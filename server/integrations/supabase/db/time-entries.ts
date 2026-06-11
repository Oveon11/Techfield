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
    .select("id, first_name, last_name, employee_code, contract_hours, google_calendar_ical_url")
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
      googleCalendarIcalUrl: (row.google_calendar_ical_url as string | null) ?? null,
    };
  });
}

export async function updateTechnicianCalendarUrl(scope: AccessScope, technicianId: number, icalUrl: string | null) {
  if (scope.user.role !== "admin") throw new Error("Accès refusé.");
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("technicians")
    .update({ google_calendar_ical_url: icalUrl })
    .eq("id", technicianId);
  if (error) throw error;
  return { success: true };
}

// ── iCal parser (server-side) ─────────────────────────────────────────────────

function unfoldLines(content: string): string[] {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const result: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && result.length > 0) {
      result[result.length - 1] += line.slice(1);
    } else {
      result.push(line);
    }
  }
  return result;
}

function parseICSDateTimeServer(value: string): { date: string; time: string } | null {
  const raw = value.includes(":") ? value.split(":").pop()! : value;
  if (/^\d{8}$/.test(raw)) {
    return { date: `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`, time: "08:00" };
  }
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` };
}

function addOneHourServer(time: string): string {
  const [h, min] = time.split(":").map(Number);
  return `${String(Math.min(h + 1, 23)).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export interface GCalEvent {
  technicianId: number;
  uid: string;
  summary: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  description: string | null;
}

export function normalizeIcalUrl(input: string): string {
  if (input.startsWith("http://") || input.startsWith("https://")) return input;
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(input)}/public/basic.ics`;
}

export function parseICSContent(content: string, technicianId: number): GCalEvent[] {
  const lines = unfoldLines(content);
  const events: GCalEvent[] = [];
  let inEvent = false;
  let cur: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") { inEvent = true; cur = {}; continue; }
    if (trimmed === "END:VEVENT") {
      inEvent = false;
      const start = cur.DTSTART ? parseICSDateTimeServer(cur.DTSTART) : null;
      const end   = cur.DTEND   ? parseICSDateTimeServer(cur.DTEND)   : null;
      if (start && end && cur.SUMMARY) {
        events.push({
          technicianId,
          uid: cur.UID ?? `${Date.now()}-${Math.random()}`,
          summary: cur.SUMMARY.replace(/\\,/g, ",").replace(/\\n/g, " ").trim(),
          date: start.date,
          startTime: start.time,
          endTime: end.time === start.time ? addOneHourServer(start.time) : end.time,
          location: cur.LOCATION ? cur.LOCATION.replace(/\\,/g, ",").replace(/\\n/g, " ").trim() : null,
          description: cur.DESCRIPTION ? cur.DESCRIPTION.replace(/\\n/g, " ").replace(/\\,/g, ",").trim() : null,
        });
      }
      continue;
    }
    if (!inEvent) continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).toUpperCase().split(";")[0];
    cur[key] = trimmed.slice(colon + 1);
  }

  return events;
}

export async function listGCalEventsForRange(
  scope: AccessScope,
  startDate: string,
  endDate: string,
): Promise<GCalEvent[]> {
  if (scope.user.role === "client") return [];
  const supabase = createSupabaseAdminClient();

  type TechRow = { id: number; google_calendar_ical_url: string };
  let q = supabase
    .from("technicians")
    .select("id, google_calendar_ical_url")
    .eq("is_active", true)
    .not("google_calendar_ical_url", "is", null);

  if (scope.user.role === "technicien" && scope.technicianProfile?.id) {
    q = q.eq("id", scope.technicianProfile.id) as typeof q;
  }

  const { data, error } = await q;
  if (error) throw error;

  // Déduplique les URLs pour ne pas fetcher plusieurs fois le même calendrier
  const seen = new Set<string>();
  const techs = (data ?? []) as TechRow[];
  const allEvents: GCalEvent[] = [];

  await Promise.all(
    techs.map(async (tech) => {
      const url = normalizeIcalUrl(tech.google_calendar_ical_url);
      if (seen.has(url)) return;
      seen.add(url);
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) {
          console.warn(`[GCal] fetch échoué pour tech ${tech.id}: HTTP ${res.status} ${url}`);
          return;
        }
        const content = await res.text();
        if (!content.includes("BEGIN:VCALENDAR")) {
          console.warn(`[GCal] réponse invalide (pas un iCal) pour tech ${tech.id}: ${url}`);
          return;
        }
        const events = parseICSContent(content, tech.id);
        allEvents.push(...events.filter(e => e.date >= startDate && e.date <= endDate));
      } catch (err) {
        console.warn(`[GCal] erreur réseau pour tech ${tech.id}: ${err instanceof Error ? err.message : err}`);
      }
    }),
  );

  return allEvents.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

export async function testGCalConnection(
  scope: AccessScope,
  input: string,
): Promise<{ ok: boolean; httpStatus: number | null; error: string | null; eventCount: number; preview: string | null }> {
  if (scope.user.role !== "admin") throw new Error("Accès refusé.");
  const url = normalizeIcalUrl(input.trim());
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      return { ok: false, httpStatus: res.status, error: `HTTP ${res.status} — Le calendrier est peut-être privé. Allez dans Paramètres Google Calendar → "Rendre accessible publiquement" ou utilisez l'URL secrète iCal.`, eventCount: 0, preview: null };
    }
    const content = await res.text();
    if (!content.includes("BEGIN:VCALENDAR")) {
      return { ok: false, httpStatus: res.status, error: "La réponse n'est pas un fichier iCal valide.", eventCount: 0, preview: content.slice(0, 100) };
    }
    const events = parseICSContent(content, 0);
    return { ok: true, httpStatus: res.status, error: null, eventCount: events.length, preview: events.slice(0, 2).map(e => `${e.date} ${e.startTime} — ${e.summary}`).join("\n") };
  } catch (err) {
    return { ok: false, httpStatus: null, error: err instanceof Error ? err.message : "Erreur réseau", eventCount: 0, preview: null };
  }
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
    techSignature: (r.tech_signature as string | null) ?? null,
    adminSignature: (r.admin_signature as string | null) ?? null,
  };
}

export async function createLeaveRequest(
  scope: AccessScope,
  input: { startDate: string; endDate: string; comment: string | null; techSignature?: string | null },
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
      tech_signature: input.techSignature ?? null,
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
  adminSignature?: string | null,
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
      admin_signature: adminSignature ?? null,
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

export async function listCongeForPlanning(
  scope: AccessScope,
  startDate: string,
  endDate: string,
) {
  if (scope.user.role === "client") return [];
  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("time_entries")
    .select("technician_id, date")
    .in("entry_type", ["conge", "absence"])
    .gte("date", startDate)
    .lte("date", endDate);
  if (scope.user.role === "technicien" && scope.technicianProfile?.id) {
    q = q.eq("technician_id", scope.technicianProfile.id) as typeof q;
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(r => ({
    technicianId: Number((r as Record<string, unknown>).technician_id),
    date: String((r as Record<string, unknown>).date),
  }));
}
