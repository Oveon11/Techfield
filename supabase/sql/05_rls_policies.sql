create or replace function public.tf_jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

create or replace function public.tf_role()
returns text
language sql
stable
as $$
  select coalesce(public.tf_jwt() ->> 'role', '');
$$;

create or replace function public.tf_open_id()
returns text
language sql
stable
as $$
  select coalesce(public.tf_jwt() ->> 'open_id', '');
$$;

create or replace function public.tf_email()
returns text
language sql
stable
as $$
  select lower(coalesce(public.tf_jwt() ->> 'email', ''));
$$;

create or replace function public.tf_user_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where (
    public.tf_open_id() <> '' and u.open_id = public.tf_open_id()
  )
  or (
    public.tf_email() <> '' and lower(u.email) = public.tf_email()
  )
  order by u.created_at asc
  limit 1;
$$;

create or replace function public.tf_technician_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select t.id
  from public.technicians t
  where t.user_id = public.tf_user_id()
  order by t.created_at asc
  limit 1;
$$;

create or replace function public.tf_client_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.clients c
  where public.tf_email() <> ''
    and lower(c.email) = public.tf_email()
  order by c.created_at asc
  limit 1;
$$;

create or replace function public.tf_is_admin()
returns boolean
language sql
stable
as $$
  select public.tf_role() = 'admin';
$$;

create or replace function public.tf_is_technician()
returns boolean
language sql
stable
as $$
  select public.tf_role() = 'technicien';
$$;

create or replace function public.tf_is_client()
returns boolean
language sql
stable
as $$
  select public.tf_role() = 'client';
$$;

alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.sites enable row level security;
alter table public.technicians enable row level security;
alter table public.projects enable row level security;
alter table public.project_assignments enable row level security;
alter table public.maintenance_contracts enable row level security;
alter table public.interventions enable row level security;
alter table public.technician_availability enable row level security;
alter table public.documents enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists users_admin_all on public.users;
drop policy if exists clients_admin_all on public.clients;
drop policy if exists client_contacts_admin_all on public.client_contacts;
drop policy if exists sites_admin_all on public.sites;
drop policy if exists technicians_admin_all on public.technicians;
drop policy if exists projects_admin_all on public.projects;
drop policy if exists project_assignments_admin_all on public.project_assignments;
drop policy if exists maintenance_contracts_admin_all on public.maintenance_contracts;
drop policy if exists interventions_admin_all on public.interventions;
drop policy if exists technician_availability_admin_all on public.technician_availability;
drop policy if exists documents_admin_all on public.documents;
drop policy if exists activity_logs_admin_all on public.activity_logs;

create policy users_admin_all on public.users
for all
using (public.tf_is_admin())
with check (public.tf_is_admin());

create policy clients_admin_all on public.clients
for all
using (public.tf_is_admin())
with check (public.tf_is_admin());

create policy client_contacts_admin_all on public.client_contacts
for all
using (public.tf_is_admin())
with check (public.tf_is_admin());

create policy sites_admin_all on public.sites
for all
using (public.tf_is_admin())
with check (public.tf_is_admin());

create policy technicians_admin_all on public.technicians
for all
using (public.tf_is_admin())
with check (public.tf_is_admin());

create policy projects_admin_all on public.projects
for all
using (public.tf_is_admin())
with check (public.tf_is_admin());

create policy project_assignments_admin_all on public.project_assignments
for all
using (public.tf_is_admin())
with check (public.tf_is_admin());

create policy maintenance_contracts_admin_all on public.maintenance_contracts
for all
using (public.tf_is_admin())
with check (public.tf_is_admin());

create policy interventions_admin_all on public.interventions
for all
using (public.tf_is_admin())
with check (public.tf_is_admin());

create policy technician_availability_admin_all on public.technician_availability
for all
using (public.tf_is_admin())
with check (public.tf_is_admin());

create policy documents_admin_all on public.documents
for all
using (public.tf_is_admin())
with check (public.tf_is_admin());

