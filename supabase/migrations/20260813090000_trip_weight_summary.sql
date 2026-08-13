-- ============================================================================
-- Trip total weight — view over trips × trip_gear × gear_items.
-- Architect-approved (comment id 6a7cfaed9e96553da12bf6f2).
-- Forward-only migration.
--
-- Exposes one row per trip with:
--   * total_grams — Σ(gear_items.weight_g × trip_gear.quantity) over items
--                   where excluded_from_base = false (owned, packed gear)
--   * item_count  — COUNT(trip_gear.gear_item_id) — distinct packed rows;
--                   this counts the trip_gear rows themselves (not the
--                   per-item quantity), so qty changes don't move the
--                   counter; excluded items still count because they are
--                   attached rows (acceptance #4 in the design comment).
--
-- RLS: the view is created with `security_invoker = true`, so the
-- trips / trip_gear / gear_items policies — all keyed on user_id =
-- auth.uid() or the parent-trip ownership join — apply automatically.
-- No new policies are required for this view.
--
-- Empty trips still surface a row (LEFT JOIN + coalesce(... ,0)), so the
-- API endpoint never has to distinguish "trip not found" from "trip is
-- empty" — both yield total_grams = 0 / item_count = 0.
-- ============================================================================

create or replace view public.trip_weight_summary
  with (security_invoker = true)
as
select
  t.id                                                 as trip_id,
  t.user_id                                            as user_id,
  coalesce(sum(g.weight_g * tg.quantity), 0)::int     as total_grams,
  count(tg.gear_item_id)                               as item_count
from public.trips t
left join public.trip_gear tg on tg.trip_id = t.id
left join public.gear_items g
       on g.id = tg.gear_item_id
      and g.excluded_from_base = false
group by t.id, t.user_id;

comment on view public.trip_weight_summary is
  'Per-trip Σ weight_g × quantity from owned, non-excluded gear_items. '
  'RLS inherited from trips/trip_gear/gear_items via security_invoker.';