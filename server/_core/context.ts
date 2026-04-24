import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { IncomingMessage, ServerResponse } from "http";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "../../drizzle/schema";
import { resolveUserFromSupabaseIdentity } from "../db";
import { createSupabaseServerSsrClient } from "../integrations/supabase/auth-ssr";
import { SUPABASE_ENV } from "../integrations/supabase/env";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  supabase: SupabaseClient | null;
};

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  const supabase = SUPABASE_ENV.isConfigured
    ? createSupabaseServerSsrClient(
        opts.req as unknown as IncomingMessage,
        opts.res as unknown as ServerResponse,
      )
    : null;

  if (supabase) {
    try {
      const authClient = supabase.auth as unknown as {
        getUser: () => Promise<{ data: { user: SupabaseAuthUser | null } }>;
      };
      const {
        data: { user: supabaseUser },
      } = await authClient.getUser();

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
