import { createSupabaseAdminClient } from "./admin";

type AccessRole = "admin" | "technicien" | "client";
type AccessScope = {
  user: { id: number; role: AccessRole };
  technicianProfile: { id: number } | null;
  clientContactProfile: { clientId: number } | null;
};

export type TimeEntryType = "travail" | "conge" | "cfa" | "maladie" | "absence";

export interface TimeEntryInput {
  technicianId: number;
  date: string;
  entryType: TimeEntryType;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number;
  projectId: number | null;
  panier: boolean;
  note: string | null;
}

function mapRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    technicianId: Number(row.technician_id),
    date: String(row.date ?? ""),
    entryType: (row.entry_type as TimeEntryType) ?? "travail",
    startTime: (row.start_time as string | null) ?? null,
    endTime: (row.end_time as string | null) ?? null,
    breakMinutes: Number(row.break_minutes ?? 60),
    projectId: row.project_id != null ? Number(row.project_id) : null,
    panier: Boolean(row.panier ?? true),
    note: (row.note as string | null) ?? null,
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : null,
  };
}

export async function listTimeEntries(scope: AccessScope, technicianId: number, year: number, month: number) {
  if (scope.user.role === "client") return [];
  if (scope.user.role === "technicien" && scope.technicianProfile?.id !== technicianId) return [];

  const supabase = createSupabaseAdminClient();
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .eq("technician_id", technicianId)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(r => mapRow(r as Record<string, unknown>));
}

