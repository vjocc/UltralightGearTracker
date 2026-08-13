-- ============================================================================
-- Base weight computation — view over gear_items × categories.
-- Architect-approved design. RLS is inherited from the base gear_items
-- table because the view is created with security_invoker = true; the
-- user_id = auth.uid() policy on gear_items naturally scopes the rows.
--
-- The view exposes one row per gear item with its category resolved so
-- the API endpoint (server/api/gear/base-weight.get.ts) can aggregate
-- without doing the JOIN inside the request handler.
-- ============================================================================

create or replace view public.gear_base_weights_view
  with (security_invoker = true)
as
select
  gi.id          as gear_item_id,
  gi.user_id     as user_id,
  gi.category_id as category_id,
  c.name         as category_name,
  gi.weight_g    as grams,
  gi.excluded_from_base as excluded_from_base
from public.gear_items gi
left join public.categories c on c.id = gi.category_id;

comment on view public.gear_base_weights_view is
  'Per-item base-weight source. Aggregations done by /api/gear/base-weight. RLS inherited from gear_items via security_invoker.';