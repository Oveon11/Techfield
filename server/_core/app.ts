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

  // Échange PKCE : Supabase redirige ici avec ?code=xxx après clic sur magic link
  app.get("/auth/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const next = typeof req.query.next === "string" && req.query.next.startsWith("/") ? req.query.next : "/";

    if (!code || !SUPABASE_ENV.isConfigured) {
      return res.redirect("/?error=auth_callback_invalid");
    }

    try {
      const supabase = createSupabaseServerSsrClient(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse,
      );
      const { error } = await supabase.auth.exchangeCodeForSession(code);
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
