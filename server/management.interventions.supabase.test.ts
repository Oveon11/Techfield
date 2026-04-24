import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getUserAccessProfile: vi.fn(),
  storagePut: vi.fn(),
  getSupabaseDashboardSummary: vi.fn(),
  getSupabaseInterventionsList: vi.fn(),
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

describe("management.interventions.list with Supabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("utilise le helper Supabase et conserve le contrat attendu des interventions", async () => {
    mocks.getUserAccessProfile.mockResolvedValue({
      user: { id: 9, openId: "tech-openid", role: "technicien" },
      technicianProfile: { id: 9, userId: 9 },
      clientContactProfile: null,
    });

    mocks.getSupabaseInterventionsList.mockResolvedValue([
      {
        id: 1,
        reference: "INTER-TEST-001",
        title: "Maintenance préventive de test",
        interventionType: "maintenance",
        priority: "normale",
        status: "planifiee",
        projectId: 1,
        contractId: 1,
        report: null,
        internalNotes: null,
        completedAt: null,
        scheduledStartAt: "2026-04-24T08:00:00.000Z",
        scheduledEndAt: "2026-04-24T10:00:00.000Z",
        clientName: "OVEON Bâtiment Test",
        siteName: "Site pilote Paris",
        technicianName: "Marc Martin",
      },
    ]);

    const caller = appRouter.createCaller(
      createContext({
        id: 9,
        openId: "tech-openid",
        email: "marc.martin@techfield.test",
        name: "Marc Martin",
        loginMethod: "manus",
        role: "technicien",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }),
    );

    const result = await caller.management.interventions.list();

    expect(mocks.getSupabaseInterventionsList).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ role: "technicien" }),
      technicianProfile: expect.objectContaining({ id: 9 }),
    }));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      reference: "INTER-TEST-001",
      technicianName: "Marc Martin",
      status: "planifiee",
    });
  });
});
