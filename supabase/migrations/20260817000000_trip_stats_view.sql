-- ============================================================================
-- Trip-történet + személyes statisztika — Phase 6 / v2 #24
-- Architect-approved (spec: docs/sprint-4-phase-6-trip-stats.md).
-- Forward-only migration.
--
-- Adds:
--   * public.trip_stats  — per-user aggregating VIEW (1 row / user).
--                          4 CTE: trip_km, base_weight_per_trip +
--                          base_weight_trend_built, debrief_counts,
--                          comfort_agg. FULL OUTER JOIN biztosítja, hogy
--                          minden user kapjon 1 sort (0 trip esetén is).
--
-- RLS: security_invoker = true — a trips.user_id = auth.uid() és a
-- gear_items.user_id = auth.uid() policy-k öröklődnek, owner-only
-- SELECT automatikus. A view NEM kap explicit RLS policy-t; a
-- trips / gear_items / trip_debriefs meglévő policy-i szűrik a
-- forrásadatokat, és a security_invoker kiértékeli őket a caller
-- jogosultságával.
--
-- forward-only: a Phase 7 #22 trip-aware loadout üzenet erre a
-- view-ra épül; a Phase 8+ riportok csv-export alapja.
-- ============================================================================

create or replace view public.trip_stats
  with (security_invoker = true)
as
with trip_km as (
  -- km / túra: a trips.gpx_metadata.total_distance_km + planned_distance_km
  -- együttesen, NULL-okat kihagyva (COALESCE fallback-sorrend).
  select
    t.user_id,
    count(t.id)                                                  as trip_count,
    coalesce(sum(
      case
        when (t.gpx_metadata->>'total_distance_km') is not null
          then (t.gpx_metadata->>'total_distance_km')::numeric
        else t.planned_distance_km
      end
    ), 0)::numeric(10,3)                                        as total_km
  from public.trips t
  group by t.user_id
),
base_weight_per_trip as (
  -- base weight / túra, időrendben. A trip_weight_summary view-t
  -- JOIN-oljuk (az már Σ weight_g × quantity-t ad owner-scoped
  -- RLS-sel).
  select
    tw.user_id,
    tw.trip_id,
    tw.total_grams,
    coalesce(t.start_date, t.created_at::date)                  as trip_date
  from public.trip_weight_summary tw
  join public.trips t on t.id = tw.trip_id
),
base_weight_trend_built as (
  -- JSONB time-series aggregáció: trips[] + avg/min/max/first/last.
  -- A Phase 7 #22 loadout üzenet és a Phase 8+ csv-export erre épül.
  select
    user_id,
    jsonb_build_object(
      'trips',   jsonb_agg(jsonb_build_object(
        'trip_id',     trip_id,
        'date',        to_char(trip_date, 'YYYY-MM-DD'),
        'total_grams', total_grams
      ) order by trip_date asc),
      'avg_grams',  coalesce(avg(total_grams), 0)::int,
      'min_grams',  coalesce(min(total_grams), 0)::int,
      'max_grams',  coalesce(max(total_grams), 0)::int,
      'first_date', to_char(min(trip_date), 'YYYY-MM-DD'),
      'last_date',  to_char(max(trip_date), 'YYYY-MM-DD')
    ) as base_weight_trend
  from base_weight_per_trip
  group by user_id
),
debrief_counts as (
  -- debrief aggregáció: a 3 text[] mező elemszámának összesítése
  -- userenként. A LEFT JOIN a trips-re biztosítja, hogy a debrief
  -- nélküli user is megjelenjen (0 összesítéssel).
  select
    t.user_id,
    count(d.id)                                                  as debrief_count,
    coalesce(sum(array_length(d.excess_items, 1)), 0)::int      as total_excess_items,
    coalesce(sum(array_length(d.missing_items, 1)), 0)::int     as total_missing_items,
    coalesce(sum(array_length(d.uncomfortable_items, 1)), 0)::int
                                                                as total_uncomfortable_items
  from public.trips t
  left join public.trip_debriefs d on d.trip_id = t.id
  group by t.user_id
),
comfort_agg as (
  -- comfort aggregáció a user GEAR-listáján: 3 dimenzió (sleep / cold /
  -- weight) átlaga a kitöltött item-ekből. NULL-biztos (FILTER a
  -- hiányzó kulcsra).
  select
    gi.user_id,
    round(avg((gi.comfort->>'sleep')::numeric)
      filter (where gi.comfort ? 'sleep'), 2)                    as avg_comfort_sleep,
    round(avg((gi.comfort->>'cold')::numeric)
      filter (where gi.comfort ? 'cold'), 2)                     as avg_comfort_cold,
    round(avg((gi.comfort->>'weight')::numeric)
      filter (where gi.comfort ? 'weight'), 2)                   as avg_comfort_weight,
    count(*) filter (where gi.comfort is not null)               as comfort_items_count
  from public.gear_items gi
  group by gi.user_id
)
select
  coalesce(tk.user_id, bwt.user_id, dc.user_id, ca.user_id)    as user_id,
  coalesce(tk.trip_count, 0)                                     as trip_count,
  coalesce(tk.total_km, 0)                                       as total_km,
  coalesce(bwt.base_weight_trend, '{}'::jsonb)                   as base_weight_trend,
  coalesce(dc.debrief_count, 0)                                  as debrief_count,
  coalesce(dc.total_excess_items, 0)                             as total_excess_items,
  coalesce(dc.total_missing_items, 0)                            as total_missing_items,
  coalesce(dc.total_uncomfortable_items, 0)                      as total_uncomfortable_items,
  ca.avg_comfort_sleep,
  ca.avg_comfort_cold,
  ca.avg_comfort_weight,
  coalesce(ca.comfort_items_count, 0)                            as comfort_items_count
from trip_km tk
full outer join base_weight_trend_built bwt on bwt.user_id = tk.user_id
full outer join debrief_counts        dc  on dc.user_id  = coalesce(tk.user_id, bwt.user_id)
full outer join comfort_agg           ca  on ca.user_id  = coalesce(tk.user_id, bwt.user_id, dc.user_id);

comment on view public.trip_stats is
  'Per-user aggregáció: trip_count, total_km, base_weight_trend JSONB, debrief aggregáció, '
  'comfort aggregáció. RLS öröklött a trips.user_id = auth.uid() és a gear_items.user_id = '
  'auth.uid() policy-ból security_invoker = true által. A Phase 7 #22 trip-aware loadout '
  'üzenet erre a view-ra épül. Forward-only, nincs RLS-policy módosítás.';
