-- ============================================================================
-- Trips — schema additions for the Trip CRUD + gear picker card.
-- Architect-approved (comment id 6a7cf65ba89ee3afc5539b23).
-- Forward-only migration.
--
-- Adds:
--   * public.trips         — owner-scoped trip list with name / dates / desc.
--   * public.trip_gear     — M:N switch table between trips and gear_items
--                            with a quantity column (>= 1).
--
-- Both tables get RLS enabled + per-user CRUD policies. The trip_gear
-- policies defer to the parent trip's owner, so cross-user INSERT/UPDATE/
-- DELETE attempts fail the WITH CHECK clause even if the gear_item is
-- owned by the caller (RLS forces a trip ownership join).
-- ============================================================================

-- ----- 1) trips -------------------------------------------------------------
create table public.trips (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid()
                          references auth.users(id) on delete cascade,
  name         text not null,
  description  text,
  start_date   date,
  end_date     date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Owner rule: when both dates are present, start must not be after end.
  -- Either side nullable is allowed (open-ended trips).
  check (
    start_date is null
    or end_date is null
    or start_date <= end_date
  )
);
create index trips_user_id_idx on public.trips (user_id);
create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.tg_set_updated_at();

-- ----- 2) trip_gear (M:N switch) -------------------------------------------
create table public.trip_gear (
  trip_id      uuid not null references public.trips(id) on delete cascade,
  gear_item_id uuid not null references public.gear_items(id) on delete cascade,
  quantity     integer not null default 1 check (quantity >= 1),
  added_at     timestamptz not null default now(),
  primary key (trip_id, gear_item_id)
);
create index trip_gear_trip_id_idx      on public.trip_gear (trip_id);
create index trip_gear_gear_item_id_idx on public.trip_gear (gear_item_id);

-- ----- 3) RLS enable + per-table policies -----------------------------------
alter table public.trips     enable row level security;
alter table public.trip_gear enable row level security;

-- trips — owner-scoped on every CRUD verb.
create policy trips_select_own on public.trips
  for select using (auth.uid() = user_id);
create policy trips_insert_own on public.trips
  for insert with check (auth.uid() = user_id);
create policy trips_update_own on public.trips
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy trips_delete_own on public.trips
  for delete using (auth.uid() = user_id);

-- trip_gear — every verb is gated by the parent trip's owner.
-- Cross-user INSERTs fail the WITH CHECK even when the gear_item itself
-- belongs to the caller (RLS checks the trip ownership, not the gear's).
create policy trip_gear_select_own on public.trip_gear
  for select using (
    exists (
      select 1 from public.trips t
      where t.id = trip_gear.trip_id and t.user_id = auth.uid()
    )
  );
create policy trip_gear_insert_own on public.trip_gear
  for insert with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_gear.trip_id and t.user_id = auth.uid()
    )
  );
create policy trip_gear_update_own on public.trip_gear
  for update using (
    exists (
      select 1 from public.trips t
      where t.id = trip_gear.trip_id and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_gear.trip_id and t.user_id = auth.uid()
    )
  );
create policy trip_gear_delete_own on public.trip_gear
  for delete using (
    exists (
      select 1 from public.trips t
      where t.id = trip_gear.trip_id and t.user_id = auth.uid()
    )
  );

-- Realtime intentionally NOT enabled. Opt-in per table later:
--   alter publication supabase_realtime add table public.trips;