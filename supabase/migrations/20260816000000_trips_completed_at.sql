-- ============================================================================
-- trips.completed_at — Sprint 5 P0.3 activation funnel (B opció: saját events)
-- Architect-approved, design-pass branch is the canonical design source.
-- Forward-only migration.
--
-- Adds:
--   * public.trips.completed_at — timestamptz NULL default.
--     NULL  = a túra még "tervezett" (a user nem jelezte, hogy elment).
--     NOT NULL = a user a Trip-UI-on jelezte, hogy elment (a closure).
--
-- Miért NULL default:
--   * A meglévő összes trips rekord tervezett státuszban marad
--     (backward-compatible, NEM törlünk / módosítunk meglévő oszlopot).
--   * A user a P0.3-ban bevezetett "Túra lezárása" gombbal
--     (pages/trips/[id].vue, owner-only) állítja NOT NULL-re egy
--     owner-only POST /api/trips/{id}/complete endpointon át.
--
-- Miért forward-only (nincs DEFAULT now() backfill):
--   * A "tervezett" túra státusz a bevitt adatok alapján nem
--     retroaktívan rekonstruálható (nincs forrásunk a kirándulás
--     tényéhez); a backfill hamis adat lenne.
--   * A funnel analytics a jövőbeni lezárásokat méri — a P0.3
--     forward-only scope-pivotja a v2 §0 #4 sémaszintű jövő-biztosítás
--     elvet követi (lásd docs/sprint-5-p0-product-loop.md §0.4).
--
-- Visibility: a trips RLS-e nem változik (owner + accepted invitee +
-- accepted friend of owner SELECT; owner-only UPDATE). A
-- completed_at mező a meglévő trips_row része; a publikus
-- /list/{id} route NEM olvassa (public adat-expozíció kerülendő —
-- v2 §0 #5 elv).
-- ============================================================================

alter table public.trips
  add column if not exists completed_at timestamptz;

-- Indoklás (komment a DB-ben):
-- Phase 7 audit round: 'First Completed Trip' a Loadout és Debrief közötti önálló
-- mérföldkő, mert külön kell lássuk: tervezett (NULL), elment (NOT NULL).
-- A user a Trip-UI-on jelzi, hogy elment — ehhez a P0.3-ban implementálunk
-- egy owner-only 'Túra lezárása' action-t.
comment on column public.trips.completed_at is
  'Phase 7 activation funnel: NULL = tervezett, NOT NULL = elment. '
  'Setter: POST /api/trips/{id}/complete endpoint, owner-only (RLS Strict). '
  'Setter status: P0.3 implementáció.';

-- Index: a P0.3 funnel analytics kérdés a "hány user zárt le túrát"
-- (SELECT WHERE completed_at IS NOT NULL) — a NULL-szűrt index
-- gyorsítja. A NOT NULL-szűrt index a meglévő idx-re épül, így
-- a meglévő trips rekordok (mind NULL) NEM foglalnak benne helyet.
create index if not exists trips_completed_at_idx
  on public.trips (completed_at)
  where completed_at is not null;
