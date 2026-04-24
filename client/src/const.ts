export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
export { resolveSupabasePublicConfig } from "./lib/supabase";

export function getAuthRedirectPath() {
  return "/";
}
