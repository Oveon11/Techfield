import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock("./integrations/supabase/env", () => ({
  SUPABASE_ENV: {
    url: "https://supabase.techfield.test",
    anonKey: "anon-key",
  },
  assertSupabaseEnv: vi.fn(),
}));

describe("createSupabaseServerSsrClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ajoute les cookies via setHeader quand appendHeader n'existe pas", async () => {
    mocks.createServerClient.mockImplementation((_url, _key, options) => ({
      options,
    }));

    const { createSupabaseServerSsrClient } = await import("./integrations/supabase/auth-ssr");

    const req = {
      headers: {
        cookie: "existing=1",
      },
    } as any;

    const headerState: Record<string, string | string[] | undefined> = {};
    const res = {
      getHeader(name: string) {
        return headerState[name];
      },
      setHeader(name: string, value: string | string[]) {
        headerState[name] = value;
      },
    } as any;

    const client = createSupabaseServerSsrClient(req, res) as {
      options: {
        cookies: {
          get: (name: string) => string | undefined;
          set: (name: string, value: string, options: Record<string, unknown>) => void;
          remove: (name: string, options: Record<string, unknown>) => void;
        };
      };
    };

    expect(client.options.cookies.get("existing")).toBe("1");

    client.options.cookies.set("sb-access-token", "abc", {
      path: "/",
      sameSite: "Lax",
      secure: true,
      maxAge: 60,
    });
    client.options.cookies.remove("sb-refresh-token", {
      path: "/",
      sameSite: "Lax",
      secure: true,
    });

    expect(headerState["Set-Cookie"]).toEqual([
      "sb-access-token=abc; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=60",
      "sb-refresh-token=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0",
    ]);
    expect(client.options.cookies.get("sb-access-token")).toBe("abc");
    expect(client.options.cookies.get("sb-refresh-token")).toBeUndefined();
  });
});
