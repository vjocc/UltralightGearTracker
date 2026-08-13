-- ============================================================================
-- Wishlist with price tracking — schema additions.
-- Architect-approved. Forward-only migration.
-- Adds two columns requested by the PO ticket:
--   * name         text NOT NULL       (display name, formerly absent)
--   * target_price numeric(10,2)       (price alert threshold, optional)
--
-- The initial migration declared wishlist_items without a `name` column.
-- Pre-existing rows (none expected at this point in the project's lifetime)
-- are backfilled to the empty string so the NOT NULL constraint can be
-- enforced safely. Tightening to a meaningful name is a data hygiene task
-- tracked separately.
-- ============================================================================

-- Backfill first: a tiny safety net for any pre-existing rows.
update public.wishlist_items
  set name = coalesce(name, '')
  where name is null;

alter table public.wishlist_items
  add column if not exists name text not null default '';

alter table public.wishlist_items
  add column if not exists target_price numeric(10,2)
    check (target_price is null or target_price >= 0);

-- Drop the defaults so future inserts must supply a real name (the form
-- validates non-empty) and an explicit target_price (NULL = no alert).
alter table public.wishlist_items
  alter column name drop default;

-- No RLS changes: the existing per-user CRUD policies already cover the
-- new columns (they are not policy-distinguishing).
