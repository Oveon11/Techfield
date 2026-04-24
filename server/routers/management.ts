import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  activityLogs,
  clientContacts,
  clients,
  documents,
  interventions,
  maintenanceContracts,
  projectAssignments,
  projects,
  sites,
  technicianAvailability,
  technicians,
} from "../../drizzle/schema";
import { protectedProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb, getUserAccessProfile } from "../db";
import { getSupabaseCalendarEvents, getSupabaseClientContactsList, getSupabaseClientsList, getSupabaseContractsList, getSupabaseDashboardSummary, getSupabaseDocumentsList, getSupabaseInterventionsHistory, getSupabaseInterventionsList, getSupabaseProjectsList, getSupabaseSitesList, getSupabaseTechnicianAvailability, getSupabaseTechniciansList } from "../integrations/supabase/db/management";
import { SUPABASE_ENV } from "../integrations/supabase/env";
import { storagePut } from "../storage";

const baseAddressSchema = z.object({
  city: z.string().min(1),
  postalCode: z.string().min(1).optional().nullable(),
  country: z.string().min(1).default("France"),
});

const createClientSchema = z.object({
  companyName: z.string().min(2),
  legalName: z.string().optional().nullable(),
  customerType: z.enum(["particulier", "professionnel", "collectivite"]).default("professionnel"),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  billingAddress: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const createSiteSchema = baseAddressSchema.extend({
  clientId: z.number().int().positive(),
  siteName: z.string().min(2),
  siteCode: z.string().optional().nullable(),
  addressLine1: z.string().min(3),
  addressLine2: z.string().optional().nullable(),
  accessInstructions: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const createClientContactSchema = z.object({
  clientId: z.number().int().positive(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  contactType: z.enum(["principal", "facturation", "technique", "administratif", "autre"]).default("principal"),
  isPrimary: z.boolean().default(false),
});

const createTechnicianSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  employeeCode: z.string().optional().nullable(),
  skills: z.array(z.string()).default([]),
  notes: z.string().optional().nullable(),
});

const createAvailabilitySchema = z.object({
  technicianId: z.number().int().positive(),
  availabilityType: z.enum(["disponible", "mission", "conge", "formation", "indisponible"]),
  startAt: z.string().min(5),
  endAt: z.string().min(5),
  notes: z.string().optional().nullable(),
});

const createProjectSchema = z.object({
  clientId: z.number().int().positive(),
  siteId: z.number().int().positive().optional().nullable(),
  title: z.string().min(3),
  serviceType: z.enum(["clim", "pac", "chauffe_eau", "pv", "vmc", "autre"]).default("autre"),
  description: z.string().optional().nullable(),
  status: z.enum(["brouillon", "planifie", "en_cours", "bloque", "termine", "annule"]).default("planifie"),
  progressPercent: z.number().int().min(0).max(100).default(0),
  estimatedHours: z.string().default("0.00"),
  actualHours: z.string().default("0.00"),
  budgetAmount: z.string().default("0.00"),
  startDate: z.string().optional().nullable(),
  plannedEndDate: z.string().optional().nullable(),
  technicianIds: z.array(z.number().int().positive()).default([]),
});

const createContractSchema = z.object({
  clientId: z.number().int().positive(),
  siteId: z.number().int().positive().optional().nullable(),
  title: z.string().min(3),
  serviceType: z.enum(["clim", "pac", "chauffe_eau", "pv", "vmc", "autre"]).default("autre"),
  frequency: z.enum(["mensuelle", "trimestrielle", "semestrielle", "annuelle", "personnalisee"]).default("annuelle"),
  status: z.enum(["brouillon", "actif", "renouvellement_proche", "expire", "suspendu"]).default("actif"),
  annualAmount: z.string().default("0.00"),
  renewalNoticeDays: z.number().int().min(0).max(365).default(30),
  startDate: z.string().optional().nullable(),
  nextServiceDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const renewContractSchema = z.object({
  contractId: z.number().int().positive(),
  startDate: z.string().min(5),
  nextServiceDate: z.string().optional().nullable(),
  endDate: z.string().min(5),
  annualAmount: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const createInterventionSchema = z.object({
  clientId: z.number().int().positive(),
  siteId: z.number().int().positive().optional().nullable(),
  projectId: z.number().int().positive().optional().nullable(),
  contractId: z.number().int().positive().optional().nullable(),
  technicianId: z.number().int().positive().optional().nullable(),
  title: z.string().min(3),
  description: z.string().optional().nullable(),
  interventionType: z.enum(["installation", "maintenance", "depannage", "inspection", "urgence", "autre"]).default("maintenance"),
  priority: z.enum(["basse", "normale", "haute", "urgente"]).default("normale"),
  status: z.enum(["planifiee", "assignee", "en_cours", "rapport_a_faire", "terminee", "annulee"]).default("planifiee"),
  scheduledStartAt: z.string().optional().nullable(),
  scheduledEndAt: z.string().optional().nullable(),
});

const interventionStatusUpdateSchema = z.object({
  interventionId: z.number().int().positive(),
  status: z.enum(["planifiee", "assignee", "en_cours", "rapport_a_faire", "terminee", "annulee"]),
  report: z.string().optional().nullable(),
});

const uploadDocumentSchema = z.object({
  entityType: z.enum(["client", "site", "project", "contract", "intervention"]),
  entityId: z.number().int().positive(),
  clientId: z.number().int().positive().optional().nullable(),
  siteId: z.number().int().positive().optional().nullable(),
  projectId: z.number().int().positive().optional().nullable(),
  contractId: z.number().int().positive().optional().nullable(),
  interventionId: z.number().int().positive().optional().nullable(),
  title: z.string().min(2),
  fileName: z.string().min(2),
  mimeType: z.string().min(3),
  base64Content: z.string().min(10),
  documentType: z.enum(["rapport", "photo", "contrat", "bon_intervention", "plan", "autre"]).default("autre"),
  visibility: z.enum(["interne", "client", "restreint"]).default("interne"),
});

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });
  }
  return db;
}

async function getScope(openId: string) {
  const profile = await getUserAccessProfile(openId);
  if (!profile) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Utilisateur introuvable." });
  }
  return profile;
}

function makeReference(prefix: string) {
  return `${prefix}-${nanoid(8).toUpperCase()}`;
}

async function logActivity(db: Awaited<ReturnType<typeof getDb>>, actorUserId: number, entityType: "client" | "site" | "project" | "contract" | "intervention" | "technician" | "document", entityId: number, action: string, message: string) {
  if (!db) return;

  await db.insert(activityLogs).values({
    actorUserId,
    entityType,
    entityId,
    action,
    message,
  });
}

export const managementRouter = router({
  dashboard: router({
    summary: protectedProcedure.query(async ({ ctx }) => {
      const scope = await getScope(ctx.user.openId);

      if (SUPABASE_ENV.isConfigured && ctx.supabase) {
        return getSupabaseDashboardSummary(scope);
      }

      const db = await requireDb();
      const clientFilter = scope.user.role === "client" && scope.clientContactProfile ? eq(projects.clientId, scope.clientContactProfile.clientId) : undefined;
      const interventionFilter = scope.user.role === "client" && scope.clientContactProfile
        ? eq(interventions.clientId, scope.clientContactProfile.clientId)
        : scope.user.role === "technicien" && scope.technicianProfile
          ? eq(interventions.technicianId, scope.technicianProfile.id)
          : undefined;
      const contractFilter = scope.user.role === "client" && scope.clientContactProfile
        ? eq(maintenanceContracts.clientId, scope.clientContactProfile.clientId)
        : undefined;

      const projectsInProgress = await db
        .select({ count: sql<number>`count(*)` })
        .from(projects)
        .where(clientFilter ?? eq(projects.status, "en_cours"));

      const upcomingInterventionsCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(interventions)
        .where(
          interventionFilter
            ? and(interventionFilter, sql`${interventions.scheduledStartAt} >= now()`)
            : sql`${interventions.scheduledStartAt} >= now()`,
        );

      const expiringContractsCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(maintenanceContracts)
        .where(
          contractFilter
            ? and(contractFilter, sql`${maintenanceContracts.endDate} is not null and ${maintenanceContracts.endDate} <= date_add(curdate(), interval 30 day)`)
            : sql`${maintenanceContracts.endDate} is not null and ${maintenanceContracts.endDate} <= date_add(curdate(), interval 30 day)`,
        );

      const upcomingInterventions = await db
        .select({
          id: interventions.id,
          reference: interventions.reference,
          title: interventions.title,
          status: interventions.status,
          scheduledStartAt: interventions.scheduledStartAt,
        })
        .from(interventions)
        .where(
          interventionFilter
            ? and(interventionFilter, sql`${interventions.scheduledStartAt} is not null and ${interventions.scheduledStartAt} >= now()`)
            : sql`${interventions.scheduledStartAt} is not null and ${interventions.scheduledStartAt} >= now()`,
        )
        .orderBy(asc(interventions.scheduledStartAt))
        .limit(5);

      const expiringContracts = await db
        .select({
          id: maintenanceContracts.id,
          contractNumber: maintenanceContracts.contractNumber,
          title: maintenanceContracts.title,
          endDate: maintenanceContracts.endDate,
          status: maintenanceContracts.status,
        })
        .from(maintenanceContracts)
        .where(
          contractFilter
            ? and(contractFilter, sql`${maintenanceContracts.endDate} is not null and ${maintenanceContracts.endDate} <= date_add(curdate(), interval 30 day)`)
            : sql`${maintenanceContracts.endDate} is not null and ${maintenanceContracts.endDate} <= date_add(curdate(), interval 30 day)`,
        )
        .orderBy(asc(maintenanceContracts.endDate))
        .limit(5);

      return {
        userRole: scope.user.role,
        cards: {
          projectsInProgress: Number(projectsInProgress[0]?.count ?? 0),
          upcomingInterventions: Number(upcomingInterventionsCount[0]?.count ?? 0),
          expiringContracts: Number(expiringContractsCount[0]?.count ?? 0),
        },
        upcomingInterventions,
        expiringContracts,
      };
    }),
  }),

  clients: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const scope = await getScope(ctx.user.openId);

      if (SUPABASE_ENV.isConfigured && ctx.supabase) {
        return getSupabaseClientsList(scope);
      }

      const db = await requireDb();
      const rows = await db
        .select()
        .from(clients)
        .where(scope.user.role === "client" && scope.clientContactProfile ? eq(clients.id, scope.clientContactProfile.clientId) : undefined)
        .orderBy(asc(clients.companyName));

      return rows;
    }),
    contacts: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        const scope = await getScope(ctx.user.openId);

        if (SUPABASE_ENV.isConfigured && ctx.supabase) {
          return getSupabaseClientContactsList(scope);
        }

        const db = await requireDb();
        return db
          .select({
            id: clientContacts.id,
            clientId: clientContacts.clientId,
            firstName: clientContacts.firstName,
            lastName: clientContacts.lastName,
            email: clientContacts.email,
            phone: clientContacts.phone,
            jobTitle: clientContacts.jobTitle,
            contactType: clientContacts.contactType,
            isPrimary: clientContacts.isPrimary,
            clientName: clients.companyName,
          })
          .from(clientContacts)
          .innerJoin(clients, eq(clientContacts.clientId, clients.id))
          .where(scope.user.role === "client" && scope.clientContactProfile ? eq(clientContacts.clientId, scope.clientContactProfile.clientId) : undefined)
          .orderBy(asc(clients.companyName), desc(clientContacts.isPrimary), asc(clientContacts.lastName));
      }),
      create: adminProcedure.input(createClientContactSchema).mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const [created] = await db
          .insert(clientContacts)
          .values({
            clientId: input.clientId,
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email ?? null,
            phone: input.phone ?? null,
            jobTitle: input.jobTitle ?? null,
            contactType: input.contactType,
            isPrimary: input.isPrimary ? 1 : 0,
          } as any)
          .$returningId();

        const createdId = Number(created?.id ?? 0);
        await logActivity(db, ctx.user.id, "client", input.clientId, "client.contact.created", `Contact client ajouté: ${input.firstName} ${input.lastName}`);
        return { success: true, id: createdId };
      }),
    }),
    create: adminProcedure.input(createClientSchema).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [created] = await db
        .insert(clients)
        .values({
          companyName: input.companyName,
          legalName: input.legalName ?? null,
          customerType: input.customerType,
          email: input.email ?? null,
          phone: input.phone ?? null,
          billingAddress: input.billingAddress ?? null,
          city: input.city ?? null,
          postalCode: input.postalCode ?? null,
          notes: input.notes ?? null,
        })
        .$returningId();

      const createdId = Number(created?.id ?? 0);
      await logActivity(db, ctx.user.id, "client", createdId, "client.created", `Client créé: ${input.companyName}`);
      return { success: true, id: createdId };
    }),
  }),

  sites: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const scope = await getScope(ctx.user.openId);

      if (SUPABASE_ENV.isConfigured && ctx.supabase) {
        return getSupabaseSitesList(scope);
      }

      const db = await requireDb();
      const rows = await db
        .select({
          id: sites.id,
          clientId: sites.clientId,
          clientName: clients.companyName,
          siteName: sites.siteName,
          siteCode: sites.siteCode,
          city: sites.city,
          postalCode: sites.postalCode,
          isActive: sites.isActive,
        })
        .from(sites)
        .innerJoin(clients, eq(sites.clientId, clients.id))
        .where(scope.user.role === "client" && scope.clientContactProfile ? eq(sites.clientId, scope.clientContactProfile.clientId) : undefined)
        .orderBy(asc(sites.siteName));

      return rows;
    }),
    create: adminProcedure.input(createSiteSchema).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [created] = await db
        .insert(sites)
        .values({
          clientId: input.clientId,
          siteName: input.siteName,
          siteCode: input.siteCode ?? null,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2 ?? null,
          postalCode: input.postalCode ?? null,
          city: input.city,
          country: input.country,
          accessInstructions: input.accessInstructions ?? null,
          notes: input.notes ?? null,
        })
        .$returningId();

      const createdId = Number(created?.id ?? 0);
      await logActivity(db, ctx.user.id, "site", createdId, "site.created", `Site créé: ${input.siteName}`);
      return { success: true, id: createdId };
    }),
  }),

  technicians: router({
    list: adminProcedure.query(async ({ ctx }) => {
      if (SUPABASE_ENV.isConfigured && ctx.supabase) {
        return getSupabaseTechniciansList();
      }

      const db = await requireDb();
      return db.select().from(technicians).orderBy(asc(technicians.lastName), asc(technicians.firstName));
    }),
    create: adminProcedure.input(createTechnicianSchema).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const [created] = await db
        .insert(technicians)
        .values({
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email ?? null,
          phone: input.phone ?? null,
          employeeCode: input.employeeCode ?? null,
          skills: input.skills,
          notes: input.notes ?? null,
        })
        .$returningId();

      const createdId = Number(created?.id ?? 0);
      await logActivity(db, ctx.user.id, "technician", createdId, "technician.created", `Technicien créé: ${input.firstName} ${input.lastName}`);
      return { success: true, id: createdId };
    }),
    availability: protectedProcedure.query(async ({ ctx }) => {
      const scope = await getScope(ctx.user.openId);

      if (SUPABASE_ENV.isConfigured && ctx.supabase) {
        return getSupabaseTechnicianAvailability(scope);
      }

      const db = await requireDb();
      if (scope.user.role === "technicien" && scope.technicianProfile) {
        return db
          .select()
          .from(technicianAvailability)
          .where(eq(technicianAvailability.technicianId, scope.technicianProfile.id))
          .orderBy(asc(technicianAvailability.startAt));
      }

      return db.select().from(technicianAvailability).orderBy(asc(technicianAvailability.startAt));
    }),
    createAvailability: protectedProcedure.input(createAvailabilitySchema).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const scope = await getScope(ctx.user.openId);

      if (scope.user.role === "technicien" && scope.technicianProfile?.id !== input.technicianId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Un technicien ne peut déclarer que ses propres disponibilités." });
      }

      if (scope.user.role === "client") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Ce profil ne peut pas gérer les disponibilités techniciens." });
      }

      const [created] = await db
        .insert(technicianAvailability)
        .values({
          technicianId: input.technicianId,
          availabilityType: input.availabilityType,
          startAt: new Date(input.startAt),
          endAt: new Date(input.endAt),
          notes: input.notes ?? null,
        } as any)
        .$returningId();

      const createdId = Number(created?.id ?? 0);
      await logActivity(db, ctx.user.id, "technician", input.technicianId, "technician.availability.created", `Disponibilité ajoutée pour le technicien ${input.technicianId}`);
      return { success: true, id: createdId };
    }),
  }),

  projects: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const scope = await getScope(ctx.user.openId);

      if (SUPABASE_ENV.isConfigured && ctx.supabase) {
        return getSupabaseProjectsList(scope);
      }

      const db = await requireDb();
      if (scope.user.role === "technicien" && scope.technicianProfile) {
        const assignments = await db
          .select({ projectId: projectAssignments.projectId })
          .from(projectAssignments)
          .where(eq(projectAssignments.technicianId, scope.technicianProfile.id));

        const projectIds = assignments.map(item => item.projectId);
        if (projectIds.length === 0) return [];

        return db
          .select({
            id: projects.id,
            reference: projects.reference,
            title: projects.title,
            status: projects.status,
            progressPercent: projects.progressPercent,
            clientName: clients.companyName,
            siteName: sites.siteName,
            assignedTechnicians: sql<string>`(
              select coalesce(group_concat(concat(${technicians.firstName}, ' ', ${technicians.lastName}) separator ', '), '')
              from ${projectAssignments}
              inner join ${technicians} on ${projectAssignments.technicianId} = ${technicians.id}
              where ${projectAssignments.projectId} = ${projects.id}
            )`,
          })
          .from(projects)
          .innerJoin(clients, eq(projects.clientId, clients.id))
          .leftJoin(sites, eq(projects.siteId, sites.id))
          .where(inArray(projects.id, projectIds))
          .orderBy(desc(projects.createdAt));
      }

      return db
        .select({
          id: projects.id,
          reference: projects.reference,
          title: projects.title,
          status: projects.status,
          progressPercent: projects.progressPercent,
          clientName: clients.companyName,
          siteName: sites.siteName,
          assignedTechnicians: sql<string>`(
            select coalesce(group_concat(concat(${technicians.firstName}, ' ', ${technicians.lastName}) separator ', '), '')
            from ${projectAssignments}
            inner join ${technicians} on ${projectAssignments.technicianId} = ${technicians.id}
            where ${projectAssignments.projectId} = ${projects.id}
          )`,
        })
        .from(projects)
        .innerJoin(clients, eq(projects.clientId, clients.id))
        .leftJoin(sites, eq(projects.siteId, sites.id))
        .where(scope.user.role === "client" && scope.clientContactProfile ? eq(projects.clientId, scope.clientContactProfile.clientId) : undefined)
        .orderBy(desc(projects.createdAt));
    }),
    create: adminProcedure.input(createProjectSchema).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const reference = makeReference("CH");
      const [created] = await db
        .insert(projects)
        .values({
          reference,
          clientId: input.clientId,
          siteId: input.siteId ?? null,
          title: input.title,
          serviceType: input.serviceType,
          description: input.description ?? null,
          status: input.status,
          progressPercent: input.progressPercent,
          estimatedHours: input.estimatedHours,
          actualHours: input.actualHours,
          budgetAmount: input.budgetAmount,
          startDate: input.startDate ?? null,
          plannedEndDate: input.plannedEndDate ?? null,
          createdByUserId: ctx.user.id,
        } as any)
        .$returningId();

      const createdId = Number(created?.id ?? 0);

      if (input.technicianIds.length > 0) {
        await db.insert(projectAssignments).values(
          input.technicianIds.map(technicianId => ({
            projectId: createdId,
            technicianId,
            assignmentRole: "technicien" as const,
            assignedByUserId: ctx.user.id,
          })),
        );
      }

      await logActivity(db, ctx.user.id, "project", createdId, "project.created", `Chantier créé: ${reference}`);
      return { success: true, id: createdId, reference };
    }),
    updateStatus: adminProcedure
      .input(z.object({ projectId: z.number().int().positive(), status: z.enum(["brouillon", "planifie", "en_cours", "bloque", "termine", "annule"]), progressPercent: z.number().int().min(0).max(100) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        await db
          .update(projects)
          .set({ status: input.status, progressPercent: input.progressPercent })
          .where(eq(projects.id, input.projectId));

        await logActivity(db, ctx.user.id, "project", input.projectId, "project.updated", `Statut chantier mis à jour: ${input.status}`);
        return { success: true };
      }),
  }),

  contracts: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const scope = await getScope(ctx.user.openId);

      if (SUPABASE_ENV.isConfigured && ctx.supabase) {
        return getSupabaseContractsList(scope);
      }

      const db = await requireDb();
      return db
        .select({
          id: maintenanceContracts.id,
          contractNumber: maintenanceContracts.contractNumber,
          title: maintenanceContracts.title,
          status: maintenanceContracts.status,
          frequency: maintenanceContracts.frequency,
          annualAmount: maintenanceContracts.annualAmount,
          renewalNoticeDays: maintenanceContracts.renewalNoticeDays,
          startDate: maintenanceContracts.startDate,
          nextServiceDate: maintenanceContracts.nextServiceDate,
          endDate: maintenanceContracts.endDate,
          notes: maintenanceContracts.notes,
          clientName: clients.companyName,
          siteName: sites.siteName,
        })
        .from(maintenanceContracts)
        .innerJoin(clients, eq(maintenanceContracts.clientId, clients.id))
        .leftJoin(sites, eq(maintenanceContracts.siteId, sites.id))
        .where(scope.user.role === "client" && scope.clientContactProfile ? eq(maintenanceContracts.clientId, scope.clientContactProfile.clientId) : undefined)
        .orderBy(asc(maintenanceContracts.endDate), desc(maintenanceContracts.createdAt));
    }),
    create: adminProcedure.input(createContractSchema).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const contractNumber = makeReference("CTR");
      const [created] = await db
        .insert(maintenanceContracts)
        .values({
          contractNumber,
          clientId: input.clientId,
          siteId: input.siteId ?? null,
          title: input.title,
          serviceType: input.serviceType,
          frequency: input.frequency,
          status: input.status,
          annualAmount: input.annualAmount,
          renewalNoticeDays: input.renewalNoticeDays,
          startDate: input.startDate ?? null,
          nextServiceDate: input.nextServiceDate ?? null,
          endDate: input.endDate ?? null,
          notes: input.notes ?? null,
          createdByUserId: ctx.user.id,
        } as any)
        .$returningId();

      const createdId = Number(created?.id ?? 0);
      await logActivity(db, ctx.user.id, "contract", createdId, "contract.created", `Contrat créé: ${contractNumber}`);
      return { success: true, id: createdId, contractNumber };
    }),
    renew: adminProcedure.input(renewContractSchema).mutation(async ({ ctx, input }) => {
      const db = await requireDb();

      await db
        .update(maintenanceContracts)
        .set({
          startDate: input.startDate,
          nextServiceDate: input.nextServiceDate ?? null,
          endDate: input.endDate,
          annualAmount: input.annualAmount ?? undefined,
          notes: input.notes ?? undefined,
          status: "actif",
        } as any)
        .where(eq(maintenanceContracts.id, input.contractId));

      await logActivity(db, ctx.user.id, "contract", input.contractId, "contract.renewed", `Contrat renouvelé jusqu'au ${input.endDate}`);
      return { success: true };
    }),
  }),

  interventions: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const scope = await getScope(ctx.user.openId);

      if (SUPABASE_ENV.isConfigured && ctx.supabase) {
        return getSupabaseInterventionsList(scope);
      }

      const db = await requireDb();
      return db
        .select({
          id: interventions.id,
          reference: interventions.reference,
          title: interventions.title,
          interventionType: interventions.interventionType,
          priority: interventions.priority,
          status: interventions.status,
          projectId: interventions.projectId,
          contractId: interventions.contractId,
          report: interventions.report,
          internalNotes: interventions.internalNotes,
          completedAt: interventions.completedAt,
          scheduledStartAt: interventions.scheduledStartAt,
          scheduledEndAt: interventions.scheduledEndAt,
          clientName: clients.companyName,
          siteName: sites.siteName,
          technicianName: sql<string>`concat(${technicians.firstName}, ' ', ${technicians.lastName})`,
        })
        .from(interventions)
        .innerJoin(clients, eq(interventions.clientId, clients.id))
        .leftJoin(sites, eq(interventions.siteId, sites.id))
        .leftJoin(technicians, eq(interventions.technicianId, technicians.id))
        .where(
          scope.user.role === "client" && scope.clientContactProfile
            ? eq(interventions.clientId, scope.clientContactProfile.clientId)
            : scope.user.role === "technicien" && scope.technicianProfile
              ? eq(interventions.technicianId, scope.technicianProfile.id)
              : undefined,
        )
        .orderBy(asc(interventions.scheduledStartAt), desc(interventions.createdAt));
    }),
    create: adminProcedure.input(createInterventionSchema).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const reference = makeReference("INT");
      const [created] = await db
        .insert(interventions)
        .values({
          reference,
          clientId: input.clientId,
          siteId: input.siteId ?? null,
          projectId: input.projectId ?? null,
          contractId: input.contractId ?? null,
          technicianId: input.technicianId ?? null,
          title: input.title,
          description: input.description ?? null,
          interventionType: input.interventionType,
          priority: input.priority,
          status: input.status,
          scheduledStartAt: input.scheduledStartAt ? new Date(input.scheduledStartAt) : null,
          scheduledEndAt: input.scheduledEndAt ? new Date(input.scheduledEndAt) : null,
          createdByUserId: ctx.user.id,
        } as any)
        .$returningId();

      const createdId = Number(created?.id ?? 0);
      await logActivity(db, ctx.user.id, "intervention", createdId, "intervention.created", `Intervention créée: ${reference}`);
      return { success: true, id: createdId, reference };
    }),
    updateStatus: protectedProcedure.input(interventionStatusUpdateSchema).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const scope = await getScope(ctx.user.openId);

      const current = await db.select().from(interventions).where(eq(interventions.id, input.interventionId)).limit(1);
      const item = current[0];
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Intervention introuvable." });
      }

      if (scope.user.role === "technicien" && scope.technicianProfile && item.technicianId !== scope.technicianProfile.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cette intervention n'est pas affectée à ce technicien." });
      }

      if (scope.user.role === "client") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Le client ne peut pas modifier l'intervention." });
      }

      await db
        .update(interventions)
        .set({
          status: input.status,
          report: input.report ?? item.report,
          startedAt: input.status === "en_cours" ? new Date() : item.startedAt,
          completedAt: input.status === "terminee" ? new Date() : item.completedAt,
        })
        .where(eq(interventions.id, input.interventionId));

      await logActivity(db, ctx.user.id, "intervention", input.interventionId, "intervention.updated", `Statut intervention mis à jour: ${input.status}`);
      return { success: true };
    }),
    history: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive().optional(), contractId: z.number().int().positive().optional() }))
      .query(async ({ ctx, input }) => {
        const scope = await getScope(ctx.user.openId);

        if (SUPABASE_ENV.isConfigured && ctx.supabase) {
          return getSupabaseInterventionsHistory(scope, input);
        }

        const db = await requireDb();
        return db
          .select({
            id: interventions.id,
            reference: interventions.reference,
            title: interventions.title,
            status: interventions.status,
            report: interventions.report,
            scheduledStartAt: interventions.scheduledStartAt,
            completedAt: interventions.completedAt,
            clientName: clients.companyName,
            siteName: sites.siteName,
          })
          .from(interventions)
          .innerJoin(clients, eq(interventions.clientId, clients.id))
          .leftJoin(sites, eq(interventions.siteId, sites.id))
          .where(and(
            input.projectId ? eq(interventions.projectId, input.projectId) : undefined,
            input.contractId ? eq(interventions.contractId, input.contractId) : undefined,
            scope.user.role === "client" && scope.clientContactProfile ? eq(interventions.clientId, scope.clientContactProfile.clientId) : undefined,
            scope.user.role === "technicien" && scope.technicianProfile ? eq(interventions.technicianId, scope.technicianProfile.id) : undefined,
          ))
          .orderBy(desc(interventions.completedAt), desc(interventions.createdAt));
      }),
  }),

  calendar: router({
    events: protectedProcedure.query(async ({ ctx }) => {
      const scope = await getScope(ctx.user.openId);

      if (SUPABASE_ENV.isConfigured && ctx.supabase) {
        return getSupabaseCalendarEvents(scope);
      }

      const db = await requireDb();
      const interventionRows = await db
        .select({
          id: interventions.id,
          title: interventions.title,
          start: interventions.scheduledStartAt,
          end: interventions.scheduledEndAt,
          status: interventions.status,
          eventType: sql<string>`'intervention'`,
        })
        .from(interventions)
        .where(
          scope.user.role === "client" && scope.clientContactProfile
            ? eq(interventions.clientId, scope.clientContactProfile.clientId)
            : scope.user.role === "technicien" && scope.technicianProfile
              ? eq(interventions.technicianId, scope.technicianProfile.id)
              : undefined,
        )
        .orderBy(asc(interventions.scheduledStartAt));

      const contractRows = await db
        .select({
          id: maintenanceContracts.id,
          title: maintenanceContracts.title,
          start: maintenanceContracts.nextServiceDate,
          end: maintenanceContracts.nextServiceDate,
          status: maintenanceContracts.status,
          eventType: sql<string>`'maintenance'`,
        })
        .from(maintenanceContracts)
        .where(scope.user.role === "client" && scope.clientContactProfile ? eq(maintenanceContracts.clientId, scope.clientContactProfile.clientId) : undefined)
        .orderBy(asc(maintenanceContracts.nextServiceDate));

      return [...interventionRows, ...contractRows];
    }),
  }),

  documents: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const scope = await getScope(ctx.user.openId);

      if (SUPABASE_ENV.isConfigured && ctx.supabase) {
        return getSupabaseDocumentsList(scope);
      }

      const db = await requireDb();
      return db
        .select({
          id: documents.id,
          title: documents.title,
          fileName: documents.fileName,
          fileUrl: documents.fileUrl,
          documentType: documents.documentType,
          visibility: documents.visibility,
          entityType: documents.entityType,
          entityId: documents.entityId,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .where(
          scope.user.role === "client" && scope.clientContactProfile
            ? and(eq(documents.clientId, scope.clientContactProfile.clientId), sql`${documents.visibility} in ('client', 'interne')`)
            : undefined,
        )
        .orderBy(desc(documents.createdAt));
    }),
    upload: protectedProcedure.input(uploadDocumentSchema).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const scope = await getScope(ctx.user.openId);

      if (scope.user.role === "client" && input.clientId && scope.clientContactProfile?.clientId !== input.clientId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Ce client ne peut pas déposer de document sur cet élément." });
      }

      const buffer = Buffer.from(input.base64Content, "base64");
      const stored = await storagePut(`techfield/${input.entityType}/${input.entityId}/${input.fileName}`, buffer, input.mimeType);
      const [created] = await db
        .insert(documents)
        .values({
          entityType: input.entityType,
          entityId: input.entityId,
          clientId: input.clientId ?? null,
          siteId: input.siteId ?? null,
          projectId: input.projectId ?? null,
          contractId: input.contractId ?? null,
          interventionId: input.interventionId ?? null,
          uploadedByUserId: ctx.user.id,
          title: input.title,
          fileName: input.fileName,
          fileKey: stored.key,
          fileUrl: stored.url,
          mimeType: input.mimeType,
          documentType: input.documentType,
          visibility: input.visibility,
        } as any)
        .$returningId();

      const createdId = Number(created?.id ?? 0);
      await logActivity(db, ctx.user.id, "document", createdId, "document.uploaded", `Document ajouté: ${input.title}`);
      return { success: true, id: createdId, url: stored.url };
    }),
  }),
});
