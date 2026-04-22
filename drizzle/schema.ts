import {
  date,
  datetime,
  decimal,
  double,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const userRoleEnum = mysqlEnum("role", ["admin", "technicien", "client"]);
export const userStatusEnum = mysqlEnum("accountStatus", ["active", "invited", "suspended"]);
export const customerTypeEnum = mysqlEnum("customerType", ["particulier", "professionnel", "collectivite"]);
export const contactTypeEnum = mysqlEnum("contactType", ["principal", "technique", "facturation", "autre"]);
export const serviceTypeEnum = mysqlEnum("serviceType", ["clim", "pac", "chauffe_eau", "pv", "vmc", "autre"]);
export const projectStatusEnum = mysqlEnum("projectStatus", ["brouillon", "planifie", "en_cours", "bloque", "termine", "annule"]);
export const contractStatusEnum = mysqlEnum("contractStatus", ["brouillon", "actif", "renouvellement_proche", "expire", "suspendu"]);
export const contractFrequencyEnum = mysqlEnum("contractFrequency", ["mensuelle", "trimestrielle", "semestrielle", "annuelle", "personnalisee"]);
export const interventionTypeEnum = mysqlEnum("interventionType", ["installation", "maintenance", "depannage", "inspection", "urgence", "autre"]);
export const interventionPriorityEnum = mysqlEnum("interventionPriority", ["basse", "normale", "haute", "urgente"]);
export const interventionStatusEnum = mysqlEnum("interventionStatus", ["planifiee", "assignee", "en_cours", "rapport_a_faire", "terminee", "annulee"]);
export const assignmentRoleEnum = mysqlEnum("assignmentRole", ["chef_equipe", "technicien", "renfort"]);
export const availabilityTypeEnum = mysqlEnum("availabilityType", ["disponible", "indisponible", "conges", "formation", "maladie"]);
export const documentTypeEnum = mysqlEnum("documentType", ["rapport", "photo", "contrat", "bon_intervention", "plan", "autre"]);
export const documentVisibilityEnum = mysqlEnum("documentVisibility", ["interne", "client", "restreint"]);
export const entityTypeEnum = mysqlEnum("entityType", ["user", "client", "site", "project", "contract", "intervention", "technician", "document"]);

export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }).unique(),
    phone: varchar("phone", { length: 32 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: userRoleEnum.default("client").notNull(),
    accountStatus: userStatusEnum.default("active").notNull(),
    avatarUrl: text("avatarUrl"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  table => ({
    roleIdx: index("users_role_idx").on(table.role),
    statusIdx: index("users_status_idx").on(table.accountStatus),
  }),
);

export const clients = mysqlTable(
  "clients",
  {
    id: int("id").autoincrement().primaryKey(),
    customerType: customerTypeEnum.default("professionnel").notNull(),
    companyName: varchar("companyName", { length: 255 }).notNull(),
    legalName: varchar("legalName", { length: 255 }),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 32 }),
    billingAddress: text("billingAddress"),
    postalCode: varchar("postalCode", { length: 20 }),
    city: varchar("city", { length: 120 }),
    country: varchar("country", { length: 120 }).default("France").notNull(),
    notes: text("notes"),
    isActive: int("isActive").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    companyIdx: index("clients_company_idx").on(table.companyName),
  }),
);

export const clientContacts = mysqlTable(
  "clientContacts",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    userId: int("userId").references(() => users.id, { onDelete: "set null" }),
    firstName: varchar("firstName", { length: 120 }).notNull(),
    lastName: varchar("lastName", { length: 120 }).notNull(),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 32 }),
    jobTitle: varchar("jobTitle", { length: 160 }),
    contactType: contactTypeEnum.default("principal").notNull(),
    isPrimary: int("isPrimary").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    clientIdx: index("client_contacts_client_idx").on(table.clientId),
    userUniqueIdx: uniqueIndex("client_contacts_user_unique_idx").on(table.userId),
  }),
);

export const sites = mysqlTable(
  "sites",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    siteCode: varchar("siteCode", { length: 64 }),
    siteName: varchar("siteName", { length: 255 }).notNull(),
    addressLine1: text("addressLine1").notNull(),
    addressLine2: text("addressLine2"),
    postalCode: varchar("postalCode", { length: 20 }),
    city: varchar("city", { length: 120 }).notNull(),
    country: varchar("country", { length: 120 }).default("France").notNull(),
    latitude: double("latitude"),
    longitude: double("longitude"),
    accessInstructions: text("accessInstructions"),
    notes: text("notes"),
    isActive: int("isActive").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    clientIdx: index("sites_client_idx").on(table.clientId),
    siteCodeIdx: index("sites_site_code_idx").on(table.siteCode),
  }),
);

