# Sprint 5 — P1 Community Routes ("Felfedezés a régióban") — Architect spec

**Author:** Architect (role:architect)
**Date:** 2026-08-16
**Source of truth:** `docs/product-architecture-v2.md` §0 döntési elvek + §4 visibility/participation sémák + a Sprint 5 P1 Trello-kártya (`6a8171f0680d02f9e3e404cf`, Backlog, `role:architect`).
**Branch / SHA:** `master` @ `e9084f0` (Sprint 5 P0.3 L3 deploy push; a P0 mind deployolva).
**Trello-kártya:** **P1 Community Routes** — `6a8171f0680d02f9e3e404cf` (Backlog, `role:architect`).
**Implementáció tiltva:** ez a fájl csak TERV. A `[deploy]` commit a parent-agent QA workflow-ja UTÁN jön (az új 2026-08-15-ös szabály: **automatikus, NEM kell user-jóváhagyás L1/L2 esetén**). A spec-et a parent-agent postolja Trello-kommentként a P1 kártyára (lásd §14 Trello-paste blokk).

---

## 0. Scope-pivot emlékeztető (3-as szintű szabály: P1 = 2-es szintű)

A P1 a **2-es szintű** hatáskörbe esik (a Sprint 4 P0-Phase-okkal + a Sprint 5 P0.1/P0.2-vel azonos besorolás):

