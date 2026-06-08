-- ============================================================
-- Sprint 4 : Planning agenda entreprise
-- ============================================================

create table if not exists public.planning_slots (
  id            bigserial primary key,
  technician_id bigint not null references public.technicians(id) on delete cascade,
  project_id    bigint references public.projects(id) on delete set null,
  slot_date     date not null,
  start_time    time not null,
  end_time      time not null,
  notes         text,
  status        varchar(20) not null default 'scheduled'
                check (status in ('scheduled','in_progress','completed','cancelled')),
  -- Flags changements (pop-up)
  has_location_change boolean not null default false,
  has_time_change     boolean not null default false,
  has_discount        boolean not null default false,
  discount_note       text,
  change_note         text,
  -- Historique déplacement (ancienne position)
  prev_date       date,
  prev_start_time time,
  prev_end_time   time,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists planning_slots_date_idx        on public.planning_slots(slot_date);
create index if not exists planning_slots_technician_idx  on public.planning_slots(technician_id);

-- RLS
alter table public.planning_slots enable row level security;

drop policy if exists "planning_slots_admin_all"   on public.planning_slots;
drop policy if exists "planning_slots_tech_select" on public.planning_slots;
drop policy if exists "planning_slots_tech_update" on public.planning_slots;

create policy "planning_slots_admin_all" on public.planning_slots
  for all using (
    exists (select 1 from public.users u where u.open_id = auth.uid()::text and u.role = 'admin')
  );

create policy "planning_slots_tech_select" on public.planning_slots
  for select using (
    exists (
      select 1 from public.technicians t
      join public.users u on u.id = t.user_id
      where u.open_id = auth.uid()::text
        and t.id = planning_slots.technician_id
    )
  );

-- Trigger updated_at
drop trigger if exists set_planning_slots_updated_at on public.planning_slots;
create trigger set_planning_slots_updated_at
  before update on public.planning_slots
  for each row execute function public.set_updated_at();
