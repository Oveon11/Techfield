import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

type HeaderCall = {
  name: string;
  value: string;
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

function createContext(role: AuthenticatedUser["role"] = "technicien"): { ctx: TrpcContext; headers: HeaderCall[] } {
  const headers: HeaderCall[] = [];

  const ctx: TrpcContext = {
    user: createUser(role),
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      setHeader: (name: string, value: string) => {
        headers.push({ name, value });
        return {} as TrpcContext["res"];
      },
    } as TrpcContext["res"],
  };

  return { ctx, headers };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, headers } = createContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(headers).toHaveLength(1);
    expect(headers[0]?.name).toBe("Set-Cookie");
    expect(headers[0]?.value).toContain(`${COOKIE_NAME}=`);
    expect(headers[0]?.value).toContain("Max-Age=0");
    expect(headers[0]?.value).toContain("HttpOnly");
    expect(headers[0]?.value).toContain("SameSite=None");
    expect(headers[0]?.value).toContain("Secure");
    expect(headers[0]?.value).toContain("Path=/");
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
