-- ============================================================================
-- funnel_events — Sprint 5 P0.3 activation funnel (B opció: saját events)
-- Architect-approved, design-pass branch is the canonical design source.
-- Forward-only migration.
--
-- Privacy-first, GDPR-barát, nincs 3rd-party függőség (a user által
-- jóváhagyott B opció a PostHog helyett — lásd
-- docs/sprint-5-p0-product-loop.md §4.3 / §11).
--
-- Adds:
--   * public.funnel_events — append-only event log:
--       id          uuid pk (gen_random_uuid)
--       user_id     uuid fk → auth.users(id) on delete cascade
--       event_name  text (zod-enum-validált szerver oldalon, NEM free-form)
--       payload     jsonb (event-specifikus metaadat, default '{}')
--       created_at  timestamptz (default now())
--
-- A 6 capture-hely által kibocsátott event_name-ek:
--   signup_completed         — sikeres Supabase Auth regisztráció
--   first_gear_added         — első gear_items INSERT
--   first_trip_created       — első trips INSERT
--   first_loadout_assembled  — első trip_gear INSERT
--   first_completed_trip     — trips.completed_at NOT NULL closure
--   first_debrief_written    — első trip_debriefs INSERT
--
-- Miért NEM free-form event_name:
--   * A tábla user-controlled INSERT-et SOHA nem fogad: NEM adunk
--     INSERT policy-t az `authenticated` role-ra. A kliens-oldali
--     capture hívás a serverSupabaseServiceRole klienst használja
--     (server/api/events/track.post.ts), a service-role key NEM
--     kerül a kliens bundle-be.
--   * A server-oldali zod schema (`trackEventSchema`) enum-validálja
--     az event_name-et, így egy sebezhető user nem tud új
--     event_name-et kitalálni.
--
-- RLS:
--   * SELECT — owner-only (a user a saját eseményeit látja).
--   * INSERT — NEM adunk policy-t authenticated role-ra. CSAK a
--     service-role client írhat (BYPASSRLS). A user-oldali
--     Supabase SQL Editor-ban futtatandó admin-script a
--     `grant insert on public.funnel_events to service_role;`
--     parancsot is tartalmazza (lásd a migration végén).
--   * UPDATE — NEM (audit integritás: az események visszavonhatatlanok).
--   * DELETE — NEM (audit integritás).
--
-- Indexek:
--   * (user_id)            — a user saját eseményeinek lekérdezése
--   * (event_name)         — funnel aggregáció event_name szerint
--   * (created_at desc)    — idősoros scan
-- ============================================================================

create table public.funnel_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  event_name  text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- CHECK constraint: event_name a 6 engedélyezett érték egyike.
-- A szerver-oldali zod schema defense-in-depth, ez a DB-oldali
-- safety-net: ha bármi úton (admin script, közvetlen REST, stb.)
-- INSERT érkezik, a DB elutasítja a nem-validált event_name-et.
alter table public.funnel_events
  drop constraint if exists funnel_events_event_name_check;
alter table public.funnel_events
  add constraint funnel_events_event_name_check
  check (
    event_name in (
      'signup_completed',
      'first_gear_added',
      'first_trip_created',
      'first_loadout_assembled',
      'first_completed_trip',
      'first_debrief_written'
    )
  );

-- Indexek
create index if not exists funnel_events_user_id_idx
  on public.funnel_events (user_id);
create index if not exists funnel_events_event_name_idx
  on public.funnel_events (event_name);
create index if not exists funnel_events_created_at_idx
  on public.funnel_events (created_at desc);

-- RLS enable
alter table public.funnel_events enable row level security;

-- SELECT — owner-only (a user a saját eseményeit látja; az
-- admin-oldal későbbi scope, service-role-on át).
create policy funnel_events_select_own
  on public.funnel_events for select
  to authenticated using (user_id = auth.uid());

-- INSERT — service-role only (a trackEvent composable-ból
-- service-role client-et használunk, NEM a user-JWT-t, hogy a
-- user ne tudjon saját eseményt hamisítani).
-- NEM adunk INSERT policy-t authenticated role-ra — CSAK
-- service-role írhat (BYPASSRLS).
-- A kliensoldali trackEvent a serverSupabaseServiceRole klienst
-- használja (server/api/events/track.post.ts).

-- UPDATE — NEM (audit integritás).
-- DELETE — NEM (audit integritás).

-- A service-role role (Supabase-ban a `service_role` Postgres role)
-- alapértelmezetten BYPASSRLS jogosultságú, tehát NEM kell explicit
-- GRANT — a service-role client INSERT-je a fenti policy-kat
-- megkerüli. A `grant insert` itt csak a dokumentáltság kedvéért
-- van; a service-role BYPASSRLLS-sel mindenképp írhat.
-- (A `service_role` role meglétét a Supabase init script biztosítja.)
revoke all on public.funnel_events from public;
grant select on public.funnel_events to authenticated;
-- Az INSERT/UPDATE/DELETE explicit revoke: a service-role role
-- BYPASSRLS, az authenticated role-nak nincs insert policy-ja.
revoke insert, update, delete on public.funnel_events from authenticated;