- **Dokumentált** (ez a fájl) + **jóváhagyott stratégia** (a Sprint 5 P1-terv: a v2 §4 `visibility` mező funkcióba hozatala, „Felfedezés a régióban" listaoldal).
- **NEM public adat-expozíció** (a `/discover` listaoldal csak a user-opt-in `public` trippeket mutatja, NEM publikus default).
- **NEM fizetős tier**, **NEM security/RLS-változás** (a meglévő trips RLS policy owner-scoped, a P1 az owner-tól kapott opt-in flagen szűr, és a `public` projektció service-role-on át megy a Phase 3 `/list/[id]` mintára).
- **2 db 3-as szintű user-döntés** szükséges a spec §11-ben: (a) régió-tag módszere (manual vs. GPX-derived), (b) régió-csoportosítás módja (ABC vs. régiónkénti ABC). A privacy-default (private) megerősítés, NEM scope-pivot.

### 0.1 A v2 §0 → P1 leképezés (5 elv)

| v2 §0 elv | P1 megvalósulása |
|---|---|
| **#1 Valós felhasználói adat > feltételezés** | A `/discover` listaoldal kizárólag a user-által explicit `public`-ra kapcsolt trippeket mutatja. A „Felfedezés" framing az adatot leírja, NEM minősíti („népszerű"/"legjobb" tiltott — amíg nincs elég adat, a minősítés hamis). |
| **#2 Minimális onboarding-súrlódás** | A meglévő `/trips` listaoldal + `TripFormModal` (P1) kap egy szabadon választható `visibility` toggle-t (default `private`). A P1 NEM nyit új modalt / új flow-t a listabejegyzéshez. |
| **#3 Niche-igény validáció nélkül** | A P1 egyetlen új felület: a `/discover` route. A listaoldal **leíró** (régiónként csoportosított, ABC-sorrend), NEM rangsoroló. A rating/értékelés P3+ scope, ahol már lesz elég adat az értelmes pontozáshoz. |
| **#4 Séma-szintű jövő-biztosítás olcsó, UI/logika-szintű nem** | A P1 **egyetlen** migrationt igényel: `trips.visibility`, `trips.region`, `trips.region_source` (a régió-tag módszerétől függően, ld. §11). A `participation` mező NEM kerül bevezetésre (az a v2 §4-ben bent van, de P2+ scope-pivot). |
| **#5 Trip ≠ My Gear** | A `/discover` listaoldal kizárólag a trips táblából olvas, NEM a `gear_items`-ből. A publikus projekció a `trips` oszlopokra korlátozódik (név, leírás, dátum, régió, GPX-származtatott táv/szint amennyiben rendelkezésre áll — ez a P1-ben minimális, ld. §3). |

### 0.2 Explicit out-of-scope (P1 NEM épít)

- **Nincs popularity/score/rating** — a P1 listaoldal NO score, NO sort by rating, NO "top X" framing.
- **Nincs participation** — a `trips.participation` mező a v2 §4 sémájában bent van, de a P1 **nem vezet be UI-t/logikát** hozzá (P2+ scope-pivot, amikor a community-share feature bejön).
- **Nincs résztvevőkezelés, comment, share** — Ezek a P2+ scope.
- **Nincs OSM/Wikiloc integráció** — a `region` mező P1-ben **csak string típus**, NEM külső API (P3+ scope, ld. §11 user-döntés).
- **Nincs új publikus route a Phase 3 mintán túl** — a `/discover` egyetlen publikus oldal, és kizárólag a `public` flag-gel ellátott trippeket mutatja (user-opt-in, NEM publikus default).
- **Nincs sprint-loop-elem módosítás** — a P1 nem nyúl a My Gear / Debrief / Trip-create flow-hoz (kizárólag a `visibility` toggle-t adja hozzá a TripFormModal-hoz).

### 0.3 A 3-as szintű scope-pivot őrszem (cross-table consistency STOP, v2 §4)

A P1 a v2 §4-ben dokumentált `trips.visibility` és `trips.participation` mezők közül **kizárólag a `visibility`-t** aktiválja. A `participation` mező NEM kerül implementálásra a P1-ben (NEM migration, NEM UI, NEM logika). A két mező séma-szintű együtt-tartása a v2 §4-ben rögzített DB-constraint (private → invite_only) csak a P2+ fázisban válik aktívvá, amikor a `participation` feature valóban bejön. A P1 migration **kizárólag** a `visibility` + `region` + `region_source` oszlopokat vezeti be; a `participation` oszlop PALETTÁRA NEM KERÜL (nem forward-only zavar, hanem a P2+ scope-ot hagyjuk érintetlenül).

### 0.4 A P1 deploy-szintje (az új 2026-08-15-ös szabály)

**P1 = L1 AUTOMATA deploy** (QA Approved UTÁN, NEM kell user-jóváhagyás):

- **NEM publikus adat-expozíció** (a `/discover` a user-opt-in `public` trippeket mutatja, NEM publikus default — a Phase 3 `/list/{id}` mintával analóg módon a meglévő owner-opt-in public-share mintát követi).
- **NEM fizetős tier.**
- **NEM security/RLS-változás** (a meglévő trips RLS-t használjuk, a public-projection service-role-on át megy a Phase 3 mintára, a `public_list_lookup` helper mintájára egy új `public_trip_lookup` helper vagy közvetlen service-role query).
- **Migration-t tartalmaz** (egyetlen fájl: `trips.visibility`, `trips.region`, `trips.region_source` — ez a P1 egyetlen új sématöbblete, a `participation` PALETTÁRA NEM KERÜL).

**A P1 kivétel az L1 automatizmus alól** (user-jóváhagyás szükséges a deploy előtt), ha:
1. A user-döntés a régió-tag módszeréről (manual vs. GPX-derived) a GPX-derived opciót választja, mert ez 3rd-party API (OSM Nominatim) hívást vezet be → **L2 deploy mehet, de utólagos jelentéssel** (az L2 jelenti a 3rd-party API bekötésének tényét a user felé).
2. Bármely más, a spec §11-ben nem explicitált döntés (pl. régió-csoportosítás) más irányt vesz.

Ellenkező esetben (manual régió + régiónkénti ABC) a P1 L1-es, és a `[deploy]` commit a QA Approved UTÁN automatikus.

---

## 1. Cél és a P1 értelmezése

A P1 a v2 §4 „jövő-biztosítás" szintjéről a tényleges, **user-által használható funkció** szintjére emeli a `visibility` flaget:

1. **A user a trip-create form-ban** (meglévő `TripFormModal.vue`) explicit átkapcsolhatja a trip-jét `private` (default) → `public` státuszra.
2. **A `public` trip megjelenik a `/discover` listaoldalon** — ez a Phase 3 `/list/{id}` mintájára service-role-on át projekciót ad a trips táblából, de **kizárólag** a `visibility = 'public'` AND `participation = 'invite_only'` (a P1-ben a participation mindig `invite_only` default) sorokra.
3. **A `private` trip NEM jelenik meg a `/discover`-en** — ez a public-projection SQL szintjén szűr, NEM a RLS szintjén (a trips RLS owner-scoped marad, a service-role a publikus projekcióhoz factory-szűrővel dolgozik).
4. **A listaoldal régiónként csoportosít** — a `trips.region` szabad szövegként (manual user input VAGY GPX-derived, ld. §11 user-döntés) szolgál csoportosítási kulcsként. A sorrendezés **leíró**, NEM popularity-alapú (a §0.1 #3 elv).

A P1 a funkció **első fázisa**, NEM a teljes „Community Routes" feature. A P2+ fázisok bevezetik a participation-t (request_to_join), a comment-eket, a share-flow-t, és a P3+ vezeti be a rating/értékelést.

---

## 2. Schema-változás (egyetlen migration)

### 2.1 A migration fájl: `supabase/migrations/20260817000000_trips_public_region.sql`

```sql
-- ============================================================================
-- trips.visibility + trips.region + trips.region_source — Sprint 5 P1
-- Architect-approved (comment id 6a8171f0680d02f9e3e404cf, design-pass).
-- Forward-only migration.
--
-- Adds:
--   * public.trips.visibility     — 'private' (default) | 'public'
--   * public.trips.region         — text, NULL default, manual user input
--                                   OR GPX-derived (P1 user-döntés, §11)
--   * public.trips.region_source  — 'manual' | 'gpx' | NULL
--                                   (NULL = a user még nem állított be régiót)
--
-- Miért NULL default a region:
--   * Backward-compatible: a meglévő összes trips rekord régió nélkül
--     marad (NEM törlünk / NEM módosítunk meglévő oszlopot).
--   * A user a TripFormModal-on opt-in jelleggel töltheti ki a régiót.
--   * A /discover listaoldal a régió NÉLKÜLI public trippeket is
--     megjeleníti egy "Egyéb / Nincs megadva" szekcióban (P1 fázis:
--     a régió nélküliek NEM esnek ki a listából, csak a „Nincs megadva"
--     bucket-be kerülnek — ez dokumentálja a hiányt, NEM rejt).
--
-- A v2 §4 'participation' mezőt ez a migration NEM VEZETI BE
-- (a P1 kizárólag a visibility-t aktiválja, a participation P2+ scope).
-- A meglévő trips tábla NEM kap participation oszlopot a P1-gyel —
-- a v2 §4 'A jelenlegi funkcionalitás változatlan marad' mondata
-- érvényes.
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
-- ============================================================================

alter table public.trips
  add column if not exists visibility    text not null default 'private'
    check (visibility in ('private', 'public')),
  add column if not exists region        text
    check (char_length(region) <= 80),
  add column if not exists region_source text
    check (region_source in ('manual', 'gpx'));

-- Indoklás (komment a DB-ben):
comment on column public.trips.visibility is
  'Sprint 5 P1: a user opt-in kitevős public flag (Phase 3 /list/{id} analóg). '
  'Setter: TripFormModal-on a user által. Default: private. '
  'A /discover listaoldal ezt olvassa service-role-on át.';

comment on column public.trips.region is
  'Sprint 5 P1: a user által megadott szabad szöveges régió-tag (max 80 char). '
  'NULL = a user még nem állított be régiót. '
  'Setter: TripFormModal (manual) VAGY GPX-import (gpx-derived, NEM P1).';

comment on column public.trips.region_source is
  'Sprint 5 P1: a region mező eredete. manual = user írta be, '
  'gpx = GPX-ből származtatva (P3+ scope, jelenleg NULL-re default). '
  'Setter: trip-create form (manual) VAGY GPX reverse-geocode (gpx, P3+).';

-- Index: a /discover listaoldal a WHERE visibility = 'public' szűrővel
-- dolgozik, region szerint csoportosít. A region index a GROUP BY-t
-- gyorsítja. A visibility index a publikus listát (kis halmaz, ha a
-- user-active trippek zöme private).
create index if not exists trips_visibility_region_idx
  on public.trips (visibility, region)
  where visibility = 'public';
```

### 2.2 A v2 §4-gyel való konzisztencia

A v2 §4 az alábbi kombináció-szabályt rögzíti (DB-constraint szinten):
- `private` túra CSAK `invite_only` lehet.
- `public` túra lehet `invite_only` VAGY `request_to_join`.

**A P1-ben a `participation` mező nem kerül bevezetésre**, ezért a fenti kombináció-szabály nem érvényesíthető DB-constraint-tel (nincs `participation` oszlop). A P1 migration dokumentálja ezt a kommentben: a participation a P2+ scope, a constraint a P2 migration részeként jön.

A P1 query-szinten kikényszeríti a kompatibilitást: a `/discover` service-role projekció kizárólag `visibility = 'public'` sorokat olvas, és a P1-ben minden public trip implicit `participation = 'invite_only'` (a Phase 3 mintára, ahol a public share = „bárki megnézheti, de nem csatlakozhat").

### 2.3 A migration szállítása

A migration-t a parent-agent írja a `supabase/migrations/20260817000000_trips_public_region.sql` fájlba, és a user futtatja a Supabase SQL Editor-ban (a `trello-board-workflow` skill §4 „user-as-migration-runner" mintája). A sub-agent (Architect, ez a fájl) a migration-t NEM írja, NEM futtatja — csak a tervet dokumentálja.

---

## 3. Séma-szintű P1 projekció (a `/discover` listaoldal adatszerkezete)

A `/discover` listaoldal a Phase 3 `/list/[id]` mintájára service-role-on át olvas, és a következő **minimális projekciót** adja vissza:

```ts
// shared/discoverSchemas.ts (új fájl, a tripSchemas mintára)
import { z } from 'zod';

export const discoverTripRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  region: z.string().nullable(),
  region_source: z.enum(['manual', 'gpx']).nullable(),
  // GPX-származtatott táv/szint, amennyiben van — a P1-ben ez
  // opcionális, a P3+ bővíti (a meglévő trips.gpx_metadata-ből olvas).
  distance_km: z.number().nullable(),
  elevation_gain_m: z.number().nullable(),
  // A user NEM kap email-t / UUID-t — a P1 anonimizál.
  // Nincs owner_user_id, nincs user email.
});

export type DiscoverTripRow = z.infer<typeof discoverTripRowSchema>;

export const discoverResponseSchema = z.object({
  // A régió-szerinti csoportosítás a szerver-oldali listát
  // egyszerűsíti (a kliens NEM újra-csoportosít): a szerver
  // ABC-sorrendben adja vissza a régió-blokkokat, és a trippeket
  // ABC-sorrendben a region belül.
  regions: z.array(z.object({
    region: z.string(),  // 'Egyéb / Nincs megadva' a NULL region esetén
    trips: z.array(discoverTripRowSchema),
  })),
});

export type DiscoverResponse = z.infer<typeof discoverResponseSchema>;
```

A projekció **szigorúan minimális** (v2 §0 #4 elv): a Phase 3 `/list/[id].get.ts` mintára a SELECTexplicit oszloplistával dolgozik (`id, name, description, start_date, end_date, region, region_source, gpx_metadata->total_distance_km, gpx_metadata->elevation_gain_m`), NEM `SELECT *`. A ownership-info (created_at, user_id, completed_at, internal-only flag) NEM kerül a projekcióba.

---

## 4. UI-változás (a meglévő komponensek patch-e)

### 4.1 `TripFormModal.vue` — a `visibility` + `region` mezők hozzáadása

A meglévő `TripFormModal.vue` (a `pages/trips/index.vue` és a `pages/trips/[id].vue` által használt) kap két új szabadon választható mezőt:

- **Visibility toggle** (toggle- vagy select-input, két opció: `Privát` / `Publikus`):
  - Default: `private` (a séma default).
  - Helper szöveg: *„Publikus trip megjelenik a „Felfedezés a régióban" listában. A régió-tag opcionális."*
  - A toggle azonnali NEM történik a szerveren — a usernek MENTENIE kell a form-ot (a Phase 3 /list/{id} mintájára, ahol a public-share is explicit „Mentés" gombra frissül).
- **Region text input** (1-soros, max 80 karakter):
  - Default: üres (NULL).
  - Helper szöveg: *„Pl. Bükk, Magas-Tátra, Pireneusok. A régió a listán a csoportosítás alapja."*
  - A region mező a `region_source = 'manual'` értéket állítja be submit-kor.

A `tripCreateSchema` és a `tripUpdateSchema` (a `shared/tripSchemas.ts` fájlban) kiegészül:

```ts
// shared/tripSchemas.ts — P1 patch
export const tripBaseSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  start_date: z.string().date().optional().nullable(),
  end_date: z.string().date().optional().nullable(),
  // P1 kiegészítés:
  visibility: z.enum(['private', 'public']).default('private'),
  region: z.string().max(80).optional().nullable(),
  region_source: z.enum(['manual', 'gpx']).optional().nullable(),
});
```

A `TripFormShape` (form-szintű interface) szintén kiegészül:

```ts
export interface TripFormShape {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  // P1:
  visibility: 'private' | 'public';
  region: string;
}
```

(A `region_source` a form-NEM KELL — submit-kor a komponens automatikusan `'manual'`-t küld, ha a region nem üres, egyébként NULL-t.)

### 4.2 `pages/trips/index.vue` — a `TripCard` badge

A meglévő `TripCard.vue` (a `pages/trips/index.vue`-ban) kap egy apró badge-et, ha a trip `public`:

```vue
<!-- Meglévő TripCard, kiegészítés -->
<span v-if="trip.visibility === 'public'" class="text-xs text-brand-700">
  Publikus · {{ trip.region ?? 'Nincs régió' }}
</span>
```

A badge a Phase 3 /list/{id} mintájára halvány (`text-brand-700`), NEM feltűnő — a P1 a privacy-first alapelvet követi (a publikus státusz látható, de nem tolakodó).

### 4.3 `pages/discover/index.vue` — az új publikus listaoldal

Az új `pages/discover/index.vue` a `/list/[id]` mintájára:

- **Auth NEM kell** — a `redirectOptions.exclude` listához hozzáadódik a `/discover` (a `nuxt.config.ts` 65-78 sorok mintájára).
- **A page service-role-on át hívja a `GET /api/discover` endpointot** (a `server/api/discover/index.get.ts` új fájl).
- **A lista régiónként csoportosítva** jelenik meg, a régiók ABC-sorrendben (a §11 user-döntés alapján).
- **A region belüli trippek ABC-sorrendben** (a `name` oszlop alapján).
- **Nincs popularity / score / rating** — a lista tisztán leíró.
- **A cím és a hero NEM tartalmazza a „népszerű"/"legjobb"/"top" szavakat** — a MemoFox voice-hoz illeszkedő, leíró cím: **„Felfedezés a régióban"** (vagy a §11 user-döntés szerinti alternatíva).
- **404 state**: ha NINCS public trip, a page egy „Még nincs publikus trip a közösségben" friendly state-et mutat, NEM error-t.
- **A region-badge-ek kattinthatók** (a régió-blokkra ugranak, de NEM szűrik az URL-en — a P1-ben az egész lista egy oldalon van, későbbi P3+ URL-szűrő feature).

### 4.4 `server/api/discover/index.get.ts` — az új publikus endpoint

A `server/api/lists/[id].get.ts` mintájára:

- **NEM kell JWT** — a `getServiceRoleClient()`-et hívja (a `server/utils/publicShareClient.ts` fájlból).
- **A SELECT** kizárólag `visibility = 'public'` sorokra szűr, a `select('id, name, description, start_date, end_date, region, region_source, gpx_metadata')` minimális projekcióval.
- **A region-szerinti csoportosítás** a szerver-oldali kódban történik (a régiók ABC-sorrendben, a region-en belüli trippek ABC-sorrendben `name` alapján).
- **A NULL region** egy 'Egyéb / Nincs megadva' blokkba kerül, a lista végén (vagy a §11 user-döntés szerinti helyen).
- **A response** a `discoverResponseSchema` shape-ját követi (a `shared/discoverSchemas.ts` fájlból).
- **Nincs owner_user_id, nincs user email** — a v2 §0 #4 (minimal scope) elv szigorú betartása.

### 4.5 A `composables/useTrips.ts` P1 patch-e

A `useTrips()` composable a meglévő `create` + `update` metódusokkal kompatibilis marad (a `TripInsert` + `TripUpdate` típusok a `tripSchemas.ts` patch-éből automatikusan öröklik a `visibility` + `region` mezőket). A P1-ben NEM kell új composable metódus — a meglévő CRUD-flow a `visibility` + `region` mezőket a `payload`-ban továbbítja a `/api/trips` endpoint felé.

A `types/db.ts` `TripInsert` és `TripUpdate` interfész kiegészül:

```ts
// types/db.ts — P1 patch
export interface TripInsert {
  name: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  // P1:
  visibility?: 'private' | 'public';
  region?: string | null;
  region_source?: 'manual' | 'gpx' | null;
}

export interface TripUpdate {
  // ... meglévő mezők ...
  visibility?: 'private' | 'public';
  region?: string | null;
  region_source?: 'manual' | 'gpx' | null;
}

export interface TripRow {
  // ... meglévő mezők ...
  visibility: 'private' | 'public';
  region: string | null;
  region_source: 'manual' | 'gpx' | null;
}
```

---

## 5. Acceptance criteria (QA-hook, 7 mérhető feltétel)

A P1 kártyán a QA a következő 7 mérhető feltételt ellenőrzi (a 3-as szintű user-döntések UTÁN):

1. **A `trips.visibility` mező funkcióba hozva**: a user a `TripFormModal`-on be tudja állítani a `private`/`public` értéket, és a submit után a `trips.visibility` oszlop a beállított értéket tartalmazza (PostgREST SELECT-tel verifikálható).
2. **A `public` trip megjelenik a `/discover` listaoldalon**: a `GET /api/discover` response tartalmazza a trip id-ját a megfelelő region-blokkban.
3. **A `private` trip NEM jelenik meg a `/discover` listaoldalon**: a `GET /api/discover` response NEM tartalmazza a private trip id-ját (PostgREST SELECT-tel verifikálható, hogy a `visibility = 'private'` rekordok kiszűrődnek).
4. **A listaoldal régiónként csoportosítja a trippeket**: a `GET /api/discover` response `regions[]` tömbje a beállított régiók szerint tartalmazza a trippeket (legalább 2 public trip 2 különböző régióval → 2 region-blokk).
5. **A publikus lista-projekció csak minimális adatot mutat**: a `GET /api/discover` response NEM tartalmaz `user_id`, `email`, `owner_user_id`, `created_at`, `completed_at` mezőket (PostgREST SELECT-tel verifikálható, hogy a response shape nem tartalmaz ilyen kulcsokat).
6. **Nincs popularity/score/rating a P1-ben**: a `pages/discover/index.vue` template NEM tartalmaz `score`, `popularity`, `rating`, `top`, `legjobb`, `népszerű` szavakat (grep a template-ben), ÉS a `GET /api/discover` response NEM tartalmaz `score`, `rating`, `popularity` kulcsokat.
7. **A listaoldal címében a „Felfedezés a régióban" / „Mások túrái" / „A te környékeden" jellegű nevek használata, NEM „népszerű"/"legjobb"**: a `pages/discover/index.vue` `useSeoMeta({ title: ... })` és a `h1` megfelel a leíró voice-nak (a §11 user-döntés szerinti opció).

A 7 feltétel mind a `npm run build` + `vue-tsc` self-test gate-eken felül értendő (a parent-agent a QA round-ban futtatja).

---

## 6. A `[deploy]` commit scope (QA Approved UTÁN)

Az új 2026-08-15-ös szabály alapján (a Sprint 5 P1-re L1-esként minősítve, ld. §0.4):

- **L1 automata deploy**: a QA Approved + ≥ 60 másodperces futásidő UTÁN a parent-agent készíti a `[deploy]` commitot, **NEM kell user-jóváhagyás**.
- **A commit message**: `[deploy] feat: Sprint 5 P1 — Community Routes ("Felfedezés a régióban")`. A P1 egyetlen commit (`57bf8fb` + `e9084f0` mintára), ami a `feat(loop-v1):` mintát követi.
- **A commit scope**:
  - `supabase/migrations/20260817000000_trips_public_region.sql` — új migration (egyetlen).
  - `shared/tripSchemas.ts` — a `tripBaseSchema` + `TripFormShape` kiegészítése.
  - `shared/discoverSchemas.ts` — új fájl (a `discoverTripRowSchema` + `discoverResponseSchema`).
  - `types/db.ts` — a `TripInsert` + `TripUpdate` + `TripRow` kiegészítése.
  - `components/TripFormModal.vue` — a `visibility` + `region` mezők hozzáadása.
  - `components/TripCard.vue` — a `public` + `region` badge-ek.
  - `pages/discover/index.vue` — új publikus listaoldal.
  - `pages/trips/index.vue` — a `TripCard` badge propagálás.
  - `server/api/discover/index.get.ts` — új publikus endpoint.
  - `nuxt.config.ts` — a `redirectOptions.exclude` listához a `/discover` hozzáadása.
  - **NEM nyúlnak**: a `pages/trips/[id].vue`, a `composables/useTrips.ts`, a `server/api/trips/*`, a `shared/debriefSchemas.ts`, a `pages/wishlist/*`, a `pages/friends/*`, a `pages/gear/*`, a `pages/stats/*`, a meglévő `/list/[id]` (Phase 3).

- **L2 deploy mehet, de UTÓLAGOS jelentéssel**: HA a §11 user-döntés a GPX-derived régió opciót választja (3rd-party OSM Nominatim API), a parent-agent a QA Approved UTÁN készíti a `[deploy]` commitot, UTÁNA jelzi a user-nek a 3rd-party API bekötésének tényét.
- **L3 VÁR a userre a deploy előtt**: NEM alkalmazható a P1-re (a P1 L1, kivéve a GPX-derived régió → L2).

---

## 7. Decisions log (a P1 spec elfogadott döntései)

| # | Döntés | Indoklás | Szint |
|---|---|---|---|
| 1 | A P1 **kizárólag a `visibility` mezőt** aktiválja, a `participation` NEM. | v2 §4 scope-pivot: a P1 a user-opt-in public-flag fázis, a participation P2+ scope. | 2 |
| 2 | A `region` mező **manuális user input** (szabad szöveg, max 80 char). | A spec §11 user-döntés — MANUAL a default; a GPX-derived opció §11 alternatíva. | 2 |
| 3 | A `region_source` mező `'manual'` / `'gpx'` / NULL. | A region eredetének átláthatósága (jelenleg csak `'manual'` és NULL aktív, a `'gpx'` P3+ előkészítés). | 2 |
| 4 | A listaoldal **régiónként csoportosít**, a régiók ABC-sorrendben, a region belüli trippek ABC-sorrendben `name` alapján. | v2 §0 #3 elv (leíró, NEM popularity-alapú); a §11 user-döntés. | 2 |
| 5 | A listaoldal **címe „Felfedezés a régióban"** (vagy §11 user-döntés szerinti alternatíva). | A user explicit nyelvi irányelve (NE „népszerű"/"legjobb"). | 2 |
| 6 | A publikus projekció **kizárólag a `trips` táblából olvas**, service-role-on át, a `visibility = 'public'` factory-szűrővel. | Phase 3 `/list/[id]` minta; NEM public default; a meglévő trips RLS NEM érintett. | 2 |
| 7 | **NEM publikus adat-expozíció** (user-opt-in), **NEM fizetős tier**, **NEM security/RLS-változás**. | 3-as szintű szabály: P1 = 2-es szintű. | 2 |
| 8 | A migration **egyetlen fájl**: `trips.visibility` + `trips.region` + `trips.region_source`. | v2 §0 #4 elv (séma-szintű jövő-biztosítás olcsó); a `participation` PALETTÁRA NEM KERÜL. | 2 |
| 9 | A publikus listaoldal **NEM igényel auth-t**, a `redirectOptions.exclude`-ban a `/discover` hozzáadódik. | Phase 3 `/list/{id}` minta; a publikus lista bárki számára elérhető. | 2 |
| 10 | A listaoldal **NINCS popularity/score/rating** — a rating/értékelés P3+ scope. | v2 §0 #3 elv (niche-igény validáció nélkül, amíg nincs elég adat). | 2 |

---

## 8. Open questions (a 3-as szintű user-döntések)

A **2 db 3-as szintű user-döntés** a P1-gyel kapcsolatban (a parent-agent a user felé továbbítja a QA round előtt):

### 8.1 Régió-tag módszere (manual vs. GPX-derived)

| Szempont | **MANUAL** (user írja be a régiót) | **GPX-derived** (GPX-ből reverse-geocode) |
|---|---|---|
| **Adatminőség** | A user dönti el, hogy mit ért régió alatt (Bükk, Magas-Tátra, Pireneusok) — NEM standardizált | Standardizált (OSM Nominatim API), de a user által feltöltött GPX-től függ |
| **Privacy** | Nincs 3rd-party adat-megosztás — a régió a user saját szava | 3rd-party API (OSM Nominatim) hívás a koordinátákkal → **adat-megosztás** az OSM-mel |
| **Implementáció** | Egyszerű: text input + `region_source = 'manual'` | Komplex: GPX parsolás + Nominatim API + rate-limit kezelés (max 1 req/sec) |
| **UX** | A user explicit megadja a régiót (extra mező a TripFormModal-on) | A user a GPX feltöltés után automatikusan megkapja a régiót (NEM extra mező) |
| **P1 fázis** | MOST megépíthető | P3+ scope-os (GPX integráció a P1-ben NEM készül el) |
| **GDPR** | Nincs 3rd-party | Az OSM Nominatim EU-s, de a user koordinátái kikerülnek a Supabase-ből |

**A spec default MANUAL** (a P1 fázisban megépíthető, NEM igényel 3rd-party API-t, privacy-first). A GPX-derived a P3+ scope-ban jöhet, amikor a GPX-import feature a listaoldal számára is elérhetővé válik.

### 8.2 Régió-csoportosítás (ABC vs. régiónkénti ABC)

| Szempont | **ABC-sorrend** (egyetlen lista, minden trip ABC-sorrendben) | **Régiónkénti ABC** (régió-blokkok, régión belül ABC) |
|---|---|---|
| **UX** | Egyszerű, „mindjárt látom az egészet" — DE hosszú listánál áttekinthetetlen | Jobban csoportosít, „a te környékeden" érzés — DE a régió-blokkok sorrendje önkényes |
| **Régió nélküli trippek** | Egybefolynak a teljes listával | Külön „Egyéb / Nincs megadva" blokkba kerülnek |
| **Keresés** | NEM (P1) / P3+ URL-szűrő | A régió-blokkok ugranak egymáshoz (anchor link) |
| **Privacy** | Nincs preferencia | Nincs preferencia |
| **MemoFox voice** | „Felfedezés a régióban" jobban passzol a régiónkénti csoportosításhoz | A user üzenetében explicit említi a „régió szerint csoportosítva" |

**A spec default RÉGIÓNKÉNTI ABC** (a user üzenete explicit kimondja, a MemoFox voice-hoz illeszkedik, a régió nélküli trippek a lista végén „Egyéb" blokkba kerülnek). Az ABC-sorrend a §11 user-döntés alternatívája.

### 8.3 A privacy-default (megerősítés, NEM scope-pivot)

- **Default: `private`** (a séma default, a user explicit opt-in szükséges a `public` státuszhoz).
- **NINCS scope-pivot** — ez a v2 §4 szerinti default, a P1 megerősíti.

### 8.4 A parent-agent teendője a 3-as szintű döntések UTÁN

A §11 user-döntés(ek) beérkezése UTÁN a parent-agent:
1. Frissíti a `docs/sprint-5-p1-community-routes.md` §11 szekcióját a user döntésével.
2. A Full-stack dispatch a §11 alapján indul (a §2-§4 spec-részletek a döntés szerinti szűkítést alkalmazzák).
3. A QA round a §5 acceptance criteria-t ellenőrzi (a §11-nek megfelelően).

---

## 9. A P1 rollback-út (ha a deployment problémás)

A P1 egyetlen migration-ön alapul, és a UI-patch-ek a `nuxt.config.ts`-ben egy `redirectOptions.exclude`-ban bővülnek. A rollback-út:

1. **Migration rollback** (`supabase/migrations/20260817000000_trips_public_region.sql`):
   - A migration `add column if not exists` kifejezést használ, ami forward-only.
   - A rollback a `drop column visibility, region, region_source` SQL-lel tehető meg (a user-oldali Supabase SQL Editor-ban).
   - A migration kommentje dokumentálja a rollback SQL-t: `ALTER TABLE public.trips DROP COLUMN visibility, DROP COLUMN region, DROP COLUMN region_source;`
2. **UI rollback**:
   - A `TripFormModal.vue` régi input-mezőit a `pages/trips/index.vue` / `[id].vue` meghívásánál a `visibility` + `region` mezők elhagyásával visszaállítható.
   - A `pages/discover/index.vue` törlése + a `server/api/discover/index.get.ts` törlése + a `nuxt.config.ts` `redirectOptions.exclude`-ból a `/discover` törlése.
   - A `composables/useTrips.ts` NEM igényel rollback-et (a meglévő CRUD-flow a `visibility` + `region` mezőket opcionálisan kezeli, NEM kötelezően).
3. **A rollbackot a parent-agent csinálja** (a user-jóváhagyás UTÁN), a Vercel deploy rollback pedig a korábbi `[deploy]` commitra való visszaállítással történik (a `[deploy]` tag convention miatt a rollback-commit is `[deploy]` tag-ű).

A rollback-út nem automatikus — a P1 bármilyen problémája a parent-agent + user közös döntése a rollbackről (a 3-as szintű szabály: rollback = scope-pivot).

---

## 10. A P1 NEM nyúlik hozzá (a P2+ scope-pivot előkészítése)

A P1 kizárólag a `visibility` flaget aktiválja. Az alábbiak a P2+ scope-pivotok (a P1 NEM építi, csak előkészíti a sémát):

- **`trips.participation` mező** (a v2 §4-ben bent van, a P1-ben NEM): a P2 migration bevezeti, a P2 UI beépíti a `request_to_join` flow-t.
- **A `public` trip-ek invite-e** (a Phase 3 mintára): a P1-ben a public trip „bárki megnézheti", DE „nem csatlakozhat" (a jelenlegi owner-only modell marad). A P2 bevezeti a `participation = 'request_to_join'`, amivel a public trip „bárki csatlakozhat" (a user request_to_join submit-tal).
- **A region-blokkok ugrása** (P3+ URL-szűrő: `/discover?region=Bükk`).
- **A GPX-derived régió** (P3+ GPX reverse-geocode feature).
- **A rating/értékelés** (P3+ scope).
- **A résztvevőkezelés, comment, share** (P2+ scope).
- **Az OSM/Wikiloc integráció** (P3+ scope).

A P1 ezen feature-ök NÉLKÜL is működőképes, user-értéket ad (a „Felfedezés a régióban" listaoldal a privacy-first alapelvet követi, NEM törekszik a „social" élményre).

---

## 11. 3-as szintű user-döntések (a parent-agent a user felé továbbítja)

A P1 2 db 3-as szintű user-döntést igényel (a parent-agent a Full-stack dispatch előtt kérdezi a user-t):

### 11.1 Régió-tag módszere

**Kérdés**: a `trips.region` mező MANUAL user input legyen (P1), vagy GPX-derived (P3+)?

- **MANUAL** (a P1 fázisban megépül): a user a TripFormModal-on beírja a régiót (pl. „Bükk").
- **GPX-derived** (a P1 fázisban NEM épül meg, P3+ scope): a GPX-import során az OSM Nominatim API reverse-geocode-olja a koordinátákat.

**A user döntése**: ______________________________ (MANUAL / GPX-derived)

### 11.2 Régió-csoportosítás módja

**Kérdés**: a `/discover` listaoldal ABC-sorrendben (egyetlen lista) vagy régiónkénti ABC (régió-blokkok) legyen?

- **ABC-sorrend**: a teljes lista ABC-sorrendben, minden trip egyszer.
- **Régiónkénti ABC**: a lista régió-blokkokra van osztva, a régiók ABC-sorrendben, a régión belüli trippek ABC-sorrendben.

**A user döntése**: ______________________________ (ABC-sorrend / Régiónkénti ABC)

### 11.3 A listaoldal címe (opcionális, NEM scope-pivot)

**Kérdés**: a `/discover` listaoldal címe „Felfedezés a régióban" (a spec default), vagy „Mások túrái" / „A te környékeden" legyen?

- **„Felfedezés a régióban"** (a spec default): a user üzenetében explicit említi.
- **„Mások túrái"**: alternatíva, a community-voice-hoz illeszkedik.
- **„A te környékeden"**: lokális voice, a region-blokkok hangsúlyozásával.

**A user döntése**: ______________________________ (Felfedezés a régióban / Mások túrái / A te környékeden)

---

## 12. A P1 szállítása (a parent-agent teendője)

A parent-agent a P1 szállításához a következő lépéseket futtatja (a 3-as szintű user-döntések UTÁN):

1. **A user-döntés beérkezése** UTÁN a parent-agent kiegészíti a spec §11 szekcióját a döntéssel.
2. **A migration fájl** megírása: `supabase/migrations/20260817000000_trips_public_region.sql` (a §2.1 alapján).
3. **A migration user-oldali futtatása** (a Supabase SQL Editor-ban).
4. **A Full-stack dispatch** (a §4 UI-változás + §3 séma-projekció alapján).
5. **A QA round** (a §5 acceptance criteria 7 feltételellenőrzésével).
6. **A QA Approved** UTÁN a parent-agent készíti a `[deploy]` commitot (L1 automata deploy, a §6 commit scope alapján).
7. **A `docs/sprint-5-p1-community-routes.md` frissítése** a deploy-commit SHA-val.

A P1 NEM épít, NEM auditál, NEM deployol a user-döntés(ek) előtt.

---

## 13. Összefoglaló — a P1 scope tömören

A P1 egyetlen fázis, egyetlen user-élmény: **„Felfedezés a régióban" publikus listaoldal**, a user-által explicit `public`-ra kapcsolt trippekből, régiónként csoportosítva, ABC-sorrendben, leíró voice-nál, NEM popularity-alapú. A séma 3 új oszloppal bővül (`visibility`, `region`, `region_source`), a `participation` PALETTÁRA NEM KERÜL. A migration-t a user futtatja. A UI-patch-ek a `TripFormModal` + `TripCard` + új `pages/discover/index.vue` + új `server/api/discover/index.get.ts` + `nuxt.config.ts` `redirectOptions.exclude` módosítások. A P1 L1 automata deploy (QA Approved UTÁN, NEM kell user-jóváhagyás), kivéve a GPX-derived régió esetét (L2 utólagos jelentéssel).

A P1 a Sprint 5 P0 utányi első lépés a „közösségi" feature-ök felé, de **privacy-first** alapelvekkel: a közösségi felfedezés a user-által opt-in módon kerül a listába, a publikus projekció minimális, és a „legjobb"/"népszerű" minősítés a P3+ scope-ban jön, amikor már van elég adat az értelmes pontozáshoz.

---

## 14. Trello-paste blokk (a parent-agent által postolandó)

A P1 kártyára (`6a8171f0680d02f9e3e404cf`) postolandó komment:

```
Sprint 5 P1 — Community Routes ("Felfedezés a régióban") — Architect spec
(részlet a docs/sprint-5-p1-community-routes.md fájlból)

Cél: a v2 §4 'visibility' mező funkcióba hozatala. A user a TripFormModal-on
átkapcsolhatja a trip-jét 'private' (default) → 'public' státuszra. A public
trip megjelenik a /discover listaoldalon, régiónként csoportosítva, ABC-sorrendben.
A lista leíró (NEM popularity-alapú), a privacy-first alapelvet követi.

Döntések (Architect hatáskör, 3-szintű szabály 2-es szint):
1. A P1 kizárólag a 'visibility' mezőt aktiválja, a 'participation' NEM
   (a P2+ scope-pivot előkészítése a v2 §4-ben rögzített).
2. A 'region' mező MANUAL user input (P1-ben), a GPX-derived a P3+ scope.
3. A 'region_source' mező 'manual' / 'gpx' / NULL előkészítés.
4. A listaoldal régiónkénti ABC-sorrendben (régió-blokkok, régión belül ABC).
5. A listaoldal címe "Felfedezés a régióban" (NEM "népszerű"/"legjobb").
6. A publikus projekció service-role-on át, a trips SELECT minimális scope-pal.
7. NEM publikus adat-expozíció (user-opt-in), NEM fizetős tier, NEM security/RLS-változás.
8. A listázott oldalhoz NEM kell auth (a /discover a redirectOptions.exclude-ban).
9. NEM popularity/score/rating a P1-ben (P3+ scope, amíg nincs elég adat).
10. A migration egyetlen fájl: trips.visibility, trips.region, trips.region_source.

3-as szintű user-döntések (a parent-agent a user felé továbbítja a dispatch előtt):
- §11.1 Régió-tag módszere: MANUAL (P1) VAGY GPX-derived (P3+)?
- §11.2 Régió-csoportosítás: ABC-sorrend VAGY régiónkénti ABC?
- §11.3 Listaoldal címe: "Felfedezés a régióban" VAGY "Mások túrái" VAGY "A te környékeden"?
(A privacy-default 'private' megerősítés, NEM scope-pivot.)

Módosítás:
- ÚJ migration: supabase/migrations/20260817000000_trips_public_region.sql
  (3 új oszlop: visibility, region, region_source — a participation PALETTÁRA NEM KERÜL)
- MÓDOSÍTÁS: shared/tripSchemas.ts (a tripBaseSchema + TripFormShape kiegészítése)
- ÚJ: shared/discoverSchemas.ts (a discoverTripRowSchema + discoverResponseSchema)
- MÓDOSÍTÁS: types/db.ts (TripInsert + TripUpdate + TripRow kiegészítése)
- MÓDOSÍTÁS: components/TripFormModal.vue (a visibility + region mezők hozzáadása)
- MÓDOSÍTÁS: components/TripCard.vue (a public + region badge-ek a TripCard-on)
- ÚJ: pages/discover/index.vue (a publikus listaoldal, régiónkénti ABC)
- ÚJ: server/api/discover/index.get.ts (a publikus endpoint, service-role-on át)
- MÓDOSÍTÁS: nuxt.config.ts (a /discover hozzáadása a redirectOptions.exclude-hoz)
- A meglévő /list/[id] (Phase 3) NEM ÉRINTETT.
- A meglévő trips RLS NEM ÉRINTETT (owner-scoped marad, a /discover service-role factory-szűrővel).

Acceptance criteria (7 mérhető, QA-hook):
1. A trips.visibility mező funkcióba hozva (a user a TripFormModal-on be tudja állítani)
2. A public trip megjelenik a /discover listaoldalon
3. A private trip NEM jelenik meg a /discover listaoldalon (service-role factory-szűrő)
4. A listaoldal régiónként csoportosítja a trippeket (2 public trip 2 régióval → 2 blokk)
5. A publikus projekció csak minimális adatot mutat (nincs user_id, email, owner_user_id)
6. Nincs popularity/score/rating a P1-ben (a template + response kulcsszó-negatív)
7. A "Felfedezés a régióban" / "Mások túrái" nevek, NEM "népszerű"/"legjobb"

[deploy] commit scope (QA Approved UTÁN, L1 automata, NEM kell user-jóváhagyás):
- L1 AUTOMATA deploy a migration + UI-patch-ek egyetlen commitját jelenti.
- A commit message: [deploy] feat: Sprint 5 P1 — Community Routes ("Felfedezés a régióban")
- A deployment scope: a §6 commit-listája (migration + ~9 UI/API/fájl).
- HA a §11.1 user-döntés GPX-derived: L2 deploy mehet, UTÓLAGOS jelentéssel a 3rd-party API-ról.
- A deployment a Vercel [deploy] tag convention alapján: a parent-agent commitja a QA Approved UTÁN.

Specifikáció teljes terjedelme: docs/sprint-5-p1-community-routes.md §1-§13
next: parent-agent → user-döntés a §11-ről → Full-stack dispatch → QA round → [deploy] L1 automata.
```
