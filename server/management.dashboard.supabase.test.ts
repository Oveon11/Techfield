import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getUserAccessProfile: vi.fn(),
  storagePut: vi.fn(),
  getSupabaseDashboardSummary: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
  getUserAccessProfile: mocks.getUserAccessProfile,
}));

vi.mock("./storage", () => ({
  storagePut: mocks.storagePut,
}));

vi.mock("./integrations/supabase/env", () => ({
  SUPABASE_ENV: {
    isConfigured: true,
  },
}));

vi.mock("./integrations/supabase/db/management", () => ({
  getSupabaseDashboardSummary: mocks.getSupabaseDashboardSummary,
}));

import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(user: AuthenticatedUser): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
    supabase: {} as any,
  };
}

describe("management.dashboard.summary with Supabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("utilise le helper Supabase et renvoie le contrat attendu du tableau de bord", async () => {
    mocks.getUserAccessProfile.mockResolvedValue({
      user: { id: 1, openId: "admin-openid", role: "admin" },
      technicianProfile: null,
      clientContactProfile: null,
    });

    mocks.getSupabaseDashboardSummary.mockResolvedValue({
      userRole: "admin",
      cards: {
        projectsInProgress: 1,
        upcomingInterventions: 1,
        expiringContracts: 1,
      },
      upcomingInterventions: [
        {
          id: 1,
          reference: "INTER-TEST-001",
          title: "Maintenance préventive de test",
          status: "planifiee",
          scheduledStartAt: "2026-04-24T08:00:00.000Z",
        },
      ],
      expiringContracts: [
        {
          id: 1,
          contractNumber: "CONTRAT-TEST-001",
          title: "Contrat maintenance climatisation",
          endDate: "2026-05-15",
          status: "actif",
        },
      ],
    });

    const caller = appRouter.createCaller(
      createContext({
        id: 1,
        openId: "admin-openid",
        email: "admin@techfield.test",
        name: "Admin Techfield",
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }),
    );

    const result = await caller.management.dashboard.summary();

    expect(mocks.getSupabaseDashboardSummary).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ role: "admin" }),
    }));
    expect(result.cards.projectsInProgress).toBe(1);
    expect(result.upcomingInterventions).toHaveLength(1);
    expect(result.expiringContracts).toHaveLength(1);
  });
});
