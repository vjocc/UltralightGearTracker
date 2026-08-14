-- ============================================================================
-- Fix: categories.user_id missing `default auth.uid()`
--
-- Context (Sprint 4 docs audit, delta #1):
--   The original `20260812000000_init_gear.sql` defined `categories` with
--   `user_id uuid NOT NULL references auth.users(id) on delete cascade` but
--   without a server-side default. All sibling tables (gear_items,
--   wishlist_items, trips) gained `default auth.uid()` in P2 sailings.
--   Result: every POST /api/categories with `{name, slug}` returned 400
--   with "new row violates row-level security policy for table
--   'categories'". Knock-on: GearFormModal inline category-creation
--   sub-form could never bootstrap a fresh user.
--
-- This migration backfills the default + aligns the RLS policy so anon
-- contexts cannot write through the new default. Forward-only (no DROP).
-- ============================================================================

alter table public.categories
  alter column user_id set default auth.uid();

-- (Optional) Drop any safety-net custom WITH CHECK that referenced user_id
-- explicitly without default reliance — none in this codebase, so nothing
-- to drop here. Kept as a comment for the next migration audit.
