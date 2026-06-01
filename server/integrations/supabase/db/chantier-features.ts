import { createSupabaseAdminClient } from "./admin";

type AccessRole = "admin" | "technicien" | "client";

type AccessScope = {
  user: {
    id: number;
    role: AccessRole;
  };
  technicianProfile: {
    id: number;
  } | null;
  clientContactProfile: {
    clientId: number;
  } | null;
};

export type JournalEntryType = "etape" | "blocage" | "livraison" | "contact_client" | "note";
export type MediaType = "photo" | "video";
export type DocumentCategory = "rapport" | "photo" | "contrat" | "bon_intervention" | "plan" | "autre";

const MEDIA_BUCKET = "techfield-media";
const DOCUMENT_BUCKET = "techfield-documents";
const SIGNED_URL_TTL = 60 * 60; // 1 hour

// ============================================================
// Helpers d'accès chantier
// ============================================================

async function assertProjectAccess(scope: AccessScope, projectId: number): Promise<void> {
  if (scope.user.role === "admin") {
    return;
  }

  const supabase = createSupabaseAdminClient();

  if (scope.user.role === "technicien" && scope.technicianProfile) {
    const { data, error } = await supabase
      .from("project_assignments")
      .select("id")
      .eq("project_id", projectId)
      .eq("technician_id", scope.technicianProfile.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new Error("Accès refusé : technicien non assigné à ce chantier.");
    }
    return;
  }

  if (scope.user.role === "client" && scope.clientContactProfile) {
    const { data, error } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("client_id", scope.clientContactProfile.clientId)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new Error("Accès refusé : chantier non rattaché à ce client.");
    }
    return;
  }

  throw new Error("Accès refusé.");
}

function sanitizeFileName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 200);
}

function buildStorageKey(projectId: number, fileName: string, prefix: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `projects/${projectId}/${prefix}/${ts}_${rand}_${sanitizeFileName(fileName)}`;
}

async function fetchUserNameMap(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userIds: number[],
): Promise<Map<number, string>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await supabase.from("users").select("id, name").in("id", userIds);
  if (error) throw error;
  const map = new Map<number, string>();
  for (const u of (data ?? []) as Record<string, unknown>[]) {
    map.set(Number(u.id), String(u.name ?? ""));
  }
  return map;
}

function uniqueIds(rows: Record<string, unknown>[], field: string): number[] {
  const seen = new Map<number, true>();
  for (const r of rows) {
    if (r[field] != null) seen.set(Number(r[field]), true);
  }
  return Array.from(seen.keys());
}

// ============================================================
// Journal d'étapes
// ============================================================

function mapJournalRow(row: Record<string, unknown>) {
  const author = (row.users as Record<string, unknown> | null | undefined) ?? null;
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    entryType: ((row.entry_type as JournalEntryType | undefined) ?? "etape") as JournalEntryType,
    title: (row.title as string | null | undefined) ?? null,
    content: String(row.content ?? ""),
    occurredAt: row.occurred_at ? new Date(String(row.occurred_at)).toISOString() : null,
    pinned: Boolean(row.pinned ?? false),
    createdByUserId: row.created_by_user_id == null ? null : Number(row.created_by_user_id),
    createdByName: author ? String(author.name ?? "") : "",
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : null,
  };
}

export async function listProjectJournalEntries(scope: AccessScope, projectId: number) {
  await assertProjectAccess(scope, projectId);
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("project_journal_entries")
    .select("id, project_id, entry_type, title, content, occurred_at, pinned, created_by_user_id, created_at, updated_at")
    .eq("project_id", projectId)
    .order("pinned", { ascending: false })
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  const userMap = await fetchUserNameMap(supabase, uniqueIds(rows, "created_by_user_id"));
  return rows.map((row) => {
    const uid = row.created_by_user_id == null ? null : Number(row.created_by_user_id);
    return mapJournalRow({ ...row, users: uid !== null ? { name: userMap.get(uid) ?? "" } : null });
  });
}

type CreateJournalInput = {
  projectId: number;
  entryType: JournalEntryType;
  title: string | null;
  content: string;
  occurredAt: string | null;
};

