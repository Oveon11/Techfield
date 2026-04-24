import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getUserAccessProfile: vi.fn(),
  storagePut: vi.fn(),
  getSupabaseCalendarEvents: vi.fn(),
  getSupabaseClientContactsList: vi.fn(),
  getSupabaseClientsList: vi.fn(),
  getSupabaseContractsList: vi.fn(),
  getSupabaseDashboardSummary: vi.fn(),
  getSupabaseDocumentsList: vi.fn(),
  getSupabaseInterventionsHistory: vi.fn(),
  getSupabaseInterventionsList: vi.fn(),
  getSupabaseProjectsList: vi.fn(),
  getSupabaseSitesList: vi.fn(),
  getSupabaseTechnicianAvailability: vi.fn(),
  getSupabaseTechniciansList: vi.fn(),
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
  getSupabaseClientContactsList: mocks.getSupabaseClientContactsList,
  getSupabaseClientsList: mocks.getSupabaseClientsList,
  getSupabaseContractsList: mocks.getSupabaseContractsList,
  getSupabaseDashboardSummary: mocks.getSupabaseDashboardSummary,
  getSupabaseDocumentsList: mocks.getSupabaseDocumentsList,
  getSupabaseInterventionsHistory: mocks.getSupabaseInterventionsHistory,
  getSupabaseInterventionsList: mocks.getSupabaseInterventionsList,
  getSupabaseProjectsList: mocks.getSupabaseProjectsList,
  getSupabaseSitesList: mocks.getSupabaseSitesList,
  getSupabaseTechnicianAvailability: mocks.getSupabaseTechnicianAvailability,
  getSupabaseTechniciansList: mocks.getSupabaseTechniciansList,
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

describe("management.clients.contacts.list with Supabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("utilise le helper Supabase et conserve le contrat attendu des contacts clients", async () => {
    mocks.getUserAccessProfile.mockResolvedValue({
      user: { id: 12, openId: "client-openid", role: "client" },
      technicianProfile: null,
      clientContactProfile: { clientId: 5 },
    });

    mocks.getSupabaseClientContactsList.mockResolvedValue([
      {
        id: 20,
        clientId: 5,
        firstName: "Alice",
        lastName: "Martin",
        email: "alice@oveon.test",
        phone: "0102030405",
        jobTitle: "Responsable maintenance",
        contactType: "principal",
        isPrimary: 1,
        clientName: "OVEON",
      },
    ]);

    const caller = appRouter.createCaller(
      createContext({
        id: 12,
        openId: "client-openid",
        email: "alice@oveon.test",
        name: "Alice Martin",
        loginMethod: "manus",
        role: "client",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }),
    );

    const result = await caller.management.clients.contacts.list();

    expect(mocks.getSupabaseClientContactsList).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ role: "client" }),
      clientContactProfile: expect.objectContaining({ clientId: 5 }),
    }));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      firstName: "Alice",
      lastName: "Martin",
      clientName: "OVEON",
      contactType: "principal",
      jobTitle: "Responsable maintenance",
    });
  });
});
