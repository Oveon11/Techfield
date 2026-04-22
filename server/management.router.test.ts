import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getUserAccessProfile: vi.fn(),
  storagePut: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
  getUserAccessProfile: mocks.getUserAccessProfile,
}));

vi.mock("./storage", () => ({
  storagePut: mocks.storagePut,
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
  };
}

function createFakeDb() {
  return {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        $returningId: vi.fn(async () => [{ id: 42 }]),
      })),
    })),
  };
}

function createAdminCaller() {
  return appRouter.createCaller(
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
}

describe("management router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("autorise un administrateur à créer un contact client", async () => {
    const fakeDb = createFakeDb();
    mocks.getDb.mockResolvedValue(fakeDb);
    mocks.getUserAccessProfile.mockResolvedValue({
      user: { id: 1, openId: "admin-openid", role: "admin" },
      technicianProfile: null,
      clientContactProfile: null,
    });

    const caller = createAdminCaller();

    const result = await caller.management.clients.contacts.create({
      clientId: 7,
      firstName: "Lina",
      lastName: "Martin",
      email: "lina.martin@example.com",
      phone: "0102030405",
      jobTitle: "Responsable technique",
      contactType: "technique",
      isPrimary: true,
    });

    expect(result).toEqual({ success: true, id: 42 });
    expect(fakeDb.insert).toHaveBeenCalledTimes(2);
  });

  it("persiste les affectations technicien lors de la création d'un chantier", async () => {
    const fakeDb = createFakeDb();
    mocks.getDb.mockResolvedValue(fakeDb);
    mocks.getUserAccessProfile.mockResolvedValue({
      user: { id: 1, openId: "admin-openid", role: "admin" },
      technicianProfile: null,
      clientContactProfile: null,
    });

    const caller = createAdminCaller();

    const result = await caller.management.projects.create({
      clientId: 10,
      siteId: 4,
      title: "Chantier chaufferie centrale",
      serviceType: "chauffe_eau",
      description: "Reprise complète et pilotage de mise en service.",
      status: "planifie",
      progressPercent: 15,
      estimatedHours: "12.50",
      actualHours: "2.00",
      budgetAmount: "18500.00",
      startDate: new Date().toISOString(),
      plannedEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      technicianIds: [3, 5],
    });

    expect(result).toMatchObject({ success: true, id: 42 });
    expect(fakeDb.insert).toHaveBeenCalledTimes(3);
  });

  it("renouvelle un contrat en le repassant à actif", async () => {
    const renewWhereSpy = vi.fn(async () => ({ affectedRows: 1 }));
    const renewSetSpy = vi.fn(() => ({
      where: renewWhereSpy,
    }));
    const fakeDb = {
      update: vi.fn(() => ({
        set: renewSetSpy,
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          $returningId: vi.fn(async () => [{ id: 91 }]),
        })),
      })),
    };

    mocks.getDb.mockResolvedValue(fakeDb);
    mocks.getUserAccessProfile.mockResolvedValue({
      user: { id: 1, openId: "admin-openid", role: "admin" },
      technicianProfile: null,
      clientContactProfile: null,
    });

    const caller = createAdminCaller();

    const result = await caller.management.contracts.renew({
      contractId: 18,
      startDate: "2026-05-01",
      nextServiceDate: "2026-06-01",
      endDate: "2027-04-30",
      annualAmount: "2400.00",
      notes: "Renouvellement validé avec revalorisation.",
    });

    expect(result).toEqual({ success: true });
    expect(fakeDb.update).toHaveBeenCalledTimes(1);
    expect(renewSetSpy).toHaveBeenCalledWith(expect.objectContaining({
      startDate: "2026-05-01",
      nextServiceDate: "2026-06-01",
      endDate: "2027-04-30",
      status: "actif",
    }));
    expect(fakeDb.insert).toHaveBeenCalledTimes(1);
  });

  it("enregistre un compte-rendu d’intervention pour un technicien affecté", async () => {
    const interventionWhereSpy = vi.fn(async () => ({ affectedRows: 1 }));
    const interventionSetSpy = vi.fn(() => ({
      where: interventionWhereSpy,
    }));
    const fakeDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{
              id: 44,
              technicianId: 9,
              report: null,
              startedAt: null,
              completedAt: null,
            }]),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: interventionSetSpy,
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          $returningId: vi.fn(async () => [{ id: 77 }]),
        })),
      })),
    };

    mocks.getDb.mockResolvedValue(fakeDb);
    mocks.getUserAccessProfile.mockResolvedValue({
      user: { id: 9, openId: "tech-openid", role: "technicien" },
      technicianProfile: { id: 9, userId: 9 },
      clientContactProfile: null,
    });

    const caller = appRouter.createCaller(
      createContext({
        id: 9,
        openId: "tech-openid",
        email: "tech@techfield.test",
        name: "Technicien Techfield",
        loginMethod: "manus",
        role: "technicien",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }),
    );

    const result = await caller.management.interventions.updateStatus({
      interventionId: 44,
      status: "terminee",
      report: "Remplacement du circulateur, essais validés et remise en service effectuée.",
    });

    expect(result).toEqual({ success: true });
    expect(fakeDb.select).toHaveBeenCalledTimes(1);
    expect(fakeDb.update).toHaveBeenCalledTimes(1);
    expect(interventionSetSpy).toHaveBeenCalledWith(expect.objectContaining({
      status: "terminee",
      report: "Remplacement du circulateur, essais validés et remise en service effectuée.",
    }));
    expect(fakeDb.insert).toHaveBeenCalledTimes(1);
  });

  it("retourne un historique d’interventions filtré par chantier", async () => {
    const historyRows = [
      {
        id: 51,
        reference: "INT-ABCDE",
        title: "Maintenance CTA",
        status: "terminee",
        report: "Nettoyage, contrôle et remise en service validés.",
        scheduledStartAt: new Date("2026-05-12T08:00:00.000Z"),
        completedAt: new Date("2026-05-12T10:30:00.000Z"),
        clientName: "Bâtiments Martin",
        siteName: "Site Nord",
      },
    ];

    const fakeDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            leftJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                orderBy: vi.fn(async () => historyRows),
              })),
            })),
          })),
        })),
      })),
    };

    mocks.getDb.mockResolvedValue(fakeDb);
    mocks.getUserAccessProfile.mockResolvedValue({
      user: { id: 1, openId: "admin-openid", role: "admin" },
      technicianProfile: null,
      clientContactProfile: null,
    });

    const caller = createAdminCaller();

    const result = await caller.management.interventions.history({ projectId: 9 });

    expect(result).toEqual(historyRows);
    expect(fakeDb.select).toHaveBeenCalledTimes(1);
  });

  it("refuse à un client la création d'une disponibilité technicien", async () => {
    mocks.getDb.mockResolvedValue(createFakeDb());
    mocks.getUserAccessProfile.mockResolvedValue({
      user: { id: 15, openId: "client-openid", role: "client" },
      technicianProfile: null,
      clientContactProfile: { id: 3, clientId: 12, userId: 15 },
    });

    const caller = appRouter.createCaller(
      createContext({
        id: 15,
        openId: "client-openid",
        email: "client@techfield.test",
        name: "Client Techfield",
        loginMethod: "manus",
        role: "client",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }),
    );

    await expect(
      caller.management.technicians.createAvailability({
        technicianId: 2,
        availabilityType: "disponible",
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        notes: "Tentative non autorisée",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
