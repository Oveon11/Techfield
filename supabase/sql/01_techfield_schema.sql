begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  create type public.user_role as enum ('admin', 'technicien', 'client');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.user_status as enum ('active', 'invited', 'suspended');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.customer_type as enum ('particulier', 'professionnel', 'collectivite');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.contact_type as enum ('principal', 'technique', 'facturation', 'autre');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.service_type as enum ('clim', 'pac', 'chauffe_eau', 'pv', 'vmc', 'autre');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.project_status as enum ('brouillon', 'planifie', 'en_cours', 'bloque', 'termine', 'annule');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.contract_status as enum ('brouillon', 'actif', 'renouvellement_proche', 'expire', 'suspendu');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.contract_frequency as enum ('mensuelle', 'trimestrielle', 'semestrielle', 'annuelle', 'personnalisee');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.intervention_type as enum ('installation', 'maintenance', 'depannage', 'inspection', 'urgence', 'autre');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.intervention_priority as enum ('basse', 'normale', 'haute', 'urgente');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.intervention_status as enum ('planifiee', 'assignee', 'en_cours', 'rapport_a_faire', 'terminee', 'annulee');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.assignment_role as enum ('chef_equipe', 'technicien', 'renfort');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.availability_type as enum ('disponible', 'indisponible', 'conges', 'formation', 'maladie');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.document_type as enum ('rapport', 'photo', 'contrat', 'bon_intervention', 'plan', 'autre');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.document_visibility as enum ('interne', 'client', 'restreint');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.entity_type as enum ('user', 'client', 'site', 'project', 'contract', 'intervention', 'technician', 'document');
exception when duplicate_object then null;
end $$;

create table if not exists public.users (
  id bigint generated always as identity primary key,
  open_id varchar(64) not null unique,
  name text,
  email varchar(320) unique,
  phone varchar(32),
  login_method varchar(64),
  role public.user_role not null default 'client',
  account_status public.user_status not null default 'active',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_signed_in timestamptz not null default now()
);

