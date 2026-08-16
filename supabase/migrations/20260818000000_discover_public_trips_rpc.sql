-- ============================================================================
-- discover_public_trips() SECURITY DEFINER — Sprint 5 P1.x defense-in-depth
-- Mirrors the Phase 3 public_list_lookup pattern: the /discover public
-- listing goes through a SECURITY DEFINER RPC that hard-codes the privacy
-- gates (visibility = 'public' filter + no owner-identifier SELECT list).
--
-- Why B opció (SECURITY DEFINER) over A (VIEW) or C (factory-filter only):
--   * A VIEW (security_invoker = false) is conceptually similar but the
--     SELECT list is harder to audit because PostgREST inlines the view
--     body. SECURITY DEFINER keeps the SELECT in one explicit place.
--   * C (factory-filter only, the current implementation) has a
--     single-point-of-failure: a single omitted `.eq('visibility','public')`
--     leaks every trip's user_id. Defense-in-depth eliminates that.
--
-- Privacy gates (locked into the function body):
--   1. WHERE visibility = 'public' — hard-coded. NOT a parameter.
--   2. SELECT list — explicit, no `user_id`, no `email`, no `created_at`,
--      no `updated_at`, no `target_date`, no `planned_*`, no
--      `completed_at`. The discoverTripRow zod schema enforces the
--      absence of owner-identifier keys at parse time as a third layer.
--   3. gpx_metadata — JSONB projected to `distance_km` (from
--      `total_distance_km`) and `elevation_gain_m`. `trackpoints`
--      (precise GPS) is NOT in the SELECT list.
--
-- search_path defense:
--   set search_path = public, pg_temp  (no `auth`, no `auth.users` — the
--   function NEVER queries `auth.*` at runtime; the only FK reference to
--   `auth.users(id)` is in the DDL of `trips.user_id`, not in this function's
--   runtime body).
--
-- Permissions:
--   * revoke all from public — the function is not callable by the default
--     `public` role.
--   * grant execute to authenticated, anon — both logged-in and anonymous
--     users can call it (the WHERE visibility = 'public' filter is the only
--     privacy gate at the SQL layer).
--   * The /api/discover endpoint calls this function via
--     `getServiceRoleClient().rpc('discover_public_trips', {})` — the
--     service-role client bypasses trips RLS, but the function itself
--     enforces privacy at the SQL layer.
-- ============================================================================

create or replace function public.discover_public_trips()
  returns table (
    id                  uuid,
    name                text,
    description         text,
    start_date          date,
    end_date            date,
    region              text,
    region_source       text,
    distance_km         numeric,
    elevation_gain_m    numeric
  )
  language sql
  stable
  security definer
  -- Strict search_path to avoid the canonical SECURITY DEFINER hijacking vector.
  -- The function queries ONLY `public.trips`; we lock to {public, pg_temp}.
  set search_path = public, pg_temp
as $$
  -- Privacy gates baked into the body:
  --   1. visibility = 'public' is the ONLY row filter.
  --   2. The SELECT list explicitly enumerates the 9 projected columns.
  --      `user_id`, `email`, `created_at`, `updated_at`, `target_date`,
  --      `planned_distance_km`, `planned_elevation_gain_m`, `completed_at`,
  --      and `visibility` are NOT in the list — they cannot leak even if
  --      the caller adds them to a supabase.rpc(...) select clause.
  --   3. gpx_metadata → distance_km + elevation_gain_m (aggregate fields
  --      only); `trackpoints` (precise GPS) is excluded.
  select
      t.id,
      t.name,
      t.description,
      t.start_date,
      t.end_date,
      t.region,
      t.region_source::text,
      (t.gpx_metadata ->> 'total_distance_km')::numeric as distance_km,
      (t.gpx_metadata ->> 'elevation_gain_m')::numeric as elevation_gain_m
    from public.trips t
   where t.visibility = 'public'
   order by t.name asc;
$$;

-- Default deny: nothing for `public`, only authenticated + anon may execute.
revoke all on function public.discover_public_trips() from public;
grant execute on function public.discover_public_trips() to authenticated, anon;

-- Document the privacy contract in the DB.
comment on function public.discover_public_trips() is
  'Sprint 5 P1.x: defense-in-depth public listing for /discover. '
  'Returns only `visibility = ''public''` trips with a 9-column privacy-first '
  'projection (id, name, description, start_date, end_date, region, '
  'region_source, distance_km, elevation_gain_m). NO user_id, NO email, '
  'NO timestamps, NO gpx_metadata.trackpoints. '
  'Called via service-role RPC from /api/discover.';
