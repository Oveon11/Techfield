-- Sprint 3 — Médias du compte-rendu d'intervention
-- À appliquer sur Supabase via le SQL Editor du dashboard.

-- ============================================================
-- Table intervention_media
-- ============================================================

create table if not exists public.intervention_media (
  id                   bigint generated always as identity primary key,
  intervention_id      bigint not null references public.interventions(id) on delete cascade,
  caption              text,
  file_name            varchar(255) not null,
  file_key             text not null,
  mime_type            varchar(127),
  size_bytes           bigint,
  uploaded_by_user_id  bigint references public.users(id) on delete set null,
  created_at           timestamptz not null default now()
);

create index if not exists intervention_media_intervention_idx
  on public.intervention_media(intervention_id);

-- ============================================================
-- RLS
-- ============================================================

alter table public.intervention_media enable row level security;

-- Admin : accès total
drop policy if exists intervention_media_admin_all on public.intervention_media;
create policy intervention_media_admin_all on public.intervention_media
for all
using (public.tf_is_admin())
with check (public.tf_is_admin());

-- Technicien : lecture si c'est son intervention
drop policy if exists intervention_media_technician_select on public.intervention_media;
create policy intervention_media_technician_select on public.intervention_media
for select
using (
  public.tf_is_technician()
  and exists (
    select 1 from public.interventions i
    where i.id = intervention_media.intervention_id
      and i.technician_id = public.tf_technician_id()
  )
);

-- Technicien : insert s'il est l'auteur et c'est son intervention
drop policy if exists intervention_media_technician_insert on public.intervention_media;
create policy intervention_media_technician_insert on public.intervention_media
for insert
with check (
  public.tf_is_technician()
  and uploaded_by_user_id = public.tf_user_id()
  and exists (
    select 1 from public.interventions i
    where i.id = intervention_media.intervention_id
      and i.technician_id = public.tf_technician_id()
  )
);

-- Technicien : suppression de ses propres médias
drop policy if exists intervention_media_technician_delete on public.intervention_media;
create policy intervention_media_technician_delete on public.intervention_media
for delete
using (
  public.tf_is_technician()
  and uploaded_by_user_id = public.tf_user_id()
);

-- Clients : aucun accès aux médias d'intervention (photos internes)