export async function createProjectJournalEntry(scope: AccessScope, input: CreateJournalInput) {
  await assertProjectAccess(scope, input.projectId);
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("project_journal_entries")
    .insert({
      project_id: input.projectId,
      entry_type: input.entryType,
      title: input.title,
      content: input.content,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      created_by_user_id: scope.user.id,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: Number((data as Record<string, unknown>).id) };
}

type UpdateJournalInput = {
  id: number;
  entryType: JournalEntryType;
  title: string | null;
  content: string;
  occurredAt: string | null;
};

export async function updateProjectJournalEntry(scope: AccessScope, input: UpdateJournalInput) {
  const supabase = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("project_journal_entries")
    .select("id, project_id, created_by_user_id")
    .eq("id", input.id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new Error("Entrée de journal introuvable.");

  const row = existing as Record<string, unknown>;
  await assertProjectAccess(scope, Number(row.project_id));

  if (scope.user.role === "technicien" && Number(row.created_by_user_id) !== scope.user.id) {
    throw new Error("Seul l'auteur peut modifier son entrée.");
  }

  const { error } = await supabase
    .from("project_journal_entries")
    .update({
      entry_type: input.entryType,
      title: input.title,
      content: input.content,
      occurred_at: input.occurredAt ?? undefined,
    })
    .eq("id", input.id);

  if (error) throw error;
  return { ok: true as const };
}

export async function deleteProjectJournalEntry(scope: AccessScope, entryId: number) {
  const supabase = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("project_journal_entries")
    .select("id, project_id, created_by_user_id")
    .eq("id", entryId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new Error("Entrée de journal introuvable.");

  const row = existing as Record<string, unknown>;
  await assertProjectAccess(scope, Number(row.project_id));

  if (scope.user.role === "technicien" && Number(row.created_by_user_id) !== scope.user.id) {
    throw new Error("Seul l'auteur peut supprimer son entrée.");
  }

  const { error } = await supabase
    .from("project_journal_entries")
    .delete()
    .eq("id", entryId);

  if (error) throw error;
  return { ok: true as const };
}

export async function togglePinJournalEntry(scope: AccessScope, entryId: number) {
  const supabase = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("project_journal_entries")
    .select("id, project_id, pinned")
    .eq("id", entryId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new Error("Entrée de journal introuvable.");

  const row = existing as Record<string, unknown>;
  await assertProjectAccess(scope, Number(row.project_id));

  const newPinned = !Boolean(row.pinned ?? false);

  const { error } = await supabase
    .from("project_journal_entries")
    .update({ pinned: newPinned })
    .eq("id", entryId);

  if (error) throw error;
  return { ok: true as const, pinned: newPinned };
}

export async function listAllJournalEntries(scope: AccessScope) {
  if (scope.user.role === "client") return [];
  const supabase = createSupabaseAdminClient();

  let projectFilter: number[] | null = null;
  if (scope.user.role === "technicien" && scope.technicianProfile) {
    const { data: assignments } = await supabase
      .from("project_assignments")
      .select("project_id")
      .eq("technician_id", scope.technicianProfile.id);
    const projectIds = ((assignments ?? []) as Record<string, unknown>[]).map((a) => Number(a.project_id));
    if (projectIds.length === 0) return [];
    projectFilter = projectIds;
  }

  let entriesQuery = supabase
    .from("project_journal_entries")
    .select("id, project_id, entry_type, title, content, occurred_at, pinned, created_by_user_id, created_at, updated_at")
    .order("pinned", { ascending: false })
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (projectFilter) entriesQuery = entriesQuery.in("project_id", projectFilter);

  const { data, error } = await entriesQuery;
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];

  const [projectsRes, userMap] = await Promise.all([
    uniqueIds(rows, "project_id").length > 0
      ? supabase.from("projects").select("id, title, reference, service_type").in("id", uniqueIds(rows, "project_id"))
      : { data: [] as unknown[], error: null },
    fetchUserNameMap(supabase, uniqueIds(rows, "created_by_user_id")),
  ]);
  if ((projectsRes as { error: unknown }).error) throw (projectsRes as { error: unknown }).error;

  const projectMap = new Map<number, { name: string; reference: string; serviceType: string }>();
  for (const p of ((projectsRes.data ?? []) as Record<string, unknown>[])) {
    projectMap.set(Number(p.id), { name: String(p.title ?? ""), reference: String(p.reference ?? ""), serviceType: String(p.service_type ?? "autre") });
  }

  return rows.map((row) => {
    const uid = row.created_by_user_id == null ? null : Number(row.created_by_user_id);
    const enriched = { ...row, users: uid !== null ? { name: userMap.get(uid) ?? "" } : null };
    const project = projectMap.get(Number(row.project_id)) ?? null;
    return {
      ...mapJournalRow(enriched),
      projectName: project?.name ?? "",
      projectRef: project?.reference ?? "",
      projectServiceType: project?.serviceType ?? "autre",
    };
  });
}

// ============================================================
// Mémos
// ============================================================

function mapMemoRow(row: Record<string, unknown>) {
  const author = (row.users as Record<string, unknown> | null | undefined) ?? null;
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    title: (row.title as string | null | undefined) ?? null,
    content: String(row.content ?? ""),
    createdByUserId: row.created_by_user_id == null ? null : Number(row.created_by_user_id),
    createdByName: author ? String(author.name ?? "") : "",
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : null,
  };
}

export async function listProjectMemos(scope: AccessScope, projectId: number) {
  if (scope.user.role === "client") {
    // Mémos non exposés aux clients (besoin métier).
    return [];
  }
  await assertProjectAccess(scope, projectId);
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("project_memos")
    .select("id, project_id, title, content, created_by_user_id, created_at, updated_at")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  const userMap = await fetchUserNameMap(supabase, uniqueIds(rows, "created_by_user_id"));
  return rows.map((row) => {
    const uid = row.created_by_user_id == null ? null : Number(row.created_by_user_id);
    return mapMemoRow({ ...row, users: uid !== null ? { name: userMap.get(uid) ?? "" } : null });
  });
}

type CreateMemoInput = {
  projectId: number;
  title: string | null;
  content: string;
};

export async function createProjectMemo(scope: AccessScope, input: CreateMemoInput) {
  await assertProjectAccess(scope, input.projectId);
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("project_memos")
    .insert({
      project_id: input.projectId,
      title: input.title,
      content: input.content,
      created_by_user_id: scope.user.id,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: Number((data as Record<string, unknown>).id) };
}

type UpdateMemoInput = {
  id: number;
  title: string | null;
  content: string;
};

export async function updateProjectMemo(scope: AccessScope, input: UpdateMemoInput) {
  const supabase = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("project_memos")
    .select("id, project_id, created_by_user_id")
    .eq("id", input.id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new Error("Mémo introuvable.");

  const row = existing as Record<string, unknown>;
  await assertProjectAccess(scope, Number(row.project_id));

  if (scope.user.role === "technicien" && Number(row.created_by_user_id) !== scope.user.id) {
    throw new Error("Seul l'auteur peut modifier ce mémo.");
  }

  const { error } = await supabase
    .from("project_memos")
    .update({
      title: input.title,
      content: input.content,
    })
    .eq("id", input.id);

  if (error) throw error;
  return { ok: true as const };
}

export async function deleteProjectMemo(scope: AccessScope, memoId: number) {
  const supabase = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("project_memos")
    .select("id, project_id, created_by_user_id")
    .eq("id", memoId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new Error("Mémo introuvable.");

  const row = existing as Record<string, unknown>;
  await assertProjectAccess(scope, Number(row.project_id));

  if (scope.user.role === "technicien" && Number(row.created_by_user_id) !== scope.user.id) {
    throw new Error("Seul l'auteur peut supprimer ce mémo.");
  }

  const { error } = await supabase
    .from("project_memos")
    .delete()
    .eq("id", memoId);

  if (error) throw error;
  return { ok: true as const };
}

export async function listAllMemos(scope: AccessScope) {
  if (scope.user.role === "client") return [];
  const supabase = createSupabaseAdminClient();

  let projectFilter: number[] | null = null;
  if (scope.user.role === "technicien" && scope.technicianProfile) {
    const { data: assignments } = await supabase
      .from("project_assignments")
      .select("project_id")
      .eq("technician_id", scope.technicianProfile.id);
    const projectIds = ((assignments ?? []) as Record<string, unknown>[]).map((a) => Number(a.project_id));
    if (projectIds.length === 0) return [];
    projectFilter = projectIds;
  }

  let memosQuery = supabase
    .from("project_memos")
    .select("id, project_id, title, content, created_by_user_id, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (projectFilter) memosQuery = memosQuery.in("project_id", projectFilter);

  const { data, error } = await memosQuery;
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];

  const [projectsRes, userMap] = await Promise.all([
    uniqueIds(rows, "project_id").length > 0
      ? supabase.from("projects").select("id, title, reference, service_type").in("id", uniqueIds(rows, "project_id"))
      : { data: [] as unknown[], error: null },
    fetchUserNameMap(supabase, uniqueIds(rows, "created_by_user_id")),
  ]);
  if ((projectsRes as { error: unknown }).error) throw (projectsRes as { error: unknown }).error;

  const projectMap = new Map<number, { name: string; reference: string; serviceType: string }>();
  for (const p of ((projectsRes.data ?? []) as Record<string, unknown>[])) {
    projectMap.set(Number(p.id), { name: String(p.title ?? ""), reference: String(p.reference ?? ""), serviceType: String(p.service_type ?? "autre") });
  }

  return rows.map((row) => {
    const uid = row.created_by_user_id == null ? null : Number(row.created_by_user_id);
    const enriched = { ...row, users: uid !== null ? { name: userMap.get(uid) ?? "" } : null };
    const project = projectMap.get(Number(row.project_id)) ?? null;
    return {
      ...mapMemoRow(enriched),
      projectName: project?.name ?? "",
      projectRef: project?.reference ?? "",
      projectServiceType: project?.serviceType ?? "autre",
    };
  });
}

// ============================================================
// Médias (photos + petites vidéos)
// ============================================================

async function mapMediaRow(supabase: ReturnType<typeof createSupabaseAdminClient>, row: Record<string, unknown>) {
  const author = (row.users as Record<string, unknown> | null | undefined) ?? null;
  const fileKey = String(row.file_key ?? "");
  let signedUrl: string | null = null;
  if (fileKey) {
    const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(fileKey, SIGNED_URL_TTL);
    signedUrl = data?.signedUrl ?? null;
  }
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    mediaType: ((row.media_type as MediaType | undefined) ?? "photo") as MediaType,
    caption: (row.caption as string | null | undefined) ?? null,
    fileName: String(row.file_name ?? ""),
    fileKey,
    mimeType: (row.mime_type as string | null | undefined) ?? null,
    sizeBytes: row.size_bytes == null ? null : Number(row.size_bytes),
    signedUrl,
    uploadedByUserId: row.uploaded_by_user_id == null ? null : Number(row.uploaded_by_user_id),
    uploadedByName: author ? String(author.name ?? "") : "",
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
  };
}

export async function listProjectMedia(scope: AccessScope, projectId: number) {
  await assertProjectAccess(scope, projectId);
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("project_media")
    .select("id, project_id, media_type, caption, file_name, file_key, mime_type, size_bytes, uploaded_by_user_id, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  const userMap = await fetchUserNameMap(supabase, uniqueIds(rows, "uploaded_by_user_id"));
  const enriched = rows.map((row) => {
    const uid = row.uploaded_by_user_id == null ? null : Number(row.uploaded_by_user_id);
    return { ...row, users: uid !== null ? { name: userMap.get(uid) ?? "" } : null };
  });
  return Promise.all(enriched.map((row) => mapMediaRow(supabase, row)));
}

type CreateMediaUploadInput = {
  projectId: number;
  fileName: string;
  mimeType: string;
  mediaType: MediaType;
};

export async function createProjectMediaUploadUrl(scope: AccessScope, input: CreateMediaUploadInput) {
  await assertProjectAccess(scope, input.projectId);
  const supabase = createSupabaseAdminClient();

  const fileKey = buildStorageKey(input.projectId, input.fileName, input.mediaType === "video" ? "videos" : "photos");

  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUploadUrl(fileKey);

  if (error) throw error;
  if (!data) throw new Error("Impossible de créer l'URL d'upload.");

  return {
    bucket: MEDIA_BUCKET,
    fileKey,
    token: data.token,
    signedUrl: data.signedUrl,
  };
}

type RegisterMediaInput = {
  projectId: number;
  mediaType: MediaType;
  caption: string | null;
  fileName: string;
  fileKey: string;
  mimeType: string;
  sizeBytes: number | null;
};

export async function registerProjectMedia(scope: AccessScope, input: RegisterMediaInput) {
  await assertProjectAccess(scope, input.projectId);
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("project_media")
    .insert({
      project_id: input.projectId,
      media_type: input.mediaType,
      caption: input.caption,
      file_name: input.fileName,
      file_key: input.fileKey,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      uploaded_by_user_id: scope.user.id,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: Number((data as Record<string, unknown>).id) };
}

export async function deleteProjectMedia(scope: AccessScope, mediaId: number) {
  const supabase = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("project_media")
    .select("id, project_id, file_key, uploaded_by_user_id")
    .eq("id", mediaId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new Error("Média introuvable.");

  const row = existing as Record<string, unknown>;
  await assertProjectAccess(scope, Number(row.project_id));

  if (scope.user.role === "technicien" && Number(row.uploaded_by_user_id) !== scope.user.id) {
    throw new Error("Seul l'auteur peut supprimer ce média.");
  }

  const fileKey = String(row.file_key ?? "");
  if (fileKey) {
    await supabase.storage.from(MEDIA_BUCKET).remove([fileKey]);
  }

  const { error } = await supabase.from("project_media").delete().eq("id", mediaId);
  if (error) throw error;
  return { ok: true as const };
}

// ============================================================
// Documents (réutilise la table documents existante)
// ============================================================

async function mapProjectDocumentRow(supabase: ReturnType<typeof createSupabaseAdminClient>, row: Record<string, unknown>) {
  const fileKey = String(row.file_key ?? "");
  let signedUrl: string | null = null;
  if (fileKey) {
    const { data } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(fileKey, SIGNED_URL_TTL);
    signedUrl = data?.signedUrl ?? null;
  }
  const uploader = (row.users as Record<string, unknown> | null | undefined) ?? null;
  return {
    id: Number(row.id),
    projectId: row.project_id == null ? null : Number(row.project_id),
    title: String(row.title ?? ""),
    fileName: String(row.file_name ?? ""),
    fileKey,
    mimeType: (row.mime_type as string | null | undefined) ?? null,
    documentType: ((row.document_type as DocumentCategory | undefined) ?? "autre") as DocumentCategory,
    visibility: String(row.visibility ?? "interne"),
    signedUrl,
    uploadedByUserId: row.uploaded_by_user_id == null ? null : Number(row.uploaded_by_user_id),
    uploadedByName: uploader ? String(uploader.name ?? "") : "",
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
  };
}

export async function listProjectDocuments(scope: AccessScope, projectId: number) {
  await assertProjectAccess(scope, projectId);
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("documents")
    .select("id, project_id, title, file_name, file_key, mime_type, document_type, visibility, uploaded_by_user_id, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (scope.user.role === "client") {
    query = query.in("visibility", ["client", "interne"]);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Record<string, unknown>[];
  const userMap = await fetchUserNameMap(supabase, uniqueIds(rows, "uploaded_by_user_id"));
  const enriched = rows.map((row) => {
    const uid = row.uploaded_by_user_id == null ? null : Number(row.uploaded_by_user_id);
    return { ...row, users: uid !== null ? { name: userMap.get(uid) ?? "" } : null };
  });
  return Promise.all(enriched.map((row) => mapProjectDocumentRow(supabase, row)));
}

type CreateDocumentUploadInput = {
  projectId: number;
  fileName: string;
  mimeType: string;
};

export async function createProjectDocumentUploadUrl(scope: AccessScope, input: CreateDocumentUploadInput) {
  await assertProjectAccess(scope, input.projectId);
  const supabase = createSupabaseAdminClient();

  const fileKey = buildStorageKey(input.projectId, input.fileName, "documents");

  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUploadUrl(fileKey);

  if (error) throw error;
  if (!data) throw new Error("Impossible de créer l'URL d'upload.");

  return {
    bucket: DOCUMENT_BUCKET,
    fileKey,
    token: data.token,
    signedUrl: data.signedUrl,
  };
}

type RegisterDocumentInput = {
  projectId: number;
  title: string;
  documentType: DocumentCategory;
  visibility: "interne" | "client" | "restreint";
  fileName: string;
  fileKey: string;
  mimeType: string;
};

export async function registerProjectDocument(scope: AccessScope, input: RegisterDocumentInput) {
  await assertProjectAccess(scope, input.projectId);
  const supabase = createSupabaseAdminClient();

  // Récupération du client_id du chantier pour cohérence avec documents.client_id.
  const { data: projectRow, error: projectError } = await supabase
    .from("projects")
    .select("client_id, site_id")
    .eq("id", input.projectId)
    .maybeSingle();
  if (projectError) throw projectError;

  const projectRecord = (projectRow ?? {}) as Record<string, unknown>;
  const clientId = projectRecord.client_id == null ? null : Number(projectRecord.client_id);
  const siteId = projectRecord.site_id == null ? null : Number(projectRecord.site_id);

  const { data, error } = await supabase
    .from("documents")
    .insert({
      entity_type: "project",
      entity_id: input.projectId,
      project_id: input.projectId,
      client_id: clientId,
      site_id: siteId,
      uploaded_by_user_id: scope.user.id,
      title: input.title,
      file_name: input.fileName,
      file_key: input.fileKey,
      file_url: input.fileKey, // file_url contraint NOT NULL : on stocke la clé, l'app sert via signed URL.
      mime_type: input.mimeType,
      document_type: input.documentType,
      visibility: input.visibility,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: Number((data as Record<string, unknown>).id) };
}

export async function deleteProjectDocument(scope: AccessScope, documentId: number) {
  const supabase = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("documents")
    .select("id, project_id, file_key, uploaded_by_user_id")
    .eq("id", documentId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new Error("Document introuvable.");

  const row = existing as Record<string, unknown>;
  if (row.project_id == null) throw new Error("Document non rattaché à un chantier.");
  await assertProjectAccess(scope, Number(row.project_id));

  if (scope.user.role === "technicien" && Number(row.uploaded_by_user_id) !== scope.user.id) {
    throw new Error("Seul l'auteur peut supprimer ce document.");
  }

  const fileKey = String(row.file_key ?? "");
  if (fileKey) {
    await supabase.storage.from(DOCUMENT_BUCKET).remove([fileKey]);
  }

  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  if (error) throw error;
  return { ok: true as const };
}

export async function getProjectMediaSignedUrl(scope: AccessScope, mediaId: number) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("project_media")
    .select("id, project_id, file_key")
    .eq("id", mediaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Média introuvable.");
  const row = data as Record<string, unknown>;
  await assertProjectAccess(scope, Number(row.project_id));
  const fileKey = String(row.file_key ?? "");
  if (!fileKey) throw new Error("Clé fichier manquante.");
  const { data: urlData, error: urlError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(fileKey, SIGNED_URL_TTL);
  if (urlError) throw urlError;
  return { signedUrl: urlData?.signedUrl ?? null };
}

export async function getProjectDocumentSignedUrl(scope: AccessScope, documentId: number) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, project_id, file_key")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Document introuvable.");
  const row = data as Record<string, unknown>;
  if (row.project_id == null) throw new Error("Document non rattaché à un chantier.");
  await assertProjectAccess(scope, Number(row.project_id));
  const fileKey = String(row.file_key ?? "");
  if (!fileKey) throw new Error("Clé fichier manquante.");
  const { data: urlData, error: urlError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(fileKey, SIGNED_URL_TTL);
  if (urlError) throw urlError;
  return { signedUrl: urlData?.signedUrl ?? null };
}
