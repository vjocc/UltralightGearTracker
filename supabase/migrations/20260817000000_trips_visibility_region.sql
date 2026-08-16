-- ============================================================================
-- trips.visibility + trips.region + trips.region_source — Sprint 5 P1
-- Architect-approved (comment id 6a8171f0680d02f9e3e404cf, design-pass).
-- Forward-only migration.
--
-- Adds:
--   * public.trips.visibility     — 'private' (default) | 'public'
--   * public.trips.region         — text, NULL default, manual user input
--                                   (P1 §11.1 user-döntés: MANUAL).
--   * public.trips.region_source  — 'manual' | 'gpx_derived' | NULL
--                                   (NULL = a user még nem állított be régiót).
--
-- Miért NULL default a region:
--   * Backward-compatible: a meglévő összes trips rekord régió nélkül
--     marad (NEM törlünk / NEM módosítunk meglévő oszlopot).
--   * A user a TripFormModal-on opt-in jelleggel töltheti ki a régiót.
--   * A /discover listaoldal a régió NÉLKÜLI public trippeket egy
--     "Egyéb / Nincs megadva" szekcióban jeleníti meg (a hiányt
--     dokumentálja, NEM rejt).
--
-- A v2 §4 'participation' mezőt ez a migration NEM VEZETI BE
-- (a P1 kizárólag a visibility-t aktiválja, a participation P2+ scope).
--
-- Miért forward-only (nincs DEFAULT most()):
--   * A 'visibility' default 'private' (a séma default, backward-compatible).
--   * A 'region' NULL default (a user explicit opt-in).
--   * A meglévő összes trips rekord 'private' visibility-val és NULL
--     region-nel marad (NEM backfill, NEM false-positive publikus adat).
--
-- Visibility: a trips RLS-e NEM változik (owner-scoped SELECT, INSERT,
-- UPDATE, DELETE). A /discover service-role-on át olvas, a publikus
-- projekció a visibility = 'public' factory-szűrővel dolgozik.
--
-- Rollback SQL:
--   ALTER TABLE public.trips DROP COLUMN visibility;
--   ALTER TABLE public.trips DROP COLUMN region;
--   ALTER TABLE public.trips DROP COLUMN region_source;
--   DROP INDEX IF EXISTS public.trips_visibility_region_idx;
-- ============================================================================

alter table public.trips
  add column if not exists visibility    text not null default 'private'
    check (visibility in ('private', 'public')),
  add column if not exists region        text
    check (region is null or char_length(region) <= 80),
  add column if not exists region_source text
    check (region_source is null or region_source in ('manual', 'gpx_derived'));

-- Indoklás (komment a DB-ben):
comment on column public.trips.visibility is
  'Sprint 5 P1: a user opt-in kitevős public flag (Phase 3 /list/{id} analóg). '
  'Setter: TripFormModal-on a user által. Default: private. '
  'A /discover listaoldal ezt olvassa service-role-on át.';

comment on column public.trips.region is
  'Sprint 5 P1: a user által megadott szabad szöveges régió-tag (max 80 char). '
  'NULL = a user még nem állított be régiót. '
  'Setter: TripFormModal (manual) VAGY GPX-import (gpx_derived, NEM P1).';

comment on column public.trips.region_source is
  'Sprint 5 P1: a region mező eredete. manual = user írta be, '
  'gpx_derived = GPX-ből származtatva (P3+ scope, jelenleg NULL-re default). '
  'Setter: trip-create form (manual) VAGY GPX reverse-geocode (gpx_derived, P3+).';

-- Index: a /discover listaoldal a WHERE visibility = 'public' szűrővel
-- dolgozik, region szerint csoportosít. A region index a GROUP BY-t
-- gyorsítja. A visibility index a publikus listát (kis halmaz, ha a
-- user-active trippek zöme private) gyorsítja.
create index if not exists trips_visibility_region_idx
  on public.trips (visibility, region)
  where visibility = 'public';