export const technicians = mysqlTable(
  "technicians",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").references(() => users.id, { onDelete: "set null" }),
    firstName: varchar("firstName", { length: 120 }).notNull(),
    lastName: varchar("lastName", { length: 120 }).notNull(),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 32 }),
    employeeCode: varchar("employeeCode", { length: 64 }),
    skills: json("skills").$type<string[] | null>(),
    notes: text("notes"),
    isActive: int("isActive").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    userUniqueIdx: uniqueIndex("technicians_user_unique_idx").on(table.userId),
    employeeCodeIdx: uniqueIndex("technicians_employee_code_idx").on(table.employeeCode),
    activeIdx: index("technicians_active_idx").on(table.isActive),
  }),
);

export const projects = mysqlTable(
  "projects",
  {
    id: int("id").autoincrement().primaryKey(),
    reference: varchar("reference", { length: 64 }).notNull().unique(),
    clientId: int("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    siteId: int("siteId").references(() => sites.id, { onDelete: "set null" }),
    title: varchar("title", { length: 255 }).notNull(),
    serviceType: serviceTypeEnum.default("autre").notNull(),
    description: text("description"),
    status: projectStatusEnum.default("brouillon").notNull(),
    progressPercent: int("progressPercent").default(0).notNull(),
    estimatedHours: decimal("estimatedHours", { precision: 8, scale: 2 }).default("0.00").notNull(),
    actualHours: decimal("actualHours", { precision: 8, scale: 2 }).default("0.00").notNull(),
    budgetAmount: decimal("budgetAmount", { precision: 12, scale: 2 }).default("0.00").notNull(),
    startDate: date("startDate"),
    plannedEndDate: date("plannedEndDate"),
    actualEndDate: date("actualEndDate"),
    createdByUserId: int("createdByUserId").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    clientIdx: index("projects_client_idx").on(table.clientId),
    siteIdx: index("projects_site_idx").on(table.siteId),
    statusIdx: index("projects_status_idx").on(table.status),
  }),
);

export const projectAssignments = mysqlTable(
  "projectAssignments",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    technicianId: int("technicianId")
      .notNull()
      .references(() => technicians.id, { onDelete: "cascade" }),
    assignmentRole: assignmentRoleEnum.default("technicien").notNull(),
    assignedAt: timestamp("assignedAt").defaultNow().notNull(),
    assignedByUserId: int("assignedByUserId").references(() => users.id, { onDelete: "set null" }),
  },
  table => ({
    projectIdx: index("project_assignments_project_idx").on(table.projectId),
    technicianIdx: index("project_assignments_technician_idx").on(table.technicianId),
  }),
);

export const maintenanceContracts = mysqlTable(
  "maintenanceContracts",
  {
    id: int("id").autoincrement().primaryKey(),
    contractNumber: varchar("contractNumber", { length: 64 }).notNull().unique(),
    clientId: int("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    siteId: int("siteId").references(() => sites.id, { onDelete: "set null" }),
    title: varchar("title", { length: 255 }).notNull(),
    serviceType: serviceTypeEnum.default("autre").notNull(),
    frequency: contractFrequencyEnum.default("annuelle").notNull(),
    status: contractStatusEnum.default("brouillon").notNull(),
    annualAmount: decimal("annualAmount", { precision: 12, scale: 2 }).default("0.00").notNull(),
    renewalNoticeDays: int("renewalNoticeDays").default(30).notNull(),
    startDate: date("startDate"),
    nextServiceDate: date("nextServiceDate"),
    endDate: date("endDate"),
    notes: text("notes"),
    createdByUserId: int("createdByUserId").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    clientIdx: index("contracts_client_idx").on(table.clientId),
    siteIdx: index("contracts_site_idx").on(table.siteId),
    statusIdx: index("contracts_status_idx").on(table.status),
    nextServiceIdx: index("contracts_next_service_idx").on(table.nextServiceDate),
  }),
);

