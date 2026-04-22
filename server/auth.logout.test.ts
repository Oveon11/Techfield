import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUser(role: AuthenticatedUser["role"] = "technicien"): AuthenticatedUser {
  return {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    phone: null,
    name: "Sample User",
    loginMethod: "manus",
    role,
    accountStatus: "active",
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

function createContext(role: AuthenticatedUser["role"] = "technicien"): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const ctx: TrpcContext = {
    user: createUser(role),
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });
});

describe("security role gates", () => {
  it("authorizes admin-only access for admin users", async () => {
    const { ctx } = createContext("admin");
    const caller = appRouter.createCaller(ctx);

    await expect(caller.security.requireAdmin()).resolves.toEqual({ authorized: true });
  });

  it("rejects admin-only access for technicians", async () => {
    const { ctx } = createContext("technicien");
    const caller = appRouter.createCaller(ctx);

    await expect(caller.security.requireAdmin()).rejects.toBeInstanceOf(TRPCError);
  });

  it("authorizes technician access for technicians", async () => {
    const { ctx } = createContext("technicien");
    const caller = appRouter.createCaller(ctx);

    await expect(caller.security.requireTechnician()).resolves.toEqual({ authorized: true });
  });

  it("authorizes client access for client users", async () => {
    const { ctx } = createContext("client");
    const caller = appRouter.createCaller(ctx);

    await expect(caller.security.requireClient()).resolves.toEqual({ authorized: true });
  });
});
