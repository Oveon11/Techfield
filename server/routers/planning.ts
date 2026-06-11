import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getUserAccessProfile } from "../db";
import { createSupabaseAdminClient } from "../integrations/supabase/db/admin";
import { normalizeIcalUrl, parseICSContent } from "../integrations/supabase/db/time-entries";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";

async function getScope(openId: string) {
  const profile = await getUserAccessProfile(openId);
  if (!profile) throw new TRPCError({ code: "UNAUTHORIZED", message: "Utilisateur introuvable." });
  return profile;
}

const slotSchema = z.object({
  technicianId: z.number().int().positive().nullable(),
  projectId: z.number().int().positive().nullable().optional(),
  slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  freeClientName: z.string().max(200).optional().nullable(),
  freeClientAddress: z.string().max(500).optional().nullable(),
  freeClientPhone: z.string().max(50).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).default("scheduled"),
  hasLocationChange: z.boolean().default(false),
  hasTimeChange: z.boolean().default(false),
  hasDiscount: z.boolean().default(false),
  discountNote: z.string().max(500).optional().nullable(),
  changeNote: z.string().max(500).optional().nullable(),
  prevDate: z.string().optional().nullable(),
  prevStartTime: z.string().optional().nullable(),
  prevEndTime: z.string().optional().nullable(),
});

