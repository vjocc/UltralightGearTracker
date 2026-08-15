# Sprint 4 — Phase 4: Vizuális súly-bontás (#20) Architect Spec

**Author:** Architect (role:architect)
**Date:** 2026-08-15
**Source of truth:** `docs/product-architecture-v2.md` §"Javasolt Sprint 4 fókusz" #20 + §0 döntési elvek
**Phase context:** Sprint 4 4. fázis (a Phase 1 = categories-globalize @ `1802b98`, Phase 2 = onboarding @ `44ed0d5`, Phase 3 = publikus gear-lista @ `c5438da` már merge-ölve master-re)
**Worktree:** `ultralight-gear-tracker` branch `master` (a `design-pass` a kanonikus design forrás, most a `main` SHA-nál `c5438da`)
**Trello kártya:** `6a7f5148839f8d1b8387b275` (Phase 4 #20 vizuális súly-bontás) — **ellenőrzés: a megadott ID jelenleg 404 a Trello API-ból; ha a card még nem létezik, a specifikáció ezen a fájlon érhető el, a card megnyitása a user/parent-agent hatásköre**
**Implementáció tiltva:** ez a fájl csak TERV. A `feat/...` branch és a `[deploy]` commit a parent-agent QA jóváhagyása után jöhet.

---

## 0. Scope-pivot emlékeztető (3-szintű szabály: Phase 4 = 2-es szintű)

A Phase 4 egy **2-es szintű hatáskör**:
- **Dokumentált** (ez a fájl) + **jóváhagyott sorrend** (a v2 §"Javasolt Sprint 4 fókusz" sorrend: 1 → 4 → 2 → 19,20 → 21,23 → 24 → 22, azaz Phase 4 az 5. lépés).
- **Nincs új scope / config / credential**: a meglévő `gear_base_weights_view`, `useGear()`, `useBaseWeight()` composable-ok és a `server/api/gear/base-weight.get.ts` endpoint használhatók.
- **NEM public adat-expozíció**: a chart a bejelentkezett user SAJÁT gear-listáját bontja. Publikus nézet (Phase 3, `/list/{token}`) NEM kap chartot — a publikus nézet a Phase 3 spec-et zárta, ezt a Phase 4 nem bővíti.

**[deploy] commit szabály** (új user-Vercel-szabály): a `feat(visual-weight):` commit a parent-agent által végzett QA **UTÁN** jöhet. A QA a Phase 1/2/3 mintára: per-page renderelt Chart ellenőrzés mobil + desktop nézetben, RLS-alatti user adattal töltve.

---

## 1. Cél és a v2 §0 elvek leképezése

| v2 §0 elv | Phase 4 megvalósulása |
|---|---|
| **#1 Valós felhasználói adat > feltételezés** | A chart a felhasználó SAJÁT gear-listájából aggregál, NINCS mock/demo adat. Ha a user 0 item-et vitt fel, a chart "üres" (a `BaseWeightSummary` "Még nincs gear item-ed" copy-ját örökli — a Phase 4 NEM vezet be új üres állapotot). |
| **#2 Minimalizáld az onboarding-súrlódást** | A chart AUTOMATIKUSAN generálódik a meglévő `per_category` aggregációból; a user NEM adat bevitelt, NEM döntést, NEM új formot kap — a chart pusztán a `BaseWeightSummary` alá kerül, mint passzív vizualizáció. |
| **#3 Ne épülj be niche-igényre** | Phase 4-ben készül (most). A chart a legnagyobb, legkisebb, százalékos arányokat mutatja — nincs forecast, nincs Trip-ajánlás, nincs "csomag-tipp" (ezek Trip-aware #22-be tartoznak). |
| **#4 Séma-szintű jövő-biztosítás olcsó, UI/logika-szintű nem** | **NINCS új migration.** Nincs új view, nincs új mező. A chart view-query-ja a meglévő `gear_base_weights_view`-ra épül, kiegészítésként: a `per_category` aggregáció immár `percent` + `color_token` mezőkkel egészül ki (UI-szint, olcsó, későbbiekben is kompatibilis). |
| **#5 Trip ≠ My Gear** | A chart **kizárólag a My Gear (per-user) base weight-jét** bontja. A `trips` tábla, a `trip_items`, a `TripWeightSummary` NEM érintett. A publikus `/list/{id}` route-on NEM jelenik meg chart. |

**További, implicit elv:** a Phase 4 **REUSE-el**, nem duplikál. A meglévő `useBaseWeight()` composable-ból olvas (mint a `BaseWeightSummary.vue`), és a meglévő `server/api/gear/base-weight.get.ts` endpoint-ot EGÉSZÍTI ki (a `per_category` tömb bővítése), nem hoz létre `server/api/gear/weight-breakdown.get.ts`-t (az új endpoint felesleges lenne, a meglévő struktúra már aggregációra van szánva).

---

## 2. A komponens neve, helye, életciklusa

### 2.1 Név + hely

- **Új komponens**: `components/WeightBreakdownChart.vue` — kizárólag a vizuális bontásért felelős.
- **Helye**: a `pages/gear/index.vue` page-en, a **meglévő `<BaseWeightSummary />` alatt** (a `pages/gear/index.vue` jelenlegi 268. sora után), az `ErrorBanner` előtt. A `BaseWeightSummary` általános összeg-blokk (total + excluded), a chart a kategóriánkénti bontás.

### 2.2 Mikor jelenik meg

- A `BaseWeightSummary` `isEmpty` állapotában (0 item) a chart **NEM renderelődik** (a meglévő `<template v-else-if="perCategory.length > 0">` minta alapján). A Phase 4 nem vezet be új üres-chart állapotot.
- A `BaseWeightSummary` `pending` (skeleton) állapotában a chart 3 soros skeleton (a `BaseWeightSummary` analógiájára: 3 animált placeholder sor `h-3 w-full rounded bg-gray-100`).
- A `BaseWeightSummary` `error` állapotában a chart nem renderelődik (a summary inline error message-je tájékoztat).
- A `BaseWeightSummary` `populated` (perCategory.length > 0) állapotában a chart teljes nézetben megjelenik.

### 2.3 A chart típusa: HORIZONTAL BAR (nem kördiagram)

A v2 spec a "sáv/kördiagram" alternatívát ad; a **HORIZONTAL BAR** a választás, három indokkal:

1. **Kategorikus összehasonlítás** — a horizontal bar az, ahol a user a kategóriák sorrendjét (grams DESC, ahogy a `BaseWeightSummary` rendezi) és relatív súlyát egy pillantással összehasonlítja. Kördiagramnál ez nehezebb.
2. **Hosszú kategórianevek** — a MemoFox palette egy "warm/playful" voice-ot jelöl, ahol a kategória-nevek (pl. "Food & Water", "Electronics", "Personal organization") hosszabbak, mint amennyi egy kördiagram-szelet melletti label-be férne. A horizontal bar a label-t a sor elején hagyja, a hosszúságot pedig a sor hossza kódolja — label nincs levágva.
3. **Accessibility** — egy horizontal bar-chart könnyen olvasható screen-reader-rel (lineáris olvasat: kategória → százalék → gramm), a kördiagramé nem.

**Indoklás a Phase 4 Trello-kártyán rögzítendő**: a v2 két opciót adott (sáv VAGY kör), és a választás nemzetközileg elfogadott UX-hez kötődik (a horizontal bar a "comparing category sizes" use case-re a Tableau/Datawrapper-style default, lásd: https://www.datawrapper.de/blog/chart-types).

### 2.4 Mikor hívja a meglévő API-t

A komponens a `useBaseWeight()` composable-ból olvas, **pontosan úgy, ahogy a `BaseWeightSummary.vue`** — ugyanaz a `perCategory` ref, ugyanaz a `totalGrams` ref. A chart NEM hív saját endpointot, NEM hív `$fetch`-et. A frissítés a `refreshNuxtData('base-weight')` meglévő triggerén át jön (a `useGear` mutációk ezt már hívják).

---

## 3. Schema + endpoint változás

### 3.1 A `server/api/gear/base-weight.get.ts` kiegészítése

**Döntés: a meglévő endpoint kiegészítése, NEM új endpoint.** Az endpoint már amúgy is 2 lekérdezést futtat (totals + per-category); a Phase 4 egyetlen, minimális kiegészítés: a `per_category` tömb elemei kapnak két új mezőt.

```ts
// A jelenlegi per_category elem:
//   { category_id, category_name, grams, item_count }

// A Phase 4 után:
//   { category_id, category_name, grams, item_count,
//     percent: number,        // 0-100, round(grams/total_grams * 100, 1)
//     color_token: string }   // MemoFox palette kulcsszó, lásd 3.2
```

A `percent` mező számítása a kiszolgáló-oldali aggregáció UTÁN, a response összeállításakor történik (1 sort ad hozzá a `per_category` építő ciklushoz). A `total_grams` referencia ugyanabból a requestből jön; ha `total_grams === 0`, minden `percent: 0` (a védelmet a meglévő `isEmpty` adja, de a 0-val osztás defenzíve le van kezelve).

### 3.2 A `color_token` — MemoFox palette leképezés

A Phase 4 a MemoFox 5 színéből (`brand, espresso, ember, moss, umber` — a tailwind.config.js-ben élő brand tokenek) determinisztikus leképezést használ. A leképezés **kiszolgáló-oldali**, a kategória-id alapján (hash-előtte nem kell — a rendezés sorrendje is stabil: a 0. elem a legnagyobb kategória, az 1. a második, stb.):

| Sorrend index | MemoFox token | Hex (MemoFox §2.1) | UX szerep |
|---|---|---|---|
| 0 (legnagyobb) | `brand` (brand-500) | `#7936EB` | Akcentus — "ez a te legnagyobb kategóriád" |
| 1 | `ember` (ember-500) | `#EB5D36` | Meleg narancs — második akcentus |
| 2 | `moss` (moss-500) | `#867E36` | Olivazöld — semleges, súly-tónus |
| 3 | `umber` (umber-500) | `#573933` | Sötét-barna — közepes kategória |
| 4+ | `espresso` (espresso-300 → 500-ig forgó) | `#...` színskála | További kategóriák |

**A `color_token` megvalósítása**: a Phase 4 implementációban egy `MEMOFOX_CHART_PALETTE = ['brand', 'ember', 'moss', 'umber', 'espresso']` tömb, és az index `i % palette.length` számít (ciklikus). Ez azért szerver-oldali, mert a hydration-konzisztencia fontos (a client ugyanazt a színt kapja, mint amit a server renderel).

A tényleges hex érték a Tailwind class-en át jön (`bg-brand-500`, `bg-ember-500`, stb.) — a `color_token` csak a kulcsszó, a `<div class="bg-${color}-500">` köti össze.

### 3.3 A `BaseWeightPerCategory` interface bővítése

A `composables/useBaseWeight.ts` fájlban:
```ts
export interface BaseWeightPerCategory {
  category_id: string;
  category_name: string | null;
  grams: number;
  item_count: number;
  // Phase 4 hozzáadva:
  percent: number;
  color_token: string;
}
```
Ez a TypeScript-szintű bővítés; mivel az interface a `composables/useBaseWeight.ts`-ban van definiálva és a composable-ban van felhasználva, a `BaseWeightSummary` is megkapja — ott nem kell használni, de a típus kompatibilis marad.

### 3.4 Ami NEM történik

- **Nincs új SQL view**, **nincs új Postgres function**. A `gear_base_weights_view` (Phase 1) változatlan.
- **Nincs új utility class**. A `formatGrams()` a meglévő függvény, a Phase 4 nem ír újat.
- **Nincs új endpoint** (`weight-breakdown.get.ts` nem jön létre).

---

## 4. A `WeightBreakdownChart.vue` komponens — belső struktúra

### 4.1 Szkript (Terv)

```ts
// useBaseWeight() ugyanaz, mint a BaseWeightSummary-ban — REUSE
const { perCategory, pending, error } = useBaseWeight();

// Belső state: a chart reordered a baseweight summary-vel szinkronban:
// a base weight summary ASC/DESC toggle-ja opcionálisan szűrő a chart-ra
// (Phase 4 kezdetben: csak a grams DESC-et mutatja, ahogy a base weight
// summary alapértelmezettje; későbbi fázisban a sortDir prop-pal
// összeköthető, de ez a Phase 4 scope-on kívül esik).

const sorted = computed<BaseWeightPerCategory[]>(() =>
  [...perCategory.value].sort((a, b) => b.grams - a.grams)
);
```

### 4.2 Template (Terv — MemoFox tokenekkel)

```
┌─────────────────────────────────────────────────────────────────┐
│  Súly eloszlása kategóriánként                                  │
│                                                                 │
│  Shelter ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 4 210 g  │
│          brand-500         32%                                    │
│                                                                 │
│  Sleep   ●━━━━━━━━━━━━━━━━━━━━ 2 980 g                          │
│          ember-500         22%                                    │
│                                                                 │
│  Pack    ●━━━━━━━━━━━━━━━━━━ 2 540 g                            │
│          moss-500          19%                                    │
│                                                                 │
│  Cooking ●━━━━━━━━━━━━━ 1 870 g                                │
│          umber-500        14%                                    │
│                                                                 │
│  …                                                              │
│                                                                 │
│  Összesen: 13 120 g · 5 kategória                                │
└─────────────────────────────────────────────────────────────────┘
```

**Részletek**:
- **Cím**: `font-display font-bold text-espresso-900` (MemoFox §3.1)
- **Minden sor**:
  - Bal: a kategória neve, `font-body text-espresso-900` 
  - Középen: a horizontal bar — `<div class="relative h-2 w-full rounded-full bg-espresso-900/10">` belsejében egy kitöltött `<div class="absolute left-0 top-0 h-2 rounded-full bg-{color_token}-500" :style="{ width: cat.percent + '%' }">`
  - Jobb: a gramm (`tabular-nums`), és alatta a százalék (`text-xs text-espresso-900/70`)
- **Sortávolság**: `space-y-2.5`, minden sor `py-2` (olyan, mint a BaseWeightSummary listája)
- **Összegzés**: alul `text-sm font-medium text-espresso-900/80` — "Összesen: X g · Y kategória" (ahol Y = perCategory.length)
- **Background**: `rounded-card border border-gray-200 bg-white p-4` (a `BaseWeightSummary` analógiájára — vizuális konzisztencia)
- **Sticky**: a `BaseWeightSummary` NEM sticky a chart-tal együtt, mert a chart magasabb, és a sticky-scroll UX-t roncsolná (a BaseWeightSummary `sticky top-16` tulajdonsága megmarad, a chart külön sectionként renderelődik alatta, NEM sticky)

### 4.3 Tooltip / hover állapot (MemoFox "playful" voice)

A chart sorai `hover:bg-espresso-900/5` highlight-ot kapnak, és a hover-állapotban egy kis "X item · Y g / Z%" tooltip jelenik meg a sor jobb szélén (CSS-only, nincs JS).

### 4.4 Responsive viselkedés

- **Desktop** (≥ 768px): a chart full-width, a bar-ok és a label-ek egy sorban.
- **Mobil** (< 768px): a chart ugyanúgy full-width, de a sáv-rész kisebb, és a gramm + százalék a sor alatt jelenik meg (egy kis "wrap"); a horizontal bar-ok megmaradnak (NEM stack-elünk vertical-ra). A label `truncate` 1 sorban max, a `category_name` hosszabb nevét a BaseWeightSummary-vel azonos logikával vágjuk.

### 4.5 Üres + pending + error állapotok

- **Üres** (perCategory.length === 0): a chart NEM renderelődik (a `pages/gear/index.vue` `v-if`-je őrzi).
- **Pending**: 3 soros skeleton (h-3, animált placeholder).
- **Error**: a chart NEM renderelődik, a `BaseWeightSummary` inline error message-je tájékoztat.

---

## 5. A `BaseWeightSummary.vue` módosítása (kiegészítés)

A meglévő `BaseWeightSummary.vue` **NEM kerül refaktorra**. A Phase 4 egyetlen, kis módosítása:

- A `useBaseWeight()`-ból a `percent` és a `color_token` mezőkre NEM vagyunk kíváncsiak a summary-ban — a summary továbbra is az eredeti listát mutatja (név + gramm + item_count), a chart-ban kapnak szerepet a szín/százalék.
- A summary `sortLabel` szövege ("gramm DESC" / "gramm ASC") a jövőben opcionálisan propagálható a chart-ra, de a Phase 4 nem terjeszti ki — a chart fix grams DESC.

**A `pages/gear/index.vue` egyetlen módosítása** (az 1-soros template-bővítés): a `<BaseWeightSummary />` után:

```vue
<WeightBreakdownChart
  v-if="perCategory.length > 0 || pending"
  aria-labelledby="weight-breakdown-heading"
/>
```

(A `perCategory`/`pending` feltételt a chart komponensen belül is meg lehetne oldani; itt a `pages/gear/index.vue`-ben a `showOnboarding` mintájára explicitáljuk a renderelési kaput, hogy a chart ne renderelődjön üres állapotban.)

---

## 6. A `pages/trips/[id].vue` módosítása — explicit NEM

A `pages/trips/[id].vue` TripWeightSummary-ja a trip-specifikus aggregációt mutatja (trip_items tábla). A Phase 4 **NEM módosítja** a TripWeightSummary-t, és **NEM vezet be chartot a Trip-page-en** — a v2 §0 #5 elv kimondja, hogy a Phase 4 a My Gear kivetítése, NEM a Trip rekordé. A publikus `/list/{id}` sem kap chartot (Phase 3 lezárt scope, public data exposure).

---

## 7. Acceptance criteria — mérhető ellenőrzés (QA hook)

A Phase 4 Trello kártya leírása + ez a fájl alapján a QA 6 mérhető feltételt ellenőriz (per-user, RLS alatt):

1. **Kategóriánkénti horizontal bar** — minden kategória egy sor, grams DESC rendezéssel, a legsúlyosabb legfelül.
2. **Százalékos megjelenítés** — minden sorban `X%` látható, kiszolgáló-oldali `percent` mezőből (round 1 tizedes).
3. **MemoFox palette** — a sávok a `brand`/`ember`/`moss`/`umber`/`espresso` 5 körül forgó skálát használják, sorrendben.
4. **Responsive** — mobil (375px) és desktop (1280px) viewport-on is jól olvasható.
5. **Total + per_category summary** — a chart alatt a teljes base weight + a kategóriák száma megjelenik.
6. **Reuse** — a `useBaseWeight()` composable-ból olvas; nincs új `useFetch`/`$fetch` a chart-ban, nincs új endpoint, nincs duplikált aggregáció.

A QA a `[deploy]` commit előtt fut le (parent-agent hatáskör).

---

## 8. A `[deploy]` commit scope (a QA jóváhagyás UTÁN)

A Vercel-deploy trigger a parent-agent munkafolyamat része. A `[deploy]` commit várható:

```
feat(visual-weight): Phase 4 vizuális súly-bontás (#20)

- server/api/gear/base-weight.get.ts:
  + percent + color_token mezők a per_category elemeken
- composables/useBaseWeight.ts:
  + BaseWeightPerCategory interface bővítés (percent, color_token)
- components/WeightBreakdownChart.vue: NEW
- pages/gear/index.vue:
  + <WeightBreakdownChart /> a <BaseWeightSummary /> alatt
- docs/sprint-4-phase-4-visual-weight-breakdown.md: NEW (Architect spec)

#20-vizuális-súly-bontás — v2 §0 #1, #2, #4, #5
```

A commit **MOST NEM JÖN LÉTRE** — a parent-agent QA workflow-ja (a Phase 1/2/3 mintára) hozza létre, miután a user/PO jóváhagyta a specifikációt és a QA kipipálta a 6 acceptance criteria-t.

---

## 9. Decisions log (Architect, ebben a fázisban)

| # | Döntés | Indoklás |
|---|---|---|
| 1 | A `server/api/gear/base-weight.get.ts` kiegészítése, nem új endpoint | A meglévő endpoint már aggregál; a `percent` + `color_token` 1-2 sor kiegészítés. Új endpoint duplikáció lenne (v2 §0 #2 "minimális súrlódás"). |
| 2 | Horizontal bar a kördiagram helyett | Kategóriás összehasonlításra a horizontal bar az industry default; hosszú kategórianevek jobban olvashatók; screen-reader-barát. |
| 3 | A `color_token` kiszolgáló-oldali, nem kliens-oldali | Hydration-konzisztencia (SSR → CSR); a MemoFox palette sorrendje determinisztikus a kategória-sorrend alapján. |
| 4 | A `pages/gear/index.vue` 1-soros módosítás (insert a chart) | Nem refaktoráljuk a page-et; a chart komponens önálló, a BaseWeightSummary-t nem bántjuk. |
| 5 | Nincs tooltip-komponens, csak CSS hover | A Phase 4 minimális scope; a hover-only tooltip 8 sor CSS-sel megoldható, nem kell külön lib. |
| 6 | A publikus `/list/{id}` NEM kap chartot | A v2 §0 #5 elv explicit; a public data exposure kerülendő (3-szintű szabály). |

---

## 10. Open questions (a PO/Designer hatásköre a Phase 4 implementáció előtt)

1. **A kategória-sorrend UX-e**: a user által rendezhető legyen (drag), vagy maradjon fix grams-DESC? A Phase 4 a fix grams-DESC-et választja (a BaseWeightSummary-val konzisztens), de a user kérésére a `pages/gear/index.vue` `sortDir` prop-pal összeköthető.
2. **A "egyéb / Uncategorized" sor** — ha egy itemnek nincs kategóriája (a `gear_base_weights_view` biztosítja, hogy a per_category aggregáció kihagyja), de a teljes base weight-ba beleszámít; a chart NEM mutatja, csak a summary-n keresztül látszik. Ez a Phase 4 viselkedése; ha a PO kéri, egy "Egyéb" bucket-et hozzáadunk.
3. **A `color_token` skála 5 eleme vs. több**: a Phase 4 5-ös palettát használ (brand/ember/moss/umber/espresso); ha a user 6+ kategóriát visz fel, az ismétlődés Ciklikusan történik. Ez a MemoFox palette 5 fő színét használja — ha a PO kéri, a skála 8-ig bővíthető (gomb hozzáadása nélkül, csak új szín-kulcsszóval).
