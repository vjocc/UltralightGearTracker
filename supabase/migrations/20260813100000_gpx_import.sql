-- ============================================================================
-- GPX import + túra-alapú gear-választás (P1).
-- Architect-approved (comment id 6a7d633e86573933564ebe1f).
-- Forward-only migration.
--
-- Adds:
--   * public.trips  — 4 new columns: gpx_metadata (jsonb), target_date (date),
--                     planned_distance_km (numeric), planned_elevation_gain_m
--                     (numeric). Existing rows get NULL defaults; the SELECT
--                     policy already covers the new columns (no new policy
--                     needed).
--   * public.gpx_track_points — sparse track storage: server-side parser
--                     drops everything between the first/last 200 sample
--                     points and writes one "summary midpoint" row in between,
--                     so the table never holds more than 401 rows per trip
--                     even for multi-thousand-point GPX files. UNIQUE on
--                     (trip_id, seq) prevents double-write races. RLS is
--                     owner-scoped via the same `exists()` join pattern used
--                     by trip_gear (no JOIN on user_id directly — it always
--                     defers to the parent trips row).
-- ============================================================================

-- ----- 1) ALTER public.trips -----------------------------------------------
alter table public.trips
  add column if not exists gpx_metadata            jsonb         default null,
  add column if not exists target_date             date          default null,
  add column if not exists planned_distance_km     numeric(8,3)  default null,
  add column if not exists planned_elevation_gain_m numeric(8,1) default null;

-- ----- 2) public.gpx_track_points -----------------------------------------
create table public.gpx_track_points (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  seq          integer not null check (seq >= 0),
  lat          numeric(9,6) not null,
  lon          numeric(9,6) not null,
  elevation_m  numeric(7,1),
  recorded_at  timestamptz,
  is_summary   boolean not null default false
);

-- The server endpoint always issues a per-trip DELETE + INSERT batch, so
-- (trip_id, seq) uniqueness is what we actually need to defend against the
-- client double-submitting the same upload.
create unique index gpx_track_points_trip_id_seq_idx
  on public.gpx_track_points (trip_id, seq);

-- The map preview endpoint orders by (trip_id, seq) for path reconstruction,
-- so a dedicated trip_id index is wasted — the unique one above is already
-- the right shape. Leaving the unique index as the only secondary index keeps
-- the storage footprint tight.

-- ----- 3) RLS enable + per-table policies ---------------------------------
alter table public.gpx_track_points enable row level security;

-- gpx_track_points — every verb is gated by the parent trip's owner, mirroring
-- trip_gear's pattern so cross-user uploads cannot piggy-back on a foreign
-- trip even when the JWT is valid.
create policy gpx_track_points_select_own on public.gpx_track_points
  for select using (
    exists (
      select 1 from public.trips t
      where t.id = gpx_track_points.trip_id and t.user_id = auth.uid()
    )
  );
create policy gpx_track_points_insert_own on public.gpx_track_points
  for insert with check (
    exists (
      select 1 from public.trips t
      where t.id = gpx_track_points.trip_id and t.user_id = auth.uid()
    )
  );
create policy gpx_track_points_update_own on public.gpx_track_points
  for update using (
    exists (
      select 1 from public.trips t
      where t.id = gpx_track_points.trip_id and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.trips t
      where t.id = gpx_track_points.trip_id and t.user_id = auth.uid()
    )
  );
create policy gpx_track_points_delete_own on public.gpx_track_points
  for delete using (
    exists (
      select 1 from public.trips t
      where t.id = gpx_track_points.trip_id and t.user_id = auth.uid()
    )
  );

-- Realtime intentionally NOT enabled. Opt-in per table later:
--   alter publication supabase_realtime add table public.gpx_track_points;