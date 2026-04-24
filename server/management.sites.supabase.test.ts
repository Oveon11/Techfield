import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getUserAccessProfile: vi.fn(),
  storagePut: vi.fn(),
  getSupabaseCalendarEvents: vi.fn(),
  getSupabaseClientsList: vi.fn(),
  getSupabaseContractsList: vi.fn(),
  getSupabaseDashboardSummary: vi.fn(),
  getSupabaseDocumentsList: vi.fn(),
  getSupabaseInterventionsHistory: vi.fn(),
  getSupabaseInterventionsList: vi.fn(),
  getSupabaseProjectsList: vi.fn(),
  getSupabaseSitesList: vi.fn(),
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
  getSupabaseCalendarEvents: mocks.getSupabaseCalendarEvents,
  getSupabaseClientsList: mocks.getSupabaseClientsList,
  getSupabaseContractsList: mocks.getSupabaseContractsList,
  getSupabaseDashboardSummary: mocks.getSupabaseDashboardSummary,
  getSupabaseDocumentsList: mocks.getSupabaseDocumentsList,
  getSupabaseInterventionsHistory: mocks.getSupabaseInterventionsHistory,
  getSupabaseInterventionsList: mocks.getSupabaseInterventionsList,
  getSupabaseProjectsList: mocks.getSupabaseProjectsList,
  getSupabaseSitesList: mocks.getSupabaseSitesList,
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

describe("management.sites.list with Supabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("utilise le helper Supabase et conserve le contrat attendu des sites", async () => {
    mocks.getUserAccessProfile.mockResolvedValue({
      user: { id: 1, openId: "admin-openid", role: "admin" },
      technicianProfile: null,
      clientContactProfile: null,
    });

    mocks.getSupabaseSitesList.mockResolvedValue([
      {
        id: 8,
        clientId: 5,
        clientName: "OVEON",
        siteName: "Siège Paris",
        siteCode: "PAR-01",
        city: "Paris",
        postalCode: "75008",
        isActive: 1,
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

    const result = await caller.management.sites.list();

    expect(mocks.getSupabaseSitesList).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ role: "admin" }),
    }));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      clientId: 5,
      clientName: "OVEON",
      siteName: "Siège Paris",
      siteCode: "PAR-01",
      city: "Paris",
      postalCode: "75008",
      isActive: 1,
    });
  });
});
