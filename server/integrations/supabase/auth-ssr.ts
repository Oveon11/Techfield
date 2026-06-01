import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { IncomingMessage, ServerResponse } from "http";
import { SUPABASE_ENV, assertSupabaseEnv } from "./env";

type HeaderWritableResponse = Pick<ServerResponse, "getHeader" | "setHeader"> & {
  appendHeader?: (name: string, value: string) => unknown;
};

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

function appendSetCookie(res: HeaderWritableResponse, serialized: string) {
  if (typeof res.appendHeader === "function") {
    res.appendHeader("Set-Cookie", serialized);
    return;
  }

  const existing = res.getHeader("Set-Cookie");
  const cookies = existing ? (Array.isArray(existing) ? existing : [String(existing)]) : [];
  res.setHeader("Set-Cookie", [...cookies, serialized]);
}

function serializeCookie(name: string, value: string, options: CookieOptions, maxAge?: number) {
  return `${name}=${encodeURIComponent(value)}; Path=${options.path ?? "/"}; HttpOnly; SameSite=${options.sameSite ?? "Lax"}${options.secure ? "; Secure" : ""}${typeof maxAge === "number" ? `; Max-Age=${maxAge}` : ""}`;
}

function isHttpsRequest(req: IncomingMessage): boolean {
  const forwarded = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return proto?.trim().toLowerCase() === "https";
}

export function createSupabaseServerSsrClient(req: IncomingMessage, res: ServerResponse) {
  assertSupabaseEnv(["SUPABASE_URL", "SUPABASE_ANON_KEY"]);

  const cookieStore = parseCookies(req.headers.cookie);
  const writableResponse = res as HeaderWritableResponse;
  const secure = isHttpsRequest(req);

  return createServerClient(SUPABASE_ENV.url, SUPABASE_ENV.anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore[name];
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore[name] = value;
        appendSetCookie(writableResponse, serializeCookie(name, value, { ...options, secure }, options.maxAge));
      },
      remove(name: string, options: CookieOptions) {
        delete cookieStore[name];
        appendSetCookie(writableResponse, serializeCookie(name, "", { ...options, secure }, 0));
      },
    },
  });
}
