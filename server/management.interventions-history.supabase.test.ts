import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getUserAccessProfile: vi.fn(),
  storagePut: vi.fn(),
  getSupabaseDashboardSummary: vi.fn(),
  getSupabaseInterventionsList: vi.fn(),
  getSupabaseInterventionsHistory: vi.fn(),
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
  getSupabaseInterventionsList: mocks.getSupabaseInterventionsList,
  getSupabaseInterventionsHistory: mocks.getSupabaseInterventionsHistory,
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

describe("management.interventions.history with Supabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("utilise le helper Supabase et conserve le contrat attendu de l’historique", async () => {
    mocks.getUserAccessProfile.mockResolvedValue({
      user: { id: 1, openId: "admin-openid", role: "admin" },
      technicianProfile: null,
      clientContactProfile: null,
    });

    mocks.getSupabaseInterventionsHistory.mockResolvedValue([
      {
        id: 1,
        reference: "INTER-TEST-001",
        title: "Maintenance préventive de test",
        status: "terminee",
        report: "Compte-rendu de test validé.",
        scheduledStartAt: "2026-04-24T08:00:00.000Z",
        completedAt: "2026-04-24T10:30:00.000Z",
        clientName: "OVEON Bâtiment Test",
        siteName: "Site pilote Paris",
      },
    ]);

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

    const result = await caller.management.interventions.history({ projectId: 1 });

    expect(mocks.getSupabaseInterventionsHistory).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ role: "admin" }) }),
      { projectId: 1 }
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      reference: "INTER-TEST-001",
      status: "terminee",
      clientName: "OVEON Bâtiment Test",
    });
  });
});
