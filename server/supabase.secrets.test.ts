import { describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe("Supabase secrets", () => {
  it("expose les variables d'environnement requises", () => {
    expect(SUPABASE_URL).toBeTruthy();
    expect(SUPABASE_ANON_KEY).toBeTruthy();
    expect(SUPABASE_SERVICE_ROLE_KEY).toBeTruthy();
  });

  it("permet un appel léger à l'API Auth avec la clé anon", async () => {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      method: "GET",
      headers: {
        apikey: String(SUPABASE_ANON_KEY),
      },
    });

    expect(response.ok).toBe(true);
  });
});
