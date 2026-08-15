# Sprint 4 — Phase 5: My Comfort (#21) + Debrief (#23) Architect Spec

**Author:** Architect (role:architect)
**Date:** 2026-08-15
**Source of truth:** `docs/product-architecture-v2.md` §"Javasolt Sprint 4 fókusz" #21 + #23 + §0 döntési elvek
**Phase context:** Sprint 4 5. fázis. Phase 1 (categories-globalize @ `1802b98`), Phase 2 (onboarding @ `44ed0d5`), Phase 3 (public gear-lista @ `c5438da`), Phase 4 (vizuális súly-bontás — spec at `docs/sprint-4-phase-4-visual-weight-breakdown.md`, deploy pending) mind a `master`-en.
**Worktree:** `ultralight-gear-tracker` branch `master` (a `design-pass` a kanonikus design forrás, most a `main` SHA-nál `c5438da`).
**Trello kártya:** a Phase 5 Trello kártya a parent-agent hatásköre (3-as szintű side-effect: új `Backlog` sor + broadcast). A specifikáció ezen a fájlon érhető el, és a Trello-paste-blokk a §13 végén készen áll, hogy a parent postolja.
**Implementáció tiltva:** ez a fájl csak TERV. A `feat(comfort-debrief):` branch és a `[deploy]` commit a parent-agent QA workflow-ja után jöhet (mint a Phase 4-nél).

---

## 0. Scope-pivot emlékeztető (3-szintű szabály: Phase 5 = 2-es szintű)

A Phase 5 egy **2-es szintű hatáskör**:

