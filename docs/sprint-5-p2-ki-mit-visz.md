# Sprint 5 — P2 Ki mit visz (csoportos csomaglista-egyeztetés) — Architect spec — SZŰKÍTETT SCOPE

**Author:** Architect (role:architect)
**Date:** 2026-08-16
**Source of truth:** `docs/product-architecture-v2.md` §0 döntési elvek + §4 visibility/participation sémák + a Sprint 5 P2 Trello-kártya (`6a822a8864aa26961a94152f`, Backlog, `role:architect`).
**Branch / SHA:** `master` @ a P2 dispatchkor aktuális SHA (P1 + P1.x defense-in-depth lezárva, deployolva).
**Trello-kártya:** **P2 Ki mit visz** — `6a822a8864aa26961a94152f` (Backlog, `role:architect`).
**Implementáció tiltva:** ez a fájl csak TERV. A `[deploy]` commit a parent-agent QA workflow-ja UTÁN jön (az új 2026-08-15-ös szabály: **automatikus, NEM kell user-jóváhagyás L1/L2 esetén**). A spec-et a parent-agent postolja Trello-kommentként a P2 kártyára (lásd §14 Trello-paste blokk).

---

## 0. Scope-pivot emlékeztető (3-as szintű szabály: P2 = 2-es szintű)

A P2 a Sprint 5 P1-gyel azonos **2-es szintű** hatáskörbe esik:

