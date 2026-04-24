import fs from "node:fs";
import path from "node:path";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerStorageProxy } from "./storageProxy";

function registerVercelStatic(app: express.Express) {
  const distPath = path.resolve(process.cwd(), "dist", "public");

  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the Vercel static build directory: ${distPath}`,
    );
    return;
  }

  app.use(express.static(distPath));
  app.use("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      next();
      return;
    }

    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

export function createTechfieldApp() {
  const app = express();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  if (process.env.DEPLOY_TARGET === "vercel") {
    registerVercelStatic(app);
  }

  return app;
}
