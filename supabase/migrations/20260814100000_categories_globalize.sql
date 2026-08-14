-- ============================================================================
-- Migration #1 — Make `categories` a global, system-defined taxonomy
-- Architect-approved design (Trello comment on debt-tracker card
-- 6a7d7b62d61ae7a41e8f83ce). Forward-only.
--
-- Context (from product-architecture-v2.md §1 + Category Taxonomy v1):
--   Categories are no longer user-owned. The 13 top-level categories
--   are seeded once by the system and shared by all users. Users cannot
--   create / edit / delete categories from the UI. This collapses the
--   "user-managed category list" onboarding friction (0. elv #2) and
--   ensures every user picks from the same canonical taxonomy (0. elv #1).
--
-- Phasing (3 migrations, this is #1):
--   #1  categories globalize + seed (THIS FILE)
--   #2  gear_items.category_id FK remap (data preserve + new constraint)
--       wishlist_items.category_id FK remap (mirrors #2)
--   #3  NOT NEEDED — trip_gear / trip_recaps / trip_share_invites do
--       not reference categories. Confirmed by ripgrep across
--       supabase/migrations/*.sql (2 hits, both in init_gear + view).
--
-- Data preservation contract:
--   - Old per-user categories are mapped slug-to-slug against the
--     13 system slugs. Any user-created slug that has no match is
--     mapped to `extras` (catch-all fallback). User rows are then
--     DELETED — the system-owned `categories` table has no place for
--     user-private copies any more (this is the intended consequence
--     of the globalize decision; the per-user rows become data noise).
--
-- Idempotency:
--   - The seed uses `on conflict (slug) do update set name = excluded.name`
--     so re-running this migration against an already-seeded DB re-syncs
--     `name` / `description` / `display_order` to the canonical v1 values
--     without recreating UUIDs.
--   - Schema-altering statements use `if exists` / `drop if exists` so
--     the file is safe to re-run from any prior partial state.
-- ============================================================================

-- ----- 1) Map-and-backup: capture old per-user category rows + their refs ---
-- Done BEFORE the table is rebuilt, because step 4 nukes the rows. We keep
-- this in a temp table that lives only for the duration of the transaction
-- and gets dropped at the end.
create temp table _cat_old on commit drop as
  select
    id          as old_id,
    user_id     as old_user_id,
    slug        as old_slug,
    name        as old_name
  from public.categories;

create index on _cat_old (old_id);
create index on _cat_old (old_user_id);

-- ----- 2) Detach FKs from the live table (preserves data) ------------------
-- gear_items.category_id + wishlist_items.category_id both reference
-- public.categories(id) on delete restrict. We must DROP these constraints
-- before dropping the categories table itself, otherwise the DROP blows up.
alter table public.gear_items
  drop constraint if exists gear_items_category_id_fkey;
alter table public.wishlist_items
  drop constraint if exists wishlist_items_category_id_fkey;

-- ----- 3) Drop old `categories` table + dependent view + RLS policies ----
-- gear_base_weights_view depends on categories.name; we drop + recreate it
-- at the end of this migration (still references categories, but the new
-- globalized table has the same column names so the view body is unchanged).
drop view   if exists public.gear_base_weights_view;
drop policy if exists categories_select_own on public.categories;
drop policy if exists categories_insert_own on public.categories;
drop policy if exists categories_update_own on public.categories;
drop policy if exists categories_delete_own on public.categories;
drop table  if exists public.categories cascade;

-- ----- 4) Create the new globalized `categories` table --------------------
-- No `user_id`. Unique on `slug` alone (was (user_id, slug)).
-- display_order pins the UI sort order (matches the approved Taxonomy v1
-- sequence: 1=Shelter ... 13=Extras). description is a future-proofing
-- hook for tooltips / onboarding copy — schema-level only, no UI yet.
create table public.categories (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  description   text,
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index categories_display_order_idx
  on public.categories (display_order);
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.tg_set_updated_at();

-- ----- 5) Seed the 13 Taxonomy v1 categories (idempotent) ------------------
-- Order matches the user-approved list (debt-tracker comment 6a7f2e18):
--   1 Shelter, 2 Sleep, 3 Pack, 4 Clothing, 5 Footwear, 6 Cooking,
--   7 Food, 8 Water, 9 Electronics, 10 Safety, 11 Tools,
--   12 Hygiene, 13 Extras / Other
-- on conflict (slug) keeps the original UUID but refreshes name /
-- description / display_order — re-running this migration is safe.
insert into public.categories (slug, name, description, display_order) values
  ('shelter',     'Shelter',       'Tents, tarps, stakes, poles, guylines, ground cloths.',                                    1),
  ('sleep',       'Sleep',         'Sleeping bags, quilts, pads, pillows, stuff sacks for the sleep system.',                  2),
  ('pack',        'Pack',          'Backpacks, hip belts, pack covers, pack liners, dry bags.',                                 3),
  ('clothing',    'Clothing',      'Base layers, insulation, rain shells, socks, gloves, hats — worn on body.',                4),
  ('footwear',    'Footwear',      'Boots, trail runners, camp shoes, gaiters, insoles.',                                       5),
  ('cooking',     'Cooking',       'Stoves, pots, mugs, utensils, fuel canisters, lighters, windscreens.',                     6),
  ('food',        'Food',          'Dehydrated meals, snacks, bars, cooking ingredients, bear can / bag food storage.',         7),
  ('water',       'Water',         'Filters, treatment drops, bottles, bladders, soft flasks, hydration reservoirs.',            8),
  ('electronics', 'Electronics',   'Phone, GPS, headlamp, camera, powerbank, cables, solar panel, e-reader.',                   9),
  ('safety',      'Safety',        'First aid, navigation, emergency shelter, satellite messenger, repair, signaling.',         10),
  ('tools',       'Tools',         'Knife, multi-tool, repair kit, duct tape, cordage, trekking poles.',                       11),
  ('hygiene',     'Hygiene',       'Toothbrush, soap, trowel, toilet paper, hand sanitizer, quick-dry towel, insect repellent.', 12),
  ('extras',      'Extras / Other','Anything that does not fit a functional category above. Catch-all for personal items.',     13)
on conflict (slug) do update
  set name          = excluded.name,
      description   = excluded.description,
      display_order = excluded.display_order;

-- ----- 6) RLS: read-all, write-blocked -------------------------------------
-- Categories are system-owned; no authenticated role can insert / update /
-- delete. The service_role bypass remains available for migrations +
-- admin tooling.
alter table public.categories enable row level security;

create policy categories_select_all on public.categories
  for select using (true);
create policy categories_insert_blocked on public.categories
  for insert with check (false);
create policy categories_update_blocked on public.categories
  for update with check (false);
create policy categories_delete_blocked on public.categories
  for delete using (false);

-- ----- 7) Map old per-user category ids → new system category ids ---------
-- This temp table is the bridge consumed by Migration #2 (gear_items +
-- wishlist_items FK remap). It is dropped at end of transaction.
create temp table _cat_id_map on commit drop as
  with system as (
    select slug, id as new_id from public.categories
  ),
  mapped as (
    select
      o.old_id,
      o.old_user_id,
      o.old_slug,
      coalesce(
        -- direct slug hit
        (select s.new_id from system s where s.slug = o.old_slug),
        -- slug normalisations (common synonyms the PO flagged)
        case
          when o.old_slug in ('misc', 'miscellaneous', 'other') then
            (select s.new_id from system s where s.slug = 'extras')
          when o.old_slug in ('rain', 'rainwear', 'jacket') then
            (select s.new_id from system s where s.slug = 'clothing')
          when o.old_slug in ('lighting', 'lamp', 'lights') then
            (select s.new_id from system s where s.slug = 'electronics')
          when o.old_slug in ('navigation', 'nav') then
            (select s.new_id from system s where s.slug = 'safety')
          when o.old_slug in ('hydration') then
            (select s.new_id from system s where s.slug = 'water')
          else
            -- last-resort catch-all → Extras / Other
            (select s.new_id from system s where s.slug = 'extras')
        end
      ) as new_id
    from _cat_old o
  )
  select old_id, old_user_id, old_slug, new_id from mapped;

create index on _cat_id_map (old_id);

-- ----- 8) Recreate gear_base_weights_view --------------------------------
-- The view body is unchanged (categories has the same `id` and `name`
-- columns), so we just recreate it with the original definition. Read-side
-- behaviour is identical.
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

-- ----- 9) Verification view (read-only, dropped at end of transaction) ---
-- Lets a human / smoke-test runner eyeball the mapping quality before
-- Migration #2 runs and the old table rows are gone for good.
create temp view _cat_map_review as
  select
    m.old_user_id,
    m.old_slug,
    m.old_id                                              as old_category_id,
    ns.id                                                 as new_category_id,
    ns.name                                               as new_category_name,
    (select count(*) from public.gear_items g
       where g.category_id = m.old_id)                    as old_gear_items,
    (select count(*) from public.wishlist_items w
       where w.category_id = m.old_id)                    as old_wishlist_items
  from _cat_id_map m
  join public.categories ns on ns.id = m.new_id
  order by m.old_user_id, m.old_slug;

comment on view _cat_map_review is
  'Pre-flight review of old→new category id mapping. SELECT before running migration #2 to sanity-check coverage + fallback routing.';

-- End of Migration #1.
-- The user MUST run "select * from _cat_map_review order by old_user_id, old_slug"
-- in the Supabase SQL Editor before running Migration #2.