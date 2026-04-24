import { createSupabaseAdminClient } from "./admin";

type AccessRole = "admin" | "technicien" | "client";
type InterventionStatus = "planifiee" | "assignee" | "en_cours" | "rapport_a_faire" | "terminee" | "annulee";
type InterventionPriority = "basse" | "normale" | "haute" | "urgente";
type InterventionType = "installation" | "maintenance" | "depannage" | "inspection" | "urgence" | "autre";
type CustomerType = "particulier" | "professionnel" | "collectivite";
type ContactType = "principal" | "technique" | "facturation" | "autre";
type AvailabilityType = "disponible" | "indisponible" | "conges" | "formation" | "maladie";
type ProjectStatus = "brouillon" | "planifie" | "en_cours" | "bloque" | "termine" | "annule";
type ContractStatus = "brouillon" | "actif" | "renouvellement_proche" | "expire" | "suspendu";
type ContractFrequency = "mensuelle" | "trimestrielle" | "semestrielle" | "annuelle" | "personnalisee";
type DocumentType = "rapport" | "photo" | "contrat" | "bon_intervention" | "plan" | "autre";
type DocumentVisibility = "interne" | "client" | "restreint";
type DocumentEntityType = "client" | "site" | "project" | "contract" | "intervention";

type AccessScope = {
  user: {
    role: AccessRole;
  };
  technicianProfile: {
    id: number;
  } | null;
  clientContactProfile: {
    clientId: number;
  } | null;
};

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function mapUpcomingIntervention(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    reference: String(row.reference ?? ""),
    title: String(row.title ?? ""),
    status: ((row.status as InterventionStatus | undefined) ?? "planifiee") as InterventionStatus,
    scheduledStartAt: (row.scheduled_start_at as string | null | undefined) ?? null,
  };
}

function mapExpiringContract(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    contractNumber: String(row.contract_number ?? ""),
    title: String(row.title ?? ""),
    endDate: (row.end_date as string | null | undefined) ?? null,
    status: ((row.status as ContractStatus | undefined) ?? "brouillon") as ContractStatus,
  };
}

function getSingleRelation(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (Array.isArray(value)) {
    return (value[0] as Record<string, unknown> | undefined) ?? null;
  }
  return (value as Record<string, unknown> | null | undefined) ?? null;
}

function mapClientRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    customerType: ((row.customer_type as CustomerType | undefined) ?? "professionnel") as CustomerType,
    companyName: String(row.company_name ?? ""),
    legalName: (row.legal_name as string | null | undefined) ?? null,
    email: (row.email as string | null | undefined) ?? null,
    phone: (row.phone as string | null | undefined) ?? null,
    billingAddress: (row.billing_address as string | null | undefined) ?? null,
    postalCode: (row.postal_code as string | null | undefined) ?? null,
    city: (row.city as string | null | undefined) ?? null,
    country: String(row.country ?? "France"),
    notes: (row.notes as string | null | undefined) ?? null,
    isActive: Number(row.is_active ?? 0),
    createdAt: row.created_at ? new Date(String(row.created_at)) : new Date(0),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)) : new Date(0),
  };
}

function mapClientContactRow(row: Record<string, unknown>) {
  const client = getSingleRelation(row, "clients");

  return {
    id: Number(row.id),
    clientId: Number(row.client_id ?? 0),
    firstName: String(row.first_name ?? ""),
    lastName: String(row.last_name ?? ""),
    email: (row.email as string | null | undefined) ?? null,
    phone: (row.phone as string | null | undefined) ?? null,
    jobTitle: (row.job_title as string | null | undefined) ?? null,
    contactType: ((row.contact_type as ContactType | undefined) ?? "principal") as ContactType,
    isPrimary: Number(row.is_primary ?? 0),
    clientName: String(client?.company_name ?? ""),
  };
}

function mapSiteRow(row: Record<string, unknown>) {
  const client = getSingleRelation(row, "clients");

  return {
    id: Number(row.id),
    clientId: Number(row.client_id ?? 0),
    clientName: String(client?.company_name ?? ""),
    siteName: String(row.site_name ?? ""),
    siteCode: (row.site_code as string | null | undefined) ?? null,
    city: String(row.city ?? ""),
    postalCode: (row.postal_code as string | null | undefined) ?? null,
    isActive: Number(row.is_active ?? 0),
  };
}

function mapTechnicianRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    userId: row.user_id == null ? null : Number(row.user_id),
    firstName: String(row.first_name ?? ""),
    lastName: String(row.last_name ?? ""),
    email: (row.email as string | null | undefined) ?? null,
    phone: (row.phone as string | null | undefined) ?? null,
    employeeCode: (row.employee_code as string | null | undefined) ?? null,
    skills: Array.isArray(row.skills) ? row.skills.map((item) => String(item)) : null,
    notes: (row.notes as string | null | undefined) ?? null,
    isActive: Number(row.is_active ?? 0),
    createdAt: row.created_at ? new Date(String(row.created_at)) : new Date(0),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)) : new Date(0),
  };
}

function mapTechnicianAvailabilityRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    technicianId: Number(row.technician_id ?? 0),
    availabilityType: ((row.availability_type as AvailabilityType | undefined) ?? "disponible") as AvailabilityType,
    startAt: row.start_at ? new Date(String(row.start_at)) : new Date(0),
    endAt: row.end_at ? new Date(String(row.end_at)) : new Date(0),
    notes: (row.notes as string | null | undefined) ?? null,
    createdAt: row.created_at ? new Date(String(row.created_at)) : new Date(0),
  };
}

function mapProjectRow(row: Record<string, unknown>) {
  const client = getSingleRelation(row, "clients");
  const site = getSingleRelation(row, "sites");
  const assignments = (row.project_assignments as Array<Record<string, unknown>> | undefined) ?? [];
  const assignedTechnicians = assignments
    .map((assignment) => {
      const technician = getSingleRelation(assignment, "technicians");
      const firstName = String(technician?.first_name ?? "").trim();
      const lastName = String(technician?.last_name ?? "").trim();
      return `${firstName} ${lastName}`.trim();
    })
    .filter(Boolean)
    .join(", ");

  return {
    id: Number(row.id),
    reference: String(row.reference ?? ""),
    title: String(row.title ?? ""),
    status: ((row.status as ProjectStatus | undefined) ?? "planifie") as ProjectStatus,
    progressPercent: Number(row.progress_percent ?? 0),
    clientName: String(client?.company_name ?? ""),
    siteName: (site?.site_name as string | undefined) ?? null,
    assignedTechnicians,
  };
}

function mapContractRow(row: Record<string, unknown>) {
  const client = getSingleRelation(row, "clients");
  const site = getSingleRelation(row, "sites");

  return {
    id: Number(row.id),
    contractNumber: String(row.contract_number ?? ""),
    title: String(row.title ?? ""),
    status: ((row.status as ContractStatus | undefined) ?? "brouillon") as ContractStatus,
    frequency: ((row.frequency as ContractFrequency | undefined) ?? "annuelle") as ContractFrequency,
    annualAmount: row.annual_amount == null ? null : String(row.annual_amount),
    renewalNoticeDays: row.renewal_notice_days == null ? null : Number(row.renewal_notice_days),
    startDate: (row.start_date as string | null | undefined) ?? null,
    nextServiceDate: (row.next_service_date as string | null | undefined) ?? null,
    endDate: (row.end_date as string | null | undefined) ?? null,
    notes: (row.notes as string | null | undefined) ?? null,
    clientName: (client?.company_name as string | undefined) ?? "",
    siteName: (site?.site_name as string | undefined) ?? null,
  };
}

function mapInterventionRow(row: Record<string, unknown>) {
  const client = getSingleRelation(row, "clients");
  const site = getSingleRelation(row, "sites");
  const technician = getSingleRelation(row, "technicians");
  const firstName = (technician?.first_name as string | undefined) ?? "";
  const lastName = (technician?.last_name as string | undefined) ?? "";
  const technicianName = `${firstName} ${lastName}`.trim();

  return {
    id: Number(row.id),
    reference: String(row.reference ?? ""),
    title: String(row.title ?? ""),
    interventionType: ((row.intervention_type as InterventionType | undefined) ?? "maintenance") as InterventionType,
    priority: ((row.priority as InterventionPriority | undefined) ?? "normale") as InterventionPriority,
    status: ((row.status as InterventionStatus | undefined) ?? "planifiee") as InterventionStatus,
    projectId: row.project_id == null ? null : Number(row.project_id),
    contractId: row.contract_id == null ? null : Number(row.contract_id),
    report: (row.report as string | null | undefined) ?? null,
    internalNotes: (row.internal_notes as string | null | undefined) ?? null,
    completedAt: (row.completed_at as string | null | undefined) ?? null,
    scheduledStartAt: (row.scheduled_start_at as string | null | undefined) ?? null,
    scheduledEndAt: (row.scheduled_end_at as string | null | undefined) ?? null,
    clientName: (client?.company_name as string | undefined) ?? "",
    siteName: (site?.site_name as string | undefined) ?? null,
    technicianName: technicianName || null,
  };
}