export const interventions = mysqlTable(
  "interventions",
  {
    id: int("id").autoincrement().primaryKey(),
    reference: varchar("reference", { length: 64 }).notNull().unique(),
    clientId: int("clientId")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    siteId: int("siteId").references(() => sites.id, { onDelete: "set null" }),
    projectId: int("projectId").references(() => projects.id, { onDelete: "set null" }),
    contractId: int("contractId").references(() => maintenanceContracts.id, { onDelete: "set null" }),
    technicianId: int("technicianId").references(() => technicians.id, { onDelete: "set null" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    interventionType: interventionTypeEnum.default("maintenance").notNull(),
    priority: interventionPriorityEnum.default("normale").notNull(),
    status: interventionStatusEnum.default("planifiee").notNull(),
    scheduledStartAt: datetime("scheduledStartAt"),
    scheduledEndAt: datetime("scheduledEndAt"),
    startedAt: datetime("startedAt"),
    completedAt: datetime("completedAt"),
    report: text("report"),
    internalNotes: text("internalNotes"),
    createdByUserId: int("createdByUserId").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    clientIdx: index("interventions_client_idx").on(table.clientId),
    siteIdx: index("interventions_site_idx").on(table.siteId),
    projectIdx: index("interventions_project_idx").on(table.projectId),
    contractIdx: index("interventions_contract_idx").on(table.contractId),
    technicianIdx: index("interventions_technician_idx").on(table.technicianId),
    statusIdx: index("interventions_status_idx").on(table.status),
    scheduleIdx: index("interventions_schedule_idx").on(table.scheduledStartAt),
  }),
);

export const technicianAvailability = mysqlTable(
  "technicianAvailability",
  {
    id: int("id").autoincrement().primaryKey(),
    technicianId: int("technicianId")
      .notNull()
      .references(() => technicians.id, { onDelete: "cascade" }),
    availabilityType: availabilityTypeEnum.default("disponible").notNull(),
    startAt: datetime("startAt").notNull(),
    endAt: datetime("endAt").notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    technicianIdx: index("technician_availability_technician_idx").on(table.technicianId),
    startIdx: index("technician_availability_start_idx").on(table.startAt),
  }),
);

export const documents = mysqlTable(
  "documents",
  {
    id: int("id").autoincrement().primaryKey(),
    entityType: entityTypeEnum.notNull(),
    entityId: int("entityId").notNull(),
    clientId: int("clientId").references(() => clients.id, { onDelete: "set null" }),
    siteId: int("siteId").references(() => sites.id, { onDelete: "set null" }),
    projectId: int("projectId").references(() => projects.id, { onDelete: "set null" }),
    contractId: int("contractId").references(() => maintenanceContracts.id, { onDelete: "set null" }),
    interventionId: int("interventionId").references(() => interventions.id, { onDelete: "set null" }),
    uploadedByUserId: int("uploadedByUserId").references(() => users.id, { onDelete: "set null" }),
    title: varchar("title", { length: 255 }).notNull(),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    fileKey: varchar("fileKey", { length: 512 }).notNull(),
    fileUrl: varchar("fileUrl", { length: 1024 }).notNull(),
    mimeType: varchar("mimeType", { length: 160 }),
    documentType: documentTypeEnum.default("autre").notNull(),
    visibility: documentVisibilityEnum.default("interne").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    entityIdx: index("documents_entity_idx").on(table.entityType, table.entityId),
    projectIdx: index("documents_project_idx").on(table.projectId),
    contractIdx: index("documents_contract_idx").on(table.contractId),
    interventionIdx: index("documents_intervention_idx").on(table.interventionId),
  }),
);

export const activityLogs = mysqlTable(
  "activityLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    actorUserId: int("actorUserId").references(() => users.id, { onDelete: "set null" }),
    entityType: entityTypeEnum.notNull(),
    entityId: int("entityId").notNull(),
    action: varchar("action", { length: 120 }).notNull(),
    message: text("message"),
    metadata: json("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    entityIdx: index("activity_logs_entity_idx").on(table.entityType, table.entityId),
    actorIdx: index("activity_logs_actor_idx").on(table.actorUserId),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;
export type ClientContact = typeof clientContacts.$inferSelect;
export type Site = typeof sites.$inferSelect;
export type Technician = typeof technicians.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type MaintenanceContract = typeof maintenanceContracts.$inferSelect;
export type Intervention = typeof interventions.$inferSelect;
export type DocumentRecord = typeof documents.$inferSelect;
