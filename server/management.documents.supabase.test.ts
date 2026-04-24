import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getUserAccessProfile: vi.fn(),
  storagePut: vi.fn(),
  getSupabaseCalendarEvents: vi.fn(),
  getSupabaseContractsList: vi.fn(),
  getSupabaseDashboardSummary: vi.fn(),
  getSupabaseDocumentsList: vi.fn(),
  getSupabaseInterventionsHistory: vi.fn(),
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
  getSupabaseCalendarEvents: mocks.getSupabaseCalendarEvents,
  getSupabaseContractsList: mocks.getSupabaseContractsList,
  getSupabaseDashboardSummary: mocks.getSupabaseDashboardSummary,
  getSupabaseDocumentsList: mocks.getSupabaseDocumentsList,
  getSupabaseInterventionsHistory: mocks.getSupabaseInterventionsHistory,
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

describe("management.documents.list with Supabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("utilise le helper Supabase et conserve le contrat attendu des documents", async () => {
    mocks.getUserAccessProfile.mockResolvedValue({
      user: { id: 1, openId: "admin-openid", role: "admin" },
      technicianProfile: null,
      clientContactProfile: null,
    });

    mocks.getSupabaseDocumentsList.mockResolvedValue([
      {
        id: 14,
        title: "Compte-rendu visite trimestrielle",
        fileName: "rapport-avril.pdf",
        fileUrl: "/manus-storage/reports/rapport-avril.pdf",
        documentType: "rapport",
        visibility: "client",
        entityType: "contract",
        entityId: 3,
        createdAt: new Date("2026-04-22T07:00:00.000Z"),
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

    const result = await caller.management.documents.list();

    expect(mocks.getSupabaseDocumentsList).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ role: "admin" }),
    }));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: "Compte-rendu visite trimestrielle",
      fileName: "rapport-avril.pdf",
      documentType: "rapport",
      visibility: "client",
      entityType: "contract",
      entityId: 3,
    });
  });
});
