-- ============================================================================
-- trip_gear.assigned_to_user_id + trip_participant_lookup_emails
-- Sprint 5 P2 — Ki mit visz (csoportos csomaglista-egyeztetés, SZŰKÍTETT SCOPE)
-- Architect-approved (Trello comment id 6a822a8864aa26961a94152f, design-pass).
-- Forward-only migration. User-oldali futtatás: Supabase SQL Editor.
--
-- Adds:
--   1. public.trip_gear.assigned_to_user_id — uuid NULL, FK auth.users(id)
--                                            ON DELETE SET NULL.
--      A §11.1 user-döntés szerinti "opcionális" default (A): a mező NULL
--      lehet, a meglévő összes sor NULL-ra marad (backfill nélkül). A "Ki
--      mit visz" nézet a hozzárendelt itemeket mutatja; a NULL-ok "Nincs
--      hozzárendelve" bucket-ben jelennek meg.
--   2. Index a "Ki mit visz" aggregált nézet leggyakoribb lekérdezéséhez
--      (trip_id + assigned_to_user_id IS NOT NULL).
--   3. SECURITY DEFINER function trip_participant_lookup_emails(p_user_ids,
--      p_trip_id) — a meglévő friend_lookup_emails mintára, de
--      trip-szinten szűrve (owner + accepted invitee-k email-címét adja
--      vissza). A trip_visible_to() function-t NEM bővíti, csak hívja.
--
-- Rollback SQL:
--   ALTER TABLE public.trip_gear DROP COLUMN IF EXISTS assigned_to_user_id;
--   DROP INDEX IF EXISTS public.trip_gear_assigned_to_idx;
--   DROP FUNCTION IF EXISTS public.trip_participant_lookup_emails(uuid[], uuid);
--
-- A trip_gear RLS-e NEM VÁLTOZIK (owner-scoped marad a P0 óta): a
-- assigned_to_user_id mezőt CSAK a trip owner PATCH-elheti a
-- /api/trips/:id/gear/:gearId endpoint-on.
-- ============================================================================

-- ----- 1) trip_gear.assigned_to_user_id -----------------------------------
alter table public.trip_gear
  add column if not exists assigned_to_user_id uuid
    references auth.users(id) on delete set null;

-- ----- 2) Index a leggyakoribb "Ki mit visz" lekérdezéshez ---------------
-- A query pattern: WHERE trip_id = $1 AND assigned_to_user_id IS NOT NULL,
-- csoportosítás user_id szerint (a GET /api/trips/:id/gear-assignments
-- endpoint szerver-oldali aggregációja).
create index if not exists trip_gear_assigned_to_idx
  on public.trip_gear (trip_id, assigned_to_user_id)
  where assigned_to_user_id is not null;

comment on column public.trip_gear.assigned_to_user_id is
  'Sprint 5 P2 (szűkített scope): a "Ki mit visz" nézethez. NULL = az item '
  'nincs userhez rendelve (a §11.1 user-döntés szerinti "opcionális" default). '
  'Setter: owner-only PATCH /api/trips/:id/gear/:gearId (assigned_to_user_id '
  'mező). A "Ki mit visz" nézet owner-only (a §11.2 user-döntés szerinti '
  'default). FK ON DELETE SET NULL, ha a user törlődik, a gear item marad, '
  'csak a hozzárendelés nullázódik. A P2 NEM bővíti a trip_visible_to() '
  'function-t.';

-- ----- 3) trip_participant_lookup_emails — SECURITY DEFINER ----------------
-- Mirror of gear_comment_lookup_authors / trip_comment_lookup_authors:
-- batch uuid → email lookup, gated by trip-level visibility. Returns only
-- the (user_id, email) pairs of users who are either the trip owner OR
-- accepted invitees on the given trip. The caller cannot probe arbitrary
-- users' emails.
--
-- search_path = public, auth (Phase 3 defense-in-depth mintája: a
-- SECURITY DEFINER function az auth.users táblát olvassa, így a
-- search_path fixálása megakadályozza, hogy egy search_path átállítással
-- a támadó egy saját `auth.users` sémát hozzon létre).
create or replace function public.trip_participant_lookup_emails(
  p_user_ids uuid[],
  p_trip_id uuid
)
returns table (user_id uuid, email text)
language sql
security definer
set search_path = public, pg_temp, auth
as $$
  select distinct u.id, u.email
    from auth.users u
   where u.id = any(p_user_ids)
     and (
       -- Az owner (a trip.user_id) vagy accepted invitee-k email-címét
       -- adja vissza (a meglévő trip_visible_to()-ból örökölt modell).
       exists (
         select 1 from public.trips t
          where t.id = p_trip_id and t.user_id = u.id
       )
       or exists (
         select 1 from public.trip_share_invites i
          where i.trip_id = p_trip_id
            and i.invitee_user_id = u.id
            and i.status = 'accepted'
       )
     );
$$;
revoke execute on function public.trip_participant_lookup_emails(uuid[], uuid) from public;
grant  execute on function public.trip_participant_lookup_emails(uuid[], uuid) to authenticated;
