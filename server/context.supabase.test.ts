import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerSsrClient: vi.fn(),
  resolveUserFromSupabaseIdentity: vi.fn(),
}));

vi.mock("./db", () => ({
  resolveUserFromSupabaseIdentity: mocks.resolveUserFromSupabaseIdentity,
}));

vi.mock("./integrations/supabase/auth-ssr", () => ({
  createSupabaseServerSsrClient: mocks.createSupabaseServerSsrClient,
}));

vi.mock("./integrations/supabase/env", () => ({
  SUPABASE_ENV: {
    isConfigured: true,
  },
}));

describe("createContext with Supabase SSR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initialise le client Supabase SSR et laisse l'utilisateur à null si aucune session Supabase n'est présente", async () => {
    const fakeSupabase = {
      kind: "supabase-ssr",
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    };

    mocks.createSupabaseServerSsrClient.mockReturnValue(fakeSupabase);

    const { createContext } = await import("./_core/context");

    const req = { headers: { cookie: "a=b" } } as any;
    const res = {} as any;
    const ctx = await createContext({ req, res });

    expect(mocks.createSupabaseServerSsrClient).toHaveBeenCalledWith(req, res);
    expect(fakeSupabase.auth.getUser).toHaveBeenCalledTimes(1);
    expect(mocks.resolveUserFromSupabaseIdentity).not.toHaveBeenCalled();
    expect(ctx.supabase).toBe(fakeSupabase);
    expect(ctx.user).toBeNull();
  });

  it("laisse l'utilisateur à null si aucune authentification n'est disponible", async () => {
    const fakeSupabase = {
      kind: "supabase-ssr",
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    };
    mocks.createSupabaseServerSsrClient.mockReturnValue(fakeSupabase);

    const { createContext } = await import("./_core/context");

    const req = { headers: {} } as any;
    const res = {} as any;
    const ctx = await createContext({ req, res });

    expect(fakeSupabase.auth.getUser).toHaveBeenCalledTimes(1);
    expect(mocks.resolveUserFromSupabaseIdentity).not.toHaveBeenCalled();
    expect(ctx.supabase).toBe(fakeSupabase);
    expect(ctx.user).toBeNull();
  });

  it("reconstruit l'utilisateur applicatif depuis la session Supabase SSR", async () => {
    const fakeUser = {
      id: 9,
      openId: "supabase:auth-user-9",
      name: "Marc Martin",
      email: "marc@techfield.test",
      phone: null,
      loginMethod: "supabase",
      role: "technicien",
      accountStatus: "active",
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const fakeSupabaseUser = {
      id: "auth-user-9",
      email: "marc@techfield.test",
      app_metadata: { open_id: "supabase:auth-user-9" },
      user_metadata: { name: "Marc Martin" },
    };
    const fakeSupabase = {
      kind: "supabase-ssr",
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: fakeSupabaseUser } }),
      },
    };

    mocks.createSupabaseServerSsrClient.mockReturnValue(fakeSupabase);
    mocks.resolveUserFromSupabaseIdentity.mockResolvedValue(fakeUser);

    const { createContext } = await import("./_core/context");

    const req = { headers: {} } as any;
    const res = {} as any;
    const ctx = await createContext({ req, res });

    expect(fakeSupabase.auth.getUser).toHaveBeenCalledTimes(1);
    expect(mocks.resolveUserFromSupabaseIdentity).toHaveBeenCalledWith({
      authUserId: "auth-user-9",
      openId: "supabase:auth-user-9",
      email: "marc@techfield.test",
      name: "Marc Martin",
    });
    expect(ctx.user).toEqual(fakeUser);
    expect(ctx.supabase).toBe(fakeSupabase);
  });
});
