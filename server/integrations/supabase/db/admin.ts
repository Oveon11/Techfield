import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ENV, assertSupabaseEnv } from "../env";

export function createSupabaseAdminClient() {
  assertSupabaseEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  return createClient(SUPABASE_ENV.url, SUPABASE_ENV.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
