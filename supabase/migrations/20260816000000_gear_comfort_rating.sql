-- ============================================================================
-- Gear comfort rating — P5 / v2 #21 "My comfort" dimenziók
-- Architect-approved, design-pass branch is the canonical design source.
-- Forward-only migration.
--
-- Adds:
--   * public.gear_items.comfort JSONB NULL — 3 dimenziós szubjektív rating
--     (sleep / cold / weight), 1..5 integer. A check constraint a kulcsokat
--     és a jsonb-típust szorítja; az 1..5 tartomány ellenőrzése a zod
--     schema-ban történik (szerver-oldali payload validáció).
--
-- Miért JSONB és nem 3 integer column:
--   * A v2 példája 3 dimenziót ad (alvás / hideg / súly), de a Phase 5
--     NEM zárja le, hogy később új dimenziót (pl. weatherproof) kérjenek.
--   * A JSONB séma-módosítás nélkül enged új kulcsokat.
--   * A TypeScript-oldali szigorúságot a gearCreateSchema +
--     GearItemUpdate type biztosítja (lásd shared/gearSchemas.ts).
--
-- Visibility: a gear_items RLS-e nem változik (owner-only CRUD marad).
-- A comfort mező kizárólag a bejelentkezett user SAJÁT gear-itemén jelenik
-- meg; a publikus /list/{id} route NEM olvassa (public adat-expozíció
-- kerülendő — v2 §0 #5 elv).
-- ============================================================================

alter table public.gear_items
  add column if not exists comfort jsonb;

-- Defensive CHECK: ha nem NULL, akkor object típusú, és minden kulcs
-- a {sleep, cold, weight} halmazból való. Az 1..5 érték-tartomány
-- ellenőrzése a zod schema-ban történik (szerver-oldalon), mert a
-- jsonb_value_constraints bonyolultabb lenne SQL-ben.
alter table public.gear_items
  drop constraint if exists gear_items_comfort_keys_check;
alter table public.gear_items
  add constraint gear_items_comfort_keys_check
  check (
    comfort is null
    or (
      jsonb_typeof(comfort) = 'object'
      and jsonb_object_keys(comfort) <@ array['sleep','cold','weight']
    )
  );