export async function createTimeEntry(scope: AccessScope, input: TimeEntryInput) {
  if (scope.user.role === "client") throw new Error("Accès refusé.");
  if (scope.user.role === "technicien" && scope.technicianProfile?.id !== input.technicianId) throw new Error("Accès refusé.");

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("time_entries")
    .upsert({
      technician_id: input.technicianId,
      date: input.date,
      entry_type: input.entryType,
      start_time: input.startTime,
      end_time: input.endTime,
      break_minutes: input.breakMinutes,
      project_id: input.projectId,
      panier: input.panier,
      note: input.note,
    }, { onConflict: "technician_id,date,entry_type" })
    .select()
    .single();

  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function deleteTimeEntry(scope: AccessScope, id: number) {
  if (scope.user.role === "client") throw new Error("Accès refusé.");

  const supabase = createSupabaseAdminClient();

  if (scope.user.role === "technicien" && scope.technicianProfile) {
    const { data } = await supabase.from("time_entries").select("technician_id").eq("id", id).single();
    if (!data || Number((data as Record<string, unknown>).technician_id) !== scope.technicianProfile.id) throw new Error("Accès refusé.");
  }

  const { error } = await supabase.from("time_entries").delete().eq("id", id);
  if (error) throw error;
}

export async function listTimeEntriesRange(scope: AccessScope, technicianId: number, startDate: string, endDate: string) {
  if (scope.user.role === "client") return [];
  if (scope.user.role === "technicien" && scope.technicianProfile?.id !== technicianId) return [];
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .eq("technician_id", technicianId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(r => mapRow(r as Record<string, unknown>));
}

export async function listTechniciansForAdmin(scope: AccessScope) {
  if (scope.user.role !== "admin") return [];
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("technicians")
    .select("id, first_name, last_name, employee_code, contract_hours")
    .eq("is_active", true)
    .order("last_name");
  if (error) throw error;
  return (data ?? []).map(r => {
    const row = r as Record<string, unknown>;
    return {
      id: Number(row.id),
      firstName: String(row.first_name ?? ""),
      lastName: String(row.last_name ?? ""),
      employeeCode: (row.employee_code as string | null) ?? null,
      contractHours: (row.contract_hours as string | null) ?? "39h",
    };
  });
}

// ── Leave requests ────────────────────────────────────────────────────────────

function countLeaveDays(startDate: string, endDate: string): number {
  const s = new Date(startDate + "T12:00:00");
  const e = new Date(endDate + "T12:00:00");
  let n = 0;
  const cur = new Date(s);
  while (cur <= e) {
    if (cur.getDay() !== 0) n++; // exclude Sundays only
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

function mapLeaveRow(r: Record<string, unknown>) {
  const t = r.technicians as Record<string, unknown> | undefined;
  return {
    id: Number(r.id),
    technicianId: Number(r.technician_id),
    technicianName: t ? `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() : "",
    employeeCode: (t?.employee_code as string | null) ?? null,
    contractHours: (t?.contract_hours as string | null) ?? "39h",
    startDate: String(r.start_date ?? ""),
    endDate: String(r.end_date ?? ""),
    days: countLeaveDays(String(r.start_date ?? ""), String(r.end_date ?? "")),
    status: (r.status as "pending" | "approved" | "refused"),
    comment: (r.comment as string | null) ?? null,
    adminComment: (r.admin_comment as string | null) ?? null,
    approvedAt: (r.approved_at as string | null) ?? null,
    createdAt: String(r.created_at ?? ""),
  };
}

export async function createLeaveRequest(
  scope: AccessScope,
  input: { startDate: string; endDate: string; comment: string | null },
) {
  if (scope.user.role === "client") throw new Error("Accès refusé.");
  if (!scope.technicianProfile?.id && scope.user.role !== "admin")
    throw new Error("Profil technicien introuvable.");

  const technicianId = scope.technicianProfile?.id;
  if (!technicianId) throw new Error("Profil technicien introuvable.");

  // start_date must be >= today + 31 days
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 31);
  minDate.setHours(0, 0, 0, 0);
  const startD = new Date(input.startDate + "T00:00:00");
  if (startD < minDate) {
    throw new Error(
      `La demande doit être faite au moins 31 jours à l'avance (date minimum : ${minDate.toLocaleDateString("fr-FR")}).`,
    );
  }
  if (input.endDate < input.startDate) throw new Error("La date de fin doit être après la date de début.");

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .insert({
      technician_id: technicianId,
      start_date: input.startDate,
      end_date: input.endDate,
      comment: input.comment,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { success: true, id: Number((data as Record<string, unknown>).id) };
}

export async function listLeaveRequests(
  scope: AccessScope,
  filters?: { status?: "pending" | "approved" | "refused"; technicianId?: number },
) {
  if (scope.user.role === "client") return [];
  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("leave_requests")
    .select("*, technicians(first_name, last_name, employee_code, contract_hours)")
    .order("created_at", { ascending: false });

  if (scope.user.role === "technicien") {
    if (!scope.technicianProfile?.id) return [];
    q = q.eq("technician_id", scope.technicianProfile.id) as typeof q;
  } else if (filters?.technicianId) {
    q = q.eq("technician_id", filters.technicianId) as typeof q;
  }
  if (filters?.status) q = q.eq("status", filters.status) as typeof q;

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(r => mapLeaveRow(r as Record<string, unknown>));
}

export async function approveLeaveRequest(
  scope: AccessScope,
  id: number,
  adminComment: string | null,
) {
  if (scope.user.role !== "admin") throw new Error("Accès refusé.");
  const supabase = createSupabaseAdminClient();

  const { data: req, error: rErr } = await supabase
    .from("leave_requests")
    .select("id, technician_id, start_date, end_date, status")
    .eq("id", id)
    .single();
  if (rErr || !req) throw new Error("Demande introuvable.");
  const r = req as Record<string, unknown>;
  if (r.status !== "pending") throw new Error("Cette demande n'est plus en attente.");

  const { error } = await supabase
    .from("leave_requests")
    .update({
      status: "approved",
      admin_comment: adminComment,
      approved_by_user_id: scope.user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;

  // Create conge time entries for each Mon–Sat in the range
  const start = new Date(String(r.start_date) + "T00:00:00");
  const end = new Date(String(r.end_date) + "T00:00:00");
  const entries: Record<string, unknown>[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    if (cur.getDay() !== 0) {
      entries.push({
        technician_id: r.technician_id,
        date: cur.toISOString().slice(0, 10),
        entry_type: "conge",
        start_time: null,
        end_time: null,
        break_minutes: 0,
        project_id: null,
        panier: false,
        note: adminComment ? `Congé approuvé — ${adminComment}` : "Congé approuvé",
      });
    }
    cur.setDate(cur.getDate() + 1);
  }
  if (entries.length > 0) {
    const { error: eErr } = await supabase
      .from("time_entries")
      .upsert(entries as Parameters<ReturnType<typeof supabase.from>["upsert"]>[0], {
        onConflict: "technician_id,date,entry_type",
      });
    if (eErr) throw eErr;
  }
  return { success: true, daysCreated: entries.length };
}

export async function refuseLeaveRequest(
  scope: AccessScope,
  id: number,
  adminComment: string | null,
) {
  if (scope.user.role !== "admin") throw new Error("Accès refusé.");
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("leave_requests")
    .update({ status: "refused", admin_comment: adminComment, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  return { success: true };
}

export async function updateLeaveRequestDates(
  scope: AccessScope,
  id: number,
  startDate: string,
  endDate: string,
) {
  if (scope.user.role !== "admin") throw new Error("Accès refusé.");
  if (endDate < startDate) throw new Error("La date de fin doit être après la date de début.");
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("leave_requests")
    .update({ start_date: startDate, end_date: endDate, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  return { success: true };
}

export async function cancelLeaveRequest(scope: AccessScope, id: number) {
  const supabase = createSupabaseAdminClient();
  const { data: req, error: rErr } = await supabase
    .from("leave_requests")
    .select("id, technician_id, status")
    .eq("id", id)
    .single();
  if (rErr || !req) throw new Error("Demande introuvable.");
  const r = req as Record<string, unknown>;
  if (r.status !== "pending") throw new Error("Seules les demandes en attente peuvent être annulées.");
  if (scope.user.role === "technicien" && scope.technicianProfile?.id !== Number(r.technician_id))
    throw new Error("Accès refusé.");
  const { error } = await supabase.from("leave_requests").delete().eq("id", id);
  if (error) throw error;
  return { success: true };
}

export async function listLeaveRequestsForExport(
  scope: AccessScope,
  startDate: string,
  endDate: string,
  technicianIds?: number[],
) {
  if (scope.user.role !== "admin") throw new Error("Accès refusé.");
  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("leave_requests")
    .select("*, technicians(first_name, last_name, employee_code, contract_hours)")
    .gte("start_date", startDate)
    .lte("end_date", endDate)
    .order("technician_id")
    .order("start_date");
  if (technicianIds && technicianIds.length > 0)
    q = q.in("technician_id", technicianIds) as typeof q;
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(r => mapLeaveRow(r as Record<string, unknown>));
}

export async function listApprovedLeavesForPlanning(
  scope: AccessScope,
  startDate: string,
  endDate: string,
) {
  if (scope.user.role === "client") return [];
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .select("technician_id, start_date, end_date")
    .eq("status", "approved")
    .lte("start_date", endDate)
    .gte("end_date", startDate);
  if (error) throw error;
  return (data ?? []).map(r => ({
    technicianId: Number((r as Record<string, unknown>).technician_id),
    startDate: String((r as Record<string, unknown>).start_date),
    endDate: String((r as Record<string, unknown>).end_date),
  }));
}

export async function updateTechnicianContractHours(scope: AccessScope, technicianId: number, contractHours: "35h" | "39h") {
  if (scope.user.role !== "admin") throw new Error("Accès refusé.");
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("technicians")
    .update({ contract_hours: contractHours })
    .eq("id", technicianId);
  if (error) throw error;
  return { success: true };
}
