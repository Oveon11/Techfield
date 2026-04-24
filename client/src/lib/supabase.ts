import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

type BrowserEnv = Record<string, unknown> & {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

export type SupabasePublicConfig = {
  url: string | null;
  anonKey: string | null;
  isConfigured: boolean;
};

export function resolveSupabasePublicConfig(env: BrowserEnv): SupabasePublicConfig {
  const url = typeof env.VITE_SUPABASE_URL === "string" && env.VITE_SUPABASE_URL.trim().length > 0
    ? env.VITE_SUPABASE_URL.trim()
    : null;
  const anonKey = typeof env.VITE_SUPABASE_ANON_KEY === "string" && env.VITE_SUPABASE_ANON_KEY.trim().length > 0
    ? env.VITE_SUPABASE_ANON_KEY.trim()
    : null;

  return {
    url,
    anonKey,
    isConfigured: Boolean(url && anonKey),
  };
}

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (browserClient) {
    return browserClient;
  }

  const config = resolveSupabasePublicConfig(import.meta.env);
  if (!config.isConfigured || !config.url || !config.anonKey) {
    return null;
  }

  browserClient = createBrowserClient(config.url, config.anonKey);
  return browserClient;
}