export async function getSupabaseClientsList(scope: AccessScope) {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("clients")
    .select("id, customer_type, company_name, legal_name, email, phone, billing_address, postal_code, city, country, notes, is_active, created_at, updated_at")
    .order("company_name", { ascending: true });

  if (scope.user.role === "client" && scope.clientContactProfile) {
    query = query.eq("id", scope.clientContactProfile.clientId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapClientRow(row as Record<string, unknown>));
}

export async function getSupabaseClientContactsList(scope: AccessScope) {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("client_contacts")
    .select("id, client_id, first_name, last_name, email, phone, job_title, contact_type, is_primary, clients(company_name)")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (scope.user.role === "client" && scope.clientContactProfile) {
    query = query.eq("client_id", scope.clientContactProfile.clientId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapClientContactRow(row as Record<string, unknown>));
}

export async function getSupabaseSitesList(scope: AccessScope) {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("sites")
    .select("id, client_id, site_name, site_code, city, postal_code, is_active, clients(company_name)")
    .order("site_name", { ascending: true });

  if (scope.user.role === "client" && scope.clientContactProfile) {
    query = query.eq("client_id", scope.clientContactProfile.clientId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapSiteRow(row as Record<string, unknown>));
}

export async function getSupabaseTechniciansList() {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("technicians")
    .select("id, user_id, first_name, last_name, email, phone, employee_code, skills, notes, is_active, created_at, updated_at")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapTechnicianRow(row as Record<string, unknown>));
}

export async function getSupabaseTechnicianAvailability(scope: AccessScope) {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("technician_availability")
    .select("id, technician_id, availability_type, start_at, end_at, notes, created_at")
    .order("start_at", { ascending: true });

  if (scope.user.role === "technicien" && scope.technicianProfile) {
    query = query.eq("technician_id", scope.technicianProfile.id);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapTechnicianAvailabilityRow(row as Record<string, unknown>));
}

export async function getSupabaseProjectsList(scope: AccessScope) {
  const supabase = createSupabaseAdminClient();

  let projectIds: number[] | null = null;
  if (scope.user.role === "technicien" && scope.technicianProfile) {
    const { data: assignmentRows, error: assignmentError } = await supabase
      .from("project_assignments")
      .select("project_id")
      .eq("technician_id", scope.technicianProfile.id);

    if (assignmentError) {
      throw assignmentError;
    }

    projectIds = (assignmentRows ?? []).map((row) => Number((row as Record<string, unknown>).project_id)).filter(Boolean);
    if (projectIds.length === 0) {
      return [];
    }
  }

  let query = supabase
    .from("projects")
    .select("id, reference, title, status, progress_percent, created_at, clients(company_name), sites(site_name), project_assignments(technicians(first_name, last_name))")
    .order("created_at", { ascending: false });

  if (projectIds) {
    query = query.in("id", projectIds);
  } else if (scope.user.role === "client" && scope.clientContactProfile) {
    query = query.eq("client_id", scope.clientContactProfile.clientId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapProjectRow(row as Record<string, unknown>));
}

export async function getSupabaseDashboardSummary(scope: AccessScope) {
  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const next30Date = addDays(now, 30).toISOString().slice(0, 10);

  let projectsCountQuery = supabase.from("projects").select("id", { count: "exact", head: true });
  if (scope.user.role === "client" && scope.clientContactProfile) {
    projectsCountQuery = projectsCountQuery.eq("client_id", scope.clientContactProfile.clientId);
  } else {
    projectsCountQuery = projectsCountQuery.eq("status", "en_cours");
  }

  let upcomingCountQuery = supabase
    .from("interventions")
    .select("id", { count: "exact", head: true })
    .gte("scheduled_start_at", nowIso);
  if (scope.user.role === "client" && scope.clientContactProfile) {
    upcomingCountQuery = upcomingCountQuery.eq("client_id", scope.clientContactProfile.clientId);
  } else if (scope.user.role === "technicien" && scope.technicianProfile) {
    upcomingCountQuery = upcomingCountQuery.eq("technician_id", scope.technicianProfile.id);
  }

  let expiringCountQuery = supabase
    .from("maintenance_contracts")
    .select("id", { count: "exact", head: true })
    .not("end_date", "is", null)
    .lte("end_date", next30Date);
  if (scope.user.role === "client" && scope.clientContactProfile) {
    expiringCountQuery = expiringCountQuery.eq("client_id", scope.clientContactProfile.clientId);
  }

  let upcomingListQuery = supabase
    .from("interventions")
    .select("id, reference, title, status, scheduled_start_at")
    .not("scheduled_start_at", "is", null)
    .gte("scheduled_start_at", nowIso)
    .order("scheduled_start_at", { ascending: true })
    .limit(5);
  if (scope.user.role === "client" && scope.clientContactProfile) {
    upcomingListQuery = upcomingListQuery.eq("client_id", scope.clientContactProfile.clientId);
  } else if (scope.user.role === "technicien" && scope.technicianProfile) {
    upcomingListQuery = upcomingListQuery.eq("technician_id", scope.technicianProfile.id);
  }

  let expiringListQuery = supabase
    .from("maintenance_contracts")
    .select("id, contract_number, title, end_date, status")
    .not("end_date", "is", null)
    .lte("end_date", next30Date)
    .order("end_date", { ascending: true })
    .limit(5);
  if (scope.user.role === "client" && scope.clientContactProfile) {
    expiringListQuery = expiringListQuery.eq("client_id", scope.clientContactProfile.clientId);
  }

  const [
    { count: projectsCount, error: projectsError },
    { count: upcomingCount, error: upcomingCountError },
    { count: expiringCount, error: expiringCountError },
    { data: upcomingRows, error: upcomingRowsError },
    { data: expiringRows, error: expiringRowsError },
  ] = await Promise.all([
    projectsCountQuery,
    upcomingCountQuery,
    expiringCountQuery,
    upcomingListQuery,
    expiringListQuery,
  ]);

  const firstError = projectsError ?? upcomingCountError ?? expiringCountError ?? upcomingRowsError ?? expiringRowsError;
  if (firstError) {
    throw firstError;
  }

  return {
    userRole: scope.user.role,
    cards: {
      projectsInProgress: Number(projectsCount ?? 0),
      upcomingInterventions: Number(upcomingCount ?? 0),
      expiringContracts: Number(expiringCount ?? 0),
    },
    upcomingInterventions: (upcomingRows ?? []).map((row) => mapUpcomingIntervention(row as Record<string, unknown>)),
    expiringContracts: (expiringRows ?? []).map((row) => mapExpiringContract(row as Record<string, unknown>)),
  };
}

export async function getSupabaseInterventionsList(scope: AccessScope) {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("interventions")
    .select("id, reference, title, intervention_type, priority, status, project_id, contract_id, report, internal_notes, completed_at, scheduled_start_at, scheduled_end_at, created_at, clients(company_name), sites(site_name), technicians(first_name, last_name)")
    .order("scheduled_start_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (scope.user.role === "client" && scope.clientContactProfile) {
    query = query.eq("client_id", scope.clientContactProfile.clientId);
  } else if (scope.user.role === "technicien" && scope.technicianProfile) {
    query = query.eq("technician_id", scope.technicianProfile.id);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapInterventionRow(row as Record<string, unknown>));
}

export async function getSupabaseContractsList(scope: AccessScope) {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("maintenance_contracts")
    .select("id, contract_number, title, status, frequency, annual_amount, renewal_notice_days, start_date, next_service_date, end_date, notes, created_at, clients(company_name), sites(site_name)")
    .order("end_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (scope.user.role === "client" && scope.clientContactProfile) {
    query = query.eq("client_id", scope.clientContactProfile.clientId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapContractRow(row as Record<string, unknown>));
}

export async function getSupabaseCalendarEvents(scope: AccessScope) {
  const supabase = createSupabaseAdminClient();

  let interventionsQuery = supabase
    .from("interventions")
    .select("id, title, scheduled_start_at, scheduled_end_at, status, created_at")
    .order("scheduled_start_at", { ascending: true, nullsFirst: false });

  if (scope.user.role === "client" && scope.clientContactProfile) {
    interventionsQuery = interventionsQuery.eq("client_id", scope.clientContactProfile.clientId);
  } else if (scope.user.role === "technicien" && scope.technicianProfile) {
    interventionsQuery = interventionsQuery.eq("technician_id", scope.technicianProfile.id);
  }

  let contractsQuery = supabase
    .from("maintenance_contracts")
    .select("id, title, next_service_date, status, created_at")
    .order("next_service_date", { ascending: true, nullsFirst: false });

  if (scope.user.role === "client" && scope.clientContactProfile) {
    contractsQuery = contractsQuery.eq("client_id", scope.clientContactProfile.clientId);
  }

  const [interventionsResult, contractsResult] = await Promise.all([interventionsQuery, contractsQuery]);

  if (interventionsResult.error) {
    throw interventionsResult.error;
  }

  if (contractsResult.error) {
    throw contractsResult.error;
  }

  const interventionRows = (interventionsResult.data ?? []).map((row) => {
    const item = row as Record<string, unknown>;
    return {
      id: Number(item.id),
      title: String(item.title ?? ""),
      start: item.scheduled_start_at ? new Date(String(item.scheduled_start_at)) : null,
      end: item.scheduled_end_at ? new Date(String(item.scheduled_end_at)) : null,
      status: ((item.status as InterventionStatus | undefined) ?? "planifiee") as InterventionStatus,
      eventType: "intervention" as const,
    };
  });

  const contractRows = (contractsResult.data ?? []).map((row) => {
    const item = row as Record<string, unknown>;
    const nextServiceDate = (item.next_service_date as string | null | undefined) ?? null;
    return {
      id: Number(item.id),
      title: String(item.title ?? ""),
      start: nextServiceDate ? new Date(String(nextServiceDate)) : null,
      end: nextServiceDate ? new Date(String(nextServiceDate)) : null,
      status: ((item.status as ContractStatus | undefined) ?? "brouillon") as ContractStatus,
      eventType: "maintenance" as const,
    };
  });

  return [...interventionRows, ...contractRows];
}

export async function getSupabaseDocumentsList(scope: AccessScope) {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("documents")
    .select("id, title, file_name, file_url, document_type, visibility, entity_type, entity_id, created_at")
    .order("created_at", { ascending: false });

  if (scope.user.role === "client" && scope.clientContactProfile) {
    query = query
      .eq("client_id", scope.clientContactProfile.clientId)
      .in("visibility", ["client", "interne"]);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const item = row as Record<string, unknown>;
    return {
      id: Number(item.id),
      title: String(item.title ?? ""),
      fileName: String(item.file_name ?? ""),
      fileUrl: String(item.file_url ?? ""),
      documentType: ((item.document_type as DocumentType | undefined) ?? "autre") as DocumentType,
      visibility: ((item.visibility as DocumentVisibility | undefined) ?? "interne") as DocumentVisibility,
      entityType: ((item.entity_type as DocumentEntityType | undefined) ?? "project") as DocumentEntityType,
      entityId: Number(item.entity_id ?? 0),
      createdAt: item.created_at ? new Date(String(item.created_at)) : new Date(0),
    };
  });
}

export async function getSupabaseInterventionsHistory(
  scope: AccessScope,
  input: { projectId?: number; contractId?: number }
) {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("interventions")
    .select("id, reference, title, status, report, scheduled_start_at, completed_at, created_at, clients(company_name), sites(site_name)")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (input.projectId) {
    query = query.eq("project_id", input.projectId);
  }

  if (input.contractId) {
    query = query.eq("contract_id", input.contractId);
  }

  if (scope.user.role === "client" && scope.clientContactProfile) {
    query = query.eq("client_id", scope.clientContactProfile.clientId);
  } else if (scope.user.role === "technicien" && scope.technicianProfile) {
    query = query.eq("technician_id", scope.technicianProfile.id);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const item = row as Record<string, unknown>;
    const client = getSingleRelation(item, "clients");
    const site = getSingleRelation(item, "sites");

    return {
      id: Number(item.id),
      reference: String(item.reference ?? ""),
      title: String(item.title ?? ""),
      status: ((item.status as InterventionStatus | undefined) ?? "planifiee") as InterventionStatus,
      report: (item.report as string | null | undefined) ?? null,
      scheduledStartAt: (item.scheduled_start_at as string | null | undefined) ?? null,
      completedAt: (item.completed_at as string | null | undefined) ?? null,
      clientName: (client?.company_name as string | undefined) ?? "",
      siteName: (site?.site_name as string | undefined) ?? null,
    };
  });
}
