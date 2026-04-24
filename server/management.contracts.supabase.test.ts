import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getUserAccessProfile: vi.fn(),
  storagePut: vi.fn(),
  getSupabaseContractsList: vi.fn(),
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
  getSupabaseContractsList: mocks.getSupabaseContractsList,
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

describe("management.contracts.list with Supabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("utilise le helper Supabase et conserve le contrat attendu des contrats", async () => {
    mocks.getUserAccessProfile.mockResolvedValue({
      user: { id: 1, openId: "admin-openid", role: "admin" },
      technicianProfile: null,
      clientContactProfile: null,
    });

    mocks.getSupabaseContractsList.mockResolvedValue([
      {
        id: 1,
        contractNumber: "CTR-TEST-001",
        title: "Contrat maintenance climatisation",
        status: "actif",
        frequency: "annuelle",
        annualAmount: "2400.00",
        renewalNoticeDays: 30,
        startDate: "2026-01-01",
        nextServiceDate: "2026-06-01",
        endDate: "2026-12-31",
        notes: "Contrat pilote",
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

    const result = await caller.management.contracts.list();

    expect(mocks.getSupabaseContractsList).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ role: "admin" }),
    }));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      contractNumber: "CTR-TEST-001",
      clientName: "OVEON Bâtiment Test",
      status: "actif",
    });
  });
});
