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

export async function listTechniciansForAdmin(scope: AccessScope) {
  if (scope.user.role !== "admin") return [];
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("technicians")
    .select("id, first_name, last_name, employee_code")
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
    };
  });
}
