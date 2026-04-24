import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("configuration Vercel", () => {
  it("déclare une build Vercel explicite et la fonction API Node", () => {
    const raw = readFileSync(resolve(process.cwd(), "vercel.json"), "utf8");
    const config = JSON.parse(raw) as {
      buildCommand?: string;
      outputDirectory?: string;
      functions?: Record<string, { runtime?: string }>;
    };

    expect(config.buildCommand).toBe("pnpm build:vercel");
    expect(config.outputDirectory).toBe("dist");
    expect(config.functions?.["api/[...path].ts"]?.runtime).toBe("nodejs22.x");
  });

  it("documente DEPLOY_TARGET=vercel dans l’exemple d’environnement", () => {
    const envExample = readFileSync(resolve(process.cwd(), ".env.vercel.example"), "utf8");
    expect(envExample).toContain("DEPLOY_TARGET=vercel");
    expect(envExample).toContain("SUPABASE_URL=");
    expect(envExample).toContain("SUPABASE_ANON_KEY=");
    expect(envExample).toContain("SUPABASE_SERVICE_ROLE_KEY=");
  });
});
