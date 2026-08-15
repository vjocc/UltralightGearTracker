# Sprint 4 — Phase 6: Trip-történet + személyes statisztika (#24) — Architect Spec

**Author:** Architect (role:architect)
**Date:** 2026-08-15
**Source of truth:** `docs/product-architecture-v2.md` §"Javasolt Sprint 4 fókusz" #24 + §0 döntési elvek
**Phase context:** Sprint 4 6. fázis. Phase 1–5 (categories-globalize @ `1802b98`, onboarding @ `44ed0d5`, public-list @ `c5438da`, visual-weight @ `5fb06d0`, comfort + debrief @ `13e15a7`) mind a `master`-en. A Phase 6 a v2 §"Javasolt sorrend" 7. lépése — a comfort + debrief adatokra ÉPÜL, ezért jön a Phase 5 UTÁN.
**Worktree:** `ultralight-gear-tracker` branch `master` (a `design-pass` a kanonikus design forrás, most a `master` SHA-nál `13e15a7`).
**Trello kártya:** a Phase 6 Trello kártya a parent-agent hatásköre (3-as szintű side-effect: új `Backlog` sor + broadcast). A specifikáció ezen a fájlon érhető el, és a Trello-paste-blokk a §13 végén készen áll, hogy a parent postolja a `6a80580d4c555552b27d50a6` kártyára.
**Implementáció tiltva:** ez a fájl csak TERV. A `feat(trip-stats):` branch és a `[deploy]` commit a parent-agent QA workflow-ja után jöhet (mint a Phase 1–5-nél).

---

## 0. Scope-pivot emlékeztető (3-szintű szabály: Phase 6 = 2-es szintű)

A Phase 6 egy **2-es szintű hatáskör**:

- **Dokumentált** (ez a fájl) + **jóváhagyott sorrend** (a v2 §"Javasolt Sprint 4 fókusz" sorrend: 1 → 4 → 2 → 19, 20 → 21, 23 → **24** → 22, azaz Phase 6 a 7. lépés, kifejezetten a comfort + debrief adatokra épül).
- **Nincs új scope / config / credential**: a meglévő `trips`, `trip_recaps`, `trip_debriefs`, `gear_items` (Phase 5-ben `comfort` JSONB-vel bővített), `trip_weight_summary` view, `gear_base_weights_view` view használhatók; a meglévő `useTrips()` composable bővíthető.
- **NEM public adat-expozíció**: a Trip-stats kizárólag a bejelentkezett user SAJÁT statisztikáit mutatja; a publikus `/list/{id}` route NEM kap statisztika feedet; a publikus `/t/{recap_id}` NEM kap aggregált számokat. A statisztikák SQL VIEW-jét `security_invoker = true` hozzáféréssel hozzuk létre, így a `trips.user_id = auth.uid()` RLS öröklődik — nem kell külön owner-only policy a view-ra.

**[deploy] commit szabály** (parent-agent workflow): a `feat(trip-stats):` commit a parent-agent által végzett QA **UTÁN** jöhet. A QA a Phase 4/5 mintájára: per-page renderelt statisztika-kártyák + trend-vizualizáció ellenőrzés, RLS-alatti user adattal töltve.

