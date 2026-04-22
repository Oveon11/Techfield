import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { IncomingMessage, ServerResponse } from "http";
import { SUPABASE_ENV, assertSupabaseEnv } from "./env";

function parseCookies(cookieHeader?: string) {
  return (cookieHeader ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const [name, ...rest] = part.split("=");
      acc[name] = decodeURIComponent(rest.join("="));
      return acc;
    }, {});
}

export function createSupabaseServerSsrClient(req: IncomingMessage, res: ServerResponse) {
  assertSupabaseEnv(["SUPABASE_URL", "SUPABASE_ANON_KEY"]);

  const cookieStore = parseCookies(req.headers.cookie);

  return createServerClient(SUPABASE_ENV.url, SUPABASE_ENV.anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore[name];
      },
      set(name: string, value: string, options: CookieOptions) {
        const serialized = `${name}=${encodeURIComponent(value)}; Path=${options.path ?? "/"}; HttpOnly; SameSite=${options.sameSite ?? "Lax"}${options.secure ? "; Secure" : ""}${typeof options.maxAge === "number" ? `; Max-Age=${options.maxAge}` : ""}`;
        res.appendHeader("Set-Cookie", serialized);
      },
      remove(name: string, options: CookieOptions) {
        const serialized = `${name}=; Path=${options.path ?? "/"}; Max-Age=0; HttpOnly; SameSite=${options.sameSite ?? "Lax"}${options.secure ? "; Secure" : ""}`;
        res.appendHeader("Set-Cookie", serialized);
      },
    },
  });
}