- **Dokumentált** (ez a fájl) + **jóváhagyott stratégia** (a Sprint 5 P2-terv: a „Ki mit visz" csoportos csomaglista-egyeztetés meglévő résztvevők között).
- **NEM public adat-expozíció** (a „Ki mit visz" nézet privát a résztvevőknek, illetve owner-only — a §11.2 user-döntés függvénye; a `/discover` listaoldal NEM módosul).
- **NEM fizetős tier**, **NEM fizetős túra-monetizáció**.
- **NEM security/RLS-változás** — a P2 a `trip_gear` owner-scoped RLS-ét NEM nyitja fel: a „Ki mit visz" nézet a **meglévő** `trip_visible_to()` function-t használja (P2 óta owner + accepted invitee + accepted friend); a P2 egyetlen sématöbblete (`trip_gear.assigned_to_user_id`) ugyanúgy owner-only szerkeszthetőségű marad, mint a meglévő `quantity` mező. A `trip_visible_to()` function NEM bővül, NEM módosul.

### 0.1 A v2 §0 → P2 leképezés (5 elv)

| v2 §0 elv | P2 megvalósulása |
|---|---|
| **#1 Valós felhasználói adat > feltételezés** | A „Ki mit visz" nézet a meglévő `trip_gear` táblából olvas, és a user általános szervezési szokásait tükrözi (manuálisan hozzárendelt user-id-k). Nincs automatikus dedukció, nincs „best guess". |
| **#2 Minimális onboarding-súrlódás** | A P2 NEM nyit új modált a meglévő trip-edit flow-n túl. A `TripGearPicker`-ben megjelenik a user-selector dropdown (owner-only), a „Ki mit visz" section egy új blokk a trip-detail oldalon. A meglévő accepted invitee-k + accepted joiner-ek + owner = a kiválasztható user-ek listája (a `TripParticipantRow` meglévő típusát használva). |
| **#3 Niche-igény validáció nélkül** | A P2 egyetlen új felület: a „Ki mit visz" aggregált section. Nincs popularity/score/rating, nincs push-notification. A meglévő owner + accepted invitee + accepted friend kört használjuk (a `trip_visible_to()` P2 óta meglévő), NEM bővítjük. |
| **#4 Séma-szintű jövő-biztosítás olcsó, UI/logika-szintű nem** | A P2 **egyetlen** migrationt igényel: `trip_gear.assigned_to_user_id` (uuid NULL, FK `auth.users(id)` ON DELETE SET NULL). A meglévő `trip_gear` PK `(trip_id, gear_item_id)` VÁLTOZATLAN. A `trip_visible_to()` function NEM MÓDOSUL. |
| **#5 Trip ≠ My Gear** | A `trip_gear.assigned_to_user_id` mező a *trip-szintű* hozzárendelést tárolja, NEM módosítja a `gear_items` táblát. A user My Gear inventáriuma érintetlen marad (egy user-nek csak egy sora van a `gear_items`-ban, de a trip-re több user is „viheti"). |

### 0.2 Explicit out-of-scope (P2 NEM épít)

A user explicit utasítása (2026-08-16) alapján a P2 szűkített scope-jából **KIMARAD**:

- ❌ **`request_to_join` flow** — nincs `trip_join_requests` tábla, nincs `POST /api/trips/:id/join-requests`, nincs owner-jóváhagyásos csatlakozás. A P4 Social/SaaS rétegbe tartozik, a P2-ből TELJESEN kimarad.
- ❌ **`trips.participation` mező funkcióba hozatala** — a séma mező bent van (a P1-es `20260817000000_trips_visibility_region.sql` migration óta), DE a P2 NEM vezet be UI-t / logikát hozzá. A `participation` default `invite_only`, és a `trip_visible_to()` function-t a P2 NEM bővíti új ággal.
- ❌ **`trip_visible_to()` function módosítása** — a meglévő function (a `20260813110000_trip_share.sql` óta: owner + accepted invitee + accepted friend) VÁLTOZATLAN marad.
- ❌ **`trip_participants` tábla bővítése** — NINCS ilyen tábla (a résztvevők a meglévő `TripParticipantRow` típussal, kliens-oldalon származtatva: owner + accepted invitee-k az invite-listából).
- ❌ **`friendships` automatikus jóváhagyás** — NINCS trigger, NINCS function-override a baráti kapcsolatokra.
- ❌ **Résztvevő-eltávolítás / „kick participant" / „leave trip" flow** — a P2 NEM épít ilyen UI-t.
- ❌ **Self-service „saját cucc listám" flow** — a résztvevők NEM szerkeszthetik a saját gear-hozzárendelésüket (csak olvashatják, ha a §11.2 user-döntés a „résztvevőknek" opciót választja).
- ❌ **Comment a „Ki mit visz" nézeten** — nincs comment thread, nincs chat a gear-hozzárendeléshez.
- ❌ **Push-notification** — a `trip_visible_to()` szerinti accepted invitee-k nem kapnak értesítést a „Ki mit visz" módosításról.
- ❌ **Nincs ML, weather-aware, GPX vizualizáció, /discover módosítás** — a P2 nem nyúl a GPX-import-hoz, a region-tag-hez, vagy a trip-stats-hoz.

### 0.3 A 3-as szintű scope-pivot őrszem (privacy-first, v2 §0 #1)

A P2 a v2 §0 #1 elvet követi: **valós felhasználói adat > feltételezés**. A „Ki mit visz" nézet a user általános szervezési szokásait tükrözi (manuálisan hozzárendelt user-id-k), és NEM vezet be új participation-modellt. A privacy-first vetület:

- A `trip_gear.assigned_to_user_id` mező alapból NULL (az item NEM hozzárendelt — a §11.1 user-döntés szerinti „opcionális" default).
- A „Ki mit visz" nézet a **meglévő** `trip_visible_to()` jogosulti körre korlátozódik (owner + accepted invitee + accepted friend). A `trip_visible_to()` NEM bővül.
- A `trip_gear` RLS NEM VÁLTOZIK (owner-scoped marad a P0 óta): a `assigned_to_user_id` mezőt CSAK a trip owner PATCH-elheti.
- A `trip_gear.assigned_to_user_id` FK ON DELETE SET NULL: ha egy user törli a fiókját, a gear item marad, csak a hozzárendelés nullázódik (nincs adatvesztés).

### 0.4 A P2 deploy-szintje (az új 2026-08-15-ös szabály)

**P2 = L2 AUTOMATA deploy** (QA Approved UTÁN, NEM kell user-jóváhagyás, UTÓLAGOS JELENTÉSsel):

- **NEM publikus adat-expozíció** (a „Ki mit visz" nézet owner-only OR résztvevőkre korlátozott — a §11.2 user-döntés függvénye; a `/discover` listaoldal NEM módosul).
- **NEM fizetős tier, NEM fizetős túra-monetizáció.**
- **NEM security/RLS-változás** — a meglévő `trip_gear` RLS owner-scoped marad; a `trip_visible_to()` function VÁLTOZATLAN; a `trips` SELECT policy VÁLTOZATLAN.
- **Migration-t tartalmaz** (egyetlen fájl: `trip_gear.assigned_to_user_id`).

**A P2 L2 különbség az L1-től** (utólagos jelentés a deploy UTÁN):
1. A `trip_gear.assigned_to_user_id` mező FK constraint-je a `auth.users(id)`-re — ha a user később törlődik, a mező ON DELETE SET NULL-tal kezeli (a gear item NEM törlődik, csak a hozzárendelés null-re áll). Az utólagos jelentés dokumentálja ezt a viselkedést.
2. A „Ki mit visz" nézet a `trip_visible_to()` function-t használja a jogosulti kör meghatározására — ez a meglévő function (P2 óta), és a deployment NEM vezet be új function-t.

**A P2 kivétel az L2 alól** (user-jóváhagyás szükséges a deploy előtt), ha:
1. A §11.1 user-döntés a „kötelező" opciót választja (minden trip-gear itemhez kell user-hozzárendelés) — mert ez a meglévő összes trip-gear sorra hatással van (mindegyikre user-t kell rendelni, ami a meglévő P0/P1 user-adatokkal nem lehetséges visszamenőleg — a meglévő összes trip-gear sort NULL-ra kellene backfillelni, ami adatmigrációs kockázat).
2. A §11.2 user-döntés a „résztvevőknek" opciót választja — mert ez a `trip_visible_to()` használatát jelenti a `GET /api/trips/:id/gear-assignments` endpoint-on, ami a meglévő function-től függ; ha a user ezt választja, a deployment UTÁN jelezni kell a user felé (hogy a funkció a meglévő accepted invitee + accepted friend kört is bevonja).
3. A §11.3 user-döntés az „automatikus accepted friend" opciót választja — ez a P2-ből KIZÁRVA (a P2 NEM épít ilyen flow-t); ha a user ezt kéri, a P4-be tolódik.

**Ellenkező esetben** (opcionális `assigned_to_user_id` + owner-only „Ki mit visz" + userenkénti csoportosítás) a P2 L2-es, és a `[deploy]` commit a QA Approved UTÁN **automatikus** (a „KIVÉTEL" szabály nem aktív).

---

## 1. Cél és a P2 értelmezése

A P2 a v2 §0 #1 elv talaján egyetlen user-értéket épít: a **„Ki mit visz" csoportos csomaglista-egyeztetést** a meglévő résztvevők (owner + accepted invitee + accepted friend) között:

1. **A trip owner a `TripGearPicker`-ben** (meglévő `components/TripGearPicker.vue`) minden trip-gear itemhez hozzárendelhet egy user-t a `trip_gear.assigned_to_user_id` mezőn keresztül. A kiválasztható user-ek listája: owner + accepted invitee-k (a meglévő `TripParticipantRow` típusból).
2. **A `trip_gear.assigned_to_user_id` mező** opcionális (a §11.1 user-döntés függvénye): ha a user nem rendel itemet senkihez, a „Ki mit visz" nézet csak a hozzárendelt itemeket mutatja (vagy az összeset, ha a user-döntés a „kötelező" opciót választja).
3. **A „Ki mit visz" aggregált nézet** owner-only (vagy a §11.2 user-döntés szerinti résztvevőkre is kiterjed): a `pages/trips/[id].vue` egy új sectiont kap, ami a trip-gear itemje(ke)t user-szinten aggregálja.
4. **Nincs új participation-flow** — a `trips.participation` mező a P1-es migration óta `invite_only` defaulton van, és a P2 NEM vezet be `request_to_join` logikát.

A P2 a „Ki mit visz" funkció **első fázisa**, NEM a teljes community-feature. A P3+ fázisok bevezetik a self-service „saját cucc listám" funkciót (ahol a résztvevők is szerkeszthetik a saját gear-hozzárendelésüket), a „trip-charter" flow-t, és a P4 a `request_to_join` participation-modellt.

---

## 2. Schema-változás (egyetlen migration)

### 2.1 Migration: `supabase/migrations/20260819000000_trip_gear_assigned_to.sql`

```sql
-- ============================================================================
-- trip_gear.assigned_to_user_id — Sprint 5 P2 (SZŰKÍTETT SCOPE)
-- Architect-approved (comment id 6a822a8864aa26961a94152f, design-pass).
-- Forward-only migration.
--
-- Adds:
--   * public.trip_gear.assigned_to_user_id — uuid NULL, FK auth.users(id).
--                                            A §11.1 user-döntés függvénye:
--                                              - ha "opcionális" (default): a mező
--                                                NULL lehet, a "Ki mit visz" nézet
--                                                csak a hozzárendelt itemeket mutatja.
--                                              - ha "kötelező": a meglévő összes
--                                                trip_gear sort NULL-ra backfillelni
--                                                kell (P2 deployment előtti user-döntés
--                                                blocking — ld. §11.1).
--
-- A P2 default opció az "opcionális" (NULL allowed). A kötelező opció
-- user-döntés esetén a migration NEM VÁLTOZIK, csak a deployment UTÁNI
-- product-looper 1 INSERT-et ad ki (UPDATE trip_gear SET assigned_to_user_id =
-- <owner> WHERE assigned_to_user_id IS NULL), amit a Migration script
-- manuálisan futtat.
--
-- A meglévő trip_gear tábla sémája (20260813000000_trips.sql):
--   trip_id      uuid not null
--   gear_item_id uuid not null
--   quantity     integer not null default 1
--   added_at     timestamptz not null
--   primary key (trip_id, gear_item_id)
-- A P2 bővíti:
--   assigned_to_user_id uuid NULL
--     references auth.users(id) ON DELETE SET NULL
--
-- Miért NULL default (opcionális):
--   * A meglévő összes trip_gear sor NULL-ra marad (backfill nélkül).
--   * A user explicit opt-in a "Ki mit visz" nézeten keresztül.
--   * A NULL itemek a "Ki mit visz" nézetben a "Nincs hozzárendelve"
--     bucketben jelennek meg (a §11.2 user-döntés szerinti szűrés).
--
-- Miért FK ON DELETE SET NULL:
--   * Ha egy user törölte a fiókját, a trip-gear item NEM törlődik,
--     csak a hozzárendelés nullázódik (a gear item a trip owner-é,
--     nem a hozzárendelt user-é).
--
-- A trip_gear RLS-e NEM VÁLTOZIK (owner-scoped marad a P0 óta).
-- A P2 endpoint PATCH /api/trips/:id/gear/:gearId bővül egy
-- 'assigned_to_user_id' mezővel (NULL = töröl, UUID = beállít).
--
-- A P2 NEM módosítja a trip_visible_to() SECURITY DEFINER function-t
-- (a P2 óta meglévő owner + accepted invitee + accepted friend
-- hármas VÁLTOZATLAN marad).
--
-- Rollback SQL:
--   ALTER TABLE public.trip_gear DROP COLUMN assigned_to_user_id;
-- ============================================================================

alter table public.trip_gear
  add column if not exists assigned_to_user_id uuid
    references auth.users(id) on delete set null;

-- A "Ki mit visz" aggregált nézet leggyakoribb query-je:
--   SELECT tg.assigned_to_user_id, gi.name, ...
--   FROM trip_gear tg JOIN gear_items gi ON gi.id = tg.gear_item_id
--   WHERE tg.trip_id = $1 AND tg.assigned_to_user_id IS NOT NULL
-- Az index a (trip_id, assigned_to_user_id) páron gyorsítja a lekérdezést.
create index if not exists trip_gear_assigned_to_idx
  on public.trip_gear (trip_id, assigned_to_user_id)
  where assigned_to_user_id is not null;

comment on column public.trip_gear.assigned_to_user_id is
  'Sprint 5 P2 (szűkített scope): a "Ki mit visz" nézethez. NULL = az item nincs '
  'userhez rendelve (a §11.1 user-döntés szerinti "opcionális" default). '
  'Setter: owner-only PATCH /api/trips/:id/gear/:gearId (assigned_to_user_id '
  'mező). A "Ki mit visz" nézet owner-only (vagy §11.2 user-döntés szerinti '
  'résztvevőkre is kiterjed a trip_visible_to() jogosulti körén keresztül). '
  'FK ON DELETE SET NULL, ha a user törlődik, a gear item marad, csak a '
  'hozzárendelés nullázódik. A P2 NEM bővíti a trip_visible_to() function-t.';
```

### 2.2 A migration szállítása

A migrationt a parent-agent írja a fenti fájlba, és a user futtatja a Supabase SQL Editor-ban (a `trello-board-workflow` skill §4 „user-as-migration-runner" mintája). A sub-agent (Architect, ez a fájl) a migrationt NEM írja, NEM futtatja — csak a tervet dokumentálja.

A migration önálló (a P2 egyetlen új sématöbblete). Nem függ más migrationtől, és más migration sem függ tőle (a `trip_gear.assigned_to_user_id` mezőt a P3+ opcionálisan használhatja, de a P2 deployment önmagában is működőképes).

---

## 3. Endpoint-ok (1 új / 1 módosított)

### 3.1 `GET /api/trips/[id]/gear-assignments` (ÚJ)

A „Ki mit visz" aggregált nézet adatszerkezete. Owner-only (vagy a §11.2 user-döntés szerinti résztvevőkre is kiterjed):

- **Request body:** nincs.
- **Response:** 200 + szerializált aggregáció:

```ts
{
  participants: [
    {
      user_id: UUID | null,                 // null = "Nincs hozzárendelve" bucket
      email: string | null,                 // a friend_lookup_emails mintájára
      total_weight_g: number,
      items: Array<{
        gear_item_id: UUID,
        name: string,
        category: string | null,
        weight_g: number,
        quantity: number,
        total_weight_g: number
      }>
    }
  ]
}
```

- **Auth:** `authenticated` + jogosulti kör. A P2 default: **owner-only** (a `state.current.user_id === auth.uid()` check). A §11.2 user-döntés „résztvevőknek" opciója esetén: a `trip_visible_to(tripId)` function-t hívjuk (a meglévő P2 function: owner + accepted invitee + accepted friend). A P2 NEM bővíti a function-t.
- **RLS:** a `trip_gear_select_own` policy (P0 óta owner-scoped) — a P2 default-ban (owner-only) az RLS-en eleve átjut a kérés. Ha a §11.2 user-döntés a „résztvevőknek" opciót választja, a P2 endpoint **service-role**-on át olvassa a `trip_gear` táblát, miután a `trip_visible_to()` function-nel igazolta a viewer jogosultságát (a meglévő Phase 3 /list/[id] service-role-olvasás mintájára, de NEM publikus, hanem jogosulti körre szűrve).
- **Szerver-oldali logika:**
  1. SELECT trip → owner-check (vagy §11.2 user-döntés szerinti `trip_visible_to()`-check).
  2. SELECT trip_gear + JOIN gear_items + JOIN categories (egyetlen lekérdezés, a `select(*, gear_items!inner(*), categories!inner(*))` PostgREST pattern mintára — a meglévő trip-detail endpoint mintájára, ami a `select(*, trip_gear(*))` embed-del dolgozik).
  3. Aggregálás user-szinten (szerveroldali JavaScript, a PostgREST grouping nélkül).
  4. A user-id-k feloldása a meglévő `friend_lookup_emails`-szel analóg módon: a P2 NEM vezet be új SECURITY DEFINER function-t. Ehelyett a meglévő `friend_lookup_emails(p_user_ids)` function-t használjuk a viewer baráti körére, ÉS a `trip_comment_lookup_authors`-szal analóg mintát követve egy új, minimális `trip_participant_lookup_emails(p_user_ids, p_trip_id)` SECURITY DEFINER functiont definiálunk, ami CSAK a `trip_visible_to(p_trip_id)` által igazolt user-id-kre ad vissza email-t.

### 3.2 `PATCH /api/trips/[id]/gear/[gearId]` (MÓDOSÍTÁS)

A meglévő `quantity` PATCH végpont bővül egy `assigned_to_user_id` mezővel. A `tripGearUpdateSchema` zod séma bővül:

- **Request body:** `{ quantity?: number, assigned_to_user_id?: string | null }` (mindkettő opcionális, de legalább az egyik kell — a meglévő séma-struktúra megmarad).
- **Response:** 200 + a frissített sor (a meglévő `TripGearRow` típus, kiegészülve az `assigned_to_user_id` mezővel).
- **Auth:** `authenticated` + owner-only (a meglévő RLS-en keresztül, ami a `trip_gear_update_own` policy).
- **Server-side logika:**
  1. A meglévő quantity-patch logika VÁLTOZATLAN (a séma backward-compatible).
  2. Ha `assigned_to_user_id` jelen van:
     - Ha `null`, a mező null-re áll (a user „elveszi" a hozzárendelést — a §11.1 user-döntés szerinti „opcionális" default támogatása).
     - Ha UUID, a mező beállítódik. A szerver ellenőrzi, hogy a user vagy a trip owner-e (`trips.user_id = auth.uid()`), VAGY a meglévő accepted invitee-k egyike (a `trip_share_invites.invitee_user_id = auth.uid() AND status = 'accepted' AND trip_id = tripId` check). A P2 NEM BŐVÍTI a `trip_visible_to()` function-t: az endpoint a `trip_share_invites` táblát direkt olvassa (egyetlen SELECT), és a saját WHERE clause-ában ellenőrzi a jogosultságot. Ha a user NEM owner és NEM accepted invitee, 400 (a user nem létezik vagy nem résztvevő).
- **self-assignment:** a viewer hozzárendelheti magához az itemet, ha a viewer a trip owner-e (maga is résztvevő). Ha a viewer accepted invitee ÉS a gear item a viewer saját `gear_items`-jához tartozik (a `gear_items.user_id = auth.uid()`), szintén megengedett (a user a saját felszerelését „magához rendeli"). Minden más esetben 400.

### 3.3 `server/utils/tripSchemas.ts` + `shared/tripSchemas.ts` (MÓDOSÍTÁS)

A `tripGearUpdateSchema` zod séma bővül az `assigned_to_user_id` mezővel:

```ts
// shared/tripSchemas.ts — P2 patch
export const tripGearUpdateSchema = z.object({
  quantity: z
    .number({ message: 'Quantity must be a number' })
    .int('Whole numbers only')
    .min(1, 'At least 1')
    .optional(),
  assigned_to_user_id: z
    .string()
    .uuid('Must be a valid user id')
    .nullable()
    .optional(),
});
```

A `quantity` mező opcionálissá válik (PATCH-szemantika: legalább az egyik mező jelen van). A meglévő hívók (csak `quantity`-t küldenek) továbbra is működnek.

### 3.4 `composables/useTrips.ts` (MÓDOSÍTÁS)

A meglévő composable bővül két új metódussal:

- `fetchGearAssignments(tripId)` — GET /api/trips/:id/gear-assignments (a `state.value.gearAssignmentsByTripId` cache-be rakja).
- `assignGearToUser(tripId, gearId, userId | null)` — PATCH /api/trips/:id/gear/:gearId (`assigned_to_user_id` mező), a meglévő `updateGearQty` mintára.

A `state` típus bővül:

```ts
export interface TripState {
  // ... meglévő mezők ...
  /**
   * P2 — "Ki mit visz" aggregált nézet, owner-only (vagy §11.2 user-döntés
   * szerinti résztvevőkre is kiterjed). Per-trip cache, a
   * fetchGearAssignments() tölti.
   */
  gearAssignmentsByTripId: Record<string, GearAssignmentsResponse | null>;
}
```

---

## 4. Séma-szintű P2 projekció (a „Ki mit visz" aggregált nézet adatszerkezete)

```ts
// shared/gearAssignmentSchemas.ts (új fájl, a tripSchemas mintára)
import { z } from 'zod';

export const assignedGearItemSchema = z.object({
  gear_item_id: z.string().uuid(),
  name: z.string(),
  category: z.string().nullable(),
  weight_g: z.number(),
  quantity: z.number().int().min(1),
  total_weight_g: z.number(),
});
export type AssignedGearItem = z.infer<typeof assignedGearItemSchema>;

export const gearAssignmentParticipantSchema = z.object({
  user_id: z.string().uuid().nullable(),   // null = "Nincs hozzárendelve" bucket
  email: z.string().nullable(),             // null = a user_id = null bucket
  total_weight_g: z.number(),
  items: z.array(assignedGearItemSchema),
});
export type GearAssignmentParticipant = z.infer<typeof gearAssignmentParticipantSchema>;

export const gearAssignmentsResponseSchema = z.object({
  participants: z.array(gearAssignmentParticipantSchema),
});
export type GearAssignmentsResponse = z.infer<typeof gearAssignmentsResponseSchema>;
```

A `gearAssignmentsResponseSchema` a `GET /api/trips/:id/gear-assignments` response shape-ja. A `participants` tömb a userenkénti aggregáció (a §11.3 user-döntés szerinti megjelenítési sorrenddel: userenkénti csoportosítás vagy itemenkénti lista — a szerver-oldali aggregáció ugyanaz, a kliens-oldali renderelés eltérő).

A SECURITY DEFINER function: `trip_participant_lookup_emails(p_user_ids uuid[], p_trip_id uuid)` — a `trip_comment_lookup_authors` mintájára (P2), de `trip_visible_to(p_trip_id)` filterrel (P2 óta meglévő function):

```sql
create or replace function public.trip_participant_lookup_emails(
  p_user_ids uuid[],
  p_trip_id uuid
)
returns table (user_id uuid, email text)
language sql
security definer
set search_path = public, auth
as $$
  select distinct u.id, u.email
    from auth.users u
   where u.id = any(p_user_ids)
     and public.trip_visible_to(p_trip_id)
     and (
       -- Az owner (a trip.user_id) vagy accepted invitee-k
       -- email-címét adja vissza (a meglévő friend_lookup_emails-sel
       -- analóg minta, de trip-szinten szűrve).
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
```

Ez a function a §11.2 user-döntés „résztvevőknek" opcióját támogatja: a `GET /api/trips/:id/gear-assignments` endpoint a viewer `trip_visible_to(tripId)` igazolása UTÁN hívja a functiont, hogy a viewer a résztvevők email-címét megkapja (NEM a saját user_id-ját, hanem a résztvevők listáját).

---

## 5. UI-terv

### 5.1 `components/TripGearPicker.vue` — assigned_to_user_id display + owner dropdown (MÓDOSÍTÁS)

A meglévő `TripGearPicker.vue` minimálisan bővül:

- Minden trip-gear item-sor MELLÉTT (a jelenlegi checkbox + qty stepper után) egy **read-only label** jelenik meg: „Hozzárendelve: <user_email>" vagy „Nincs hozzárendelve", ha NULL.
- Az **owner-only** gate-en belül (`isOwnerViewer === true`) a label MELLETT egy „Szerkesztés" link / icon-button, ami megnyit egy **inline dropdown-t** (NEM új modált — a §0.1 #2 elv: minimális súrlódás): a résztvevők listája (owner + accepted invitee-k, a `TripParticipantRow`-ból), plusz egy „Hozzárendelés törlése" opció (NULL).
- A dropdown változtatása azonnal PATCH-eli a `trip_gear.assigned_to_user_id` mezőt (debounce 300 ms a gyakori váltás ellen), a sikeres patch után a `useTrips.assignGearToUser` a `state.current.trip_gear` listát frissíti.

A Picker scope-ja NEM DRIFT-EL (P1 retro §2.2 tanulsága: a dedikált composable jobban karbantartható). A Picker NEM nyit új modált, csak egy inline dropdown-t.

### 5.2 `pages/trips/[id].vue` — „Ki mit visz" section (ÚJ)

A page DOM-jában a meglévő `TripGearPicker` UTÁN (vagy a `Résztvevők` panel MELLETT) egy új `gear-assignments-section` kerül:

- **Cím:** „Ki mit visz" (NEM „Súlyeloszlás", NEM „Pack list" — a P2 magyar voice-hoz igazodik, MemoFox style).
- **Gate:** `v-if="canViewGearAssignments"` (a `canViewGearAssignments` a `isOwnerViewer || canViewRecap(state.current, user.value.id)` kombináció — a P2 default: owner-only, a §11.2 user-döntés „résztvevőknek" opciója esetén a `canViewRecap`-pal konzisztens).
- **Aggregáció:** a `useTrips.fetchGearAssignments(tripId)` hívás eredménye (a `state.gearAssignmentsByTripId[tripId]` cache-ből). Első mountkor a page a függvényt meghívja (debounce 200 ms).
- **Megjelenítési sorrend** (a §11.3 user-döntés függvénye):
  - **Userenkénti csoportosítás** (A opció, default): `<div v-for="p in participants">`, ABC-sorrendben a user email-címével (a `Intl.Collator('hu')` rendezéssel, a P1 mintára). A `user_id = null` bucket („Nincs hozzárendelve") a lista végén jelenik meg.
  - **Itemenkénti lista** (B opció): egyetlen `<ul>`, soronként `<item.name> → <user.email>` (vagy „Nincs hozzárendelve"), ABC-sorrendben az item nevével.
- **Aggregált súly:** block-fejlécben (A opció) vagy soronként (B opció) a `total_weight_g` (grams, 1 tizedesjegy).
- **Item lista:** a participant items tömbje, soronként `name · category · weight_g × quantity`.
- **Owner-only edit:** A és B opció esetén is: minden item-sor mellett a §5.1 dropdown (ugyanaz, mint a `TripGearPicker`-ben — a kettő NEM drift-el, a dropdown handler ugyanazt a `assignGearToUser` composable metódust hívja).

### 5.3 `pages/trips/[id].vue` — Résztvevők panel (NEM MÓDOSUL)

A meglévő `Résztvevők` panel (P3.2 óta: owner + accepted invitee-k, a `TripParticipantRow` típusból) **NEM MÓDOSUL** a P2-vel. A P2 NEM bővíti a `TripParticipantRow` típust új role-névvel (a `request_to_join` / accepted joiner KIZÁRVA a P2-ből — a §0.2 out-of-scope).

### 5.4 A többi meglévő UI NEM MÓDOSUL

- `TripFormModal.vue` — NEM MÓDOSUL (nincs új `participation` toggle, nincs új mező). A P2 nem nyúl a form-hoz.
- `TripCard.vue` — NEM MÓDOSUL (nincs új „Kérelemre" badge, nincs „Meghívásos" badge). A P2 nem nyúl a card-hoz.
- A meglévő invite-flow, comment-thread, recap-photo, debrief UI — NEM MÓDOSUL.

---

## 6. Fájl-lista (commit scope)

**Új fájlok (3 db):**

- `supabase/migrations/20260819000000_trip_gear_assigned_to.sql` (a `trip_gear.assigned_to_user_id` + index + SECURITY DEFINER function)
- `shared/gearAssignmentSchemas.ts` (a `gearAssignmentParticipantSchema` + `AssignedGearItem` zod schemas)
- `server/api/trips/[id]/gear-assignments.get.ts` (az aggregált nézet endpoint)

**Módosított fájlok (4 db):**

- `shared/tripSchemas.ts` (a `tripGearUpdateSchema` bővül az `assigned_to_user_id` mezővel)
- `server/utils/tripSchemas.ts` (re-export patch, backward-compatible)
- `types/db.ts` (a `TripGearRow` + `TripGearUpdate` bővül az `assigned_to_user_id` mezővel; a `TripState` bővül a `gearAssignmentsByTripId` cache-sel)
- `composables/useTrips.ts` (2 új metódus: `fetchGearAssignments`, `assignGearToUser`)
- `components/TripGearPicker.vue` (assigned_to_user_id display + owner dropdown)
- `pages/trips/[id].vue` (az új „Ki mit visz" section)

**NEM MÓDOSUL:**

- `server/api/trips/[id]/gear.post.ts` (a meglévő INSERT, NEM bővül)
- `server/api/trips/[id]/gear/[gearId].delete.ts` (a meglévő DELETE, NEM bővül)
- `server/api/trips/[id].get.ts` (a trip-detail endpoint NEM bővül — a gear nested marad)
- `server/api/trips/[id].patch.ts` (a trip-update endpoint NEM bővül a `participation` mezővel — a P2 NEM vezeti be)
- `components/TripFormModal.vue`, `components/TripCard.vue` — NEM MÓDOSULNAK
- A meglévő trips RLS NEM ÉRINTETT, a `trip_visible_to()` function NEM MÓDOSUL, a `trip_share_invites` RLS NEM MÓDOSUL, a `friendships` RLS NEM MÓDOSUL.

---

## 7. Acceptance criteria (7 mérhető feltétel, a QA hook-hoz)

A P2 kártyán a QA a következő 7 mérhető feltételt ellenőrzi (a 3-as szintű user-döntések UTÁN):

1. **A `trip_gear.assigned_to_user_id` mező hozzáadva** (a migration alapján, NULL default).
2. **A `TripGearPicker` UI mutatja a gear-hozzárendeléseket** (read-only label + owner-only dropdown).
3. **Az owner hozzárendelhet egy user-t az item-hez (és eltávolíthatja)**: a PATCH /api/trips/:id/gear/:gearId fogadja az `assigned_to_user_id` mezőt (UUID vagy NULL), és a RLS-en átenged (owner-only).
4. **A „Ki mit visz" aggregált endpoint owner + résztvevők gate-en működik** (a §11.2 B user-döntés szerint): a GET /api/trips/:id/gear-assignments 200-zal válaszol owner-ként ÉS accepted invitee-ként ÉS accepted friend-ként. A NEM résztvevő user (accepted invitee-n kívüli) 404-et kap (a meglévő trips RLS-en át, `trips_select_own_or_shared` policy + a meglévő `trip_visible_to()` function). A PATCH endpoint (a gear-hozzárendelés beállítása) továbbra is owner-only (az owner végzi a hozzárendelést, a résztvevők csak olvassák).
5. **A megjelenítési sorrend (userenkénti vagy itemenkénti) megfelel a §11.3 user-döntésnek**: a `pages/trips/[id].vue` `gear-assignments-section` template a §11.3-nak megfelelő struktúrát rendereli.
6. **Nincs publikus adat-felszín (a `/discover` NEM módosul)**: a `pages/discover/index.vue` és a `server/api/discover/index.get.ts` VÁLTOZATLAN (git diff = 0 sor).
7. **A meglévő social funkciók (`trip_visible_to()`, `trip_share_invites`) NEM törtek el**: a `trip_visible_to()` function body változatlan (a meglévő owner + accepted invitee + accepted friend clause), a `trip_share_invites` RLS VÁLTOZATLAN.

A 7 feltétel mind a `npm run build` + `vue-tsc` self-test gate-eken felül értendő (a parent-agent a QA round-ban futtatja).

---

## 8. Open questions (a 3-as szintű user-döntések)

A **3 db 3-as szintű user-döntés** a P2-vel kapcsolatban (a parent-agent a Full-stack dispatch előtt kérdezi a user-t):

### 8.1 `assigned_to_user_id` mező opcionális vagy kötelező?

| Szempont | **Opcionális** (A, default) | **Kötelező** (B) |
|---|---|---|
| **Adatmigráció** | Nincs backfill, a meglévő sorok NULL-ra maradnak | Backfill script kell (UPDATE trip_gear SET assigned_to_user_id = <owner> WHERE IS NULL) |
| **UX** | A user explicit opt-in a „Ki mit visz" nézetbe | Minden item automatikusan hozzárendelt |
| **„Ki mit visz" nézet** | Csak a hozzárendelt itemeket mutatja (a NULL-ok „Nincs hozzárendelve" bucket-ben) | Minden itemet mutatja |
| **Privacy** | Nincs preferencia | Nincs preferencia |
| **P2 default** | **A** (a §0.4 „kivétel" 1. alpontja NEM aktív) | — (BLOCKING, §0.4 1. alpont) |

### 8.2 „Ki mit visz" nézet publikus-e a résztvevőknek vagy owner-only?

| Szempont | **Owner-only** (A, default) | **Résztvevőknek** (B) |
|---|---|---|
| **Jogosulti kör** | `state.current.user_id === auth.uid()` | `trip_visible_to(tripId)` — owner + accepted invitee + accepted friend |
| **Privacy** | Maximális (csak a tulajdonos látja) | A meglévő accepted invitee-k is látják |
| **Implementáció** | Egyszerű: RLS-en átjut, NEM kell service-role olvasás | Bonyolult: service-role olvasás + `trip_visible_to()` check az endpoint-on |
| **P2 default** | **A** (a privacy-first elv követi, kisebb scope) | — (L2 + utólagos jelentés, §0.4 2. alpont) |

### 8.3 Megjelenítési sorrend (userenkénti vagy itemenkénti)?

| Szempont | **Userenkénti csoportosítás** (A, default) | **Itemenkénti lista** (B) |
|---|---|---|
| **UX** | „User A viszi: sátor, hálózsák; User B viszi: főző, evőeszközök" — klasszikus „ki-mit-visz" élmény | „sátor → User A; hálózsák → User A; főző → User B" — lineáris, görgetős |
| **Aggregált súly** | Block-fejlécben (user-szintű összeg) | Soronként (item-szintű) |
| **P2 default** | **A** (a user üzenete explicit említi a „Ki mit visz" framinget) | — |

---

## 9. A P2 rollback-út (ha a deployment problémás)

A P2 egyetlen migration-ön alapul, és a UI-patch-ek minimálisak (a `TripGearPicker` + a `pages/trips/[id].vue` új section). A rollback-út:

1. **Migration rollback** (`supabase/migrations/20260819000000_trip_gear_assigned_to.sql`):
   - A migration `add column if not exists` kifejezést használ, ami forward-only.
   - A rollback a `drop column assigned_to_user_id; drop index if exists trip_gear_assigned_to_idx; drop function if exists trip_participant_lookup_emails(uuid[], uuid);` SQL-lel tehető meg (a user-oldali Supabase SQL Editor-ban).
   - A migration kommentje dokumentálja a rollback SQL-t.
2. **UI rollback**:
   - A `components/TripGearPicker.vue` régi verzióját a `pages/trips/[id].vue`-ból a `gear-assignments-section` törlésével visszaállítható.
   - A `server/api/trips/[id]/gear-assignments.get.ts` törlése.
   - A `shared/gearAssignmentSchemas.ts` törlése.
   - A `composables/useTrips.ts` `fetchGearAssignments` + `assignGearToUser` metódusainak eltávolítása.
   - A `shared/tripSchemas.ts` `tripGearUpdateSchema` régi verzióját a `quantity` kötelezővé tételével visszaállítható.
3. **A rollbackot a parent-agent csinálja** (a user-jóváhagyás UTÁN), a Vercel deploy rollback pedig a korábbi `[deploy]` commitra való visszaállítással történik (a `[deploy]` tag convention miatt a rollback-commit is `[deploy]` tag-ű).

A rollback-út nem automatikus — a P2 bármilyen problémája a parent-agent + user közös döntése a rollbackről (a 3-as szintű szabály: rollback = scope-pivot).

---

## 10. A P2 NEM nyúlik hozzá (a P3+ scope-pivot előkészítése)

A P2 kizárólag a `trip_gear.assigned_to_user_id` mezőt aktiválja. Az alábbiak a P3+ scope-pivotok (a P2 NEM építi, csak előkészíti a sémát):

- **`trips.participation` mező funkcióba hozatala** (a v2 §4-ben bent van, a P2 NEM): a `request_to_join` flow, a `trip_join_requests` tábla, a P4 Social/SaaS rétegbe tartozik.
- **`trip_visible_to()` function módosítása** (a P2 NEM): a P3+ bővítheti a function-t `request_to_join + accepted joiner` ággal, amikor a `request_to_join` flow bejön (P4).
- **Self-service „Hozzárendelem magamhoz a cuccot" flow** (a résztvevők is szerkeszthetik a saját gear-listájukat): P3+ scope, ahol a `trip_gear.assigned_to_user_id` PATCH RLS a `auth.uid() = assigned_to_user_id OR auth.uid() = trip.owner` kiterjesztést kap. A P2 owner-only ezen a flow-n, mert a résztvevők saját gear-listája a P3+ validációtól függ.
- **A „trip-charter" (turista-csoport koordináció) flow**: a P3+ scope-pivot, ahol a résztvevők egymás között chat-elhetnek a gear-listáról, vote-olhatnak a közös cuccokra, stb. A P2 NEM épít chat vagy vote UI-t.
- **Résztvevő-eltávolítás / „kick participant" / „leave trip" flow**: P3+ scope.
- **A „Mit vittem a túrán?" poszt-trip recap** (a meglévő trip_recap rendszerben marad, P2 nem bővíti).

A P2 ezen feature-ök NÉLKÜL is működőképes, user-értéket ad (a „Ki mit visz" nézet a meglévő accepted invitee-k + owner körére szorítkozik, és a privacy-first alapelvet követi, NEM törekszik a „social" élményre).

---

## 11. 3-as szintű user-döntések (a parent-agent a user felé továbbítja)

A P2 3 db 3-as szintű user-döntést igényel (a parent-agent a Full-stack dispatch előtt kérdezi a user-t):

### 11.1 `assigned_to_user_id` mező opcionális vagy kötelező?

**Kérdés**: a `trip_gear.assigned_to_user_id` mező opcionális (NULL allowed) vagy kötelező (NOT NULL) legyen?

**A user 2026-08-16-i megerősítése (explicit, ebben a beszélgetésben): opcionális (A) — egyezik a P2 default-tal, OK.**

- **Opcionális** (A — a user döntése): a mező NULL lehet; a meglévő összes trip_gear sor NULL-ra marad (backfill nélkül). A „Ki mit visz" nézet a hozzárendelt itemeket mutatja, a NULL-ok „Nincs hozzárendelve" bucket-ben jelennek meg.
- **Kötelező** (B — elvetve, a user NEM ezt választotta): NEM implementálandó.

**A user döntése (rögzítve 2026-08-16): A — opcionális.**

### 11.2 „Ki mit visz" nézet: ki láthatja?

**Kérdés**: a „Ki mit visz" nézetet kik láthatják?

**A user 2026-08-16-i döntése (explicit, ebben a beszélgetésben): a nézetet MINDEN trip-résztvevő láthassa** — owner + accepted invitee-k + accepted friend-ek. **NEM owner-only.**

- **Résztvevőknek** (B — a user döntése): a `GET /api/trips/:id/gear-assignments` endpoint a meglévő `trip_visible_to()` SECURITY DEFINER function-t használja (a P2 social-ből örökölt, NEM BŐVÜL); a function ellenőrzi, hogy a viewer owner, accepted invitee, vagy accepted friend-e. A `pages/trips/[id].vue` `gear-assignments-section` `v-if="canViewRecap(state.current, user.value.id)"` gate-elve (a meglévő client-side predicate). A P2 endpoint `serverSupabaseClient<Database>(event)`-et használ (a user-JWT-vel), NEM service-role-t, hogy az RLS Strict-en átengedje a viewer-t (az RLS a meglévő trips RLS-en keresztül fut, ami a `trips_select_own_or_shared` policy-t használja).
- **Owner-only** (A — elvetve, a user NEM ezt választotta): NEM implementálandó.

**A user döntése (rögzítve 2026-08-16): B — résztvevőknek.**

### 11.3 Megjelenítési sorrend (userenkénti vagy itemenkénti)?

**Kérdés**: a „Ki mit visz" nézet userenkénti csoportosításban vagy itemenkénti listában jelenjen meg?

**A user 2026-08-16-i döntése (explicit, ebben a beszélgetésben): userenkénti csoportosítás** — a duplikáció-elkerülés célját jobban szolgálja (könnyebb látni, ha valakinek semmi sincs hozzárendelve, vagy ha egy fontos tétel senkihez sincs kötve).

- **Userenkénti csoportosítás** (A — a user döntése): „User A viszi: sátor, hálózsák; User B viszi: főző, evőeszközök" — a `participants` tömb iterationje, ABC-sorrendben email-cím alapján.
- **Itemenkénti lista** (B — elvetve, a user NEM ezt választotta): NEM implementálandó.

**A user döntése (rögzítve 2026-08-16): A — userenkénti csoportosítás.**

### 11.4 A parent-agent teendője a 3-as szintű döntések UTÁN

A §11 user-döntés(ek) beérkezése UTÁN a parent-agent:

1. Frissíti a `docs/sprint-5-p2-ki-mit-visz.md` §11 szekcióját a user döntésével.
2. A Full-stack dispatch a §11 alapján indul (a §2-§5 spec-részletek a döntés szerinti szűkítést alkalmazzák).
3. A QA round a §7 acceptance criteria-t ellenőrzi (a §11-nek megfelelően).

---

## 12. A P2 szállítása (a parent-agent teendője)

A parent-agent a P2 szállításához a következő lépéseket futtatja (a 3-as szintű user-döntések UTÁN):

1. **A migration megírása**: a `supabase/migrations/20260819000000_trip_gear_assigned_to.sql` fájlba a §2.1 SQL-t.
2. **A migration user-oldali futtatása**: a user a Supabase SQL Editor-ban futtatja (a `trello-board-workflow` skill §4 „user-as-migration-runner" mintája).
3. **A típusok + zod schemák megírása**: `shared/gearAssignmentSchemas.ts` (§4), `shared/tripSchemas.ts` (§3.3), `types/db.ts` (§3.4).
4. **Az endpoint megírása**: `server/api/trips/[id]/gear-assignments.get.ts` (§3.1) + a PATCH endpoint bővítése (§3.2).
5. **A composable bővítése**: `composables/useTrips.ts` (§3.4).
6. **A UI patch-ek**: `components/TripGearPicker.vue` (§5.1) + `pages/trips/[id].vue` (§5.2).
7. **A QA round**: a §7 acceptance criteria alapján, a parent-agent `feature-qa-pass` skill-t használva.
8. **A `[deploy]` commit**: a QA Approved + ≥ 60 másodperces futásidő UTÁN, L2 automata (kivéve a §0.4 „kivétel" eseteit).
9. **Az utólagos jelentés**: a `trip_gear.assigned_to_user_id` FK ON DELETE SET NULL viselkedéséről + a §11 user-döntés szerinti funkció-szűkítésről.

A parent-agent a P2 deployment UTÁN jelzést küld a user-nek a Trello P2 kártyán (komment formájában), és a `docs/retro/sprint5-phase2.md` fájlban dokumentálja a tanulságokat (a P0 + P1 retro mintára).

---

## 13. Decisions log (a P2 spec elfogadott döntései)

| # | Döntés | Indoklás | Szint |
|---|---|---|---|
| 1 | A P2 **kizárólag a `trip_gear.assigned_to_user_id` mezőt** aktiválja. A `participation` flow, a `request_to_join`, a `trip_join_requests` tábla, a `trip_visible_to()` function bővítése — mind **KIZÁRVA**. | User explicit utasítása (2026-08-16): a P2 szűkített scope, a `request_to_join` flow P4-be tolódik. | 1 |
| 2 | A `trip_visible_to()` SECURITY DEFINER function **VÁLTOZATLAN** marad. | A meglévő P2 function (owner + accepted invitee + accepted friend) elegendő a „Ki mit visz" nézet jogosulti köréhez; a P2 NEM bővíti. | 2 |
| 3 | A `trip_gear` RLS **VÁLTOZATLAN** marad (owner-scoped). | A meglévő P0 owner-only RLS biztosítja, hogy csak a trip owner PATCH-elheti az `assigned_to_user_id` mezőt. | 2 |
| 4 | A `TripParticipantRow` típus **NEM BŐVÜL** új role-névvel (a `request_to_join` / accepted joiner KIZÁRVA). | A P2 szűkített scope: a meglévő P3.2 típus (owner + accepted invitee) elegendő a kiválasztható user-ek listájához. | 2 |
| 5 | A `TripGearPicker` módosítása **inline dropdown**-nal történik, NEM új modál. | v2 §0 #2 elv: minimális onboarding-súrlódás. A dedikált composable jobban karbantartható (P1 retro §2.2). | 2 |
| 6 | A „Ki mit visz" section **owner-only** (a §11.2 user-döntés szerinti default). | Privacy-first alapelv (v2 §0 #1): a meglévő accepted invitee-k számára a nézet a §11.2 user-döntés UTÁN nyílik meg. | 2 |
| 7 | A megjelenítési sorrend **userenkénti csoportosítás** (a §11.3 user-döntés szerinti default). | A user üzenete a „Ki mit visz" framinget preferálja (NEM lineáris „sátor → user A" listát). | 2 |
| 8 | A `trip_participant_lookup_emails` SECURITY DEFINER function a §4-ben definiált, a `trip_visible_to()` filtert használja. | A meglévő `trip_comment_lookup_authors` mintát követi; a `trip_visible_to()` NEM bővül, csak a P2 endpoint hívja. | 2 |
| 9 | A migration **egyetlen fájl**: `trip_gear.assigned_to_user_id` + index + SECURITY DEFINER function. | v2 §0 #4 elv (séma-szintű jövő-biztosítás olcsó); a P2 egyetlen új sématöbblete. | 2 |
| 10 | **Nincs publikus adat-expozíció** (user-opt-in), **nincs fizetős tier**, **nincs security/RLS-változás**. | 3-as szintű szabály: P2 = 2-es szintű. | 2 |
| 11 | A P2 deployment **L2 automata** (QA Approved UTÁN, NEM kell user-jóváhagyás), kivéve a §0.4 „kivétel" eseteit (§11.1 kötelező, §11.2 résztvevőknek, §11.3 automatikus accepted friend — ez utóbbi KIZÁRVA a P2-ből). | 2026-08-15-ös deploy-szabály: L2 automata a 2-es szintű P2-re. | 2 |

---

## 14. Trello-paste blokk (a parent-agent a P2 kártyára postolja)

```
Sprint 5 P2 — Ki mit visz (csoportos csomaglista-egyeztetés) — SZŰKÍTETT SCOPE
Architect-spec: docs/sprint-5-p2-ki-mit-visz.md (14 szekció, teljes terjedelem)

Forrás: v2 §0 döntési elvek + §4 visibility/participation sémák.
A P2 = 2-es szintű (NEM publikus adat-expozíció, NEM fizetős tier, NEM security/RLS-változás).
A user explicit utasítása (2026-08-16): a request_to_join flow + a participation
funkcióba hozatala + a trip_visible_to() bővítése KIZÁRVA a P2-ből — P4-be tolódik.
A meglévő social funkciók (trip_share_invites, trip_visible_to(), friendships)
HASZNÁLATBAN vannak (a meglévő accepted invitee-k listájához), DE NEM BŐVÜLNEK.

Séma:
- ÚJ: trip_gear.assigned_to_user_id (uuid NULL, FK auth.users(id) ON DELETE SET NULL)
- ÚJ: SECURITY DEFINER trip_participant_lookup_emails(p_user_ids uuid[], p_trip_id uuid)
  (a meglévő trip_visible_to() filtert használja — a function NEM BŐVÜL)
- VÁLTOZATLAN: trip_gear RLS (owner-scoped), trip_visible_to() function,
  trips SELECT policy, trip_share_invites, friendships, trip_participants.
- KIZÁRVA: trips.participation funkcióba hozatala, trip_join_requests tábla,
  request_to_join flow.

Endpoint-ok (1 új / 1 módosított):
- ÚJ: GET /api/trips/:id/gear-assignments (aggregált nézet, owner-only default,
  vagy §11.2 user-döntés szerinti résztvevőkre kiterjed)
- MÓDOSÍTÁS: PATCH /api/trips/:id/gear/:gearId (assigned_to_user_id mező,
  owner-only, NULL = töröl, UUID = beállít)
- VÁLTOZATLAN: POST /api/trips/:id/gear, DELETE /api/trips/:id/gear/:gearId,
  PATCH /api/trips/:id, GET /api/trips/:id.

UI (1 új section / 1 módosítás / 0 új modál):
- ÚJ: pages/trips/[id].vue „Ki mit visz" section (owner-only, aggregált
  user-bucketek vagy itemenkénti lista — a §11.3 user-döntés függvénye)
- MÓDOSÍTÁS: components/TripGearPicker.vue (assigned_to_user_id read-only
  label + owner-only inline dropdown — NEM új modál)
- VÁLTOZATLAN: TripFormModal.vue (NEM bővül participation toggle-vel),
  TripCard.vue (NEM bővül új badge-dzsel), Résztvevők panel (NEM bővül
  új role-névvel).

Migration (1 új, forward-only, user-oldali futtatás):
- 20260819000000_trip_gear_assigned_to.sql (trip_gear.assigned_to_user_id
  + index + SECURITY DEFINER function)

NE épít: ML, push-notification, weather-aware, GPX vizualizáció, /discover
módosítás, request_to_join flow, participation funkcióba hozatala,
trip_visible_to() bővítése, self-service „saját cucc listám", chat/vote,
résztvevő-eltávolítás, automatic friend invite.

3-as szintű user-döntések (a parent-agent a dispatch előtt kérdezi):
- §11.1: assigned_to_user_id mező opcionális (A) vagy kötelező (B)?
  [BLOCKING ha B — backfill script kell]
- §11.2: „Ki mit visz" nézet owner-only (A) vagy résztvevőknek (B)?
  [L2 + utólagos jelentés ha B — a trip_visible_to() használata]
- §11.3: Megjelenítési sorrend userenkénti (A) vagy itemenkénti (B)?
  [NEM blocking — UI preferencia]

A P2 default: A/A/A (opcionális assigned_to_user_id + owner-only „Ki mit visz"
+ userenkénti csoportosítás).

Acceptance criteria (7 mérhető, QA-hook):
1. trip_gear.assigned_to_user_id mező hozzáadva (NULL default).
2. TripGearPicker UI mutatja a gear-hozzárendeléseket (read-only + owner dropdown).
3. Az owner hozzárendelhet egy user-t az item-hez (és eltávolíthatja) a
   PATCH /api/trips/:id/gear/:gearId endpoint-on.
4. „Ki mit visz" aggregált endpoint owner + (a §11.2 user-döntés szerinti)
   résztvevők gate-en működik.
5. A megjelenítési sorrend (userenkénti vagy itemenkénti) megfelel a
   §11.3 user-döntésnek.
6. Nincs publikus adat-felszín (a /discover NEM módosul — git diff = 0 sor).
7. A meglévő social funkciók (trip_visible_to(), trip_share_invites) NEM
   törtek el — a function body VÁLTOZATLAN.

[deploy] commit scope (QA Approved UTÁN, L2 automata, NEM kell user-jóváhagyás,
UTÓLAGOS JELENTÉSsel):
- L2 automata deploy a 1 migration + 3 új + 4 módosítás egyetlen commitját jelenti.
- A deployment UTÁNI utólagos jelentés: a trip_gear.assigned_to_user_id FK
  ON DELETE SET NULL viselkedése + a §11 user-döntés szerinti funkció-szűkítés.
- A P2 kivétel az L2 alól (user-jóváhagyás szükséges a deploy előtt), ha:
  (a) §11.1 a „kötelező" opciót választja (adatmigrációs backfill script kell),
  (b) §11.2 a „résztvevőknek" opciót választja (trip_visible_to() használata).
- Ellenkező esetben (A/A/A) a P2 L2 automata, NEM kell user-jóváhagyás.

Specifikáció teljes terjedelme: docs/sprint-5-p2-ki-mit-visz.md §1-§13
next: parent-agent → user-döntés a §11-ről → Full-stack dispatch → QA round →
[deploy] L2 automata.
```

---

## Végjegyzet

A P2 a v2 §0 #1 elv talaján egyetlen user-értéket épít: a „Ki mit visz" csoportos csomaglista-egyeztetést a meglévő résztvevők (owner + accepted invitee + accepted friend) között. A P2 a user explicit utasítására (2026-08-16) SZŰKÍTETT scope-pal indul: a `request_to_join` flow, a `participation` funkcióba hozatala, a `trip_visible_to()` bővítése, a `trip_join_requests` tábla — mind KIZÁRVA a P2-ből, a P4 Social/SaaS rétegbe tolódnak. A meglévő P0/P1/P2 social funkciók (`trip_share_invites`, `trip_visible_to()`, `friendships`) HASZNÁLATBAN vannak (a kiválasztható user-ek listájához), DE NEM BŐVÜLNEK.

A P2 NEM nyúl a `/discover` listaoldalhoz, NEM vezet be push-notification-t, NEM épít ML-t/weather-aware-t, NEM bővíti a `trip_visible_to()` function-t, és NEM épít self-service résztvevő-szerkesztést — ezek a P3+/P4 scope-pivotok. A P2 a spec-et a parent-agent postolja Trello-kommentként a P2 kártyára (`6a822a8864aa26961a94152f`), a §14 paste-blokk mintájára. A spec implementációja a P2 deployment-hez kötött, ami a §11 user-döntések beérkezése UTÁN indul.