**Explicit out-of-scope (a v2 §0 #3 elv — niche-igény validáció nélkül):**

- Nincs ML-alapú trend-előrejelzés.
- Nincs push-notification a statisztika-változásról.
- Nincs automatikus trip-end triggelés (`trips.status = closed`).
- Nincs cross-user aggregáció ("a teljes közösség átlaga") — kizárólag saját user-szintű stat.
- Nincs `actual_distance_km` sematikus mező (a meglévő `gpx_metadata.total_distance_km` és `planned_distance_km` mezők elégséges forrást adnak; új távolság-migráció későbbi fázisokba tartozik).
- Nincs publikus statisztika-oldal.

---

## 1. Cél és a v2 §0 elvek leképezése

| v2 §0 elv | Phase 6 megvalósulása |
|---|---|
| **#1 Valós felhasználói adat > feltétlezés** | A statisztikák kizárólag a user valódi trip-adataiból + gear comfort-adataiból + debrief szövegeiből aggregálódnak. Nincs default-érték, nincs kitalált átlag, nincs ML-előrejelzés. Aki még nem töltött fel trip-et, "Még nincs elég adat" üzenetet lát (v2 §0 #1 szigorúan alkalmazva). |
| **#2 Minimalizáld az onboarding-súrlódást** | Nincs új adatgyűjtés. A statisztikák AUTOMATIKUSAN számítódnak a meglévő `trips`, `trip_debriefs`, `gear_items.comfort` adatokból — a usernek semmit nem kell kitöltenie. A page egy új route (`/stats`), de a link az `AppHeader`-ben a meglévő nav mellé kerül, és a statisztikák azonnal megjelennek (1 db `GET /api/stats` hívás). |
| **#3 Ne épülj be niche-igényre** | A 4 db statisztika-kártya (km, túrák száma, base weight trend, debrief-aggregáció) az átlag-felhasználónak szól. Nincs "túránkénti részletes percentilis", nincs cross-user összehasonlítás, nincs ML-recommendation. |
| **#4 Séma-szintű jövő-biztosítás olcsó, UI/logika-szintű nem** | **EGY új SQL VIEW**, a `trip_stats`, forward-only: 1 db VIEW + 1 db `TripStatsRow` TS-típus + 1 db endpoint. A view `security_invoker = true`-val örökli a `trips.user_id = auth.uid()` RLS-t — nincs új policy. A jövőbeli Phase 7 #22 trip-aware loadout üzenet erre a view-ra épülhet, a Phase 8+ riportok pedig ezt a view-t használhatják csv-export alapnak. |
| **#5 Trip ≠ My Gear** | A "Trip-történet + személyes statisztika" a **Trip**-re vonatkozik (km, túrák száma, base weight trend, debrief-aggregáció). A **My Gear** statisztika (összesített base weight, kategória-bontás) a Phase 1-ből már megvan a `/api/gear/base-weight` endpointon + `BaseWeightSummary` + `WeightBreakdownChart` komponenseken. A Phase 6 NEM duplikálja ezeket — a Trip-stats page a meglévő My Gear összesítést NEM jeleníti meg, csak a Trip-specifikus számokat. |

**További, implicit elv:** a Phase 6 **REUSE-el**, nem duplikál. A meglévő `useTrips()` composable-t bővíti egy `loadStats()` metódussal; a meglévő `BaseWeightSummary` / `WeightBreakdownChart` komponenseket NEM módosítja (azok a My Gear-hez tartoznak); a v2 #5 elv szigorúan betartva.

---

## 2. A `trip_stats` VIEW — struktúra és séma

### 2.1 A séma döntés: **VIEW (nem materializált), security_invoker, owner-only öröklött RLS-sel**

A v2 §0 #4 elv kimondja, hogy a séma-szintű jövő-biztosítás olcsó. A statisztikák lehetnének:

| Alternatíva | Előny | Hátrány |
|---|---|---|
| **Materialized view** | Gyorsabb olvasás (előre aggregált) | Nem örökli a RLS-t tisztán; frissítési policy kell; 2-es szintű szabály: nem olcsóbb, sőt |
| **Normál tábla + trigger** | Direkt RLS, gyors | Trigger-karbantartás; minden trip-CRUD eseményt triggerelni kell; rideg |
| **VIEW + `security_invoker = true`** | **RLS öröklődik** a `trips.user_id = auth.uid()`-ból; nincs trigger; nincs materializálás; a Phase 7 #22 erre építhet; a meglévő `gear_base_weights_view` és `trip_weight_summary` mintát követi | Minden olvasáskor újraszámolódik (de per-user néhány tucat sorra ez triviális) |

**Döntés: VIEW + `security_invoker = true`.** A meglévő mintát követi (`gear_base_weights_view` Phase 1, `trip_weight_summary` Phase 1). A VIEW **EGY sort ad vissza userenként** (egy user → egy statisztika-csomag), tehát a lekérdezés `SELECT * FROM trip_stats WHERE user_id = auth.uid()` — a `WHERE` filter redundáns (a view-ból csak a saját user sora jön), de védelmi vonalként bent marad.

### 2.2 A VIEW oszlopai

A `trip_stats` VIEW a következő oszlopokat adja vissza (per-user, 1 sor / user):

```sql
create or replace view public.trip_stats
  with (security_invoker = true)
as
with trip_km as (
  -- km / túra: a trips.gpx_metadata.total_distance_km + planned_distance_km
  -- együttesen, NULL-okat kihagyva (COALESCE fallback-sorrend).
  select
    t.user_id,
    count(t.id)                                                  as trip_count,
    coalesce(sum(
      case
        when (t.gpx_metadata->>'total_distance_km') is not null
          then (t.gpx_metadata->>'total_distance_km')::numeric
        else t.planned_distance_km
      end
    ), 0)::numeric(10,3)                                        as total_km
  from public.trips t
  group by t.user_id
),
base_weight_per_trip as (
  -- base weight / túra, időrendben. A trip_weight_summary view-t JOIN-oljuk
  -- (az már Σ weight_g × quantity-t ad owner-scoped RLS-sel).
  select
    tw.user_id,
    tw.trip_id,
    tw.total_grams,
    coalesce(t.start_date, t.created_at::date)                  as trip_date
  from public.trip_weight_summary tw
  join public.trips t on t.id = tw.trip_id
),
base_weight_trend_built as (
  select
    user_id,
    jsonb_build_object(
      'trips',   jsonb_agg(jsonb_build_object(
        'trip_id',     trip_id,
        'date',        to_char(trip_date, 'YYYY-MM-DD'),
        'total_grams', total_grams
      ) order by trip_date asc),
      'avg_grams',  coalesce(avg(total_grams), 0)::int,
      'min_grams',  coalesce(min(total_grams), 0)::int,
      'max_grams',  coalesce(max(total_grams), 0)::int,
      'first_date', to_char(min(trip_date), 'YYYY-MM-DD'),
      'last_date',  to_char(max(trip_date), 'YYYY-MM-DD')
    ) as base_weight_trend
  from base_weight_per_trip
  group by user_id
),
debrief_counts as (
  -- debrief aggregáció: a 3 text[] mező elemszámának összesítése userenként.
  -- text_array_length(text[]) SQL függvényt használunk (belső pg, nincs extra migration).
  select
    t.user_id,
    count(d.id)                                                  as debrief_count,
    coalesce(sum(array_length(d.excess_items, 1)), 0)::int      as total_excess_items,
    coalesce(sum(array_length(d.missing_items, 1)), 0)::int     as total_missing_items,
    coalesce(sum(array_length(d.uncomfortable_items, 1)), 0)::int
                                                                as total_uncomfortable_items
  from public.trips t
  left join public.trip_debriefs d on d.trip_id = t.id
  group by t.user_id
),
comfort_agg as (
  -- comfort aggregáció a user GEAR-listáján: 3 dimenzió (sleep / cold / weight)
  -- átlaga a kitöltött item-ekből. NULL-biztos (COALESCE + NULLIF a 0 elkerülésére).
  select
    gi.user_id,
    round(avg((gi.comfort->>'sleep')::numeric)
      filter (where gi.comfort ? 'sleep'), 2)                    as avg_comfort_sleep,
    round(avg((gi.comfort->>'cold')::numeric)
      filter (where gi.comfort ? 'cold'), 2)                     as avg_comfort_cold,
    round(avg((gi.comfort->>'weight')::numeric)
      filter (where gi.comfort ? 'weight'), 2)                   as avg_comfort_weight,
    count(*) filter (where gi.comfort is not null)               as comfort_items_count
  from public.gear_items gi
  group by gi.user_id
)
select
  coalesce(tk.user_id, bwt.user_id, dc.user_id, ca.user_id)    as user_id,
  coalesce(tk.trip_count, 0)                                     as trip_count,
  coalesce(tk.total_km, 0)                                       as total_km,
  coalesce(bwt.base_weight_trend, '{}'::jsonb)                   as base_weight_trend,
  coalesce(dc.debrief_count, 0)                                  as debrief_count,
  coalesce(dc.total_excess_items, 0)                             as total_excess_items,
  coalesce(dc.total_missing_items, 0)                            as total_missing_items,
  coalesce(dc.total_uncomfortable_items, 0)                      as total_uncomfortable_items,
  ca.avg_comfort_sleep,
  ca.avg_comfort_cold,
  ca.avg_comfort_weight,
  coalesce(ca.comfort_items_count, 0)                            as comfort_items_count
from trip_km tk
full outer join base_weight_trend_built bwt on bwt.user_id = tk.user_id
full outer join debrief_counts        dc  on dc.user_id  = coalesce(tk.user_id, bwt.user_id)
full outer join comfort_agg           ca  on ca.user_id  = coalesce(tk.user_id, bwt.user_id, dc.user_id);
```

**A 4 darab CTE indoklása:**

1. **`trip_km`** — km aggregáció. A `gpx_metadata.total_distance_km` az elsődleges forrás (Phase 1-ből), `planned_distance_km` a fallback (Phase 1-ből, tervezett táv). A `COALESCE` NULL-biztos.
2. **`base_weight_per_trip` + `base_weight_trend_built`** — a Phase 1-ből származó `trip_weight_summary` view-t használja (újrahasznosítás, nem duplikáció). A JSONB trend tömb time-series formátumban adja a base weight alakulását (`{trip_id, date, total_grams}` sorok, időrendben), plusz az `avg/min/max` összesítőket. A Designer a JSONB-t frontend-oldalon dolgozhatja fel (mini sparkline, vagy egyszerű lista).
3. **`debrief_counts`** — a Phase 5-ből származó `trip_debriefs` táblát aggregálja. A 3 `text[]` mező elemszámát adja user-szinten. `LEFT JOIN` a trips-re, hogy a debrief nélküli user is megjelenjen (0 összesítéssel).
4. **`comfort_agg`** — a Phase 5-ből származó `gear_items.comfort` JSONB-t aggregálja. A 3 dimenziót (`sleep`, `cold`, `weight`) külön-külön átlagolja, NULL-biztosan. A `comfort_items_count` a kitöltött comfort mezős item-ek számát adja.

**A `FULL OUTER JOIN` lánc:** biztosítja, hogy minden user kapjon 1 sort, függetlenül attól, hogy van-e trip-je, debrief-je vagy comfort item-e. Aki minden mezőben NULL, az 0-s trip_count / 0 km / üres trend JSONB / 0 debrief_count + NULL comfort averages — a frontend "Még nincs elég adat" üzenettel reagál.

### 2.3 A VIEW megjegyzés + audit

```sql
comment on view public.trip_stats is
  'Per-user aggregáció: trip_count, total_km, base_weight_trend JSONB, debrief aggregáció, '
  'comfort aggregáció. RLS öröklött a trips.user_id = auth.uid() és a gear_items.user_id = '
  'auth.uid() policy-ból security_invoker = true által. A Phase 7 #22 trip-aware loadout '
  'üzenet erre a view-ra épül. Forward-only, nincs RLS-policy módosítás.';
```

### 2.4 Ami NEM történik a VIEW-ban

- **Nincs cross-user aggregáció.** A view kizárólag a caller saját user_id-ját adja vissza (RLS).
- **Nincs anyagi aggregáció a komment-számokról** (`trip_comments`, `gear_comments`) — ezek a Phase 7 #22-be tartoznak.
- **Nincs weather / elevation aggregáció** (Phase 8+ backlog).
- **Nincs `actual_distance_km` mező.** A `gpx_metadata.total_distance_km` és a `planned_distance_km` együttesen fedik a fázis igényét.

---

## 3. Az új endpoint: `server/api/stats.get.ts`

### 3.1 Döntés: **top-level `GET /api/stats` (nem `trips/stats`)**

A spec scope-jában "vagy `server/api/trips/stats.get.ts`" alternatíva van. A döntés: **top-level `server/api/stats.get.ts`**, mert:

- A statisztika nem kizárólag trip-adat: a `comfort_agg` CTE a `gear_items`-ből aggregál (My Gear), a `debrief_counts` a `trip_debriefs`-ből (Trip), a `trip_km` és `base_weight_trend` a Trip-ből. A v2 §0 #5 elv hangsúlyozza, hogy a Trip ≠ My Gear — a `/api/trips/stats` route azt sugallná, hogy csak Trip-adat. A `/api/stats` semleges, és a későbbi fázisokban (pl. gear-stats összesítés, wishlist-stats) is bővíthető anélkül, hogy route-ot kelljen mozgatni.
- A meglévő `useTrips()` composable-ban a `loadStats()` metódus opcionálisan hívja — a route path `/api/stats` egyértelmű.

### 3.2 A endpoint implementáció

`server/api/stats.get.ts`:

```ts
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database, TripStatsRow } from '~/types/db';

/**
 * GET /api/stats
 *
 * Returns the signed-in user's aggregated trip + gear statistics.
 * Pure aggregation over the trip_stats VIEW (security_invoker = true,
 * so RLS from trips + gear_items is inherited automatically).
 *
 * Visibility:
 *   * serverSupabaseUser() — 401 if anonymous.
 *   * RLS on the underlying tables (trips.user_id = auth.uid(),
 *     gear_items.user_id = auth.uid()) — owner-only via security_invoker.
 *
 * Why server-side and not client-side aggregation?
 *   The Phase 5 spec already established that aggregation belongs on the
 *   server (see server/api/gear/base-weight.get.ts rationale). The trip_stats
 *   VIEW is the single source of truth; the JS layer never re-implements
 *   SUM / AVG / jsonb aggregation, avoiding hydration drift.
 *
 * The endpoint also fetches the user's recent trip list (newest 10) so the
 * page can render a "Trip-történet" timeline without a second round-trip.
 * The trip list itself is owner-scoped via RLS on the trips table — no
 * extra filter needed.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Bejelentkezés szükséges',
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);

  // 1) Aggregated stats from the trip_stats VIEW.
  //    The WHERE user_id = auth.uid() filter is redundant (security_invoker
  //    + trips.user_id = auth.uid() RLS already scopes to the caller), but
  //    we keep it as a defense-in-depth assertion.
  const { data: statsRow, error: statsError } = await supabase
    .from('trip_stats')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (statsError) {
    throw createError({ statusCode: 500, statusMessage: statsError.message });
  }

  // 2) Recent trips for the timeline section (newest first, limit 10).
  //    The Phase 5 spec did NOT introduce a timeline; this is the Phase 6
  //    addition. LIMIT is server-side; client pagination is out-of-scope
  //    for v2 #24.
  const { data: recentTrips, error: tripsError } = await supabase
    .from('trips')
    .select('id, name, start_date, end_date, created_at')
    .order('start_date', { ascending: false, nullsFirst: false })
    .limit(10);

  if (tripsError) {
    throw createError({ statusCode: 500, statusMessage: tripsError.message });
  }

  // If the user has zero trips, statsRow is null (the FULL OUTER JOIN gives
  // 1 row per user_id that appears in *any* CTE; a totally empty user has
  // no row at all). The frontend renders the "Még nincs elég adat" empty
  // state in that case.
  return {
    stats: (statsRow as TripStatsRow | null) ?? null,
    recent_trips: (recentTrips ?? []) as Array<{
      id: string;
      name: string;
      start_date: string | null;
      end_date: string | null;
      created_at: string;
    }>,
  };
});
```

### 3.3 Ami NEM történik az endpoint-on

- **Nincs POST / PUT / DELETE.** A statisztikák read-only aggregációk.
- **Nincs query-string paraméter** (nincs `?trip_id=...`, nincs `?from=...`). A v2 #24 spec user-szintű, nem per-trip.
- **Nincs caching header.** A Vercel edge-cache későbbi fázisokba tartozik; most minden GET fresh.

---

## 4. A `TripStatsRow` TypeScript-típus

### 4.1 Az új típus

`types/db.ts` kiegészítése a meglévő `TripWeightRow` interface után:

```ts
/**
 * Row shape of the trip_stats VIEW (see migration
 * 20260817000000_trip_stats_view.sql). The view is created with
 * security_invoker = true, so RLS from trips (user_id = auth.uid())
 * and gear_items (user_id = auth.uid()) is inherited — only the
 * caller's own aggregated row is returned.
 *
 * One row per user (via FULL OUTER JOIN across trip_km, base_weight_trend,
 * debrief_counts, comfort_agg). Users with zero trips still get one row
 * with all numeric fields = 0 and avg_comfort_* = null.
 *
 * `base_weight_trend` is a JSONB time-series:
 *   {
 *     "trips":      [{ trip_id, date, total_grams }, ...]   // ASC by date
 *     "avg_grams":  number,
 *     "min_grams":  number,
 *     "max_grams":  number,
 *     "first_date": "YYYY-MM-DD" | null,
 *     "last_date":  "YYYY-MM-DD" | null
 *   }
 *
 * Phase 7 #22 (trip-aware loadout üzenet) reads from this view; Phase 8+
 * csv-export uses it as a source. Forward-only.
 */
export interface TripStatsTrendPoint {
  trip_id: string;
  date: string;       // YYYY-MM-DD
  total_grams: number;
}

export interface TripStatsTrend {
  trips: TripStatsTrendPoint[];
  avg_grams: number;
  min_grams: number;
  max_grams: number;
  first_date: string | null;
  last_date: string | null;
}

export interface TripStatsRow {
  user_id: UUID;
  trip_count: number;
  total_km: number;
  base_weight_trend: TripStatsTrend;
  debrief_count: number;
  total_excess_items: number;
  total_missing_items: number;
  total_uncomfortable_items: number;
  avg_comfort_sleep: number | null;
  avg_comfort_cold: number | null;
  avg_comfort_weight: number | null;
  comfort_items_count: number;
}
```

### 4.2 A `Database` típus bővítése

A `types/db.ts:616-619` `Views` slot kiegészítése a `trip_stats: ViewShape<TripStatsRow>` sorral (a `ViewShape<Row>` generic pattern-ot követi, lásd `types/db.ts:593-596`).

### 4.3 Ami NEM történik a típuson

- **Nincs `Insert` / `Update` shape** (a VIEW read-only).
- **Nincs `Relationships` slot** (a VIEW nem tartalmaz embedded FK-t).

---

## 5. A `pages/stats/index.vue` új page + a `useTrips()` composable bővítése

### 5.1 A page elhelyezése: `pages/stats/index.vue` (nem `pages/profile/[id].vue`)

A spec scope alternatívája: "MÓDOSÍTÁS: `pages/profile/[id].vue` (vagy új `pages/stats/index.vue`)". A döntés: **új `pages/stats/index.vue`**, mert:

- A `pages/profile/[id].vue` NEM létezik a `master`-en (`ls pages/` kimenete: `auth, friends, gear, index.vue, list, signin, signup, trips, wishlist` — nincs `profile` alkönyvtár). A "vagy új `pages/stats/index.vue`" alternatíva az explicit fallback.
- A v2 §0 #5 elv hangsúlyozza: Trip ≠ My Gear. A Trip-stats page külön route, NEM a `/gear` alá rejtve. A `/stats` semleges, és a későbbi My Gear-stats kiterjesztés (ha lesz) külön route-ot kaphat (`/gear-stats` vagy hasonló).
- A `middleware/auth.global.ts` védelmi prefix-listájához hozzá kell adni a `/stats` útvonalat (lásd §5.5 lent).

### 5.2 A page struktúrája

```
┌──────────────────────────────────────────────────────────────────┐
│  📊 Trip-történet és statisztika                                  │
│  Saját túráid összesítése · kizárólag a te adataidból             │
│                                                                  │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐       │
│  │ Túrák száma │ Összesített │ Átlagos     │ Debrief     │       │
│  │             │ km          │ base weight │ kitöltések  │       │
│  │     12      │   148.3 km  │   3.4 kg    │    8 / 12   │       │
│  └─────────────┴─────────────┴─────────────┴─────────────┘       │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Base weight trend                                          │  │
│  │  [mini line-chart placeholder — a JSONB time-series alapján, │  │
│  │   MemoFox brand-500 + ember-500 színpár, SSR-safe]           │  │
│  │                                                             │  │
│  │   ── ──── ──── ────── ───── ──── ────── ──── ───── ────     │  │
│  │   '23 ápr     '24 szep     '25 jún     '26 máj              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────┬──────────────────────────────────┐  │
│  │  🦊 Mit bántam meg?     │  😊 Átlagos komfort              │  │
│  │  (aggregált)            │  (a gear-listádon)               │  │
│  │                         │                                  │  │
│  │  Felesleges:    23 item │  Alvás:       4.2 / 5 (8 item) │  │
│  │  Hiányzott:     14 item │  Hidegben:    3.8 / 5 (8 item) │  │
│  │  Kényelmetlen:  17 item │  Súlya:       3.5 / 5 (8 item) │  │
│  └─────────────────────────┴──────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Trip-történet (utolsó 10 túra)                              │  │
│  │                                                             │  │
│  │  2026-05-12 · Magas-Tátra · 18.4 km · 🦊 debrief kitöltve    │  │
│  │  2025-09-04 · Börzsöny · 22.1 km · 🦊 debrief kitöltve      │  │
│  │  ...                                                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Ha nincs trip: "Még nincs elég adat — menj, túrázz, és töltsd  │
│   fel a debrief-et!" CTA, MemoFox warm/playful voice]            │
└──────────────────────────────────────────────────────────────────┘
```

### 5.3 A `useTrips()` composable bővítése

A meglévő `composables/useTrips.ts`-hez (amely a P3-P5 `loadDebrief` / `saveDebrief` metódusokat is tartalmazza) hozzáadódik:

```ts
// composables/useTrips.ts (kiegészítés)

interface TripStatsState {
  stats: TripStatsRow | null;
  recentTrips: Array<{
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
  }>;
  loading: boolean;
  error: string | null;
}

const statsState = ref<TripStatsState>({
  stats: null,
  recentTrips: [],
  loading: false,
  error: null,
});

async function loadStats() {
  statsState.value.loading = true;
  statsState.value.error = null;
  try {
    const data = await $fetch<{
      stats: TripStatsRow | null;
      recent_trips: TripStatsState['recentTrips'];
    }>('/api/stats');
    statsState.value.stats = data.stats;
    statsState.value.recentTrips = data.recent_trips;
  } catch (e) {
    const err = e as { statusMessage?: string; message?: string };
    statsState.value.error = err?.statusMessage ?? err?.message ?? 'Stats betöltése sikertelen';
  } finally {
    statsState.value.loading = false;
  }
}
```

A `useTrips()` return-jében ezúttal NEM exportálódik globálisan — ehelyett egy dedikált **`composables/useStats.ts`** composable javasolt (lásd §5.4), ami a `loadStats()` + `state` mintát követi. Ez a Phase 5 mintától való eltérés, de a statisztika nem kizárólag Trip-adat, így a `useTrips()`-be való erőltetése a v2 §0 #5 elvvel ütközne.

### 5.4 Az új `composables/useStats.ts`

```ts
// composables/useStats.ts — a /api/stats endpoint ref-je.
// Mintát a useBaseWeight.ts (Phase 1) és useTrips.ts (Phase 3) ad.

interface UseStatsState {
  stats: TripStatsRow | null;
  recentTrips: Array<{
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
  }>;
  loading: boolean;
  error: string | null;
}

export const useStats = () => {
  const state = ref<UseStatsState>({
    stats: null,
    recentTrips: [],
    loading: false,
    error: null,
  });

  const load = async () => {
    state.value.loading = true;
    state.value.error = null;
    try {
      const data = await $fetch<{
        stats: TripStatsRow | null;
        recent_trips: UseStatsState['recentTrips'];
      }>('/api/stats');
      state.value.stats = data.stats;
      state.value.recentTrips = data.recent_trips;
    } catch (e) {
      const err = e as { statusMessage?: string; message?: string };
      state.value.error = err?.statusMessage ?? err?.message ?? 'Hiba';
    } finally {
      state.value.loading = false;
    }
  };

  const resetError = () => { state.value.error = null; };

  return { state, load, resetError };
};
```

### 5.5 A `middleware/auth.global.ts` módosítása

A védelmi prefix-listához hozzá kell adni a `/stats` útvonalat:

```ts
// middleware/auth.global.ts (kiegészítés)
const isProtected =
  to.path === '/gear' ||
  to.path.startsWith('/gear/') ||
  to.path.startsWith('/wishlist') ||
  to.path.startsWith('/trips') ||
  to.path.startsWith('/friends') ||
  to.path.startsWith('/settings') ||
  to.path.startsWith('/stats');   // ← P6 / v2 #24
```

### 5.6 A `components/AppHeader.vue` módosítása

A meglévő nav (Gear / Wishlist / Trips / Friends) után, a "Kijelentkezés" gomb előtt, egy új `NuxtLink`:

```vue
<NuxtLink
  to="/stats"
  class="rounded px-2 py-1 font-medium text-gray-700 hover:bg-gray-100"
>
  Stats
</NuxtLink>
```

A "Stats" link a MemoFox voice-hoz illeszkedően magyar copy-val is megjelenhet ("Statisztika"), de a meglévő nav egységesen angol ("Gear", "Wishlist", "Trips", "Friends"), így a Phase 6 az angolt követi. Ha a Designer magyarosít, egyszerű szöveg-csere.

### 5.7 A vizuális megjelenítés — MemoFox palette

A 4 db statisztika-kártya a meglévő `BaseWeightSummary` és `WeightBreakdownChart` komponensek mintáját követi (Tailwind utility osztályok, `bg-white` / `border-gray-200` / `text-gray-900` alapszínek + MemoFox `brand-500` akcentus a számoknál). A base weight trend-vizualizáció egy egyszerű **inline SVG line-chart** (MemoFox `brand-500` és `ember-500` színpár), NEM új npm-csomag — a JSONB `base_weight_trend.trips` tömbből SSR-safe módon számítódik a `viewBox`. A Designer a Phase 6 implementáció során dönthet a pontos vizualizációról (mini sparkline / egyszerű vonaldiagram / dot-marker), de a Phase 6 spec a minimumot adja (a trend JSONB time-series-ből egy működőképes vizuális reprezentáció).

### 5.8 Ami NEM történik a page-en

- **Nincs cross-user / community statisztika** ("a teljes közösség átlaga").
- **Nincs export (CSV / PDF)** — Phase 8+ backlog.
- **Nincs dátum-szűrő** ("csak az elmúlt 1 év"). A spec user-szintű, minden túrát magában foglal.
- **Nincs trip-detail side-panel** — a "Trip-történet" lista linkeli a `/trips/{id}` page-et (a meglévő `TripCard` újrahasznosítása).

---

## 6. Schema + endpoint + page változások — összefoglaló

| Fájl | Módosítás |
|---|---|
| `supabase/migrations/20260817000000_trip_stats_view.sql` | **NEW** — `trip_stats` VIEW + COMMENT (lásd §2). Forward-only. |
| `server/api/stats.get.ts` | **NEW** — `GET /api/stats` owner-scoped read (lásd §3). |
| `pages/stats/index.vue` | **NEW** — statisztika-page, 4 kártya + trend + trip-történet timeline (lásd §5). |
| `composables/useStats.ts` | **NEW** — `useStats()` composable a `/api/stats` ref-jével (lásd §5.4). |
| `types/db.ts` | MÓDOSÍTÁS — `TripStatsRow` + `TripStatsTrend` + `TripStatsTrendPoint` típusok + `Database.public.Views.trip_stats` slot. |
| `middleware/auth.global.ts` | MÓDOSÍTÁS — `/stats` hozzáadása a védelmi prefix-listához. |
| `components/AppHeader.vue` | MÓDOSÍTÁS — "Stats" `NuxtLink` a nav-ba. |

**Érintetlen fájlok (fontos!):**

- `server/api/trips/index.get.ts` — változatlan, a meglévő trip lista endpoint.
- `server/api/trips/[id]/recap.get.ts` — változatlan.
- `pages/gear/index.vue` — változatlan (a My Gear-base-weight summary a Phase 1-ből itt marad, NEM duplikálódik a /stats-ra).
- `components/BaseWeightSummary.vue` és `components/WeightBreakdownChart.vue` — változatlanok.
- `pages/trips/[id].vue` — változatlan (a debrief UI a Phase 5-ből).
- A `useTrips()` composable — változatlan (a stats külön composable-ba kerül, lásd §5.3).

---

## 7. Acceptance criteria — mérhető ellenőrzés (QA hook)

A Phase 6 Trello kártya leírása + ez a fájl alapján a QA 8 mérhető feltételt ellenőriz (per-user, RLS alatt):

1. **Migration deploy**: `supabase db push` (vagy a Supabase Dashboard SQL editor) sikeresen lefut; a `trip_stats` VIEW létezik, `security_invoker = true`-val.
2. **Endpoint auth-gated**: `GET /api/stats` anonymous kérésre **401**-et ad; bejelentkezett user kérésre **200** + `{ stats, recent_trips }` JSON-t ad.
3. **RLS owner-only**: user-A `GET /api/stats` hívása CSAK user-A saját aggregált sorát adja (a view-ból az RLS kiszűri a többi user-t). User-A `SELECT * FROM trip_stats` közvetlenül a Supabase-ből is csak a saját sorát látja.
4. **Aggregáció helyes**: 3 db trip (2 km + 3 km + 5 km, ebből 2-nek van debrief-je és 1 comfort item-je) esetén `trip_count = 3`, `total_km = 10`, `debrief_count = 2`, `comfort_items_count = 1`, az `avg_comfort_*` mezők a kitöltött item-ek átlagát adják (NULL-biztosan).
5. **Trend JSONB time-series**: a `base_weight_trend.trips` tömb hossza = `trip_count`; a sorok `date` mező szerint növekvő sorrendben vannak; az `avg/min/max/first_date/last_date` összesítők konzisztensek a tömbbel.
6. **Empty state**: 0 trip-es user a `GET /api/stats` hívásra `stats: null` + `recent_trips: []` választ kap; a page "Még nincs elég adat" CTA-t mutat (MemoFox warm/playful voice).
7. **Cross-table RLS**: ha user-A user-B trip-jének `id`-ját közvetlenül a `trips` táblából próbálja olvasni (a Supabase Studio-ból), a RLS kiszűri — a Phase 5-ben már bizonyított RLS pattern.
8. **Publikus route védett**: a publikus `/list/{id}` (Phase 3) és `/t/{recap_id}` (Phase 3, ha van) NEM tartalmazza a statisztika feedet; a `stats` endpoint NEM érhető el anonymous kérésre; a `trip_stats` view NEM olvasható service-role-on kívül más user RLS-jével.

A QA a `[deploy]` commit előtt fut le (parent-agent hatásköre).

---

## 8. Decisions log (Architect, ebben a fázisban)

| # | Döntés | Indoklás |
|---|---|---|
| 1 | **VIEW `security_invoker = true`**, nem materializált view, nem triggeres tábla | A v2 §0 #4 elv: séma-szintű jövő-biztosítás olcsó; a meglévő `gear_base_weights_view` és `trip_weight_summary` mintát követi; a Phase 7 #22 erre a view-ra épülhet. |
| 2 | **FULL OUTER JOIN a 4 CTE-n** (trip_km, base_weight_trend_built, debrief_counts, comfort_agg) | Biztosítja, hogy minden user kapjon 1 sort, függetlenül attól, hogy melyik aggregációs forrásból van adata. A 0 trip-es user is megjelenik (üres aggregációkkal), nem "missing row". |
| 3 | **`base_weight_trend` JSONB time-series**, nem külön `base_weight_history` tábla | A v2 §0 #4 elv: séma-módosítás nélküli bővíthetőség; a JSONB-ben tárolt `trips[]` + `avg/min/max/first/last` a Phase 7 #22-nek elég adat; a JSONB-ből a frontend bármilyen vizualizációt (line-chart, bar-chart, sparkline) meg tud csinálni. |
| 4 | **`GET /api/stats` top-level route** (nem `/api/trips/stats`) | A statisztika kevert forrású (Trip + My Gear comfort); a v2 §0 #5 elv hangsúlyozza, hogy Trip ≠ My Gear — a `/api/stats` semleges route. |
| 5 | **Új `pages/stats/index.vue`**, nem `pages/profile/[id].vue` | A `pages/profile/[id].vue` NEM létezik a master-en; a `pages/stats/index.vue` az explicit fallback a spec scope-ban. A jövőbeli My Gear-stats külön route-ot kaphat. |
| 6 | **Dedikált `useStats()` composable**, nem a `useTrips()` bővítése | A stats kevert forrású (Trip + My Gear); a `useTrips()`-be való erőltetés a v2 §0 #5 elvvel ütközne; a dedikált composable tisztán tartja a felelősségi köröket. |
| 7 | **Nincs cross-user aggregáció** | A v2 §0 #5 elv szigorúan: a stats user-szintű; a community-stats külön fázis (Phase 8+ backlog). |
| 8 | **Nincs `actual_distance_km` migration** | A `gpx_metadata.total_distance_km` + `planned_distance_km` együttesen fedik a fázis km-igényét; új távolság-migráció a Phase 8+-ba tartozik. |
| 9 | **A meglévő `BaseWeightSummary` és `WeightBreakdownChart` NEM módosul** | A v2 §0 #5 elv szigorúan: a base weight summary a My Gear-hez tartozik (Phase 1), a Trip-stats page csak a Trip-specifikus számokat mutatja (km, túrák száma, base weight trend). |
| 10 | **MemoFox palette a vizuális megjelenítéshez** | A meglévő `design-pass` branch kanonikus (memo 13e15a7); a `brand-500` / `ember-500` / `moss-500` színpár a `BaseWeightSummary` mintát követi. |

---

## 9. Open questions (a PO/Designer hatásköre a Phase 6 implementáció előtt)

1. **A base weight trend vizualizáció pontos formája**: a Phase 6 spec inline SVG line-chart-ot javasol; a Designer dönthet más formátum mellett (mini sparkline, bar-chart, dot-marker). A JSONB time-series bármelyiket támogatja.
2. **A "Túrák száma" kártya címkéje**: a Phase 6 "Túrák száma" + szám; a Designer rövidebbet kérhet ("12 túra") vagy hosszabbat ("Összesen 12 túra"). A copy a page-en 1 sor.
3. **A trip-történet lista limitje**: a Phase 6 spec 10-es limitet ad (`recent_trips.limit(10)`); a Designer nagyobbat kérhet (20, 50), de a page-en görgetés nélkül max 10-20 sor ajánlott.
4. **Az "Még nincs elég adat" CTA**: a Phase 6 spec MemoFox warm/playful voice-ot javasol ("Még nincs elég adat — menj, túrázz, és töltsd fel a debrief-et!"); a Designer dönthet más hangnem mellett.
5. **A "Stats" link a nav-ban magyarul ("Statisztika") vagy angolul**: a meglévő nav egységesen angol ("Gear", "Wishlist", "Trips", "Friends"), így a Phase 6 az angolt javasolja; a Designer magyarosíthatja az egész nav-ot (későbbi i18n fázis).

---

## 10. Rollback-út (orphan-komponensek + diff-méret)

A Phase 6 NEM töröl meglévő komponenst; a módosítások kiegészítő jellegűek:

- A `types/db.ts` módosítása (`TripStatsRow` + Database slot): ha rollback, a típusok + slot törlése ~40 sor diff.
- A `middleware/auth.global.ts` módosítása (1 sor hozzáadás a prefix-listához): ha rollback, a sor törlése 1 sor diff.
- A `components/AppHeader.vue` módosítása (1 új `NuxtLink`): ha rollback, a link törlése ~8 sor diff.
- A `pages/stats/index.vue` új fájl: ha rollback, a fájl teljes törlése (~150 sor).
- A `composables/useStats.ts` új fájl: ha rollback, a fájl teljes törlése (~40 sor).
- A `server/api/stats.get.ts` új fájl: ha rollback, a fájl teljes törlése (~80 sor).

Az 1 új migration (`trip_stats` VIEW) forward-only; rollback esetén a VIEW `drop` 1 SQL utasítás (a `down` migration a parent-agent hatásköre).

**Nincs orphan-komponens** — a Phase 6 nem cserél le v1 komponenst v2-re; minden új fájl önálló, a meglévők módosítása minimális (1-8 sor).

---

## 11. Out of scope (explicit lista)

A Phase 6 NEM terjeszkedik az alábbiakra (a v2 §0 #3 elv — niche-igény validáció nélkül):

- ML-alapú trend-előrejelzés ("a következő túrádon várhatóan 3.6 kg lesz a base weight-ed").
- Push-notification / email-emlékeztető a statisztika-változásról.
- Automatikus trip-end triggelés (`trips.status = closed`).
- Cross-user / community statisztika ("a teljes közösség átlaga").
- Export (CSV / PDF) a statisztikákból.
- Dátum-szűrő a page-en ("csak az elmúlt 1 év").
- `actual_distance_km` sematikus mező (a `gpx_metadata.total_distance_km` + `planned_distance_km` elég).
- A publikus `/list/{id}` és `/t/{recap_id}` route-ok bővítése (Phase 3 lezárt scope).
- Többnyelvűség (a page magyar; az i18n a későbbi fázisokba tartozik).
- A Phase 7 #22 trip-aware loadout üzenet — az a Phase 6 view-t használja, de a loadout logika külön fázis.

---

## 12. A v2 §0 elvek leképezése — táblázat (Összefoglaló)

| v2 §0 elv | Phase 6 megvalósulása |
|---|---|
| **#1 Valós adat > feltételezés** | A statisztikák a user valódi `trips`, `trip_debriefs`, `gear_items.comfort` adataiból aggregálódnak. 0 trip-es user esetén NINCS default-szám, "Még nincs elég adat" üzenet. |
| **#2 Minimális onboarding-súrlódás** | AUTOMATIKUS generálás — a usernek semmit nem kell kitöltenie. A `/stats` page azonnal renderel, 1 db `GET /api/stats` hívással. |
| **#3 Niche-igény validáció nélkül** | A 4 db statisztika-kártya az átlag-felhasználónak szól (km, túrák száma, base weight trend, debrief-aggregáció). Nincs cross-user, nincs ML. |
| **#4 Séma-szintű olcsó** | 1 db VIEW (`trip_stats`) + 1 db típus (`TripStatsRow`) + 1 db endpoint + 1 db page. A Phase 7 #22 erre a view-ra épül. |
| **#5 Trip ≠ My Gear** | A Trip-stats page a Trip-specifikus számokat mutatja (km, túrák száma, trend, debrief-aggregáció). A My Gear-stats (base weight summary, kategória-bontás) a Phase 1-ből a `/gear` page-en marad. A dedikált `useStats` composable a `useTrips`-től különálló. |

---

## 13. Handoff (a Phase 6 után)

A Phase 6 lezárása után a Sprint 4 sorrend utolsó fázisa marad:

- **Phase 7 #22 Trip-aware loadout üzenet** — a Phase 6 `trip_stats` view-ból ajánlás ("a legutóbbi 3 túrádon a hálózsákod kényelmetlen volt hidegben → próbáld ki a …"). A Phase 6 a statisztikákat adja; a Phase 7 a loadout-ajánlást.

A Phase 6 lezárása UTÁN a parent-agent külön Architect dispatches-et küld a Phase 7 #22 specifikációjára (hasonló mintával: 3-szintű szabály, scope-pivot emlékeztető, Architect spec fájl, Trello-paste blokk).

---

## 14. Trello-paste blokk (a parent-agent által postolandó)

A Phase 6 Trello kártya a **parent-agent** hatásköre (`6a80580d4c555552b27d50a6`). Ha a parent-agent postolja a sub-agent comment-body-t, a következő blokk Trello-paste-ready:

```
Sprint 4 — Phase 6: Trip-történet + személyes statisztika (#24) — Architect spec

Döntések (Architect hatáskör, 3-szintű szabály 2-es szint):
1. Séma: trip_stats VIEW (security_invoker = true), NEM materializált view, NEM triggeres tábla
   - Indoklás: v2 §0 #4 — séma-szintű jövő-biztosítás olcsó; a meglévő gear_base_weights_view és
     trip_weight_summary mintát követi; a Phase 7 #22 erre a view-ra épül.
2. VIEW struktúra: 4 CTE (trip_km, base_weight_trend, debrief_counts, comfort_agg) FULL OUTER JOIN-nal
   - Indoklás: minden user kapjon 1 sort, függetlenül a forrás-adatok meglététől; a 0 trip-es user
     "Még nincs elég adat" CTA-t lát (v2 §0 #1 szigorúan).
3. base_weight_trend JSONB time-series (trips[] + avg/min/max/first/last)
   - Indoklás: séma-módosítás nélküli bővíthetőség; a JSONB-ből bármilyen vizualizáció (line-chart,
     sparkline, bar-chart) megoldható a frontend-en.
4. GET /api/stats top-level route (NEM /api/trips/stats)
   - Indoklás: a statisztika kevert forrású (Trip + My Gear comfort); a v2 §0 #5 elv szigorúan
     hangsúlyozza, hogy Trip ≠ My Gear — a semleges /api/stats route illik.
5. Új pages/stats/index.vue (NEM pages/profile/[id].vue — ami nem is létezik a master-en)
   - Indoklás: a profile route nem létezik; a /stats semleges, és a későbbi My Gear-stats külön
     route-ot kaphat.
6. Dedikált composables/useStats.ts (NEM a useTrips() bővítése)
   - Indoklás: a stats kevert forrású; a useTrips()-be való erőltetés a v2 §0 #5 elvvel ütközne.
7. Nincs cross-user aggregáció
   - Indoklás: v2 §0 #5 elv szigorúan user-szintű; community-stats = Phase 8+ backlog.
8. Nincs actual_distance_km migration
   - Indoklás: a gpx_metadata.total_distance_km + planned_distance_km együttesen fedik a km-igényt.

Komponensek:
- ÚJ: supabase/migrations/20260817000000_trip_stats_view.sql
  + trip_stats VIEW (security_invoker = true) + COMMENT
- ÚJ: server/api/stats.get.ts (owner-only, RLS öröklött a security_invoker által)
- ÚJ: pages/stats/index.vue (4 statisztika-kártya + trend-vizualizáció + trip-történet timeline)
- ÚJ: composables/useStats.ts (useStats() composable, /api/stats ref)
- MÓDOSÍTÁS: types/db.ts (+ TripStatsRow, TripStatsTrend, TripStatsTrendPoint + Database.Views slot)
- MÓDOSÍTÁS: middleware/auth.global.ts (+ /stats prefix a védelmi listához)
- MÓDOSÍTÁS: components/AppHeader.vue (+ "Stats" NuxtLink a nav-ba)
- ÉRINTETLEN: pages/gear/index.vue, components/BaseWeightSummary.vue,
  components/WeightBreakdownChart.vue, pages/trips/[id].vue, useTrips(),
  server/api/trips/* (a meglévő My Gear-stats és Trip-flow NEM módosul)

Nincs új utility class, nincs új endpoint a meglévőkhöz, nincs publikus adat-expozíció.

Acceptance criteria (8 mérhető, QA-hook):
1) Migration deploy sikeres; 2) endpoint 401 anonymous + 200 auth;
3) RLS owner-only; 4) aggregáció helyes (3 trip + debrief + comfort sample);
5) trend JSONB time-series konzisztens; 6) empty state "Még nincs elég adat" CTA;
7) cross-table RLS öröklődik; 8) publikus route védett (nincs stats feed).

Specifikáció teljes terjedelme: docs/sprint-4-phase-6-trip-stats.md
[deploy] commit scope (QA jóváhagyás után): lásd §15 a spec fájlban.
next: Full-stack implementation (a parent-agent QA workflow része).
```

**Megjegyzés a parent-agent számára:** a fenti blokk a spec §0–§13 + §14 alapján készült. A Trello kártya (`6a80580d4c555552b27d50a6`) már létezik (Phase 6 scope-ja a parent-agent által korábban létrehozott Backlog sor) — a comment postolása a parent-agent hatásköre. A sub-agent (Architect, ez a fájl) NEM postolja a kommentet — csak a specifikációt és a Trello-paste blokkot készíti elő.

---

## 15. A `[deploy]` commit scope (a QA jóváhagyás UTÁN)

A Vercel-deploy trigger a parent-agent munkafolyamat része. A `[deploy]` commit várható:

```
feat(trip-stats): Phase 6 Trip-történet + személyes statisztika (#24)

Migrations:
- supabase/migrations/20260817000000_trip_stats_view.sql: NEW
  + trip_stats VIEW (security_invoker = true) — 4 CTE: trip_km,
    base_weight_trend_built (JSONB time-series), debrief_counts,
    comfort_agg. FULL OUTER JOIN az 1 sor / user garanciájához.

Endpoint:
- server/api/stats.get.ts: NEW
  + GET /api/stats (owner-only, 401 anonymous)

Composable:
- composables/useStats.ts: NEW
  + useStats() composable, $fetch /api/stats wrapper (load + state + resetError)

Page:
- pages/stats/index.vue: NEW
  + 4 statisztika-kártya (túrák száma, összesített km, átlagos base weight,
    debrief kitöltések) + base weight trend inline SVG + comfort aggregáció +
    trip-történet timeline (utolsó 10 túra) + empty state "Még nincs elég adat"

Types:
- types/db.ts: + TripStatsRow, TripStatsTrend, TripStatsTrendPoint
  + Database.public.Views.trip_stats slot

Middleware:
- middleware/auth.global.ts: + /stats prefix a védelmi listához

Nav:
- components/AppHeader.vue: + "Stats" NuxtLink

#24-Trip-történet — v2 §0 #1, #2, #3, #4, #5
```

A commit **MOST NEM JÖN LÉTRE** — a parent-agent QA workflow-ja (a Phase 1–5 mintára) hozza létre, miután a user/PO jóváhagyta a specifikációt és a QA kipipálta a 8 acceptance criteria-t.