function mapSlot(r: Record<string, unknown>) {
  return {
    id: Number(r.id),
    technicianId: r.technician_id != null ? Number(r.technician_id) : null,
    technicianName: r.technician_name as string | null,
    projectId: r.project_id ? Number(r.project_id) : null,
    projectName: r.project_name as string | null,
    projectRef: r.project_ref as string | null,
    projectAddress: r.project_address as string | null,
    projectServiceType: r.project_service_type as string | null,
    projectColor: r.project_color as string | null,
    freeClientName: r.free_client_name as string | null,
    freeClientAddress: (r.free_client_address as string | null) ?? null,
    freeClientPhone: (r.free_client_phone as string | null) ?? null,
    gcalEventUid: (r.gcal_event_uid as string | null) ?? null,
    clientName: r.client_name as string | null,
    clientPhone: r.client_phone as string | null,
    clientAddress: r.client_address as string | null,
    slotDate: r.slot_date as string,
    startTime: (r.start_time as string).slice(0, 5),
    endTime: (r.end_time as string).slice(0, 5),
    notes: r.notes as string | null,
    status: r.status as string,
    hasLocationChange: Boolean(r.has_location_change),
    hasTimeChange: Boolean(r.has_time_change),
    hasDiscount: Boolean(r.has_discount),
    discountNote: r.discount_note as string | null,
    changeNote: r.change_note as string | null,
    prevDate: r.prev_date as string | null,
    prevStartTime: r.prev_start_time ? (r.prev_start_time as string).slice(0, 5) : null,
    prevEndTime: r.prev_end_time ? (r.prev_end_time as string).slice(0, 5) : null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

// ─── Shared enrichment helper ─────────────────────────────────────────────────

async function fetchAndEnrichSlots(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  start: string,
  end: string,
) {
  const { data: raw, error } = await supabase
    .from("planning_slots")
    .select("id, technician_id, project_id, free_client_name, free_client_address, free_client_phone, gcal_event_uid, slot_date, start_time, end_time, notes, status, has_location_change, has_time_change, has_discount, discount_note, change_note, prev_date, prev_start_time, prev_end_time, created_at, updated_at")
    .gte("slot_date", start)
    .lte("slot_date", end)
    .order("slot_date")
    .order("start_time");

  if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

  const slots = (raw ?? []) as Record<string, unknown>[];
  if (slots.length === 0) return [];

  const techIds = Array.from(new Set(slots.filter(s => s.technician_id != null).map(s => s.technician_id as number)));
  const projectIds = Array.from(new Set(slots.filter(s => s.project_id).map(s => s.project_id as number)));

  const [techRes, projRes] = await Promise.all([
    supabase.from("technicians").select("id, first_name, last_name").in("id", techIds),
    projectIds.length
      ? supabase.from("projects").select("id, title, reference, service_type, color, address, phone, client_id, sites(address_line_1, city)").in("id", projectIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const techMap = Object.fromEntries(
    ((techRes.data ?? []) as Record<string, unknown>[]).map(t => [
      t.id,
      `${t.first_name} ${t.last_name}`,
    ])
  );

  const projArr = (projRes.data ?? []) as Record<string, unknown>[];
  const clientIds = Array.from(new Set(projArr.filter(p => p.client_id).map(p => p.client_id as number)));
  const clientRes = clientIds.length
    ? await supabase.from("clients").select("id, company_name, phone, billing_address, city").in("id", clientIds)
    : { data: [] as Record<string, unknown>[] };

  const clientMap = Object.fromEntries(
    ((clientRes.data ?? []) as Record<string, unknown>[]).map(c => [c.id, c])
  );
  const projMap = Object.fromEntries(
    projArr.map(p => {
      const cl = clientMap[p.client_id as number] as Record<string, unknown> | undefined;
      const site = p.sites as Record<string, unknown> | null;
      const siteAddress = site ? [site.address_line_1, site.city].filter(Boolean).join(", ") : "";
      return [p.id, {
        name: p.title,
        ref: p.reference,
        serviceType: p.service_type,
        color: (p.color as string | null) ?? null,
        address: (p.address as string | null) || siteAddress || "",
        phone: (p.phone as string | null) ?? null,
        clientName: cl?.company_name ?? null,
        clientPhone: cl?.phone ?? null,
        clientAddress: cl ? [cl.billing_address, cl.city].filter(Boolean).join(", ") : null,
      }];
    })
  );

  return slots.map(s => {
    const techName = techMap[s.technician_id as number] ?? null;
    const proj = s.project_id ? projMap[s.project_id as number] : null;
    return mapSlot({
      ...s,
      technician_name: techName,
      project_name: proj?.name ?? null,
      project_ref: proj?.ref ?? null,
      project_address: proj?.address ?? null,
      project_service_type: proj?.serviceType ?? null,
      project_color: proj?.color ?? null,
      client_name: proj?.clientName ?? null,
      client_phone: proj?.phone ?? proj?.clientPhone ?? null,
      client_address: proj?.clientAddress ?? null,
    });
  });
}

// ─── GCal → planning_slots sync ───────────────────────────────────────────────

function extractPhone(text: string | null): string | null {
  if (!text) return null;
  const m = text.match(/(?:\+33|0033|0)[1-9](?:[\s.\-]?\d{2}){4}/);
  return m ? m[0].replace(/[\s.\-]/g, " ").trim() : null;
}

function clampStartTime(startTime: string, endTime: string): { start: string; end: string } {
  const MIN = 8 * 60; // 08:00 in minutes
  const [sh, sm] = startTime.split(":").map(Number);
  const startMin = sh * 60 + sm;
  if (startMin >= MIN) return { start: startTime, end: endTime };
  const [eh, em] = endTime.split(":").map(Number);
  const endMin = eh * 60 + em;
  const duration = endMin - startMin;
  const newStart = MIN;
  const newEnd = Math.min(newStart + duration, 19 * 60);
  const pad = (n: number) => `${Math.floor(n / 60).toString().padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`;
  return { start: pad(newStart), end: pad(Math.max(newEnd, newStart + 30)) };
}

async function syncGCalToPlanning(startDate: string, endDate: string) {
  const supabase = createSupabaseAdminClient();
  type TechRow = { id: number; google_calendar_ical_url: string };
  const { data, error } = await supabase
    .from("technicians")
    .select("id, google_calendar_ical_url")
    .eq("is_active", true)
    .not("google_calendar_ical_url", "is", null);
  if (error) throw error;

  const techs = (data ?? []) as TechRow[];
  let created = 0, updated = 0;
  const errors: string[] = [];

  for (const tech of techs) {
    const url = normalizeIcalUrl(tech.google_calendar_ical_url);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) { errors.push(`tech ${tech.id}: HTTP ${res.status}`); continue; }
      const content = await res.text();
      if (!content.includes("BEGIN:VCALENDAR")) { errors.push(`tech ${tech.id}: réponse non-iCal`); continue; }

      const events = parseICSContent(content, tech.id).filter(e => e.date >= startDate && e.date <= endDate);

      for (const ev of events) {
        const phone = extractPhone(ev.description) ?? extractPhone(ev.location);
        const times = clampStartTime(ev.startTime, ev.endTime);

        const { data: existing } = await supabase
          .from("planning_slots")
          .select("id, slot_date, start_time, end_time, free_client_name, free_client_address, free_client_phone")
          .eq("technician_id", tech.id)
          .eq("gcal_event_uid", ev.uid)
          .maybeSingle();

        const row = {
          technician_id: tech.id,
          gcal_event_uid: ev.uid,
          free_client_name: ev.summary,
          free_client_address: ev.location ?? null,
          free_client_phone: phone,
          slot_date: ev.date,
          start_time: times.start + ":00",
          end_time: times.end + ":00",
          status: "scheduled",
          has_location_change: false,
          has_time_change: false,
          has_discount: false,
        };

        if (!existing) {
          await supabase.from("planning_slots").insert(row);
          created++;
        } else {
          const changed =
            existing.free_client_name !== ev.summary ||
            existing.free_client_address !== (ev.location ?? null) ||
            (existing.free_client_phone as string | null) !== phone ||
            (existing.slot_date as string) !== ev.date ||
            (existing.start_time as string).slice(0, 5) !== times.start ||
            (existing.end_time as string).slice(0, 5) !== times.end;
          if (changed) {
            await supabase.from("planning_slots").update({
              free_client_name: ev.summary,
              free_client_address: ev.location ?? null,
              free_client_phone: phone,
              slot_date: ev.date,
              start_time: times.start + ":00",
              end_time: times.end + ":00",
            }).eq("id", existing.id as number);
            updated++;
          }
        }
      }
    } catch (err) {
      errors.push(`tech ${tech.id}: ${err instanceof Error ? err.message : "erreur réseau"}`);
    }
  }

  return { created, updated, errors };
}

export const planningRouter = router({
  /** Liste les créneaux pour une semaine donnée */
  listWeek: protectedProcedure
    .input(z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      await getScope(ctx.user.openId);
      const supabase = createSupabaseAdminClient();
      const weekEnd = new Date(input.weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekEndStr = weekEnd.toISOString().slice(0, 10);
      return fetchAndEnrichSlots(supabase, input.weekStart, weekEndStr);
    }),

  /** Liste les créneaux pour une plage de dates arbitraire */
  listRange: protectedProcedure
    .input(z.object({
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }))
    .query(async ({ ctx, input }) => {
      await getScope(ctx.user.openId);
      const supabase = createSupabaseAdminClient();
      return fetchAndEnrichSlots(supabase, input.start, input.end);
    }),

  /** Liste tous les techniciens actifs */
  listTechnicians: protectedProcedure.query(async ({ ctx }) => {
    await getScope(ctx.user.openId);
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("technicians")
      .select("id, first_name, last_name, email, category")
      .eq("is_active", true)
      .order("last_name");
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return (data ?? []).map((t: Record<string, unknown>) => ({
      id: Number(t.id),
      name: `${t.first_name} ${t.last_name}`,
      firstName: t.first_name as string,
      lastName: t.last_name as string,
      email: t.email as string | null,
      category: (t.category as string) ?? "installation",
    }));
  }),

  create: adminProcedure.input(slotSchema).mutation(async ({ input }) => {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("planning_slots").insert({
      technician_id: input.technicianId,
      project_id: input.projectId ?? null,
      free_client_name: input.freeClientName ?? null,
      free_client_address: input.freeClientAddress ?? null,
      free_client_phone: input.freeClientPhone ?? null,
      slot_date: input.slotDate,
      start_time: input.startTime,
      end_time: input.endTime,
      notes: input.notes ?? null,
      status: input.status,
      has_location_change: input.hasLocationChange,
      has_time_change: input.hasTimeChange,
      has_discount: input.hasDiscount,
      discount_note: input.discountNote ?? null,
      change_note: input.changeNote ?? null,
    });
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { success: true };
  }),

  update: adminProcedure
    .input(z.object({ id: z.number().int().positive() }).merge(slotSchema.partial()))
    .mutation(async ({ input }) => {
      const supabase = createSupabaseAdminClient();
      const { id, ...rest } = input;
      const patch: Record<string, unknown> = {};
      if (rest.technicianId !== undefined) patch.technician_id = rest.technicianId;
      if (rest.projectId !== undefined) patch.project_id = rest.projectId ?? null;
      if (rest.freeClientName !== undefined) patch.free_client_name = rest.freeClientName ?? null;
      if (rest.freeClientAddress !== undefined) patch.free_client_address = rest.freeClientAddress ?? null;
      if (rest.freeClientPhone !== undefined) patch.free_client_phone = rest.freeClientPhone ?? null;
      if (rest.slotDate !== undefined) patch.slot_date = rest.slotDate;
      if (rest.startTime !== undefined) patch.start_time = rest.startTime;
      if (rest.endTime !== undefined) patch.end_time = rest.endTime;
      if (rest.notes !== undefined) patch.notes = rest.notes ?? null;
      if (rest.status !== undefined) patch.status = rest.status;
      if (rest.hasLocationChange !== undefined) patch.has_location_change = rest.hasLocationChange;
      if (rest.hasTimeChange !== undefined) patch.has_time_change = rest.hasTimeChange;
      if (rest.hasDiscount !== undefined) patch.has_discount = rest.hasDiscount;
      if (rest.discountNote !== undefined) patch.discount_note = rest.discountNote ?? null;
      if (rest.changeNote !== undefined) patch.change_note = rest.changeNote ?? null;
      if (rest.prevDate !== undefined) patch.prev_date = rest.prevDate ?? null;
      if (rest.prevStartTime !== undefined) patch.prev_start_time = rest.prevStartTime ?? null;
      if (rest.prevEndTime !== undefined) patch.prev_end_time = rest.prevEndTime ?? null;
      const { error } = await supabase.from("planning_slots").update(patch).eq("id", id);
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),

  move: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      prevDate: z.string().optional(),
      prevStartTime: z.string().optional(),
      prevEndTime: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const supabase = createSupabaseAdminClient();
      const { error } = await supabase.from("planning_slots").update({
        slot_date: input.slotDate,
        start_time: input.startTime,
        end_time: input.endTime,
        prev_date: input.prevDate ?? null,
        prev_start_time: input.prevStartTime ?? null,
        prev_end_time: input.prevEndTime ?? null,
        has_time_change: true,
      }).eq("id", input.id);
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),

  delete: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("planning_slots").delete().eq("id", input.id);
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { success: true };
  }),

  /** Slots non affectés dans les 14 prochains jours (pour bannière d'alerte admin) */
  getUnassignedUpcoming: adminProcedure.query(async () => {
    const supabase = createSupabaseAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("planning_slots")
      .select("id, slot_date, start_time, end_time, free_client_name, project_id")
      .is("technician_id", null)
      .gte("slot_date", today)
      .lte("slot_date", in14)
      .order("slot_date");
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return (data ?? []).map((s: Record<string, unknown>) => ({
      id: Number(s.id),
      slotDate: s.slot_date as string,
      startTime: (s.start_time as string).slice(0, 5),
      endTime: (s.end_time as string).slice(0, 5),
      label: (s.free_client_name as string | null) ?? null,
      projectId: s.project_id ? Number(s.project_id) : null,
    }));
  }),

  /** ID technicien du user connecté (null si admin/client) */
  getMyTechnicianId: protectedProcedure.query(async({ctx})=>{
    const supabase = createSupabaseAdminClient();
    const {data} = await supabase
      .from("technician_profiles")
      .select("technician_id")
      .eq("user_id", ctx.user.openId)
      .maybeSingle();
    return {technicianId: data?.technician_id ? Number(data.technician_id) : null};
  }),

  search: protectedProcedure.input(z.object({q: z.string().min(1).max(200)})).query(async({ctx,input})=>{
    await getScope(ctx.user.openId);
    const supabase = createSupabaseAdminClient();
    const q = input.q.trim();
    if(!q) return [];
    const likeQ = `%${q}%`;

    const [{data:projMatches},{data:clientMatches}] = await Promise.all([
      supabase.from("projects").select("id").ilike("title",likeQ).limit(100),
      supabase.from("clients").select("id,company_name").ilike("company_name",likeQ).limit(50),
    ]);
    let projIdsFromClients:number[]=[];
    if((clientMatches??[]).length>0){
      const cIds=(clientMatches!).map((c:Record<string,unknown>)=>c.id as number);
      const {data:cp}=await supabase.from("projects").select("id").in("client_id",cIds).limit(200);
      projIdsFromClients=(cp??[]).map((p:Record<string,unknown>)=>p.id as number);
    }
    const {data:techMatches}=await supabase.from("technicians").select("id").or(`first_name.ilike.${likeQ},last_name.ilike.${likeQ}`).limit(20);
    const allProjIds=Array.from(new Set((projMatches??[]).map((p:Record<string,unknown>)=>p.id as number).concat(projIdsFromClients)));
    const allTechIds=(techMatches??[]).map((t:Record<string,unknown>)=>t.id as number);

    const orParts:string[]=[];
    orParts.push(`free_client_name.ilike.${likeQ}`);
    if(allProjIds.length>0) orParts.push(`project_id.in.(${allProjIds.join(",")})`);
    if(allTechIds.length>0) orParts.push(`technician_id.in.(${allTechIds.join(",")})`);

    const {data:raw,error}=await supabase
      .from("planning_slots")
      .select("id,technician_id,project_id,free_client_name,free_client_address,free_client_phone,gcal_event_uid,slot_date,start_time,end_time,notes,status,has_location_change,has_time_change,has_discount,discount_note,change_note,prev_date,prev_start_time,prev_end_time,created_at,updated_at")
      .or(orParts.join(","))
      .order("slot_date",{ascending:false})
      .limit(60);
    if(error) throw new TRPCError({code:"INTERNAL_SERVER_ERROR",message:error.message});
    if(!raw?.length) return [];
    const slots=(raw as Record<string,unknown>[]);
    const techIds=Array.from(new Set(slots.filter(s=>s.technician_id!=null).map(s=>s.technician_id as number)));
    const projectIds=Array.from(new Set(slots.filter(s=>s.project_id).map(s=>s.project_id as number)));
    const [techRes,projRes]=await Promise.all([
      techIds.length?supabase.from("technicians").select("id,first_name,last_name").in("id",techIds):{data:[]},
      projectIds.length?supabase.from("projects").select("id,title,reference,service_type,color,address,phone,client_id,sites(address_line_1,city)").in("id",projectIds):{data:[]},
    ]);
    const techMap=Object.fromEntries(((techRes.data??[]) as Record<string,unknown>[]).map(t=>[t.id,`${t.first_name} ${t.last_name}`]));
    const projArr=(projRes.data??[]) as Record<string,unknown>[];
    const clientIds=Array.from(new Set(projArr.filter(p=>p.client_id).map(p=>p.client_id as number)));
    const clientRes=clientIds.length?await supabase.from("clients").select("id,company_name,phone,billing_address,city").in("id",clientIds):{data:[]};
    const clientMap=Object.fromEntries(((clientRes.data??[]) as Record<string,unknown>[]).map(c=>[c.id,c]));
    const projMap=Object.fromEntries(projArr.map(p=>{
      const cl=clientMap[p.client_id as number] as Record<string,unknown>|undefined;
      const site=p.sites as Record<string,unknown>|null;
      const siteAddress=site?[site.address_line_1,site.city].filter(Boolean).join(", "):"";
      return [p.id,{name:p.title,ref:p.reference,serviceType:p.service_type,color:(p.color as string|null)??null,address:(p.address as string|null)||siteAddress||"",phone:(p.phone as string|null)??null,clientName:cl?.company_name??null,clientPhone:cl?.phone??null,clientAddress:cl?[cl.billing_address,cl.city].filter(Boolean).join(", "):null}];
    }));
    return slots.map(s=>{
      const techName=techMap[s.technician_id as number]??null;
      const proj=s.project_id?projMap[s.project_id as number]:null;
      return mapSlot({...s,technician_name:techName,project_name:proj?.name??null,project_ref:proj?.ref??null,project_address:proj?.address??null,project_service_type:proj?.serviceType??null,project_color:proj?.color??null,client_name:proj?.clientName??null,client_phone:proj?.phone??proj?.clientPhone??null,client_address:proj?.clientAddress??null});
    });
  }),

  gcalSync: adminProcedure
    .input(z.object({
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }))
    .mutation(async ({ input }) => {
      try {
        return await syncGCalToPlanning(input.startDate, input.endDate);
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err instanceof Error ? err.message : "Erreur sync GCal." });
      }
    }),
});