- **Dokumentált** (ez a fájl) + **jóváhagyott sorrend** (a v2 §"Javasolt Sprint 4 fókusz" sorrend: 1 → 4 → 2 → 19,20 → **21,23** → 24 → 22, azaz Phase 5 a 6. lépés — a #21 + #23 kifejezetten párhuzamos, mert a comfort user-bevitel és nem függ a debrieftől).
- **Nincs új scope / config / credential**: a meglévő `gear_items`, `trips`, `trip_recaps` táblák használhatók; a meglévő `useGear()` / `useTrips()` composable-ok, a `GearFormModal` és a `pages/trips/[id].vue` P3 recap section bővíthető.
- **NEM public adat-expozíció**: a comfort-rating kizárólag a bejelentkezett user SAJÁT gear-itemén jelenik meg; a publikus `/list/{id}` nézet NEM kap comfort-mezőt. A debrief kizárólag a trip owner számára szerkeszthető, és a `trip_recaps` RLS-ével kompatibilis (owner OR public OR `trip_visible_to`).

**[deploy] commit szabály** (parent-agent workflow): a `feat(comfort-debrief):` commit a parent-agent által végzett QA **UTÁN** jöhet. A QA a Phase 4 mintára: per-page renderelt comfort-star UI + debrief-textarea UI ellenőrzés, RLS-alatti user adattal töltve.

**Explicit out-of-scope (a v2 §0 #3 elv — niche-igény validáció nélkül):**

- Nincs ML-alapú comfort-ajánlás.
- Nincs automatikus trip-end (`trips.status = closed` triggelés).
- Nincs push-notification a debrief emlékeztetőre.
- Nincs aggregáció / statistics a comfort-ból (a Phase 6 #24-be tartozik).
- Nincs "what to pack next time" típusú ajánlás (a Phase 7 #22-be tartozik).

---

## 1. Cél és a v2 §0 elvek leképezése

| v2 §0 elv | Phase 5 megvalósulása |
|---|---|
| **#1 Valós felhasználói adat > feltételezés** | Mind a comfort, mind a debrief **user-bevitel**, nem ML-generált. A user kézzel tölti a 3 dimenziót (sleep/cold/weight 1-5) és a 3 szöveges választ (felesleges/hiányzott/kényelmetlen). Nincs default-érték, nincs kitalált tartalom. |
| **#2 Minimalizáld az onboarding-súrlódást** | A comfort **a meglévő `GearFormModal`-ban** jelenik meg (create + edit módban egyaránt), nem új oldal / új modal. A debrief **a meglévő `pages/trips/[id].vue` recap section-jében** (P3) jelenik meg, nem új flow / új route. |
| **#3 Ne épülj be niche-igényre** | A comfort 3 dimenziója (`sleep` / `cold` / `weight`) a v2 példájából jön ("alvás: 5/5, hidegben: 4/5, súly: 3/5"), és a Phase 6 #24 Trip-stats-hoz adatgyűjtő primitív. A debrief 3 kérdése a v2 szövegéből jön ("felesleges / hiányzott / kényelmetlen"). Nincs forecast, nincs predikció. |
| **#4 Séma-szintű jövő-biztosítás olcsó, UI/logika-szintű nem** | **KÉT új séma-elem, mindkettő olcsó:** (a) `gear_items.comfort JSONB` — 3 integer mezőt vagy egy JSONB objektumot tárol (lásd §3 döntés); (b) `trip_debriefs` új tábla — `trip_id uuid unique references trips(id) on delete cascade` + 3 `text[]` mező. Mindkettő forward-only, forward-compatible. |
| **#5 Trip ≠ My Gear** | A comfort **My Gear-szintű** (item-en, a `gear_items.comfort` mezőben). A debrief **Trip-szintű** (a `trip_debriefs` tábla a `trips` alatt). A kettő keveredése tilos: a comfort mező NEM a `trip_gear`-en, a debrief NEM a `gear_items`-en. |

**További, implicit elv:** a Phase 5 **REUSE-el**, nem duplikál. A `GearFormModal` submit-pipeline-ját használja (ugyanaz a `gearCreateSchema` / `gearUpdateSchema`, kiegészítve egy `comfort` mezővel). A `useTrips().loadOne(tripId)` hívás során a debrief is betöltődik (a meglévő recap endpoint mintájára).

---

## 2. A #21 comfort: 3 dimenzió, séma és UI

### 2.1 A séma döntés: **JSONB a 3 integer column helyett**

A v2 §0 #4 elv kimondja, hogy a séma-szintű jövő-biztosítás olcsó. A `gear_items.comfort` lehetne:

| Alternatíva | Előny | Hátrány |
|---|---|---|
| **3 integer column** (`comfort_sleep`, `comfort_cold`, `comfort_weight` integer 1..5) | Erősen típusos, egyszerű aggregáció SQL-ben (pl. `AVG(comfort_sleep)`) | Migrationenként 1 új dimenzió = 1 új migration; rigid; a dimenziók száma a séma-részévé válik |
| **JSONB** (`comfort: { sleep: 5, cold: 4, weight: 3 } \| null`) | **Rugalmas** — új dimenzió = app-oldali változás, séma-módosítás nélkül; későbbi mező (pl. `comfort_noise`) is hozzáadható migration nélkül | SQL-szintű aggregáció kevésbé triviális (jsonb expression kell); TypeScript-szinten viszont a zod schema + interface kézben tartja |

**Döntés: JSONB.** A 3 dimenzió a v2 példájából jön, de a Phase 5 NEM zárja le, hogy a user / Designer később 4. dimenziót kérjen (pl. "weatherproof", "packability"). A JSONB ezt olcsón engedi. A TypeScript-oldali szigorúságot a `gearCreateSchema` + `GearItemRow` interface biztosítja (lásd §3.3).

### 2.2 A séma: `gear_items.comfort JSONB NULL`

```sql
-- 20260816000000_gear_comfort_rating.sql
alter table public.gear_items
  add column comfort jsonb
    check (
      comfort is null
      or (
        jsonb_typeof(comfort) = 'object'
        and (
          (comfort ? 'sleep'   and jsonb_typeof(comfort->'sleep')   = 'number')
          or not (comfort ? 'sleep')
        )
        and (
          (comfort ? 'cold'    and jsonb_typeof(comfort->'cold')    = 'number')
          or not (comfort ? 'cold')
        )
        and (
          (comfort ? 'weight'  and jsonb_typeof(comfort->'weight')  = 'number')
          or not (comfort ? 'weight')
        )
        and jsonb_object_keys_check(comfort) <@ array['sleep','cold','weight']
      )
    );
```

A CHECK constraint a legszigorúbb, ami migráció nélkül megadható: az objektum kulcsai csak `sleep` / `cold` / `weight` lehetnek (a `jsonb_object_keys_check` a `jsonb_object_keys(comfort) <@ array['sleep','cold','weight']` mintával helyettesíthető, ha a helper nem érhető el — lásd §3.2). Az érték-tartomány ellenőrzése (1..5) a zod schema-ban van, mert a CHECK-ben a `value BETWEEN 1 AND 5` jsonb expression-nel bonyolultabb lenne.

### 2.3 A UI: **3 star-rating sor** (MemoFox "warm/playful" voice)

A v2 §0 #2 elv kimondja, hogy a comfort a meglévő gear-edit formban jelenik meg. A `GearFormModal` jelenleg 4 mezőt tartalmaz (name / category / weight / price) + 1 checkbox (excluded_from_base). A Phase 5 a modal **aljára** szúr be egy új section-t, **"Mennyire kényelmes?"** címmel:

```
┌────────────────────────────────────────────────────────────┐
│  Mennyire kényelmes?                                       │
│  (opcionális — töltsd ki, ha van saját tapasztalatod)       │
│                                                            │
│  Alvás          ☆ ☆ ☆ ☆ ☆                                  │
│                 (5/5 — semmi nyomás, meleg)                │
│                                                            │
│  Hidegben       ☆ ☆ ☆ ☆ ☆                                  │
│                 (4/5 — derékig melegít, láb hideg)        │
│                                                            │
│  Súlya          ☆ ☆ ☆ ☆ ☆                                  │
│                 (3/5 — észrevehető a vállamon)             │
│                                                            │
│  ──────────────────────────────────────────────────        │
│  [Cancel]                                  [Save changes]  │
└────────────────────────────────────────────────────────────┘
```

A 3 dimenzió:

- **Alvás** — az item mennyire kényelmes alvás közben (hálózsák, matrac, párna kategória, de nem korlátozva).
- **Hidegben** — mennyire tart melegen hideg időben (aláöltözet, sapka, kesztyű kategória, de nem korlátozva).
- **Súlya** — a komfort-súly arány, mennyire érezhető a vállon / háton (mindegyik itemre alkalmazható).

A 3 dimenzió fix a Phase 5-ben; a Phase 6 #24 Trip-stats-hoz készülnek az aggregációk (pl. "alacsony alvás-komfort → ajánlott matrac upgrade"). A 4. dimenzió hozzáadása a Phase 5 NEM terjeszkedik — ha a Designer kéri, későbbi fázis, a JSONB miatt séma-módosítás nélkül.

A star UI: 5 darab `<button type="button">` sorban, hover és aktív állapotban kitöltve (MemoFox `brand-500` színnel), a fókusz-kezelés a meglévő focus-trap-pel konzisztens. A billentyűzet-navigáció: `Tab` a sorok között, `←/→` a csillagok között (a `GearFormModal` meglévő `onKeydown` eseménykezelőjéhez hozzáadott 1-2 sor).

### 2.4 A tooltip a `GearCard.vue`-ban (deployment URL)

A v2 acceptance criteria kimondja: *"a komfort-rating a deployment URL-en megjelenik a gear-item tooltip-jében"*. A meglévő `GearCard.vue` jelenleg minimális (name + category badge + weight + price + excluded dot). A Phase 5 a kártya jobb szélén megjelenít egy **comfort-summary badge**-et:

- Ha mind a 3 dimenzió kitöltött: egy kis "😊 4.3" badge (az átlag 1 tizedesre kerekítve), MemoFox `brand-500` háttér.
- Ha 1-2 dimenzió kitöltött: "😊 4.0 (2/3)" badge, MemoFox `brand-200` háttér (halványabb).
- Ha 0 dimenzió kitöltött: nincs badge.

A badge `title="Alvás 5/5 · Hidegben 4/5 · Súlya 3/5"` attribútummal natív tooltip-et ad (mouseover-re a böngésző mutatja). A v2 elfogadási kritérium szövege a tooltip-re szól — natív `title` attribútum kielégíti. A 3-as szintű túlteljesítés (popper.js / saját tooltip komponens) NEM történik.

A publikus `/list/{id}` route-on (Phase 3) a comfort badge **NEM jelenik meg** — a publikus gear-lista a `{ id, name, category_name, weight_g }` mezőkre szorítkozik (lásd `PublicListResponse` interface, `types/db.ts:469`), és a comfort mező a `public_list_lookup` SECURITY DEFINER helper által visszaadott sorokban nincs benne. Ez a 3-as szintű public adat-expozíció elkerülése (v2 §0 #5 elv).

---

## 3. Schema + endpoint változások — #21 comfort

### 3.1 Az új migration

`supabase/migrations/20260816000000_gear_comfort_rating.sql`:

```sql
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
```

### 3.2 A meglévő fájlok módosítása

| Fájl | Módosítás |
|---|---|
| `shared/gearSchemas.ts` | `gearCreateSchema` + `gearUpdateSchema` kiegészítése `comfort: z.object({ sleep: z.number().int().min(1).max(5).optional(), cold: z.number().int().min(1).max(5).optional(), weight: z.number().int().min(1).max(5).optional() }).strict().nullable().optional()` mezővel. A `.strict()` megakadályozza, hogy a user ismeretlen kulcsot küldjön (illeszkedik a CHECK constraint-hoz). |
| `types/db.ts` | `GearItemRow` + `GearItemInsert` + `GearItemUpdate` interface bővítése `comfort: GearComfort \| null` mezővel. Az új `GearComfort` interface: `{ sleep?: number; cold?: number; weight?: number }` (1..5 integer, mindegyik opcionális). |
| `server/api/gear/index.post.ts` | NEM változik — a `gearCreateSchema` extendálásával automatikusan kezeli a `comfort` mezőt. |
| `server/api/gear/[id].patch.ts` | NEM változik — a `gearUpdateSchema` extendálásával automatikusan kezeli a `comfort` mezőt. |
| `components/GearFormModal.vue` | A template aljára egy új section: 3 star-rating sor (Alvás / Hidegben / Súlya), mindegyik MemoFox `brand-500` színnel, hover + aktív állapotban. A `form` reactive objektumhoz hozzáadódik a `comfort: GearComfort | null`. A `resetForm()` és `buildPayload()` frissül. |
| `components/GearCard.vue` | A comfort-summary badge megjelenítése (lásd §2.4): a `props.item.comfort` prop alapján, a 3 állapotot (mind / részleges / üres) megkülönböztetve. |

### 3.3 A `GearComfort` TypeScript-típus

```ts
// types/db.ts — új típus a kényelmi értékeléshez
export interface GearComfort {
  sleep?: number;   // 1..5
  cold?: number;    // 1..5
  weight?: number;  // 1..5
}
```

A zod séma a `shared/gearSchemas.ts`-ban:

```ts
export const gearComfortSchema = z
  .object({
    sleep: z.number().int().min(1).max(5).optional(),
    cold: z.number().int().min(1).max(5).optional(),
    weight: z.number().int().min(1).max(5).optional(),
  })
  .strict();

// gearCreateSchema kiegészítése:
export const gearCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(80, 'Max 80 characters'),
  category_id: z.string().uuid('Pick a category'),
  weight_g: z.number().int().nonnegative().max(50_000),
  price: z.number().nonnegative().max(1_000_000).nullable().optional(),
  excluded_from_base: z.boolean().optional().default(false),
  comfort: gearComfortSchema.nullable().optional(), // ← P5
});
```

### 3.4 Ami NEM történik

- **Nincs új endpoint** (a meglévő POST/PATCH kezeli).
- **Nincs új utility class**.
- **Nincs új SQL view** (a `gear_base_weights_view` Phase 1-ből változatlan).
- **A publikus `/list/{id}` NEM kap comfort mezőt** (v2 §0 #5 elv).

---

## 4. A #23 debrief: séma, endpoint, UI

### 4.1 A séma döntés: **új `trip_debriefs` tábla a `trip_recaps.debrief JSONB` helyett**

A v2 §0 #4 elv kimondja, hogy a séma-szintű jövő-biztosítás olcsó. A debrief lehetne:

| Alternatíva | Előny | Hátrány |
|---|---|---|
| **`trip_recaps.debrief JSONB` mező** | Nincs új tábla, RLS már megvan (recap owner OR public OR `trip_visible_to`) | A debrief strukturálisan MÁS, mint a recap (`body` + `rating_out_of_10` + `public`); a JSONB egy "kalapdoboz", ami a későbbi riportok számára nehezen aggregálható |
| **Új `trip_debriefs` tábla** | **Tiszta normalizált séma** (3 `text[]` mező + `created_at`), egyszerű aggregáció később ("hány túra hiányolta a trekking pole-t"); a `unique(trip_id)` constraint az upsertet is kézben tartja | 1 új tábla + RLS + endpoint |

**Döntés: új `trip_debriefs` tábla.** A debrief a későbbi Phase 6 #24 Trip-stats-hoz (és a Phase 7 #22 Trip-aware loadout üzenethez) **aggregációs forrás**, és a 3 `text[]` (excess / missing / uncomfortable) SQL-szinten sokkal könnyebben aggregálható, mint egy JSONB mező. A `trip_recaps`-tól független tábla azért is jó, mert:

- A recap a P3-ból jön (body + rating + public), a debrief a P5-ből (3 question). Külön entitás, külön életciklus.
- A debrief `created_at` külön timestampet ad (a recap `updated_at`-jától eltérő), és a későbbi "utólag módosítottam a véleményem" flow-t külön auditálja.
- A RLS ugyanazt a mintát követi, mint a recap: owner OR `trip_visible_to` (a publikus flag a debrief-re nem értelmes — a debrief user-bevitel, nem publikus beszámoló).

### 4.2 Az új migration

`supabase/migrations/20260816000001_trip_debrief.sql`:

```sql
-- ============================================================================
-- Trip debrief — P5 / v2 #23 "Mit bántam meg?" debrief
-- Architect-approved, design-pass branch is the canonical design source.
-- Forward-only migration.
--
-- Adds:
--   * public.trip_debriefs — one row per trip. 3 text[] mező a 3 kérdésre
--     (excess / missing / uncomfortable). A unique (trip_id) constraint az
--     upsertet kézben tartja. A created_at timestamptz az első kitöltés
--     időpontja; UPDATE esetén is megmarad (csak a row updated_at triggerje
--     frissül — lásd alább).
--
-- Miért új tábla és nem a trip_recaps.debrief JSONB:
--   * A debrief strukturálisan más, mint a recap (3 kérdés, 3 text[]).
--   * A Phase 6 #24 Trip-stats-hoz aggregációs forrás; a text[] SQL-szinten
--     sokkal könnyebben aggregálható, mint egy JSONB mező.
--   * A recap-tól független életciklus (lehet debrief recap nélkül, és
--     fordítva).
--
-- Visibility (RLS): owner OR trip_visible_to(trip_id). A publikus flag a
-- debrief-re nem értelmes (a debrief user-bevitel, nem publikus beszámoló).
-- ============================================================================

create table public.trip_debriefs (
  id                  uuid primary key default gen_random_uuid(),
  trip_id             uuid not null unique references public.trips(id) on delete cascade,
  excess_items        text[] not null default '{}',
  missing_items       text[] not null default '{}',
  uncomfortable_items text[] not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index trip_debriefs_trip_id_idx on public.trip_debriefs (trip_id);
create trigger trip_debriefs_set_updated_at
  before update on public.trip_debriefs
  for each row execute function public.tg_set_updated_at();

-- RLS
alter table public.trip_debriefs enable row level security;

-- SELECT — owner OR trip_visible_to(trip_id).
-- A debrief nem publikus (nincs public flag), de a trip_visible_to helper
-- a P2-ből már owner + accepted invitee + accepted friend logikát ad.
create policy trip_debriefs_select_visible
  on public.trip_debriefs
  for select using (
    exists (
      select 1 from public.trips t
       where t.id = trip_debriefs.trip_id and t.user_id = auth.uid()
    )
    or public.trip_visible_to(trip_id)
  );

-- INSERT — owner only (WITH CHECK a parent trip owner-ját erősíti).
create policy trip_debriefs_insert_owner
  on public.trip_debriefs
  for insert with check (
    exists (
      select 1 from public.trips t
       where t.id = trip_debriefs.trip_id and t.user_id = auth.uid()
    )
  );

-- UPDATE — owner only.
create policy trip_debriefs_update_owner
  on public.trip_debriefs
  for update using (
    exists (
      select 1 from public.trips t
       where t.id = trip_debriefs.trip_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trips t
       where t.id = trip_debriefs.trip_id and t.user_id = auth.uid()
    )
  );

-- DELETE — owner only (cascade a parent trip törlésével együtt jár).
create policy trip_debriefs_delete_owner
  on public.trip_debriefs
  for delete using (
    exists (
      select 1 from public.trips t
       where t.id = trip_debriefs.trip_id and t.user_id = auth.uid()
    )
  );
```

### 4.3 Az új endpoint

`server/api/trips/[id]/debrief.get.ts` + `debrief.post.ts`:

```ts
// server/api/trips/[id]/debrief.get.ts
// GET /api/trips/:id/debrief
// Returns { debrief: TripDebriefRow | null }. Owner OR trip_visible_to.
export default defineEventHandler(async (event) => {
  const tripId = getRouterParam(event, 'id');
  if (!tripId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing trip id' });
  }
  const supabase = await serverSupabaseClient<Database>(event);
  const { data, error } = await supabase
    .from('trip_debriefs')
    .select('*')
    .eq('trip_id', tripId)
    .maybeSingle();
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }
  return { debrief: (data as TripDebriefRow | null) ?? null };
});
```

```ts
// server/api/trips/[id]/debrief.post.ts
// POST /api/trips/:id/debrief
// Owner-only upsert. body: { excess_items: string[], missing_items: string[], uncomfortable_items: string[] }.
// A unique (trip_id) constraint a duplikációt megakadályozza.
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Bejelentkezés szükséges' });
  }
  const tripId = getRouterParam(event, 'id');
  if (!tripId) {
    throw createError({ statusCode: 400, statusMessage: 'Hiányzó túra azonosító' });
  }
  const body = await readBody(event);
  const parsed = debriefUpsertSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Érvénytelen debrief payload', data: parsed.error.flatten() });
  }
  const supabase = await serverSupabaseClient<Database>(event);
  const upsertPayload = {
    trip_id: tripId,
    excess_items: parsed.data.excess_items,
    missing_items: parsed.data.missing_items,
    uncomfortable_items: parsed.data.uncomfortable_items,
  };
  const { data, error } = await supabase
    .from('trip_debriefs')
    .upsert(upsertPayload, { onConflict: 'trip_id' })
    .select()
    .single();
  if (error || !data) {
    throw createError({ statusCode: 404, statusMessage: 'A túra nem található vagy nem a tiéd' });
  }
  return data as TripDebriefRow;
});
```

### 4.4 A zod séma

`shared/debriefSchemas.ts` (új fájl, mint a `recapSchemas.ts` mintája):

```ts
import { z } from 'zod';

// Egy item-szintű bejegyzés: max 120 karakter, hogy a UI ne legyen túl hosszú.
// A text[] Postgres-tömb, tehát a kliens string[]-ként küldi.
const debriefItemSchema = z.string().min(1).max(120);

export const debriefUpsertSchema = z.object({
  excess_items: z.array(debriefItemSchema).max(50).default([]),
  missing_items: z.array(debriefItemSchema).max(50).default([]),
  uncomfortable_items: z.array(debriefItemSchema).max(50).default([]),
});

export type DebriefUpsertInput = z.infer<typeof debriefUpsertSchema>;
```

A `server/utils/debriefSchemas.ts` wrapper re-exportálja, ahogy a többi séma.

### 4.5 A UI: **3 textarea a `pages/trips/[id].vue` recap section-je alatt**

A debrief card **a meglévő Túra-élménybeszámoló section alá** kerül, új `<section>`-ként. A MemoFox "warm/playful" voice-hoz illeszkedő szöveggel:

```
┌─────────────────────────────────────────────────────────────┐
│  🦊 Mit bántam meg?                                         │
│                                                             │
│  Mi volt felesleges?                                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Pl. extra kulacs, sosem használt bicska              │    │
│  │                                                     │    │
│  │ + Adj hozzá újabb sort                              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Mi hiányzott?                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Pl. jobb fejlámpa, plusz réteg                      │    │
│  │                                                     │    │
│  │ + Adj hozzá újabb sort                              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Mi volt kényelmetlen?                                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Pl. matrac túl kemény, hálózsák túl szűk            │    │
│  │                                                     │    │
│  │ + Adj hozzá újabb sort                              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│                              [Debrief mentése]              │
└─────────────────────────────────────────────────────────────┘
```

A 3 kérdés fix (a v2 szövegéből); a válaszok `text[]` formátumban tárolódnak. A UI-n a 3 textarea **dinamikusan bővül**, ha a user az "+ Adj hozzá újabb sort" gombra kattint (újabb sor a tömbhöz). A mentés a meglévő `upsert` mintára működik: a `useTrips()` composable-hoz hozzáadódik egy `saveDebrief(tripId, payload)` metódus.

### 4.6 A `pages/trips/[id].vue` módosítása

A meglévő `useTrips()` composable-hoz (amely a P3 recap-ot is kezeli) hozzáadódik:

- `state.debriefByTripId: Record<UUID, TripDebriefRow | null>` — a memoizált state.
- `loadDebrief(tripId: UUID)` — a `GET /api/trips/:id/debrief` hívása.
- `saveDebrief(tripId, payload)` — a `POST /api/trips/:id/debrief` hívása.

A `pages/trips/[id].vue` page a meglévő recap section (P3) után szúrja be az új debrief section-t. A sorrend fontos: a debrief a recap UTÁN jelenik meg, mert a recap az "utólagos élménybeszámoló" (szabad szöveges), a debrief a "strukturált reflexió" (3 kérdés). A kettő kiegészíti egymást, nem zárja ki.

### 4.7 A `trip_debriefs` típus a `types/db.ts`-ban

```ts
export interface TripDebriefRow {
  id: UUID;
  trip_id: UUID;
  excess_items: string[];
  missing_items: string[];
  uncomfortable_items: string[];
  created_at: string;
  updated_at: string;
}

export interface TripDebriefUpsert {
  excess_items?: string[];
  missing_items?: string[];
  uncomfortable_items?: string[];
}
```

A `Database` típus kiegészül a `trip_debriefs` tábla `Row` / `Insert` / `Update` slotjaival (a `GenericTable` constraint-ot kielégítve, a `types/db.ts:482-500` mintát követve).

### 4.8 Ami NEM történik

- **Nincs automatikus trip-end** (`trips.status` mező nem jön létre; a debrief kézzel nyílik a `pages/trips/[id].vue` page-en, amikor a user kész).
- **Nincs push-notification** a debrief emlékeztetőre.
- **Nincs aggregáció / statistics** a debrief-ből (Phase 6 #24-be tartozik).
- **Nincs "what to pack next time" ajánlás** (Phase 7 #22-be tartozik).
- **A publikus `/t/{recap_id}` route-ot a Phase 5 NEM bővíti** (a debrief nem publikus, owner + invited barátok látják csak).

---

## 5. Acceptance criteria — mérhető ellenőrzés (QA hook)

A Phase 5 Trello kártya leírása + ez a fájl alapján a QA 10 mérhető feltételt ellenőriz (per-user, RLS alatt):

### #21 Comfort

1. **Star-rating UI**: a `GearFormModal` "Mennyire kényelmes?" section 3 sort tartalmaz (Alvás / Hidegben / Súlya), mindegyik 5 `<button type="button">` csillaggal.
2. **Validáció**: a `gearCreateSchema` elutasítja a 0-ás, 6-os, tört, vagy ismeretlen kulcsot tartalmazó comfort payload-ot (zod `.strict()` + `min(1).max(5)`).
3. **DB-szintű védelem**: a `gear_items` CHECK constraint elutasítja a `{ foo: 5 }` payload-ot (ismeretlen kulcs), és a NULL-t engedi (opcionális a comfort).
4. **Per-dimenzió megjelenítés**: a `GearCard.vue` badge három állapotot mutat (mind / részleges / üres), a natív `title` attribútumban a 3 dimenzió "Alvás X/5 · Hidegben Y/5 · Súlya Z/5" formátumban.
5. **Publikus route védett**: a `/list/{id}` (Phase 3) NEM tartalmazza a comfort mezőt; a `PublicListResponse` interface változatlan.

### #23 Debrief

6. **3 kérdés UI**: a `pages/trips/[id].vue` recap section után egy új section jelenik meg, 3 textarea-val (Felesleges / Hiányzott / Kényelmetlen), mindegyik "+ Adj hozzá újabb sort" gombbal.
7. **Mentés**: a `POST /api/trips/:id/debrief` 200 + `{ debrief: TripDebriefRow }` választ ad owner-kérésre; 401-et nem-auth és 404-et nem-owner kérésre.
8. **Upsert**: a debrief második beküldése UPDATE-eli a meglévő sort (a `unique (trip_id)` constraint + `onConflict: 'trip_id'`); a `created_at` nem változik, az `updated_at` igen.
9. **RLS**: a debrief-et CSAK a trip owner + accepted invitee + accepted friend látja (a meglévő `trip_visible_to` helper által). A publikus user 0 sort lát.
10. **Reuse**: a debrief endpoint NEM hoz létre új utility-t; a `useTrips().saveDebrief()` a meglévő `useTrips()` composable-t bővíti.

A QA a `[deploy]` commit előtt fut le (parent-agent hatáskör).

---

## 6. A `[deploy]` commit scope (a QA jóváhagyás UTÁN)

A Vercel-deploy trigger a parent-agent munkafolyamat része. A `[deploy]` commit várható:

```
feat(comfort-debrief): Phase 5 My Comfort (#21) + Debrief (#23)

Migrations:
- supabase/migrations/20260816000000_gear_comfort_rating.sql: NEW
  + gear_items.comfort JSONB NULL + CHECK constraint
- supabase/migrations/20260816000001_trip_debrief.sql: NEW
  + trip_debriefs table + 3 text[] + RLS (owner OR trip_visible_to)

Endpoints:
- server/api/trips/[id]/debrief.get.ts: NEW
- server/api/trips/[id]/debrief.post.ts: NEW

Schemas:
- shared/gearSchemas.ts: + gearComfortSchema, gearCreateSchema + comfort
- shared/debriefSchemas.ts: NEW (debriefUpsertSchema, DebriefUpsertInput)
- server/utils/debriefSchemas.ts: NEW (re-export wrapper)

Types:
- types/db.ts: + GearComfort, + TripDebriefRow, + TripDebriefUpsert,
  + Database.trip_debriefs Row/Insert/Update slots
- types/db.ts: GearItemRow + comfort field, GearItemInsert + comfort,
  GearItemUpdate + comfort

UI:
- components/GearFormModal.vue: + comfort 3-star section (form state + template)
- components/GearCard.vue: + comfort-summary badge (3-state, native title tooltip)
- pages/trips/[id].vue: + debrief section (3 textarea + save button)
- composables/useTrips.ts: + loadDebrief, saveDebrief, state.debriefByTripId

Docs:
- docs/sprint-4-phase-5-comfort-and-debrief.md: NEW (Architect spec)

#21-My-Comfort + #23-Debrief — v2 §0 #1, #2, #4, #5
```

A commit **MOST NEM JÖN LÉTRE** — a parent-agent QA workflow-ja (a Phase 1/2/3/4 mintára) hozza létre, miután a user/PO jóváhagyta a specifikációt és a QA kipipálta a 10 acceptance criteria-t.

---

## 7. Decisions log (Architect, ebben a fázisban)

| # | Döntés | Indoklás |
|---|---|---|
| 1 | **JSONB a 3 integer column helyett** a `gear_items.comfort` | A v2 példája 3 dimenziót ad, de a Phase 5 NEM zárja le a későbbi bővítést. A JSONB séma-módosítás nélkül enged új kulcsokat; a TypeScript-oldali szigorúságot a zod `.strict()` + interface biztosítja. |
| 2 | **3 star-rating sor** (slider / emoji helyett) | A MemoFox "warm/playful" voice-hoz a csillag-klasszika illeszkedik; a 1-5 skála a v2 példájából jön; a natív `<button>` focus-kezelés a meglévő focus-trap-pel konzisztens. |
| 3 | **Új `trip_debriefs` tábla** a `trip_recaps.debrief JSONB` helyett | A debrief strukturálisan más, mint a recap (3 kérdés × text[] vs. body + rating + public); a Phase 6 #24 Trip-stats-hoz aggregációs forrás; a `unique (trip_id)` constraint az upsertet kézben tartja. |
| 4 | **3 textarea (3-szor expandálható)** | A v2 szövege explicit 3 kérdést ad; a "+ Adj hozzá újabb sort" gomb a Phase 6 #24 statisztikákhoz (több item / túra) is jó alapot ad. |
| 5 | **Két külön migration fájl** (egy-egy feature-re) | A v2 §0 #4 elv: a séma-szintű jövő-biztosítás olcsó; a kettéválasztás megkönnyíti a rollback-utat, ha bármelyik feature QA-ja elbukik. |
| 6 | **A publikus `/list/{id}` NEM kap comfort mezőt** | A v2 §0 #5 elv explicit; a public adat-expozíció kerülendő (3-as szintű szabály). |
| 7 | **Nincs `trips.status = closed` triggelés** | A debrief kézzel nyílik, amikor a user késznek érzi; az automatikus trip-end a Phase 7-be tartozik. |
| 8 | **A debrief NEM publikus** (nincs `public` flag a `trip_debriefs`-en) | A debrief user-bevitel, nem publikus beszámoló; a `trip_visible_to` helper (owner + accepted invitee + accepted friend) elégséges láthatóságot ad. |

---

## 8. Open questions (a PO/Designer hatásköre a Phase 5 implementáció előtt)

1. **A comfort-summary badge színvariációja**: a 3 állapot (mind / részleges / üres) MemoFox `brand-500` / `brand-200` / semmi. A Phase 5 ezt javasolja; ha a Designer más palettát kér (pl. `ember` a részlegesre), egyszerű CSS-csere.
2. **A debrief card ikonja**: a fenti terv 🦊 rókát javasol (MemoFox brand voice); a Designer dönthet más ikon mellett (pl. 🎒, ⛰️).
3. **A "+ Adj hozzá újabb sort" gomb szövege**: a Phase 5 ezt a copy-t javasolja; ha a PO rövidebbet kér (pl. "+"), egyszerű szöveg-csere.
4. **A debrief `text[]` mezők maximális hossza**: a zod séma `max(120)` karakter / item, `max(50)` item / mező. A Phase 5 ezt a limitet javasolja; ha a PO hosszabb szöveget kér, a limit a zod + a CHECK constraint-ben (ha bevezetünk) egyszerre változik.

---

## 9. Rollback-út (orphan-komponensek + diff-méret)

A Phase 5 NEM töröl meglévő komponenst; a módosítások kiegészítő jellegűek:

- A `GearFormModal.vue` módosítása (3 új star-rating sor): ha rollback, a sorok törlése ~30 sor diff.
- A `GearCard.vue` módosítása (1 új badge section): ha rollback, a badge törlése ~10 sor diff.
- A `pages/trips/[id].vue` módosítása (1 új `<section>` a recap után): ha rollback, a section törlése ~80 sor diff.
- A `useTrips()` composable módosítása (`loadDebrief` + `saveDebrief` + `debriefByTripId`): ha rollback, ezeknek a metódusoknak a törlése ~30 sor diff.

A 2 új migration forward-only; rollback esetén a `gear_items.comfort` oszlop és a `trip_debriefs` tábla `drop`-ja 1-1 SQL utasítás (a `down` migration a parent-agent hatásköre).

**Nincs orphan-komponens** — a Phase 5 nem cserél le v1 komponenst v2-re.

---

## 10. Out of scope (explicit lista)

A Phase 5 NEM terjeszkedik az alábbiakra (a v2 §0 #3 elv — niche-igény validáció nélkül):

- ML-alapú comfort-ajánlás ("ez a matrac általában 5/5 alvás-komfortot kap").
- Automatikus trip-end triggelés (`trips.status = closed`).
- Push-notification / email-emlékeztető a debrief-re.
- Aggregáció / statistics a comfort-ból és a debrief-ből (Phase 6 #24).
- "What to pack next time" típusú loadout-ajánlás (Phase 7 #22).
- A publikus `/list/{id}` bővítése (Phase 3 lezárt scope).
- A `trips.visibility` / `trips.participation` mezők funkcióba hozása (Phase 4 óta séma-szinten léteznek, UI/logika a Phase 7+).
- Többnyelvűség (a debrief UI jelenleg magyar; az i18n a későbbi fázisokba tartozik).

---

## 11. A v2 §0 elvek leképezése — táblázat (Összefoglaló)

| v2 §0 elv | #21 Comfort megvalósulása | #23 Debrief megvalósulása |
|---|---|---|
| **#1 Valós adat > feltételezés** | User-bevitel, 3 dimenzió 1-5 star; nincs default | User-bevitel, 3 kérdés × text[]; nincs ML |
| **#2 Minimális onboarding-súrlódás** | Meglévő `GearFormModal` (create + edit) | Meglévő `pages/trips/[id].vue` recap section után |
| **#3 Niche-igény validáció nélkül** | 3 dimenzió fix a Phase 5-ben | 3 kérdés fix a v2-ből |
| **#4 Séma-szintű olcsó** | `gear_items.comfort JSONB` (1 új column + CHECK) | `trip_debriefs` tábla (1 új tábla + RLS) |
| **#5 Trip ≠ My Gear** | My Gear-szintű (item-en) | Trip-szintű (trip-en) |

---

## 12. Handoff (a Phase 5 után)

A Phase 5 lezárása után a Sprint 4 sorrend a következő fázisokat kínálja:

- **Phase 6 #24 Trip-történet/statisztika** — a comfort + debrief aggregációkból épít ("melyik kategóriában van a leggyakoribb kényelmetlenség", "melyik túrámon volt a legtöbb felesleges item"). A Phase 5 a Phase 6 adatgyűjtő primitívjeit építi; a Phase 6 az aggregáció.
- **Phase 7 #22 Trip-aware loadout üzenet** — a Phase 6 statisztikáiból ajánlás ("a legutóbbi 3 túrádon a hálózsákod kényelmetlen volt hidegben → próbáld ki a …"). A Phase 5 NEM épít ajánlást, csak adatot gyűjt.

A Phase 6 #24-et a jelenlegi scope-pivot memo nem részletezi; a Phase 7 #22-höz hasonlóan a v2 §"Javasolt Sprint 4 fókusz" jelöli ki a sorrendben. A Phase 5 lezárása UTÁN a parent-agent külön Architect dispatches-et küld a Phase 6 #24 specifikációjára.

---

## 13. Trello-paste blokk (a parent-agent által postolandó)

A Trello Phase 5 kártya **még nem létezik** — a parent-agent hatásköre, hogy a Backlog listában létrehozza (3-as szintű side-effect: új sor + broadcast). Ha a parent-agent létrehozza a kártyát és a sub-agent comment-body-t postolja, a következő blokk Trello-paste-ready:

```
Sprint 4 — Phase 5: My Comfort (#21) + Debrief (#23) — Architect spec

Döntések (Architect hatáskör, 3-szintű szabály 2-es szint):
1. Comfort séma: gear_items.comfort JSONB (3 integer column helyett)
   - Indoklás: v2 §0 #4 — séma-szintű jövő-biztosítás olcsó; JSONB séma-módosítás nélkül enged új dimenziót.
2. Comfort UI: 3 star-rating sor a GearFormModal alján (MemoFox brand-500)
   - Indoklás: v2 §0 #2 — minimális onboarding-súrlódás; a meglévő modal-t egészíti ki.
3. Debrief séma: új trip_debriefs tábla (trip_recaps.debrief JSONB helyett)
   - Indoklás: 3 text[] SQL-szinten aggregálható; Phase 6 #24 statisztikákhoz jobb alap.
4. Debrief UI: 3 textarea a pages/trips/[id].vue recap section után
   - Indoklás: v2 §0 #2 — a meglévő recap-flow-ba illeszkedik; a 3 kérdés a v2 szövegéből jön.
5. 2 külön migration (egy-egy feature-re), nem 1 összevont
   - Indoklás: rollback-út egyszerűbb, ha bármelyik feature QA-ja elbukik.

Komponensek:
- ÚJ: supabase/migrations/20260816000000_gear_comfort_rating.sql
- ÚJ: supabase/migrations/20260816000001_trip_debrief.sql
- ÚJ: server/api/trips/[id]/debrief.get.ts
- ÚJ: server/api/trips/[id]/debrief.post.ts
- ÚJ: shared/debriefSchemas.ts + server/utils/debriefSchemas.ts (wrapper)
- MÓDOSÍTÁS: types/db.ts (GearComfort + TripDebriefRow + TripDebriefUpsert + DB slot)
- MÓDOSÍTÁS: shared/gearSchemas.ts (+ gearComfortSchema, comfort mező)
- MÓDOSÍTÁS: components/GearFormModal.vue (+ 3 star-rating section)
- MÓDOSÍTÁS: components/GearCard.vue (+ comfort-summary badge)
- MÓDOSÍTÁS: composables/useTrips.ts (+ loadDebrief, saveDebrief, debriefByTripId)
- MÓDOSÍTÁS: pages/trips/[id].vue (+ debrief section a recap után)
- ÉRINTETLEN: server/api/gear/index.post.ts, server/api/gear/[id].patch.ts (a schema-bővítéssel kompatibilisek)
- Nincs orphan-komponens (rollback-út: 30-80 sor diff / feature)

Nincs új utility class, nincs új endpoint a comfort-hoz, nincs publikus adat-expozíció.

Acceptance criteria (10 mérhető, QA-hook):
#21 Comfort: 1) 3 star-rating UI; 2) zod validáció; 3) DB CHECK; 4) GearCard badge 3 állapot; 5) /list/{id} NEM tartalmazza.
#23 Debrief: 6) 3 textarea UI; 7) POST 200/401/404; 8) upsert (created_at不变, updated_at változik); 9) RLS owner + trip_visible_to; 10) useTrips saveDebrief reuse.

Specifikáció teljes terjedelme: docs/sprint-4-phase-5-comfort-and-debrief.md
[deploy] commit scope (QA jóváhagyás után): lásd §6 a spec fájlban.
next: Full-stack implementation (a parent-agent QA workflow része).
```

**Megjegyzés a parent-agent számára:** a fenti blokk a spec §0–§11 + §13 alapján készült. A Trello kártya létrehozása (3-as szintű side-effect: új Backlog sor) a parent-agent hatásköre. A sub-agent (Architect, ez a fájl) NEM hozza létre a kártyát — csak a specifikációt és a Trello-paste blokkot készíti elő.
