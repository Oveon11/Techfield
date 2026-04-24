import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  createSupabaseServerSsrClient: vi.fn(),
  resolveUserFromSupabaseIdentity: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    authenticateRequest: mocks.authenticateRequest,
  },
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

  it("initialise le client Supabase SSR et conserve l'utilisateur authentifié", async () => {
    const fakeSupabase = {
      kind: "supabase-ssr",
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    };
    const fakeUser = {
      id: 1,
      openId: "test-admin-001",
      name: "Admin Techfield",
      email: "admin@techfield.test",
      phone: null,
      loginMethod: "manual",
      role: "admin",
      accountStatus: "active",
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    mocks.createSupabaseServerSsrClient.mockReturnValue(fakeSupabase);
    mocks.authenticateRequest.mockResolvedValue(fakeUser);

    const { createContext } = await import("./_core/context");

    const req = { headers: { cookie: "a=b" } } as any;
    const res = {} as any;
    const ctx = await createContext({ req, res });

    expect(mocks.createSupabaseServerSsrClient).toHaveBeenCalledWith(req, res);
    expect(mocks.authenticateRequest).toHaveBeenCalledWith(req);
    expect(fakeSupabase.auth.getUser).not.toHaveBeenCalled();
    expect(ctx.supabase).toBe(fakeSupabase);
    expect(ctx.user).toEqual(fakeUser);
  });

  it("laisse l'utilisateur à null si aucune authentification n'est disponible", async () => {
    const fakeSupabase = {
      kind: "supabase-ssr",
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    };
    mocks.createSupabaseServerSsrClient.mockReturnValue(fakeSupabase);
    mocks.authenticateRequest.mockRejectedValue(new Error("forbidden"));

    const { createContext } = await import("./_core/context");

    const req = { headers: {} } as any;
    const res = {} as any;
    const ctx = await createContext({ req, res });

    expect(fakeSupabase.auth.getUser).toHaveBeenCalledTimes(1);
    expect(mocks.resolveUserFromSupabaseIdentity).not.toHaveBeenCalled();
    expect(ctx.supabase).toBe(fakeSupabase);
    expect(ctx.user).toBeNull();
  });

  it("reconstruit l'utilisateur applicatif depuis la session Supabase SSR lorsque le cookie historique est absent", async () => {
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
    mocks.authenticateRequest.mockRejectedValue(new Error("missing cookie"));
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
