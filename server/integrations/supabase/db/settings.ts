import { createSupabaseAdminClient } from "./admin";

export interface ServiceType {
  id: number;
  code: string;
  label: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
}

function mapRow(row: Record<string, unknown>): ServiceType {
  return {
    id: Number(row.id),
    code: String(row.code ?? ""),
    label: String(row.label ?? ""),
    color: String(row.color ?? "slate"),
    isActive: Boolean(row.is_active ?? true),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export async function listServiceTypes(): Promise<ServiceType[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("service_types")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(r => mapRow(r as Record<string, unknown>));
}

export async function createServiceType(code: string, label: string, color: string): Promise<ServiceType> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("service_types")
    .insert({ code, label, color })
    .select()
    .single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function updateServiceType(id: number, label: string, color: string, isActive: boolean): Promise<ServiceType> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("service_types")
    .update({ label, color, is_active: isActive })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export async function deleteServiceType(id: number): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("service_types").delete().eq("id", id);
  if (error) throw error;
}
