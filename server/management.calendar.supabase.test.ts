import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getUserAccessProfile: vi.fn(),
  storagePut: vi.fn(),
  getSupabaseCalendarEvents: vi.fn(),
  getSupabaseContractsList: vi.fn(),
  getSupabaseDashboardSummary: vi.fn(),
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

describe("management.calendar.events with Supabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("utilise le helper Supabase et conserve le contrat attendu du calendrier", async () => {
    mocks.getUserAccessProfile.mockResolvedValue({
      user: { id: 9, openId: "tech-openid", role: "technicien" },
      technicianProfile: { id: 9, userId: 9 },
      clientContactProfile: null,
    });

    mocks.getSupabaseCalendarEvents.mockResolvedValue([
      {
        id: 1,
        title: "Maintenance préventive de test",
        start: new Date("2026-04-24T08:00:00.000Z"),
        end: new Date("2026-04-24T10:00:00.000Z"),
        status: "planifiee",
        eventType: "intervention",
      },
      {
        id: 2,
        title: "Contrat maintenance climatisation",
        start: new Date("2026-06-01T00:00:00.000Z"),
        end: new Date("2026-06-01T00:00:00.000Z"),
        status: "actif",
        eventType: "maintenance",
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

    const result = await caller.management.calendar.events();

    expect(mocks.getSupabaseCalendarEvents).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ role: "technicien" }),
      technicianProfile: expect.objectContaining({ id: 9 }),
    }));
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      title: "Maintenance préventive de test",
      eventType: "intervention",
      status: "planifiee",
    });
    expect(result[1]).toMatchObject({
      title: "Contrat maintenance climatisation",
      eventType: "maintenance",
      status: "actif",
    });
  });
});
