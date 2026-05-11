-- Sprint 2 - Chantier features : journal d'étapes, médias, mémos
-- Réutilise la table documents existante pour l'onglet Documents (filtre project_id).
-- Ajoute un bucket Storage dédié aux médias photo/vidéo.

begin;

-- ============================================================
-- 1. ENUMS
-- ============================================================

do $$ begin
  create type public.journal_entry_type as enum (
    'etape',
    'blocage',
    'livraison',
    'contact_client',
    'note'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.media_type as enum ('photo', 'video');
exception when duplicate_object then null;
end $$;

-- Étendre entity_type pour les nouveaux journaux/médias/mémos dans activity_logs.
alter type public.entity_type add value if not exists 'journal_entry';
alter type public.entity_type add value if not exists 'project_memo';
alter type public.entity_type add value if not exists 'project_media';

-- ============================================================
-- 2. TABLES
-- ============================================================

create table if not exists public.project_journal_entries (
  id bigint generated always as identity primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  entry_type public.journal_entry_type not null default 'etape',
  title varchar(255),
  content text not null,
  occurred_at timestamptz not null default now(),
  created_by_user_id bigint references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_memos (
  id bigint generated always as identity primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  title varchar(255),
  content text not null,
  created_by_user_id bigint references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_media (
  id bigint generated always as identity primary key,
  project_id bigint not null references public.projects(id) on delete cascade,
  media_type public.media_type not null default 'photo',
  caption varchar(500),
  file_name varchar(255) not null,
  file_key varchar(512) not null,
  mime_type varchar(160),
  size_bytes bigint,
  uploaded_by_user_id bigint references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 3. INDEX
-- ============================================================

create index if not exists project_journal_entries_project_idx
  on public.project_journal_entries(project_id);
create index if not exists project_journal_entries_occurred_idx
  on public.project_journal_entries(occurred_at desc);
create index if not exists project_journal_entries_type_idx
  on public.project_journal_entries(entry_type);

create index if not exists project_memos_project_idx
  on public.project_memos(project_id);

create index if not exists project_media_project_idx
  on public.project_media(project_id);
create index if not exists project_media_type_idx
  on public.project_media(media_type);

-- ============================================================
-- 4. TRIGGERS updated_at
-- ============================================================

drop trigger if exists set_project_journal_entries_updated_at on public.project_journal_entries;
create trigger set_project_journal_entries_updated_at
  before update on public.project_journal_entries
  for each row execute function public.set_updated_at();

drop trigger if exists set_project_memos_updated_at on public.project_memos;
create trigger set_project_memos_updated_at
  before update on public.project_memos
  for each row execute function public.set_updated_at();

-- ============================================================
-- 5. RLS - enable
-- ============================================================

alter table public.project_journal_entries enable row level security;
alter table public.project_memos enable row level security;
alter table public.project_media enable row level security;

-- ============================================================
-- 6. RLS - drop anciennes policies (idempotence)
-- ============================================================

drop policy if exists project_journal_entries_admin_all on public.project_journal_entries;
drop policy if exists project_journal_entries_technician_select on public.project_journal_entries;
drop policy if exists project_journal_entries_technician_insert on public.project_journal_entries;
drop policy if exists project_journal_entries_technician_update on public.project_journal_entries;
drop policy if exists project_journal_entries_technician_delete on public.project_journal_entries;
drop policy if exists project_journal_entries_client_select on public.project_journal_entries;

drop policy if exists project_memos_admin_all on public.project_memos;
drop policy if exists project_memos_technician_select on public.project_memos;
drop policy if exists project_memos_technician_insert on public.project_memos;
drop policy if exists project_memos_technician_update on public.project_memos;
drop policy if exists project_memos_technician_delete on public.project_memos;

drop policy if exists project_media_admin_all on public.project_media;
drop policy if exists project_media_technician_select on public.project_media;
drop policy if exists project_media_technician_insert on public.project_media;
drop policy if exists project_media_technician_delete on public.project_media;
drop policy if exists project_media_client_select on public.project_media;

-- ============================================================
-- 7. RLS - admin (accès complet)
-- ============================================================

create policy project_journal_entries_admin_all on public.project_journal_entries
for all
using (public.tf_is_admin())
with check (public.tf_is_admin());

create policy project_memos_admin_all on public.project_memos
for all
using (public.tf_is_admin())
with check (public.tf_is_admin());

create policy project_media_admin_all on public.project_media
for all
using (public.tf_is_admin())
with check (public.tf_is_admin());

-- ============================================================
-- 8. RLS - technicien (accès via project_assignments)
-- ============================================================

-- Journal : lecture + écriture pour les technos assignés au chantier
create policy project_journal_entries_technician_select on public.project_journal_entries
for select
using (
  public.tf_is_technician()
  and exists (
    select 1
    from public.project_assignments pa
    where pa.project_id = project_journal_entries.project_id
      and pa.technician_id = public.tf_technician_id()
  )
);

create policy project_journal_entries_technician_insert on public.project_journal_entries
for insert
with check (
  public.tf_is_technician()
  and created_by_user_id = public.tf_user_id()
  and exists (
    select 1
    from public.project_assignments pa
    where pa.project_id = project_journal_entries.project_id
      and pa.technician_id = public.tf_technician_id()
  )
);

create policy project_journal_entries_technician_update on public.project_journal_entries
for update
using (
  public.tf_is_technician()
  and created_by_user_id = public.tf_user_id()
)
with check (
  public.tf_is_technician()
  and created_by_user_id = public.tf_user_id()
);

create policy project_journal_entries_technician_delete on public.project_journal_entries
for delete
using (
  public.tf_is_technician()
  and created_by_user_id = public.tf_user_id()
);

-- Mémos : lecture/écriture pour les technos assignés au chantier
create policy project_memos_technician_select on public.project_memos
for select
using (
  public.tf_is_technician()
  and exists (
    select 1
    from public.project_assignments pa
    where pa.project_id = project_memos.project_id
      and pa.technician_id = public.tf_technician_id()
  )
);

create policy project_memos_technician_insert on public.project_memos
for insert
with check (
  public.tf_is_technician()
  and created_by_user_id = public.tf_user_id()
  and exists (
    select 1
    from public.project_assignments pa
    where pa.project_id = project_memos.project_id
      and pa.technician_id = public.tf_technician_id()
  )
);

create policy project_memos_technician_update on public.project_memos
for update
using (
  public.tf_is_technician()
  and created_by_user_id = public.tf_user_id()
)
with check (
  public.tf_is_technician()
  and created_by_user_id = public.tf_user_id()
);

create policy project_memos_technician_delete on public.project_memos
for delete
using (
  public.tf_is_technician()
  and created_by_user_id = public.tf_user_id()
);

-- Médias : lecture + upload + delete pour les technos assignés au chantier
create policy project_media_technician_select on public.project_media
for select
using (
  public.tf_is_technician()
  and exists (
    select 1
    from public.project_assignments pa
    where pa.project_id = project_media.project_id
      and pa.technician_id = public.tf_technician_id()
  )
);

create policy project_media_technician_insert on public.project_media
for insert
with check (
  public.tf_is_technician()
  and uploaded_by_user_id = public.tf_user_id()
  and exists (
    select 1
    from public.project_assignments pa
    where pa.project_id = project_media.project_id
      and pa.technician_id = public.tf_technician_id()
  )
);

create policy project_media_technician_delete on public.project_media
for delete
using (
  public.tf_is_technician()
  and uploaded_by_user_id = public.tf_user_id()
);

-- ============================================================
-- 9. RLS - client (lecture des médias liés à ses chantiers)
-- ============================================================

create policy project_media_client_select on public.project_media
for select
using (
  public.tf_is_client()
  and exists (
    select 1
    from public.projects p
    where p.id = project_media.project_id
      and p.client_id = public.tf_client_id()
  )
);

create policy project_journal_entries_client_select on public.project_journal_entries
for select
using (
  public.tf_is_client()
  and exists (
    select 1
    from public.projects p
    where p.id = project_journal_entries.project_id
      and p.client_id = public.tf_client_id()
  )
);

-- ============================================================
-- 10. STORAGE - bucket techfield-media (photos + vidéos)
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'techfield-media',
  'techfield-media',
  false,
  104857600, -- 100 MB pour permettre de petites vidéos terrain
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.project_journal_entries is 'Journal d''étapes par chantier (étape, blocage, livraison, contact client, note).';
comment on table public.project_memos is 'Mémos partagés par chantier (visibles par tous les utilisateurs du chantier).';
comment on table public.project_media is 'Photos et vidéos par chantier, fichiers stockés dans le bucket techfield-media.';

commit;
