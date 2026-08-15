-- ============================================================================
-- Trip debrief — P5 / v2 #23 "Mit bántam meg?" debrief
-- Architect-approved, design-pass branch is the canonical design source.
-- Forward-only migration.
--
-- Adds:
--   * public.trip_debriefs — one row per trip. 3 text[] mező a 3 kérdésre
--     (excess / missing / uncomfortable). A unique (trip_id) constraint az
--     upsertet kézben tartja. A created_at timestamptz az első kitöltés
--     időpontja; UPDATE esetén is megmarad (csak a row updated_at triggerje
--     frissül — lásd alább).
--
-- Miért új tábla és nem a trip_recaps.debrief JSONB:
--   * A debrief strukturálisan más, mint a recap (3 kérdés, 3 text[]).
--   * A Phase 6 #24 Trip-stats-hoz aggregációs forrás; a text[] SQL-szinten
--     sokkal könnyebben aggregálható, mint egy JSONB mező.
--   * A recap-tól független életciklus (lehet debrief recap nélkül, és
--     fordítva).
--
-- Visibility (RLS): owner OR trip_visible_to(trip_id). A publikus flag a
-- debrief-re nem értelmes (a debrief user-bevitel, nem publikus beszámoló).
-- ============================================================================

create table public.trip_debriefs (
  id                  uuid primary key default gen_random_uuid(),
  trip_id             uuid not null unique references public.trips(id) on delete cascade,
  excess_items        text[] not null default '{}',
  missing_items       text[] not null default '{}',
  uncomfortable_items text[] not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index trip_debriefs_trip_id_idx on public.trip_debriefs (trip_id);
create trigger trip_debriefs_set_updated_at
  before update on public.trip_debriefs
  for each row execute function public.tg_set_updated_at();

-- RLS
alter table public.trip_debriefs enable row level security;

-- SELECT — owner OR trip_visible_to(trip_id).
-- A debrief nem publikus (nincs public flag), de a trip_visible_to helper
-- a P2-ből már owner + accepted invitee + accepted friend logikát ad.
create policy trip_debriefs_select_visible
  on public.trip_debriefs
  for select using (
    exists (
      select 1 from public.trips t
       where t.id = trip_debriefs.trip_id and t.user_id = auth.uid()
    )
    or public.trip_visible_to(trip_id)
  );

-- INSERT — owner only (WITH CHECK a parent trip owner-ját erősíti).
create policy trip_debriefs_insert_owner
  on public.trip_debriefs
  for insert with check (
    exists (
      select 1 from public.trips t
       where t.id = trip_debriefs.trip_id and t.user_id = auth.uid()
    )
  );

-- UPDATE — owner only.
create policy trip_debriefs_update_owner
  on public.trip_debriefs
  for update using (
    exists (
      select 1 from public.trips t
       where t.id = trip_debriefs.trip_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trips t
       where t.id = trip_debriefs.trip_id and t.user_id = auth.uid()
    )
  );

-- DELETE — owner only (cascade a parent trip törlésével együtt jár).
create policy trip_debriefs_delete_owner
  on public.trip_debriefs
  for delete using (
    exists (
      select 1 from public.trips t
       where t.id = trip_debriefs.trip_id and t.user_id = auth.uid()
    )
  );