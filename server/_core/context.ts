import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { resolveUserFromSupabaseIdentity } from "../db";
import { createSupabaseServerSsrClient } from "../integrations/supabase/auth-ssr";
import { SUPABASE_ENV } from "../integrations/supabase/env";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  supabase: ReturnType<typeof createSupabaseServerSsrClient> | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  const supabase = SUPABASE_ENV.isConfigured
    ? createSupabaseServerSsrClient(opts.req, opts.res)
    : null;

  if (supabase) {
    try {
      const {
        data: { user: supabaseUser },
      } = await supabase.auth.getUser();

      if (supabaseUser) {
        const appMetadata = (supabaseUser.app_metadata ?? {}) as Record<string, unknown>;
        const userMetadata = (supabaseUser.user_metadata ?? {}) as Record<string, unknown>;
        const resolved = await resolveUserFromSupabaseIdentity({
          authUserId: supabaseUser.id,
          openId:
            (typeof appMetadata.open_id === "string" ? appMetadata.open_id : null) ??
            (typeof userMetadata.open_id === "string" ? userMetadata.open_id : null),
          email: supabaseUser.email ?? null,
          name:
            (typeof userMetadata.name === "string" ? userMetadata.name : null) ??
            (typeof appMetadata.name === "string" ? appMetadata.name : null) ??
            null,
        });

        user = resolved ?? null;
      }
    } catch (error) {
      console.warn("[Auth] Supabase SSR lookup failed", String(error));
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    supabase,
  };
}
