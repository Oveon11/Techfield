import express from "express";
import type { IncomingMessage, ServerResponse } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { createSupabaseServerSsrClient } from "../integrations/supabase/auth-ssr";
import { SUPABASE_ENV } from "../integrations/supabase/env";

export function createTechfieldApp() {
  const app = express();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Échange auth : Supabase redirige ici après clic sur magic link
  // - PKCE flow : ?code=xxx → exchangeCodeForSession
  // - OTP flow  : ?token_hash=xxx&type=email → verifyOtp
  app.get("/auth/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const tokenHash = typeof req.query.token_hash === "string" ? req.query.token_hash : undefined;
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const next = typeof req.query.next === "string" && req.query.next.startsWith("/") ? req.query.next : "/";

    if (!SUPABASE_ENV.isConfigured || (!code && !tokenHash)) {
      return res.redirect("/?error=auth_callback_invalid");
    }

    try {
      const supabase = createSupabaseServerSsrClient(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse,
      );

      let error: { message: string } | null = null;

      if (code) {
        ({ error } = await supabase.auth.exchangeCodeForSession(code));
      } else if (tokenHash && type) {
        ({ error } = await (supabase.auth as any).verifyOtp({ token_hash: tokenHash, type }));
      }

      if (error) {
        return res.redirect(`/?error=${encodeURIComponent(error.message)}`);
      }
      return res.redirect(next);
    } catch {
      return res.redirect("/?error=auth_callback_failed");
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  return app;
}
