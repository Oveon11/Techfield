import { nanoid } from "nanoid";
import { createSupabaseAdminClient } from "./admin";

type AccessRole = "admin" | "technicien" | "client";

type AccessScope = {
  user: { id: number; role: AccessRole };
  technicianProfile: { id: number } | null;
  clientContactProfile: { clientId: number } | null;
};

const MEDIA_BUCKET = "techfield-media";
const SIGNED_URL_TTL = 60 * 60; // 1h

function sanitizeFileName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 200);
}

function buildInterventionStorageKey(interventionId: number, fileName: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `interventions/${interventionId}/photos/${ts}_${rand}_${sanitizeFileName(fileName)}`;
}

// ============================================================
// Contrôle d'accès
// ============================================================

async function assertInterventionAccess(scope: AccessScope, interventionId: number): Promise<void> {
  if (scope.user.role === "admin") return;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("interventions")
    .select("id, technician_id, client_id")
    .eq("id", interventionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Intervention introuvable.");

  const row = data as Record<string, unknown>;

  if (scope.user.role === "technicien" && scope.technicianProfile) {
    if (row.technician_id !== null && Number(row.technician_id) !== scope.technicianProfile.id) {
      throw new Error("Accès refusé : intervention non assignée à ce technicien.");
    }
    return;
  }

  if (scope.user.role === "client" && scope.clientContactProfile) {
    if (Number(row.client_id) !== scope.clientContactProfile.clientId) {
      throw new Error("Accès refusé : intervention non rattachée à ce client.");
    }
    return;
  }

  throw new Error("Accès refusé.");
}

// ============================================================
// Liste des interventions d'un chantier
// ============================================================

function mapInterventionListRow(row: Record<string, unknown>) {
  const tech = (row.technicians as Record<string, unknown> | null | undefined) ?? null;
  const firstName = (tech?.first_name as string | undefined) ?? "";
  const lastName = (tech?.last_name as string | undefined) ?? "";
  return {
    id: Number(row.id),
    reference: String(row.reference ?? ""),
    title: String(row.title ?? ""),
    interventionType: String(row.intervention_type ?? "maintenance"),
    priority: String(row.priority ?? "normale"),
    status: String(row.status ?? "planifiee"),
    technicianId: row.technician_id == null ? null : Number(row.technician_id),
    technicianName: `${firstName} ${lastName}`.trim() || null,
    scheduledStartAt: (row.scheduled_start_at as string | null | undefined) ?? null,
    scheduledEndAt: (row.scheduled_end_at as string | null | undefined) ?? null,
    completedAt: (row.completed_at as string | null | undefined) ?? null,
    description: (row.description as string | null | undefined) ?? null,
    report: (row.report as string | null | undefined) ?? null,
    internalNotes: (row.internal_notes as string | null | undefined) ?? null,
    createdAt: (row.created_at as string | null | undefined) ?? null,
  };
}

export async function listInterventionsByProject(scope: AccessScope, projectId: number) {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("interventions")
    .select(
      "id, reference, title, intervention_type, priority, status, technician_id, scheduled_start_at, scheduled_end_at, completed_at, description, report, internal_notes, created_at, technicians(first_name, last_name)"
    )
    .eq("project_id", projectId)
    .order("scheduled_start_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (scope.user.role === "client" && scope.clientContactProfile) {
    query = query.eq("client_id", scope.clientContactProfile.clientId);
  } else if (scope.user.role === "technicien" && scope.technicianProfile) {
    query = query.eq("technician_id", scope.technicianProfile.id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row: unknown) => mapInterventionListRow(row as Record<string, unknown>));
}

// ============================================================
// Mise à jour d'une intervention (admin)
// ============================================================

type UpdateInterventionInput = {
  interventionId: number;
  title: string;
  interventionType: string;
  priority: string;
  technicianId?: number | null;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  description?: string | null;
};

export async function updateIntervention(scope: AccessScope, input: UpdateInterventionInput) {
  if (scope.user.role !== "admin") {
    throw new Error("Seul un administrateur peut modifier une intervention.");
  }
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("interventions")
    .update({
      title: input.title,
      intervention_type: input.interventionType,
      priority: input.priority,
      technician_id: input.technicianId ?? null,
      scheduled_start_at: input.scheduledStartAt ?? null,
      scheduled_end_at: input.scheduledEndAt ?? null,
      description: input.description ?? null,
    })
    .eq("id", input.interventionId);
  if (error) throw error;
  return { ok: true as const };
}

// ============================================================
// Compte-rendu (admin ou technicien assigné)
// ============================================================

type UpdateInterventionReportInput = {
  interventionId: number;
  report?: string | null;
  internalNotes?: string | null;
};

export async function updateInterventionReport(scope: AccessScope, input: UpdateInterventionReportInput) {
  await assertInterventionAccess(scope, input.interventionId);
  if (scope.user.role === "client") {
    throw new Error("Le client ne peut pas modifier le compte-rendu.");
  }
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("interventions")
    .update({
      report: input.report ?? null,
      internal_notes: input.internalNotes ?? null,
    })
    .eq("id", input.interventionId);
  if (error) throw error;
  return { ok: true as const };
}

// ============================================================
// Médias du compte-rendu
// ============================================================

async function mapInterventionMediaRow(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  row: Record<string, unknown>
) {
  const fileKey = String(row.file_key ?? "");
  let signedUrl: string | null = null;
  if (fileKey) {
    const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(fileKey, SIGNED_URL_TTL);
    signedUrl = data?.signedUrl ?? null;
  }
  const uploader = (row.users as Record<string, unknown> | null | undefined) ?? null;
  return {
    id: Number(row.id),
    interventionId: Number(row.intervention_id),
    caption: (row.caption as string | null | undefined) ?? null,
    fileName: String(row.file_name ?? ""),
    fileKey,
    mimeType: (row.mime_type as string | null | undefined) ?? null,
    sizeBytes: row.size_bytes == null ? null : Number(row.size_bytes),
    signedUrl,
    uploadedByUserId: row.uploaded_by_user_id == null ? null : Number(row.uploaded_by_user_id),
    uploadedByName: uploader ? String(uploader.name ?? "") : "",
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
  };
}

type CreateMediaUploadInput = {
  interventionId: number;
  fileName: string;
  mimeType: string;
};

export async function createInterventionMediaUploadUrl(scope: AccessScope, input: CreateMediaUploadInput) {
  await assertInterventionAccess(scope, input.interventionId);
  if (scope.user.role === "client") {
    throw new Error("Le client ne peut pas uploader des photos.");
  }
  const supabase = createSupabaseAdminClient();
  const fileKey = buildInterventionStorageKey(input.interventionId, input.fileName);
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUploadUrl(fileKey);
  if (error) throw error;
  if (!data) throw new Error("Impossible de créer l'URL d'upload.");
  return { bucket: MEDIA_BUCKET, fileKey, token: data.token, signedUrl: data.signedUrl };
}

type RegisterInterventionMediaInput = {
  interventionId: number;
  caption?: string | null;
  fileName: string;
  fileKey: string;
  mimeType: string;
  sizeBytes?: number | null;
};

export async function registerInterventionMedia(scope: AccessScope, input: RegisterInterventionMediaInput) {
  await assertInterventionAccess(scope, input.interventionId);
  if (scope.user.role === "client") {
    throw new Error("Le client ne peut pas enregistrer des médias.");
  }
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("intervention_media")
    .insert({
      intervention_id: input.interventionId,
      caption: input.caption ?? null,
      file_name: input.fileName,
      file_key: input.fileKey,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes ?? null,
      uploaded_by_user_id: scope.user.id,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: Number((data as Record<string, unknown>).id) };
}

export async function listInterventionMedia(scope: AccessScope, interventionId: number) {
  await assertInterventionAccess(scope, interventionId);
  if (scope.user.role === "client") return [];
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("intervention_media")
    .select(
      "id, intervention_id, caption, file_name, file_key, mime_type, size_bytes, uploaded_by_user_id, created_at, users:uploaded_by_user_id(name)"
    )
    .eq("intervention_id", interventionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return Promise.all(rows.map((row) => mapInterventionMediaRow(supabase, row)));
}

export async function deleteInterventionMedia(scope: AccessScope, mediaId: number) {
  const supabase = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("intervention_media")
    .select("id, intervention_id, file_key, uploaded_by_user_id")
    .eq("id", mediaId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new Error("Média introuvable.");

  const row = existing as Record<string, unknown>;
  await assertInterventionAccess(scope, Number(row.intervention_id));

  if (scope.user.role === "technicien" && Number(row.uploaded_by_user_id) !== scope.user.id) {
    throw new Error("Seul l'auteur peut supprimer ce média.");
  }

  const fileKey = String(row.file_key ?? "");
  if (fileKey) {
    await supabase.storage.from(MEDIA_BUCKET).remove([fileKey]);
  }
  const { error } = await supabase.from("intervention_media").delete().eq("id", mediaId);
  if (error) throw error;
  return { ok: true as const };
}

// ============================================================
// Création d'une intervention (admin)
// ============================================================

type CreateInterventionInput = {
  clientId: number;
  siteId?: number | null;
  projectId?: number | null;
  contractId?: number | null;
  technicianId?: number | null;
  title: string;
  description?: string | null;
  interventionType: string;
  priority: string;
  status: string;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
};

export async function createIntervention(
  scope: AccessScope,
  input: CreateInterventionInput,
  createdByUserId: number
) {
  if (scope.user.role !== "admin") {
    throw new Error("Seul un administrateur peut créer une intervention.");
  }
  const reference = `INT-${nanoid(8).toUpperCase()}`;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("interventions")
    .insert({
      reference,
      client_id: input.clientId,
      site_id: input.siteId ?? null,
      project_id: input.projectId ?? null,
      contract_id: input.contractId ?? null,
      technician_id: input.technicianId ?? null,
      title: input.title,
      description: input.description ?? null,
      intervention_type: input.interventionType,
      priority: input.priority,
      status: input.status,
      scheduled_start_at: input.scheduledStartAt ?? null,
      scheduled_end_at: input.scheduledEndAt ?? null,
      created_by_user_id: createdByUserId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: Number((data as Record<string, unknown>).id), reference };
}

// ============================================================
// Mise à jour du statut (admin ou technicien assigné)
// ============================================================

type UpdateInterventionStatusInput = {
  interventionId: number;
  status: string;
  report?: string | null;
};

export async function updateInterventionStatus(
  scope: AccessScope,
  input: UpdateInterventionStatusInput
) {
  await assertInterventionAccess(scope, input.interventionId);
  if (scope.user.role === "client") {
    throw new Error("Le client ne peut pas modifier l'intervention.");
  }
  const supabase = createSupabaseAdminClient();
  const updateData: Record<string, unknown> = { status: input.status };
  if (input.report !== undefined) updateData.report = input.report ?? null;
  if (input.status === "en_cours") updateData.started_at = new Date().toISOString();
  if (input.status === "terminee") updateData.completed_at = new Date().toISOString();
  const { error } = await supabase
    .from("interventions")
    .update(updateData)
    .eq("id", input.interventionId);
  if (error) throw error;
  return { ok: true as const };
}
