export type RequiredSupabaseEnvKey =
  | "SUPABASE_URL"
  | "SUPABASE_ANON_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY";

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export const SUPABASE_ENV = {
  url: readEnv("SUPABASE_URL") ?? "",
  anonKey: readEnv("SUPABASE_ANON_KEY") ?? "",
  serviceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  isConfigured: Boolean(
    readEnv("SUPABASE_URL") &&
      readEnv("SUPABASE_ANON_KEY") &&
      readEnv("SUPABASE_SERVICE_ROLE_KEY"),
  ),
} as const;

export function assertSupabaseEnv(keys: RequiredSupabaseEnvKey[]) {
  const missing = keys.filter((key) => !readEnv(key));

  if (missing.length > 0) {
    throw new Error(`Missing Supabase environment variables: ${missing.join(", ")}`);
  }
}
