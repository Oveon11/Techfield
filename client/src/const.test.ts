import { describe, expect, it } from "vitest";
import { resolveSupabasePublicConfig } from "./const";

describe("resolveSupabasePublicConfig", () => {
  it("retourne les variables publiques Supabase lorsqu’elles sont présentes", () => {
    const result = resolveSupabasePublicConfig({
      VITE_SUPABASE_URL: "https://project.supabase.co",
      VITE_SUPABASE_ANON_KEY: "anon-key-123",
    });

    expect(result).toEqual({
      url: "https://project.supabase.co",
      anonKey: "anon-key-123",
      isConfigured: true,
    });
  });

  it("signale une configuration incomplète quand les variables manquent", () => {
    const result = resolveSupabasePublicConfig({});

    expect(result).toEqual({
      url: null,
      anonKey: null,
      isConfigured: false,
    });
  });
});
