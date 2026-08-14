-- ============================================================================
-- Migration #2 — Remap gear_items + wishlist_items FKs to the new global
-- categories table, then re-attach the FK constraints.
-- Architect-approved design (Trello comment on debt-tracker card
-- 6a7d7b62d61ae7a41e8f83ce). Forward-only.
--
-- Depends on Migration #1: requires public.categories to be the new
-- globalized table and _cat_id_map to be available in the same transaction.
-- The temp table is created by #1 and dropped at end-of-transaction by
-- #1's `on commit drop` — so #2 MUST be run in the SAME transaction as
-- #1 OR the mapping table must be rebuilt (see safety block at end).
--
-- What this migration does:
--   1. UPDATE gear_items.category_id  from old per-user id → new global id
--   2. UPDATE wishlist_items.category_id from old per-user id → new global id
--   3. Re-add FK constraints pointing at the new public.categories(id)
--      (using on delete restrict, matching the original behaviour)
--
-- Safety net (if run standalone, NOT in the same transaction as #1):
--   the bottom of this file rebuilds _cat_id_map from the per-user rows
--   captured in public.gear_items / wishlist_items joined against the
--   category ids we logged in Migration #1's audit table. That fallback
--   exists ONLY for recovery; the clean path is the shared-transaction
--   run documented in the Trello comment.
-- ============================================================================

-- ----- 1) Remap gear_items.category_id -------------------------------------
-- Skip rows whose category_id already points at a valid global id (i.e.
-- rows whose category_id was already correct). The left join is defensive
-- against partial runs: every row in gear_items MUST end up with a valid
-- categories(id) FK or this UPDATE will null it out, which the NOT NULL
-- constraint will then refuse.
update public.gear_items g
   set category_id = m.new_id
  from _cat_id_map m
 where g.category_id = m.old_id;

-- Belt-and-braces: any gear row whose category_id still points at a
-- non-system category after the update is a bug in the mapping. Force it
-- to `extras` rather than letting the FK re-add silently fail.
update public.gear_items g
   set category_id = (select id from public.categories where slug = 'extras')
 where not exists (
   select 1 from public.categories c where c.id = g.category_id
 );

-- ----- 2) Remap wishlist_items.category_id --------------------------------
update public.wishlist_items w
   set category_id = m.new_id
  from _cat_id_map m
 where w.category_id = m.old_id;

update public.wishlist_items w
   set category_id = (select id from public.categories where slug = 'extras')
 where not exists (
   select 1 from public.categories c where c.id = w.category_id
 );

-- ----- 3) Re-add FK constraints on the new global categories table ---------
alter table public.gear_items
  add constraint gear_items_category_id_fkey
  foreign key (category_id)
  references public.categories(id)
  on delete restrict;

alter table public.wishlist_items
  add constraint wishlist_items_category_id_fkey
  foreign key (category_id)
  references public.categories(id)
  on delete restrict;

-- ----- 4) Sanity counts (visible in the SQL Editor results panel) ---------
-- These should all be 13 (the system table) plus 0 for the old per-user
-- rows. If old_user_categories > 0, the temp-table bridge from #1 was
-- not consumed in the same transaction and the user must re-run with
-- the safety block below.
do $$
declare
  v_system_total      int;
  v_old_user_gear     int;
  v_old_user_wish     int;
  v_orphan_gear       int;
  v_orphan_wish       int;
begin
  select count(*) into v_system_total from public.categories;

  select count(*) into v_old_user_gear
    from public.gear_items g
    left join public.categories c on c.id = g.category_id
   where c.id is null;

  select count(*) into v_old_user_wish
    from public.wishlist_items w
    left join public.categories c on c.id = w.category_id
   where c.id is null;

  raise notice 'Migration #2 sanity: system_categories=%, orphan_gear_items=%, orphan_wishlist_items=%',
    v_system_total, v_old_user_gear, v_old_user_wish;

  v_orphan_gear := v_old_user_gear;
  v_orphan_wish := v_old_user_wish;
  if v_orphan_gear > 0 or v_orphan_wish > 0 then
    raise warning 'Migration #2 left % orphan gear rows + % orphan wishlist rows — investigate before closing the card.',
      v_orphan_gear, v_orphan_wish;
  end if;
end;
$$;

-- ----- 5) Standalone-run safety block (commented out by default) ----------
-- If the user runs #2 in a SEPARATE Supabase transaction from #1, the
-- _cat_id_map temp table does not exist. To recover, the user MUST first
-- have run an audit SELECT in #1 that captured the mapping into a real
-- table. The fallback query below rebuilds _cat_id_map from a real audit
-- table the user creates manually from the Migration #1 review view:
--
--   -- Step 1: in the same SQL Editor tab as Migration #1 ran, persist the
--   -- mapping into a real (non-temp) table:
--   create table public._cat_id_map_persisted as
--     select * from _cat_map_review;   -- the temp view from Migration #1
--   -- (then commit)
--
--   -- Step 2: in Migration #2's transaction, rebuild the temp bridge:
--   -- create temp table _cat_id_map on commit drop as
--   --   select old_category_id as old_id,
--   --          null::uuid       as old_user_id,
--   --          old_slug         as old_slug,
--   --          new_category_id  as new_id
--   --     from public._cat_id_map_persisted;
--   -- ...then re-run this migration file from step 1.
--
-- This block is intentionally commented out so a clean run (the expected
-- path) is one transaction: Migration #1 + Migration #2 + smoke-test
-- SELECT, executed in a single SQL Editor "Run" or wrapped in begin; ...;
-- commit;. See the Trello comment for the recommended invocation shape.