create table if not exists public.clients (
  id bigint generated always as identity primary key,
  customer_type public.customer_type not null default 'professionnel',
  company_name varchar(255) not null,
  legal_name varchar(255),
  email varchar(320),
  phone varchar(32),
  billing_address text,
  postal_code varchar(20),
  city varchar(120),
  country varchar(120) not null default 'France',
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_contacts (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  user_id bigint unique references public.users(id) on delete set null,
  first_name varchar(120) not null,
  last_name varchar(120) not null,
  email varchar(320),
  phone varchar(32),
  job_title varchar(160),
  contact_type public.contact_type not null default 'principal',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sites (
  id bigint generated always as identity primary key,
  client_id bigint not null references public.clients(id) on delete cascade,
  site_code varchar(64),
  site_name varchar(255) not null,
  address_line_1 text not null,
  address_line_2 text,
  postal_code varchar(20),
  city varchar(120) not null,
  country varchar(120) not null default 'France',
  latitude double precision,
  longitude double precision,
  access_instructions text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.technicians (
  id bigint generated always as identity primary key,
  user_id bigint unique references public.users(id) on delete set null,
  first_name varchar(120) not null,
  last_name varchar(120) not null,
  email varchar(320),
  phone varchar(32),
  employee_code varchar(64) unique,
  skills jsonb,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id bigint generated always as identity primary key,
  reference varchar(64) not null unique,
  client_id bigint not null references public.clients(id) on delete restrict,
  site_id bigint references public.sites(id) on delete set null,
  title varchar(255) not null,
  service_type public.service_type not null default 'autre',
  description text,
  status public.project_status not null default 'brouillon',
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  estimated_hours numeric(8,2) not null default 0.00,
  actual_hours numeric(8,2) not null default 0.00,
  budget_amount numeric(12,2) not null default 0.00,
  start_date date,
  planned_end_date date,
  actual_end_date date,
  created_by_user_id bigint references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_assignments (
  id bigint generated always as identity primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  technician_id bigint not null references public.technicians(id) on delete cascade,
  assignment_role public.assignment_role not null default 'technicien',
  assigned_at timestamptz not null default now(),
  assigned_by_user_id bigint references public.users(id) on delete set null
);

create table if not exists public.maintenance_contracts (
  id bigint generated always as identity primary key,
  contract_number varchar(64) not null unique,
  client_id bigint not null references public.clients(id) on delete restrict,
  site_id bigint references public.sites(id) on delete set null,
  title varchar(255) not null,
  service_type public.service_type not null default 'autre',
  frequency public.contract_frequency not null default 'annuelle',
  status public.contract_status not null default 'brouillon',
  annual_amount numeric(12,2) not null default 0.00,
  renewal_notice_days integer not null default 30,
  start_date date,
  next_service_date date,
  end_date date,
  notes text,
  created_by_user_id bigint references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interventions (
  id bigint generated always as identity primary key,
  reference varchar(64) not null unique,
  client_id bigint not null references public.clients(id) on delete restrict,
  site_id bigint references public.sites(id) on delete set null,
  project_id bigint references public.projects(id) on delete set null,
  contract_id bigint references public.maintenance_contracts(id) on delete set null,
  technician_id bigint references public.technicians(id) on delete set null,
  title varchar(255) not null,
  description text,
  intervention_type public.intervention_type not null default 'maintenance',
  priority public.intervention_priority not null default 'normale',
  status public.intervention_status not null default 'planifiee',
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  report text,
  internal_notes text,
  created_by_user_id bigint references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.technician_availability (
  id bigint generated always as identity primary key,
  technician_id bigint not null references public.technicians(id) on delete cascade,
  availability_type public.availability_type not null default 'disponible',
  start_at timestamptz not null,
  end_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now(),
  check (end_at >= start_at)
);

create table if not exists public.documents (
  id bigint generated always as identity primary key,
  entity_type public.entity_type not null,
  entity_id bigint not null,
  client_id bigint references public.clients(id) on delete set null,
  site_id bigint references public.sites(id) on delete set null,
  project_id bigint references public.projects(id) on delete set null,
  contract_id bigint references public.maintenance_contracts(id) on delete set null,
  intervention_id bigint references public.interventions(id) on delete set null,
  uploaded_by_user_id bigint references public.users(id) on delete set null,
  title varchar(255) not null,
  file_name varchar(255) not null,
  file_key varchar(512) not null,
  file_url varchar(1024) not null,
  mime_type varchar(160),
  document_type public.document_type not null default 'autre',
  visibility public.document_visibility not null default 'interne',
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  actor_user_id bigint references public.users(id) on delete set null,
  entity_type public.entity_type not null,
  entity_id bigint not null,
  action varchar(120) not null,
  message text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists users_role_idx on public.users(role);
create index if not exists users_status_idx on public.users(account_status);
create index if not exists clients_company_idx on public.clients(company_name);
create index if not exists client_contacts_client_idx on public.client_contacts(client_id);
create index if not exists sites_client_idx on public.sites(client_id);
create index if not exists sites_site_code_idx on public.sites(site_code);
create index if not exists technicians_active_idx on public.technicians(is_active);
create index if not exists projects_client_idx on public.projects(client_id);
create index if not exists projects_site_idx on public.projects(site_id);
create index if not exists projects_status_idx on public.projects(status);
create index if not exists project_assignments_project_idx on public.project_assignments(project_id);
create index if not exists project_assignments_technician_idx on public.project_assignments(technician_id);
create index if not exists contracts_client_idx on public.maintenance_contracts(client_id);
create index if not exists contracts_site_idx on public.maintenance_contracts(site_id);
create index if not exists contracts_status_idx on public.maintenance_contracts(status);
create index if not exists contracts_next_service_idx on public.maintenance_contracts(next_service_date);
create index if not exists interventions_client_idx on public.interventions(client_id);
create index if not exists interventions_site_idx on public.interventions(site_id);
create index if not exists interventions_project_idx on public.interventions(project_id);
create index if not exists interventions_contract_idx on public.interventions(contract_id);
create index if not exists interventions_technician_idx on public.interventions(technician_id);
create index if not exists interventions_status_idx on public.interventions(status);
create index if not exists interventions_schedule_idx on public.interventions(scheduled_start_at);
create index if not exists technician_availability_technician_idx on public.technician_availability(technician_id);
create index if not exists technician_availability_start_idx on public.technician_availability(start_at);
create index if not exists documents_entity_idx on public.documents(entity_type, entity_id);
create index if not exists documents_project_idx on public.documents(project_id);
create index if not exists documents_contract_idx on public.documents(contract_id);
create index if not exists documents_intervention_idx on public.documents(intervention_id);
create index if not exists activity_logs_entity_idx on public.activity_logs(entity_type, entity_id);
create index if not exists activity_logs_actor_idx on public.activity_logs(actor_user_id);

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at before update on public.users for each row execute function public.set_updated_at();

drop trigger if exists set_clients_updated_at on public.clients;
create trigger set_clients_updated_at before update on public.clients for each row execute function public.set_updated_at();

drop trigger if exists set_client_contacts_updated_at on public.client_contacts;
create trigger set_client_contacts_updated_at before update on public.client_contacts for each row execute function public.set_updated_at();

drop trigger if exists set_sites_updated_at on public.sites;
create trigger set_sites_updated_at before update on public.sites for each row execute function public.set_updated_at();

drop trigger if exists set_technicians_updated_at on public.technicians;
create trigger set_technicians_updated_at before update on public.technicians for each row execute function public.set_updated_at();

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at before update on public.projects for each row execute function public.set_updated_at();

drop trigger if exists set_maintenance_contracts_updated_at on public.maintenance_contracts;
create trigger set_maintenance_contracts_updated_at before update on public.maintenance_contracts for each row execute function public.set_updated_at();

drop trigger if exists set_interventions_updated_at on public.interventions;
create trigger set_interventions_updated_at before update on public.interventions for each row execute function public.set_updated_at();

commit;