create policy activity_logs_admin_all on public.activity_logs
for all
using (public.tf_is_admin())
with check (public.tf_is_admin());

drop policy if exists users_self_select on public.users;
drop policy if exists technicians_self_select on public.technicians;
drop policy if exists project_assignments_technician_select on public.project_assignments;
drop policy if exists projects_technician_select on public.projects;
drop policy if exists clients_technician_select on public.clients;
drop policy if exists client_contacts_technician_select on public.client_contacts;
drop policy if exists sites_technician_select on public.sites;
drop policy if exists maintenance_contracts_technician_select on public.maintenance_contracts;
drop policy if exists interventions_technician_select on public.interventions;
drop policy if exists interventions_technician_insert on public.interventions;
drop policy if exists interventions_technician_update on public.interventions;
drop policy if exists technician_availability_technician_select on public.technician_availability;
drop policy if exists technician_availability_technician_insert on public.technician_availability;
drop policy if exists technician_availability_technician_update on public.technician_availability;
drop policy if exists technician_availability_technician_delete on public.technician_availability;
drop policy if exists documents_technician_select on public.documents;
drop policy if exists documents_technician_insert on public.documents;
drop policy if exists activity_logs_technician_select on public.activity_logs;
drop policy if exists activity_logs_technician_insert on public.activity_logs;

create policy users_self_select on public.users
for select
using (id = public.tf_user_id());

create policy technicians_self_select on public.technicians
for select
using (id = public.tf_technician_id());

create policy project_assignments_technician_select on public.project_assignments
for select
using (
  public.tf_is_technician()
  and technician_id = public.tf_technician_id()
);

create policy projects_technician_select on public.projects
for select
using (
  public.tf_is_technician()
  and exists (
    select 1
    from public.project_assignments pa
    where pa.project_id = projects.id
      and pa.technician_id = public.tf_technician_id()
  )
);

create policy clients_technician_select on public.clients
for select
using (
  public.tf_is_technician()
  and (
    exists (
      select 1
      from public.interventions i
      where i.client_id = clients.id
        and i.technician_id = public.tf_technician_id()
    )
    or exists (
      select 1
      from public.projects p
      join public.project_assignments pa on pa.project_id = p.id
      where p.client_id = clients.id
        and pa.technician_id = public.tf_technician_id()
    )
  )
);

create policy client_contacts_technician_select on public.client_contacts
for select
using (
  public.tf_is_technician()
  and exists (
    select 1
    from public.clients c
    where c.id = client_contacts.client_id
      and (
        exists (
          select 1
          from public.interventions i
          where i.client_id = c.id
            and i.technician_id = public.tf_technician_id()
        )
        or exists (
          select 1
          from public.projects p
          join public.project_assignments pa on pa.project_id = p.id
          where p.client_id = c.id
            and pa.technician_id = public.tf_technician_id()
        )
      )
  )
);

create policy sites_technician_select on public.sites
for select
using (
  public.tf_is_technician()
  and (
    exists (
      select 1
      from public.interventions i
      where i.site_id = sites.id
        and i.technician_id = public.tf_technician_id()
    )
    or exists (
      select 1
      from public.projects p
      join public.project_assignments pa on pa.project_id = p.id
      where p.site_id = sites.id
        and pa.technician_id = public.tf_technician_id()
    )
  )
);

create policy maintenance_contracts_technician_select on public.maintenance_contracts
for select
using (
  public.tf_is_technician()
  and (
    exists (
      select 1
      from public.interventions i
      where i.contract_id = maintenance_contracts.id
        and i.technician_id = public.tf_technician_id()
    )
    or exists (
      select 1
      from public.projects p
      join public.project_assignments pa on pa.project_id = p.id
      where p.site_id = maintenance_contracts.site_id
        and pa.technician_id = public.tf_technician_id()
    )
  )
);

create policy interventions_technician_select on public.interventions
for select
using (
  public.tf_is_technician()
  and technician_id = public.tf_technician_id()
);

