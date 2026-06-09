import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getUserAccessProfile } from "../db";
import { createSupabaseAdminClient } from "../integrations/supabase/db/admin";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";

async function getScope(openId: string) {
  const profile = await getUserAccessProfile(openId);
  if (!profile) throw new TRPCError({ code: "UNAUTHORIZED", message: "Utilisateur introuvable." });
  return profile;
}

const slotSchema = z.object({
  technicianId: z.number().int().positive(),
  projectId: z.number().int().positive().nullable().optional(),
  slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  freeClientName: z.string().max(200).optional().nullable(),
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
    technicianId: Number(r.technician_id),
    technicianName: r.technician_name as string | null,
    projectId: r.project_id ? Number(r.project_id) : null,
    projectName: r.project_name as string | null,
    projectRef: r.project_ref as string | null,
    projectAddress: r.project_address as string | null,
    projectServiceType: r.project_service_type as string | null,
    projectColor: r.project_color as string | null,
    freeClientName: r.free_client_name as string | null,
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
    .select("id, technician_id, project_id, free_client_name, slot_date, start_time, end_time, notes, status, has_location_change, has_time_change, has_discount, discount_note, change_note, prev_date, prev_start_time, prev_end_time, created_at, updated_at")
    .gte("slot_date", start)
    .lte("slot_date", end)
    .order("slot_date")
    .order("start_time");

  if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

  const slots = (raw ?? []) as Record<string, unknown>[];
  if (slots.length === 0) return [];

  const techIds = Array.from(new Set(slots.map(s => s.technician_id as number)));
  const projectIds = Array.from(new Set(slots.filter(s => s.project_id).map(s => s.project_id as number)));

  const [techRes, projRes] = await Promise.all([
    supabase.from("technicians").select("id, first_name, last_name").in("id", techIds),
    projectIds.length
      ? supabase.from("projects").select("id, title, reference, service_type, color, client_id, sites(address_line_1, city)").in("id", projectIds)
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
      return [p.id, {
        name: p.title,
        ref: p.reference,
        serviceType: p.service_type,
        color: (p.color as string | null) ?? null,
        address: site ? [site.address_line_1, site.city].filter(Boolean).join(", ") : "",
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
      client_phone: proj?.clientPhone ?? null,
      client_address: proj?.clientAddress ?? null,
    });
  });
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
      .select("id, first_name, last_name, email")
      .eq("is_active", true)
      .order("last_name");
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return (data ?? []).map((t: Record<string, unknown>) => ({
      id: Number(t.id),
      name: `${t.first_name} ${t.last_name}`,
      firstName: t.first_name as string,
      lastName: t.last_name as string,
      email: t.email as string | null,
    }));
  }),

  create: adminProcedure.input(slotSchema).mutation(async ({ input }) => {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("planning_slots").insert({
      technician_id: input.technicianId,
      project_id: input.projectId ?? null,
      free_client_name: input.freeClientName ?? null,
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
});
