# Sprint 4 — Phase 7: Trip-aware loadout (v2 #22) — Architect spec

> **Phase context**: a Phase 1–6 mind implementálva, valódi QA Approved-del Done-ban. A Phase 7 a Sprint 4 UTOLSÓ fázisa: a Phase 5 (comfort JSONB) + Phase 6 (`trip_stats` VIEW) adatait olvassa, és egy rule-based ajánlást ad a user saját gear-listájából, a túra kontextusában.
>
> **Forrás**: `docs/product-architecture-v2.md` §"Javasolt Sprint 4 fókusz" #22 + §0 döntési elvek.

---

## 0. Scope-pivot emlékeztető (3-szintű szabály: Phase 7 = 2-es szintű)

A Phase 7 = **2-es szintű** (dokumentált, jóváhagyott sorrend, **NINCS** új scope / config / credential / publikus adat-expozíció). A user a Trello kártyán jóváhagyta a scope-ot; az Architect (ez a fájl) a SAJÁT hatáskörében dönti el a nyitott kérdéseket (recommender threshold, copy, section pozíció), és a Trello kártyán dokumentálja.

**Amit a Phase 7 NEM hoz létre:**
- ❌ Nincs új Supabase migration (a `trip_stats` VIEW és `trip_debriefs` / `gear_items.comfort` már Phase 5–6-ban jött létre)
- ❌ Nincs új utility class (csak meglévő `.btn-primary`, `.input`, `.rounded-card` MemoFox token-ek)
- ❌ Nincs ML, nincs valós idejű push-notification (v2 §0 #3 szigorúan tiltja)
- ❌ Nincs starter pack (v2 §2 kifejezetten kizárja)
- ❌ Nincs publikus route (a /api/trips/:id/loadout-recommendations GET 401 anonymous, owner-only)
- ❌ Nincs cross-user aggregáció (a v2 §0 #5 szigorúan user-szintű)
- ❌ Nincs új trip-rekord létrehozás (a Phase 7 read-only: a meglévő trip gear-listáját olvassa)
- ❌ Nincs My Gear módosítás (a v2 §0 #5: Trip ≠ My Gear; a Phase 7 kizárólag a Trip-oldali ajánlás-szekció, NEM ír a `gear_items` táblába)

**Amit a Phase 7 igen:**
- ✅ 1 db új endpoint (`server/api/trips/[id]/loadout-recommendations.get.ts`)
- ✅ 1 db új dedikált composable (`composables/useLoadoutRecommendations.ts` — NEM a useTrips/useStats bővítése, mert kevert forrású: trip + gear + comfort + debrief)
- ✅ 1 db módosítás a `pages/trips/[id].vue`-ban (egy új section, NEM modal, a recap + debrief szekciók UTÁN, még az `isOwnerViewer` gate-en belül)
- ✅ 1 db új típus a `types/db.ts`-ben (`LoadoutRecommendation` + `LoadoutRecommendationsResponse`)
- ✅ Rule-based logic, 5 db explicit szabállyal (lásd §2.4)

---

## 1. Cél és a v2 §0 elvek leképezése

| v2 §0 elv | Phase 7 megvalósulása |
|---|---|
| **1. elv** — valós adat > feltételezés | Az ajánlás a user VALÓDI `gear_items` listájából + VALÓDI `trip_debriefs.excess_items` előfordulásaiból + VALÓDI `gear_items.comfort` JSONB-ből jön. Nincs "feltételezett" item. |
| **2. elv** — onboarding-súrlódás minimalizálás | A loadout NEM kér új adatot a user-től. A Phase 5 (comfort) + Phase 6 (stats) adatból dolgozik; ha ezek üresek, "Még nincs elég adat" CTA jelenik meg, és a user-nek NEM kell új formot kitöltenie. |
| **3. elv** — ne niche, ne ML | Rule-based ajánlás: `(comfort_score - 1) × (1 - excess_rate)` formula (lásd §2.4). Nincs ML, nincs forecast, nincs személyre szabott tanuló-modell. |
| **4. elv** — séma-szintű jövő-biztosítás olcsó | Nincs új séma. A meglévő `trip_stats` VIEW (Phase 6) és a `trip_debriefs` / `gear_items.comfort` (Phase 5) feed-elik az ajánlót; a Phase 8+ csv-export és a "Trip-aware loadout v2" (pl. weather-aware) erre a rule-re épülhet. |
| **5. elv** — Trip ≠ My Gear | A loadout kizárólag a Trip-oldali ajánlás. A My Gear listát NEM módosítja. A Phase 7 endpoint a trip-id-hez van kötve (`/api/trips/:id/loadout-recommendations`), nem a user-id-hez. A dedikált composable a useTrips/useStats bővítése HELYETT kap helyet, mert kevert forrású (a v2 §0 #5 elv szigorúan). |

A fenti leképezés explicit, mert a Phase 7 egy "data-consuming" phase (a Phase 5 + 6 read-only inputjaiból dolgozik), nem egy "data-producing" phase — a séma-szintű határ a Phase 5–6 lezárult.

---

## 2. Az endpoint és a recommender logic

### 2.1 Endpoint signature

```
GET /api/trips/:id/loadout-recommendations
```

Auth: `serverSupabaseUser()` — 401 anonymous.
Owner-only: a trip `user_id === auth.uid()` ellenőrzés a szerver-oldali `trips` SELECT-tel; ha a trip nem a caller-é, 404-et adunk (RLS denial surface).
RLS öröklés: a `gear_items.user_id = auth.uid()` policy a `gear_items` SELECT-en öröklődik (a supabase-js client RLS-aware), a `trip_debriefs` SELECT a `trip_visible_to(trip_id)` policy-n keresztül owner-only effective (a trip owner = a trip visible).
Nincs POST / PUT / DELETE — read-only.

### 2.2 Query terv (3 db supabase-js SELECT, N+1 NEM, a dataset user-szinten kicsi)

A recommender három sub-query-t futtat (mind RLS-aware, mind owner-only effective):

1. **trip + gear lekérdezés** — `trips` SELECT a trip_id-vel (a trips.user_id RLS ellenőrzi a tulajdont), JOIN `trip_gear`-re, SELECT gear_item_id + quantity. Ez adja a "jelenleg a trip-en lévő itemek" halmazt.

2. **user gear + comfort lekérdezés** — `gear_items` SELECT (user-szintű, NEM trip-szintű): `id, name, weight_g, category_id, comfort`. A user TELJES gear-listája kell, mert az ajánlás a "még nincs a trip-en" itemekre is vonatkozhat.

3. **user debrief aggregáció** — a `trip_debriefs` SELECT az adott user ÖSSZES túrájáról (RLS: owner), kiolvassuk a 3 `text[]` mezőt. A `text[]` értékeit lowercase-re normalizáljuk és a gear item nevekkel (szintén lowercase) match-eljük: ha egy item neve szerepel a `excess_items` listában bármelyik korábbi trip-en, az 1-el növeli az `excess_appearances` számát. Az `uncomfortable_items` és `missing_items` listákat NEM használjuk a scoringhoz — csak az `excess_items`-t, mert a v2 §0 #1 elv ("felesleges" = a user által konkrétan megnevezett, user-bevitel adat, NEM feltételezés).

A 3 sub-query eredményét a szerveroldali handler kombinálja egy rule-based scoring passzal (lásd §2.4). A scoring kizárólag a user saját adataiból számít.

### 2.3 A `LoadoutRecommendation` típus

```ts
// types/db.ts (Phase 7 kiegészítés)

export interface LoadoutRecommendationItem {
  gear_item_id: UUID;
  name: string;
  category_id: UUID | null;
  weight_g: number;
  comfort: GearComfort | null;     // a user saját komfort-értékelése
  comfort_score: number;          // 1.0 .. 5.0, a (sleep+cold+weight)/3 átlag,
                                  //   NULL ha nincs komfort-értékelés → kimarad a scoringból
  excess_appearances: number;      // 0..N, hányszor szerepelt a user excess_items listájában
  excess_rate: number;            // 0.0 .. 1.0, excess_appearances / total_user_trip_count
  recommendation_score: number;   // 0.0 .. 1.0, rule-based formula
  reason: 'high_comfort' | 'low_excess' | 'both' | 'new_item' | null;
  /** Igaz, ha az item MÁR a trip-en van (ne ajánljuk hozzáadásra). */
  already_on_trip: boolean;
}

export interface LoadoutRecommendationsResponse {
  trip_id: UUID;
  /** Top-N item, akiket érdemes HOZZÁADNI ehhez a triphoz (még nincsenek a trip-en). */
  add_candidates: LoadoutRecommendationItem[];
  /** Top-N item, akiket érdemes MEGTARTANI a trip-en (már a trip-en vannak, magas score). */
  keep_candidates: LoadoutRecommendationItem[];
  /** Aggregált user-szintű statisztikák a section header-hez. */
  meta: {
    user_trip_count: number;
    user_debrief_count: number;
    user_comfort_items_count: number;
    /** Hány gear item került pontozásra (akinek van comfort VAGY excess adat). */
    scored_items_count: number;
    /** Összesített CTA: 'enough_data' | 'no_trips' | 'no_debriefs' | 'no_comfort' */
    readiness: 'enough_data' | 'no_trips' | 'no_debriefs' | 'no_comfort';
  };
}
```

### 2.4 A rule-based scoring formula

Minden user-szintű gear item-re (`scored_items_count` darab):

```
comfort_score  = (sleep + cold + weight) / 3, ha mind a 3 dimenzió ki van töltve
               = (kitöltött dimenziók átlaga), ha 1-2 dimenzió van
               = NULL, ha 0 dimenzió van  (kimarad a scoringból)

excess_rate    = excess_appearances / total_user_trip_count
               = 0, ha a user-nek nincs trip-je (de ekkor readiness='no_trips')

recommendation_score = ha comfort_score IS NULL:
                         1 - excess_rate         // csak excess alapján pontozunk
                       else:
                         0.6 × (comfort_score - 1) / 4    // 0.0..0.6 (1-5 skála normalizálva)
                       + 0.4 × (1 - excess_rate)         // 0.0..0.4
                       // max 1.0, ha comfort=5 ÉS excess_rate=0
```

A scoring egyszerű, transzparens, és a user számára is elmagyarázható (a `reason` mező ezt adja vissza):
- `reason = 'high_comfort'` ha `comfort_score >= 4` ÉS `excess_rate < 0.5`
- `reason = 'low_excess'` ha `comfort_score < 4` ÉS `excess_rate < 0.3` (és van excess adat)
- `reason = 'both'` ha mindkét threshold teljesül
- `reason = 'new_item'` ha nincs comfort adat, de az item soha nem szerepelt excess-ben (tehát "ismeretlen, de nem hibás")
- `reason = null` ha `comfort_score IS NULL` ÉS `excess_appearances > 0` (az itemről csak rossz adat van → nem ajánljuk)

A `recommendation_score` DESC szerint rendezzük; top-N=6-ot veszünk (az UI 3 + 3 kártyát mutat).

### 2.5 A "add" vs "keep" szétválogatás

- **`add_candidates`**: top-6 item, ahol `already_on_trip = false`, és `recommendation_score >= 0.5`. (A küszöb a "ne zajos ajánlás" elv — csak erős ajánlások kerülnek a UI-ba.)
- **`keep_candidates`**: top-6 item, ahol `already_on_trip = true`, és `recommendation_score >= 0.5`. (A user megerősítést kap: "ez az item korábbi túráidon is bevált, érdemes megtartani a mostani trip-en is".)

Ha bármelyik lista üres, a section-body-ban "Nincs új ajánlás" / "Nincs megerősített item" copy jelenik meg (NE üres lista, NE modal).

### 2.6 Empty state readiness

A `meta.readiness` mező 4 értéket vehet fel:

| Readiness | Trigger | UI copy |
|---|---|---|
| `enough_data` | `user_trip_count >= 1` ÉS `user_debrief_count >= 1` ÉS `user_comfort_items_count >= 3` | "Ajánlás a te túráid alapján" + a top-6 + top-6 lista |
| `no_trips` | `user_trip_count == 0` | "Még nincs elég adat — rögzíts egy túrát a Debrief kitöltéséhez, hogy személyes ajánlást kapj." |
| `no_debriefs` | `user_trip_count >= 1` ÉS `user_debrief_count == 0` | "A túráid megvannak, de a Debrief még nincs kitöltve. Töltsd ki bármelyik túrádon a 'Mit bántam meg?' űrlapot, hogy a felesleges itemeket kiszűrhessük." |
| `no_comfort` | van trip + van debrief ÉS `user_comfort_items_count < 3` | "A túráid és a Debrief megvannak, de a komfort-értékeléseid hiányosak. Értékeld a My Gear listádon legalább 3 itemet a komfort dimenziókban, hogy az ajánlás személyre szóljon." |

A `meta.readiness` az endpoint response része; a frontend nem számítja újra (single source of truth).

---

## 3. Az endpoint implementáció — kulcs blokkok

A teljes fájl: `server/api/trips/[id]/loadout-recommendations.get.ts`. A váz:

```ts
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database, LoadoutRecommendationsResponse } from '~/types/db';

export default defineEventHandler(async (event): Promise<LoadoutRecommendationsResponse> => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Bejelentkezés szükséges' });
  }

  const tripId = getRouterParam(event, 'id');
  if (!tripId) {
    throw createError({ statusCode: 400, statusMessage: 'Hiányzó túra azonosító' });
  }

  const supabase = await serverSupabaseClient<Database>(event);

  // (A) Trip ownership + meglévő trip_gear
  const { data: tripRow, error: tripErr } = await supabase
    .from('trips')
    .select('id, user_id, trip_gear(gear_item_id, quantity)')
    .eq('id', tripId)
    .maybeSingle();
  if (tripErr || !tripRow) {
    throw createError({ statusCode: 404, statusMessage: 'A túra nem található vagy nem a tiéd' });
  }

  // (B) User teljes gear-listája + comfort
  const { data: gearRows, error: gearErr } = await supabase
    .from('gear_items')
    .select('id, name, weight_g, category_id, comfort')
    .eq('user_id', user.id); // defense-in-depth, RLS is owner-only
  if (gearErr) {
    throw createError({ statusCode: 500, statusMessage: gearErr.message });
  }

  // (C) User összes túrájának debrief text[]-je
  const { data: debriefRows, error: debriefErr } = await supabase
    .from('trip_debriefs')
    .select('excess_items, trip_id, trips!inner(user_id)')
    .eq('trips.user_id', user.id);
  if (debriefErr) {
    throw createError({ statusCode: 500, statusMessage: debriefErr.message });
  }

  // (D) Aggregáció és scoring — lásd §2.4 + §2.5
  // A score-okat itt számoljuk, a §2.4 formulával.

  return { trip_id: tripId, add_candidates: [...], keep_candidates: [...], meta: {...} };
});
```

A handler:
- **N+1 NEM** — 3 SELECT, mind user-szintű (egy user max néhány száz gear-item, max néhány tucat trip).
- **Auth kettős**: `serverSupabaseUser` + `tripRow.user_id === user.id` + RLS öröklés.
- **404 a RLS-denied trip-re** — ugyanaz a pattern, mint a Phase 5 `debrief.post.ts`.

---

## 4. A dedikált composable: `composables/useLoadoutRecommendations.ts`

A Phase 7-nek van 1 db dedikált composable-ja. A `useTrips()` bővítését a v2 §0 #5 elvvel ütközne (a Trip-loadout kevert forrású: trip + gear + comfort + debrief), és a `useStats()` is user-szintű (NEM trip-szintű). A dedikált composable a Phase 6 `useStats` mintát követi:

```ts
export const useLoadoutRecommendations = (tripIdRef: Ref<string> | ComputedRef<string>) => {
  const state = useState<...>('loadout-recs', () => ({...}));
  const load = async () => { /* $fetch /api/trips/:id/loadout-recommendations */ };
  const resetError = () => { state.value.error = null; };
  return { state, load, resetError };
};
```

A composable:
- A `tripIdRef` reaktív — amikor a user route-ol egy másik trip-re, a `load()` automatikusan újrafut (watch).
- A state 1 db `LoadoutRecommendationsResponse`-ot cache-el, scoped a `tripId`-re.
- A `useStats()` mintát követi: `state.loading` + `state.error` + `state.byTripId[tripId]`.
- **NEM bővíti a `useTrips()`-t** — külön useState namespace (`'loadout-recs'` vs. `'trips'` vs. `'trip-stats'`).

---

## 5. A `pages/trips/[id].vue` módosítása

A módosítás scope-ja minimális:

1. **ÚJ section** a `<template>`-ben, a **Debrief section UTÁN** (line ~1802), még az `isOwnerViewer` gate-en belül:

```vue
<section
  v-if="isOwnerViewer"
  class="loadout-recs-section mt-4 rounded-card border border-blushMid-200 bg-blushLight-50 p-4 shadow-[0_1px_0_rgba(90,69,40,0.04)]"
  data-testid="loadout-recs-section"
  aria-label="Trip-aware loadout"
>
  <header class="mb-3">
    <h3 class="text-sm font-semibold tracking-tight text-espresso-900">
      Trip-aware loadout
    </h3>
    <p class="mt-1 text-xs italic text-umber-500">
      {{ loadoutRecsSubtitle }}
    </p>
  </header>

  <!-- Empty states: meta.readiness alapján -->
  <div v-if="loadoutRecsMeta?.readiness !== 'enough_data'" class="...">
    {{ loadoutRecsEmptyCopy }}
  </div>

  <!-- Két oszlop: add + keep -->
  <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div data-testid="loadout-recs-add">
      <h4 class="text-xs font-bold text-espresso-900">Ajánlott hozzáadni</h4>
      <ul v-if="loadoutRecsAdd.length > 0" class="mt-2 space-y-2">
        <li v-for="rec in loadoutRecsAdd" :key="rec.gear_item_id" class="...">
          {{ rec.name }} ({{ rec.weight_g }} g) — {{ reasonCopy(rec.reason) }}
        </li>
      </ul>
      <p v-else class="mt-2 text-xs italic text-umber-500">
        Nincs új ajánlás — a meglévő trip-ed már a lehető legjobb.
      </p>
    </div>
    <div data-testid="loadout-recs-keep">
      <h4 class="text-xs font-bold text-espresso-900">Ezeket érdemes megtartani</h4>
      <ul v-if="loadoutRecsKeep.length > 0" class="mt-2 space-y-2">
        <li v-for="rec in loadoutRecsKeep" :key="rec.gear_item_id" class="...">
          {{ rec.name }} ({{ rec.weight_g }} g) — {{ reasonCopy(rec.reason) }}
        </li>
      </ul>
      <p v-else class="mt-2 text-xs italic text-umber-500">
        Nincs megerősített item — a trip-ed összes elemét jelöld meg a komfort-értékelésben.
      </p>
    </div>
  </div>
</section>
```

2. **ÚJ state binding** a `<script setup>`-ban:
- `const { state: loadoutRecsState, load: loadLoadoutRecs } = useLoadoutRecommendations(tripId);` (ahol `tripId` a meglévő `computed(() => String(route.params.id))`).
- A `Promise.all([..., loadLoadoutRecs()])` bekerül a meglévő `loadTripBundle`-be (line ~761 mintára, a Phase 5 `loadDebrief`-fel párhuzamosan).
- Computed-ek: `loadoutRecsSubtitle`, `loadoutRecsMeta`, `loadoutRecsAdd`, `loadoutRecsKeep`, `loadoutRecsEmptyCopy`, `reasonCopy(reason)`.

3. **NEM módosítja**:
- A meglévő recap / debrief / picker / invite / participant / photo / GPX szekciók — a Phase 7 egy TISZTA ADDÍció, NEM módosítás.
- A `useTrips()` composable — nem bővül.
- A `useStats()` composable — nem bővül.
- A `gear_items` tábla — nem írunk bele.

---

## 6. Schema + endpoint + page + composable — összefoglaló

| Réteg | Változás | Fájl |
|---|---|---|
| **Séma (Supabase)** | NINCS új migration | — |
| **Endpoint** | ÚJ | `server/api/trips/[id]/loadout-recommendations.get.ts` |
| **Composable** | ÚJ | `composables/useLoadoutRecommendations.ts` |
| **Page** | MÓDOSÍTÁS (1 db új section a debrief után) | `pages/trips/[id].vue` |
| **Típus** | MÓDOSÍTÁS (+ `LoadoutRecommendation`, `LoadoutRecommendationItem`, `LoadoutRecommendationsResponse`) | `types/db.ts` |
| **Middleware** | NINCS — a trips route már védett (`/trips/*` a `middleware/auth.global.ts`-ban) |
| **Nav** | NINCS — a loadout a /trips/:id-n jelenik meg, nem új top-level route |

A Phase 7 **NEM nyúl** semmihez, ami nem a trip detail page-hez tartozik:
- A My Gear page (`pages/gear/index.vue`) NEM módosul.
- A Stats page (`pages/stats/index.vue`) NEM módosul — a loadout a trip-oldalon van, nem a stats-oldalon.
- A `useCategories()` (Phase 1) NEM használja (a loadout nem kategória-szintű).

---

## 7. Acceptance criteria — mérhető ellenőrzés (QA hook)

1. **Endpoint auth**: anonymous `GET /api/trips/:id/loadout-recommendations` → 401.
2. **Endpoint owner-only**: A trip user_id !== caller → 404 (RLS denial surface).
3. **Recommender correctness (sample)**: 3 túra + 2 debrief + 5 comfort-rated item → top-N ajánlás a scoring formulával konzisztens, `reason` mező helyesen töltődik.
4. **Empty state - no_trips**: 0 trip → `meta.readiness === 'no_trips'`, UI copy a §2.6 alapján.
5. **Empty state - no_debriefs**: trip van, debrief nincs → `meta.readiness === 'no_debriefs'`.
6. **Empty state - no_comfort**: van trip + debrief, de < 3 comfort item → `meta.readiness === 'no_comfort'`.
7. **Empty state - enough_data**: top-6 add + top-6 keep lista megjelenik, a section a trip detail page-en, NEM modal.
8. **NINCS ML, NINCS starter pack**: a scoring formula kizárólag a user saját adataiból dolgozik, NEM használ külső API-t, NEM tanul.
9. **NINCS publikus route**: az endpoint kizárólag signed-in user-eknek elérhető, 401 anonymous.
10. **NINCS My Gear módosítás**: a loadout nem ír a `gear_items` táblába, csak olvassa.

---

## 8. Decisions log (Architect, ebben a fázisban)

A Phase 7 spec-et a user (Senior UI Designer) jóváhagyta a Trello kártyán. Az alábbi döntések az Architect hatáskörébe tartoznak (3-szintű szabály 2-es szint):

1. **Recommender formula**: `(comfort_score - 1) / 4 × 0.6 + (1 - excess_rate) × 0.4`, max 1.0.
   - Indoklás: a comfort-értékelés a user szubjektív adata (Phase 5, magas megbízhatóság), az excess-rate a user-bevitel text[] (Phase 5, magas megbízhatóság). A kettő súlyozása 60-40, mert a comfort a "pozitív" item-signal, az excess a "negatív".
2. **Top-N=6 (3 + 3 kártya)**: az UI 2 oszlopban (md:grid-cols-2) jeleníti meg az add + keep listákat, oszloponként max 3 item (a Phase 4 vizuális súly-bontás mintája: 3-col grid a tömörség kedvéért).
   - Indoklás: a 6+6 túl zsúfolt lenne, a 2+2 túl kevés. A 3+3 = "elég hogy legyen választék, nem sok hogy elriasztó legyen".
3. **Section pozíció: a Debrief section UTÁN, még az `isOwnerViewer` gate-en belül**.
   - Indoklás: a debrief az adatforrás (a user frissen írhatja be a felesleges itemeket), a loadout az adatfelhasználó. A logikai sorrend: adatgyűjtés (debrief) → ajánlás (loadout). A recap (publikus résztvevőknek szól) a section felett marad.
4. **Csak `excess_items`-t használunk a scoringban** (NEM `uncomfortable_items`-t, NEM `missing_items`-t).
   - Indoklás: az "ajánlott hozzáadni" logikailag a "NE hozz túl sokat" elvet követi, tehát a felesleges-itemeket büntetjük. A "kényelmetlen" és "hiányzó" itemek a Phase 8+ "weather-aware" / "use-case-specific" kiterjesztés alapjai (v2 §0 #4: séma-szintű jövő-biztosítás).
5. **A dedikált composable a `useTrips` / `useStats` bővítése HELYETT**.
   - Indoklás: a loadout 4 forrásból aggregál (trip + trip_gear + gear_items.comfort + trip_debriefs), a useTrips 3-ból (trip + trip_gear + gear base weight), a useStats 4-ből de user-szinten (nem trip-szinten). A dedikált composable a Phase 6 useStats mintát követi.
6. **Nincs új utility class, nincs új MemoFox token**.
   - Indoklás: a Phase 7 a meglévő `.rounded-card`, `.btn-primary`, `.input`, `.text-umber-500`, `.bg-blushLight-50` osztályokat használja (MemoFox design system, Phase 1–4).
7. **A scoring kizárólag a user saját adataiból dolgozik (NEM használ cross-user aggregációt)**.
   - Indoklás: a v2 §0 #5 szigorúan user-szintű. A "community wisdom" / "mások ezt vitték" feature = Phase 8+ backlog.

---

## 9. Open questions (a PO/Designer hatásköre a Phase 7 implementáció előtt)

Nincs explicit nyitott kérdés — a Trello kártya leírása és a v2 §0 elvek egyértelműek. Az alábbi L2 micro-decisions a Full-stack / Designer implementáció során dőlnek el (copywriting-finomítás, threshold-számok):

- A `reasonCopy()` szövege (pl. `"Magas komfort, alacsony felesleg-előfordulás"` vs. `"Korábbi túráidon is bevált"`).
- A `recommendation_score >= 0.5` küszöb (lehet 0.4-re vagy 0.6-ra is hangolni a user-jóváhagyás után, ha az UI túl zsúfolt / túl ritka).
- A `top-N=6` érték (az Acceptance #7 UI-sűrűség alapján finomítható).

Ezeket a Full-stack + Designer round a saját hatáskörében dönti el (3-szintű szabály 2-es szint), NEM kell user-jóváhagyás.

---

## 10. Rollback-út (orphan-komponensek + diff-méret)

A Phase 7 minimális diff-et hagy:

- **ÚJ fájlok** (4 db): `server/api/trips/[id]/loadout-recommendations.get.ts`, `composables/useLoadoutRecommendations.ts`, `LoadoutRecommendation` típusok a `types/db.ts`-ben (insert, nem replace), a `pages/trips/[id].vue` új section (insert, nem replace).
- **NINCS fájl-törlés** a Phase 7-ben — minden fájl megmarad, csak a meglévő `pages/trips/[id].vue` és `types/db.ts` bővül.
- **Rollback**: `git revert <phase-7-commit-sha>` — 1 db revert commit, ~250 sor diff visszafordítása.

A rollback kockázata alacsony, mert:
- A Phase 7 endpoint egy N+1-free SELECT 3-as lanc; ha lassú lenne, a scoring formula `O(N)` a user-gear-listára (max néhány száz item).
- A section megjelenése a `loadout-recs-section` data-testid-jén ellenőrizhető; ha a UI nem tetszik, a section egy `v-if="false"`-szal kikapcsolható a `pages/trips/[id].vue`-ban, az endpoint maradhat (read-only, NEM okoz inkonzisztens state-et).

---

## 11. Out of scope (explicit lista)

A Phase 7 szándékosan NEM foglalkozik:

- ❌ Weather-aware loadout (a jövőbeli Phase 8+ külső API integráció).
- ❌ "Mások ezt vitték" / community wisdom (cross-user aggregáció, Phase 8+).
- ❌ Push-notification, ha új ajánlás érhető el (valós idejű értesítés, v2 §0 #3 tiltja).
- ❌ A scoring formula online-learninggel történő testreszabása (ML, v2 §0 #3 tiltja).
- ❌ Új trip-rekord automatikus létrehozása (a Phase 7 read-only a trip-en).
- ❌ My Gear lista módosítása a loadout alapján (a user manuálisan veszi fel a gear-itemeket, a loadout csak JELZI, NEM tölti fel).
- ❌ A `recommendation_score` szerinti rendezés a My Gear listán (a My Gear marad időrendben, a loadout nem ír a listába).
- ❌ Többnyelvűség (HU/EN) a reasonCopy-nál — HU-only, ahogy az egész app.
- ❌ A score magyarázó tooltip (Phase 7-ben a `reason` mező inline megjelenik, NEM modal/tooltip).

---

## 12. A v2 §0 elvek leképezése — táblázat (Összefoglaló)

| Elv | Spec szakasz | Megvalósulás |
|---|---|---|
| **1. elv** — valós adat > feltételezés | §2.2, §2.4 | A scoring a user VALÓDI gear + trip + comfort + debrief adataiból számít. Nincs "starter pack" vagy "default recommendation". |
| **2. elv** — onboarding-súrlódás minimalizálás | §2.6 | A 4-féle empty state mindegyike CTA-stílusú ("Töltsd ki a Debrief-et, hogy ..."), NEM új formot kér. |
| **3. elv** — ne niche, ne ML | §2.4, §8 #1 | A scoring formula egyszerű, transzparens, magyarázható. Nincs ML, nincs forecast. |
| **4. elv** — séma-szintű jövő-biztosítás olcsó | §0, §2.3 | Nincs új migration; a Phase 5–6 meglévő tábláit használjuk. A Phase 8+ weather-aware loadout a `reason` mező és a `comfort_score` struktúrára épülhet. |
| **5. elv** — Trip ≠ My Gear | §0, §4, §5 | A Phase 7 kizárólag a Trip-oldali ajánlás-szekció. A My Gear lista NEM módosul. A dedikált composable a useTrips/useStats bővítése HELYETT. |

---

## 13. Handoff (a Phase 7 után)

A Phase 7 lezárása a Sprint 4 végét jelenti. A parent-agent a QA jóváhagyás után:

1. **Full-stack** implementáció a §2-§5 spec alapján (4 db új fájl + 2 db módosítás).
2. **Designer** review (MemoFox token-ek alkalmazása a section-ön, copy-véglegesítés).
3. **QA** sub-agent: az Acceptance §7 10 pontját ellenőrzi (auth, owner-only, recommender correctness, 4 empty state, no-ML, no-public, no-My-Gear-modification).
4. **Domain Director** + user-jóváhagyás a `[deploy]` commit scope-hoz.
5. A `[deploy]` commit-et lásd §15-ben.

A Sprint 5 backlogja a "weather-aware loadout" (cross-API integráció, 3-as szintű user-döntés) és a "Trip-aware loadout v2" (multi-day, multi-trip optimalizálás) feature-öket tartalmazza — ezek a Phase 7-re épülnek, de nem részei a Sprint 4-nek.

---

## 14. Trello-paste blokk (a parent-agent által postolandó)

A Phase 7 Trello kártya (`6a806304b982e5f94b14e58d`) a **parent-agent** hatásköre (a sub-agent NEM postol kommentet, csak a specifikációt készíti elő). A Trello-paste-ready blokk:

```
Sprint 4 — Phase 7: Trip-aware loadout (#22) — Architect spec (UTOLSÓ phase)

Döntések (Architect hatáskör, 3-szintű szabály 2-es szint):
1. Recommender formula: (comfort_score - 1)/4 × 0.6 + (1 - excess_rate) × 0.4, max 1.0
   - Indoklás: comfort 60% (pozitív item-signal), excess 40% (negatív item-signal);
     a user-bevitel adatok (Phase 5) magas megbízhatóságúak, ezért a formula
     transzparens és magyarázható (a "reason" mező ezt adja vissza).
2. Top-N=6 (3 + 3 kártya) a UI-ban
   - Indoklás: 3-col grid a Phase 4 vizuális súly-bontás mintája; 6+6 túl zsúfolt,
     2+2 túl kevés.
3. Section pozíció: Debrief UTÁN, még az isOwnerViewer gate-en belül
   - Indoklás: a debrief az adatforrás (Phase 5), a loadout az adatfelhasználó;
     logikai sorrend: adatgyűjtés → ajánlás.
4. Csak excess_items-t használunk a scoringban (NEM uncomfortable / NEM missing)
   - Indoklás: az "ajánlott hozzáadni" logikailag a "NE hozz túl sokat" elvet
     követi; a kényelmetlen/hiányzó itemek a Phase 8+ weather-aware / use-case
     kiterjesztés alapjai.
5. Dedikált composables/useLoadoutRecommendations.ts (NEM useTrips/useStats bővítés)
   - Indoklás: a loadout 4 forrásból aggregál (trip + trip_gear + comfort +
     debrief); a Phase 6 useStats mintát követi, dedikált useState namespace.
6. Nincs új utility class, nincs új MemoFox token
   - Indoklás: a meglévő .rounded-card / .btn-primary / .input / .bg-blushLight-50
     osztályok elegendőek.
7. Nincs cross-user aggregáció
   - Indoklás: v2 §0 #5 szigorúan user-szintű; community-stats = Phase 8+.

Komponensek:
- ÚJ: server/api/trips/[id]/loadout-recommendations.get.ts (3 db SELECT,
  rule-based scoring, 4-féle empty state)
- ÚJ: composables/useLoadoutRecommendations.ts (dedikált, useState namespace
  'loadout-recs', $fetch wrapper)
- ÚJ: pages/trips/[id].vue új <section data-testid="loadout-recs-section">
  a Debrief section UTÁN, még az isOwnerViewer gate-en belül (NEM modal)
- MÓDOSÍTÁS: types/db.ts (+ LoadoutRecommendation, LoadoutRecommendationItem,
  LoadoutRecommendationsResponse)
- ÉRINTETLEN: pages/gear/index.vue, pages/stats/index.vue, useTrips(),
  useStats(), useCategories(), server/api/trips/{debrief,recap,comments,...},
  supabase/migrations/* (NINCS új migration)
- NINCS fájl-törlés.

Acceptance criteria (10 mérhető, QA-hook):
1) 401 anonymous; 2) 404 RLS-denied trip; 3) recommender correctness (sample);
4) no_trips state; 5) no_debriefs state; 6) no_comfort state; 7) enough_data
top-6+top-6; 8) NINCS ML; 9) NINCS publikus route; 10) NINCS My Gear módosítás.

Specifikáció teljes terjedelme: docs/sprint-4-phase-7-trip-aware-loadout.md
[deploy] commit scope (QA jóváhagyás után): lásd §15 a spec fájlban.
next: Full-stack implementation (a parent-agent QA workflow része).
```

**Megjegyzés a parent-agent számára:** a fenti blokk a spec §0–§13 + §14 alapján készült. A Trello kártya (`6a806304b982e5f94b14e58d`) a Backlog-ban van (idList `6a7c443d9bfe1b40a1dca541`), NINCS rajta role-label. A parent-agent a sub-agent Trello-write recipe (trello-board-workflow §13.2) alapján postolja a commentet.

---

## 15. A `[deploy]` commit scope (a QA jóváhagyás UTÁN)

A Vercel-deploy trigger a parent-agent munkafolyamat része. A `[deploy]` commit várható:

```
feat(loadout-recommendations): Phase 7 Trip-aware loadout (#22) — UTOLSÓ phase

Endpoint:
- server/api/trips/[id]/loadout-recommendations.get.ts: NEW
  + GET /api/trips/:id/loadout-recommendations (owner-only, 401 anonymous)
  + 3 db RLS-aware SELECT (trips+trip_gear, gear_items, trip_debriefs)
  + Rule-based scoring: (comfort_score - 1)/4 × 0.6 + (1 - excess_rate) × 0.4
  + 4-féle empty state readiness: no_trips / no_debriefs / no_comfort / enough_data
  + Top-N=6 (3 add + 3 keep) javaslat

Composable:
- composables/useLoadoutRecommendations.ts: NEW
  + useLoadoutRecommendations(tripIdRef) — dedikált, NEM useTrips/useStats
    bővítése (v2 §0 #5 szigorúan)

Page:
- pages/trips/[id].vue: MÓDOSÍTÁS
  + ÚJ <section data-testid="loadout-recs-section"> a Debrief section UTÁN,
    még az isOwnerViewer gate-en belül (NEM modal)
  + Computed-ek: loadoutRecsSubtitle, loadoutRecsMeta, loadoutRecsAdd,
    loadoutRecsKeep, loadoutRecsEmptyCopy, reasonCopy(rec.reason)
  + A loadLoadoutRecs() bekerül a loadTripBundle Promise.all-ba

Types:
- types/db.ts: + LoadoutRecommendation, LoadoutRecommendationItem,
  LoadoutRecommendationsResponse

#22-Trip-aware-loadout — v2 §0 #1, #2, #3, #4, #5
```

A commit **MOST NEM JÖN LÉTRE** — a parent-agent QA workflow-ja (a Phase 1–6 mintára) hozza létre, miután a user/PO jóváhagyta a specifikációt és a QA kipipálta a 10 acceptance criteria-t.