create policy interventions_technician_insert on public.interventions
for insert
with check (
  public.tf_is_technician()
  and technician_id = public.tf_technician_id()
);

create policy interventions_technician_update on public.interventions
for update
using (
  public.tf_is_technician()
  and technician_id = public.tf_technician_id()
)
with check (
  public.tf_is_technician()
  and technician_id = public.tf_technician_id()
);

create policy technician_availability_technician_select on public.technician_availability
for select
using (
  public.tf_is_technician()
  and technician_id = public.tf_technician_id()
);

create policy technician_availability_technician_insert on public.technician_availability
for insert
with check (
  public.tf_is_technician()
  and technician_id = public.tf_technician_id()
);

create policy technician_availability_technician_update on public.technician_availability
for update
using (
  public.tf_is_technician()
  and technician_id = public.tf_technician_id()
)
with check (
  public.tf_is_technician()
  and technician_id = public.tf_technician_id()
);

create policy technician_availability_technician_delete on public.technician_availability
for delete
using (
  public.tf_is_technician()
  and technician_id = public.tf_technician_id()
);

create policy documents_technician_select on public.documents
for select
using (
  public.tf_is_technician()
  and (
    (intervention_id is not null and exists (
      select 1
      from public.interventions i
      where i.id = documents.intervention_id
        and i.technician_id = public.tf_technician_id()
    ))
    or
    (project_id is not null and exists (
      select 1
      from public.project_assignments pa
      where pa.project_id = documents.project_id
        and pa.technician_id = public.tf_technician_id()
    ))
  )
);

create policy documents_technician_insert on public.documents
for insert
with check (
  public.tf_is_technician()
  and uploaded_by_user_id = public.tf_user_id()
  and (
    (intervention_id is not null and exists (
      select 1
      from public.interventions i
      where i.id = documents.intervention_id
        and i.technician_id = public.tf_technician_id()
    ))
    or
    (project_id is not null and exists (
      select 1
      from public.project_assignments pa
      where pa.project_id = documents.project_id
        and pa.technician_id = public.tf_technician_id()
    ))
  )
);

create policy activity_logs_technician_select on public.activity_logs
for select
using (
  public.tf_is_technician()
  and actor_user_id = public.tf_user_id()
);

create policy activity_logs_technician_insert on public.activity_logs
for insert
with check (
  public.tf_is_technician()
  and actor_user_id = public.tf_user_id()
);

drop policy if exists clients_client_select on public.clients;
drop policy if exists client_contacts_client_select on public.client_contacts;
drop policy if exists sites_client_select on public.sites;
drop policy if exists projects_client_select on public.projects;
drop policy if exists maintenance_contracts_client_select on public.maintenance_contracts;
drop policy if exists interventions_client_select on public.interventions;
drop policy if exists documents_client_select on public.documents;
drop policy if exists users_client_self_select on public.users;

create policy users_client_self_select on public.users
for select
using (
  public.tf_is_client()
  and id = public.tf_user_id()
);

create policy clients_client_select on public.clients
for select
using (
  public.tf_is_client()
  and id = public.tf_client_id()
);

create policy client_contacts_client_select on public.client_contacts
for select
using (
  public.tf_is_client()
  and client_id = public.tf_client_id()
);

create policy sites_client_select on public.sites
for select
using (
  public.tf_is_client()
  and client_id = public.tf_client_id()
);

create policy projects_client_select on public.projects
for select
using (
  public.tf_is_client()
  and client_id = public.tf_client_id()
);

create policy maintenance_contracts_client_select on public.maintenance_contracts
for select
using (
  public.tf_is_client()
  and client_id = public.tf_client_id()
);

create policy interventions_client_select on public.interventions
for select
using (
  public.tf_is_client()
  and client_id = public.tf_client_id()
);

create policy documents_client_select on public.documents
for select
using (
  public.tf_is_client()
  and client_id = public.tf_client_id()
);
