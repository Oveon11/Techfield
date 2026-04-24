import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("configuration Vercel", () => {
  it("déclare une fonction API explicite et un fallback SPA statique compatibles avec Vercel", () => {
    const raw = readFileSync(resolve(process.cwd(), "vercel.json"), "utf8");
    const config = JSON.parse(raw) as {
      buildCommand?: string;
      functions?: Record<string, { includeFiles?: string; runtime?: string; maxDuration?: number }>;
      rewrites?: Array<{ source: string; destination: string }>;
      outputDirectory?: string;
    };

    const apiFunction = config.functions?.["api/[...path].ts"];

    expect(config.buildCommand).toBe("pnpm build:vercel");
    expect(config.outputDirectory).toBe("dist/public");
    expect(apiFunction).toBeDefined();
    expect(apiFunction?.maxDuration).toBe(10);
    expect(apiFunction?.includeFiles).toBeUndefined();
    expect(apiFunction?.runtime).toBeUndefined();
    expect(config.rewrites).toEqual([
      {
        source: "/((?!api/).*)",
        destination: "/index.html",
      },
    ]);
  });

  it("documente DEPLOY_TARGET=vercel dans l’exemple d’environnement", () => {
    const envExample = readFileSync(resolve(process.cwd(), ".env.vercel.example"), "utf8");
    expect(envExample).toContain("DEPLOY_TARGET=vercel");
    expect(envExample).toContain("SUPABASE_URL=");
    expect(envExample).toContain("SUPABASE_ANON_KEY=");
    expect(envExample).toContain("SUPABASE_SERVICE_ROLE_KEY=");
  });
});
