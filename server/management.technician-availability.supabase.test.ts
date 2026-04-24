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

describe("management.technicians.availability with Supabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("utilise le helper Supabase et conserve le contrat attendu des disponibilités", async () => {
    mocks.getUserAccessProfile.mockResolvedValue({
      user: { id: 9, openId: "tech-openid", role: "technicien" },
      technicianProfile: { id: 9, userId: 9 },
      clientContactProfile: null,
    });

    mocks.getSupabaseTechnicianAvailability.mockResolvedValue([
      {
        id: 31,
        technicianId: 9,
        availabilityType: "disponible",
        startAt: new Date("2026-04-25T08:00:00.000Z"),
        endAt: new Date("2026-04-25T16:00:00.000Z"),
        notes: "Créneau atelier",
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

    const result = await caller.management.technicians.availability();

    expect(mocks.getSupabaseTechnicianAvailability).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ role: "technicien" }),
      technicianProfile: expect.objectContaining({ id: 9 }),
    }));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      technicianId: 9,
      availabilityType: "disponible",
      notes: "Créneau atelier",
    });
    expect(result[0].startAt).toBeInstanceOf(Date);
    expect(result[0].endAt).toBeInstanceOf(Date);
  });
});
