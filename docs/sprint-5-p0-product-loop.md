# Sprint 5 — P0 Product Loop v1 (Architect spec, egységes)

**Author:** Architect (role:architect)
**Date:** 2026-08-16
**Source of truth:** `docs/product-architecture-v2.md` §0 döntési elvek + a Sprint 5 P0.1 / P0.2 / P0.3 Trello-kártyák leírásai.
**Branch / SHA:** `master` @ `0a262b3` (a `design-pass` branch a kanonikus design forrás, most ezen a SHA-n).
**Trello-kártyák:**
- P0.1 Debrief UX fix — `6a80e641720faa5874f56aaf` (Backlog, `idList=6a7c443d9bfe1b40a1dca540`)
- P0.2 My Gear finomítás — `6a80e6426acee2df605e45ab` (Backlog)
- P0.3 Activation funnel mérés — `6a80e6438af56d56df99fa20` (Backlog)
**Implementáció tiltva:** ez a fájl csak TERV. A `feat(loop-v1):` commit és a `[deploy]` a parent-agent QA workflow-ja után jöhet (Phase 4/5/6/7 mintára). A spec-et a parent-agent postolja Trello-kommentként a 3 kártyára (lásd §14 Trello-paste blokkok).

---

## 0. Scope-pivot emlékeztető (3-as szintű szabály: P0 = 2-es szintű)

A P0 **2-es szintű hatáskör** (a Sprint 4 P0-Phase-okkal azonos besorolás):
- **Dokumentált** (ez a fájl) + **jóváhagyott stratégia** (a Sprint 5 P0-terv: loop-rész rendbetétele, nem új feature).
- **Nincs új scope / config / credential** a P0.1 és P0.2-re. A P0.3-ra **egy explicit 3-as szintű user-döntés** szükséges (PostHog vs. saját events tábla — lásd §0.2).
- **NEM public adat-expozíció**, **NEM fizetős tier**, **NEM security/RLS-változás**.

### 0.1 A loop-összefüggés (3 pont 1 fájlban, miért)

A három P0 pont a `My Gear → Trip → Loadout → Hike → Debrief → History` loop **3 kritikus, jelenleg gyenge láncszemét** javítja. A közös cél: **a loop bezáródjon** — ne csak adatot gyűjtsünk, hanem a user érezze, hogy a saját adata visszahat a döntéseire.

| Láncszem | P0 pont | Miért kritikus most |
|---|---|---|
| **My Gear** (bemenet) | P0.2 — gyorsabbá / egyszerűbbé | Ha a gear-felviteli flow akad, a loop el sem indul. |
| **Debrief** (záró ritual) | P0.1 — UX fix, save feedback | Ha a debrief "csak egy 4. card a lap alján", a user nem tölti ki, a History üres marad. |
| **History** (kimenet) | P0.3 — funnel mérés | Ha nem mérünk, nem látjuk, hol szakad el a loop; a Sprint 5 P1+ scope-pivotok vakon indulnának. |

A 3 pont **kölcsönösen adat-fogyasztói** egymásnak: a P0.2 (gyorsabb gear-felvitel) növeli a `first_gear_added` eseményszámot; a P0.1 (jól használható debrief) növeli a `first_debrief_written`-t; a P0.3 (funnel) megmutatja, hol esik szét a lánc. **Együtt deployolva** a Phase-ek sorrendje:

1. **P0.2** (alap: gyors gear-felvitel) → legyen a legbiztosabb bemenet
2. **P0.3** (funnel events) → mérjük, mi történik a P0.2-vel
3. **P0.1** (debrief fix) → a loop záró rituáléja, a `first_debrief_written` konverzió-mérő

A P0.3 P0.1/P0.2 előtt is mehet, de a P0.2 → P0.1 sorrend a kód-szintű függőség (a P0.1 a Phase 5 meglévő debrief endpointját használja, a P0.2 a meglévő gear endpointot, a P0.3 ezekhez ad listener-eket).

### 0.2 A P0.3 3-as szintű user-döntés (a spec NEM dönt, hanem kér)

A P0.3 card leírása explicit kimondja: **PostHog (3rd-party) vs. saját events tábla**. Ez architect-spec szinten **nem eldönthető**:
- A PostHog harmadik fél scriptje a useradatokat küldi ki (consent + GDPR).
- A saját events tábla privacy-first, de saját lekérdező UI-t / aggregációt igényel később.
- A user kifejezetten kizárta a Cloudflare Analytics / Mixpanel / stb. opciókat.

**A spec §11 a két alternatívát prezentálja, és a parent-agent a 3-as szintű döntést a user felé továbbítja** — a parent NEM dispatchol P0.3 Full-stack-et, amíg a user válaszol.

### 0.3 Explicit out-of-scope (P0 NEM épít)

- Nincs új funkció a loop-on kívül.
- Nincs új schema-migráció a P0.1-re és P0.2-re (a meglévő `gear_items.comfort`, `trip_debriefs`, `trips`, `gear_items`, `trip_gear` táblák elegendőek).
- Nincs public adat-expozíció (a P0.3 NEM a publikus `/list/{id}`-re vonatkozik; kizárólag owner-only funnel).
- Nincs fizetős tier / subscription / SaaS-referencia.
- Nincs ML-alapú ajánlás, nincs push-notification.
- A `trips.visibility` / `participation` mezők funkcióba hozatala (v2 §4) továbbra is későbbi fázis.
- **P1 (Community Routes) / P2 (csomaglista) / P3 (mély Discover) / P4 (SaaS/social)** — explicit STOP. A P0 lezárásáig a parent-agent NEM készít elő Architect-spec-et / Trello-kártyát / kódot ezekre.

### 0.4 A 3-as szintű scope-pivot őrszem (cross-table consistency STOP, v2 §4)

A P0 NEM nyúl a v2 §4-ben rögzített `trips.visibility` / `trips.participation` mezőkhöz. A P0.3-ban a `trips.completed_at` mező HOZZÁADÁSA (forward-only) elfogadható, mert:
- NEM törlünk / módosítunk meglévő oszlopot.
- A `visibility` / `participation` alapértelmezett értéke (`private` / `invite_only`) változatlan marad.
- A `completed_at` NULL értéke a default (tervezett túra); NOT NULL = elment.

---

## 1. Cél és a v2 §0 elvek leképezése

| v2 §0 elv | P0 megvalósulása |
|---|---|
| **#1 Valós felhasználói adat > feltételezés** | A P0.1 a user DEBRIEF-bevitelét (3 kérdés) jobb UX-szel láthatóvá teszi; NEM generálunk automatikus összefoglalót. A P0.2 a user GEAR-bevitelét (kategória, súly) gyorsabbá teszi; NEM ajánlunk fel starter packot. A P0.3 a user VALÓDI aktivációs eseményeit méri; NEM becsül. |
| **#2 Minimális onboarding-súrlódás** | A P0.2 a meglévő `GearOnboardingPanel`-t (Phase 2) finomítja (üres állapot placeholder, feltételes megjelenés); NEM nyit új modalt / új flow-t. A P0.1 a meglévő debrief section-t (Phase 5) teszi megtalálhatóvá; NEM hoz létre új route-ot. A P0.3 NEM igényel új user-inputot — passzívan méri a meglévő INSERT-eket. |
| **#3 Niche-igény validáció nélkül** | A P0 a meglévő loop-elemeket javítja; NEM vezet be új dimenziót (pl. weatherproof, photo-stats). A P0.3 a 6 szakaszból álló funnel-t méri, ami a v2 §"Megjegyzés" utolsó mondatából jön ("hányan jutnak el egy értelmes trip/loadout állapotig"). |
| **#4 Séma-szintű jövő-biztosítás olcsó, UI/logika-szintű nem** | A P0.1 és P0.2 NEM igényel új migrationt. A P0.3 **egyetlen** migrationt igényel: `trips.completed_at timestamptz` (NULL default). A `funnel_events` tábla csak a saját events-tábla opció esetén jön létre (PostHog opció esetén NEM — ld. §11). |
| **#5 Trip ≠ My Gear** | A P0.2 kizárólag a My Gear-listát érinti (gear CRUD finomhangolás). A P0.1 kizárólag a Trip-szintű debriefet (a meglévő `trip_debriefs` tábla, owner-only). A P0.3 a kettő közötti aktivációs határt méri. |

---

## 2. P0.1 — Debrief UX fix (a /trips/[id] lap)

### 2.1 A jelenlegi állapot (audit, 2026-08-16, `0a262b3`)

A `pages/trips/[id].vue` template-ben a debrief section (Phase 5, commit `13e15a7`) megvan, `v-if="isOwnerViewer"` gate-elve (owner-only szerkesztés). A user által jelzett "jelenleg használhatatlan" tünetek — a kódból és a Sprint 4.2 audit jegyzőkönyvből visszafejtve:

| Tünet | Hol | Mi a gond |
|---|---|---|
| **Mentés-visszajelzés hiányzik** | `saveDebriefHandler` (lásd `pages/trips/[id].vue:600-617`) — `try { ... } catch { /* surfaced via state.error */ }` | Nincs siker-visszajelzés (a Sprint 4.2 #3 a komfortra adott inline checkmark + error toast-ot, de a debrief `catch {}` csak a `state.error`-ba ír, és a lap nem jeleníti meg a debrief section közelében). |
| **A section vizuálisan a 4. card a lap alján** | A debrief section a recap + photos + trip-aware loadout után jön | A loop utolsó lépéseként a debrief a vizuális hierarchia legaljára szorul — a user nem találja meg, ha csak "végigmegy a lapon". |
| **Nincs "loop-lezáró" framing** | A section címe: "Debrief" + "Milyen tapasztalataid voltak a túráról? (Opcionális)" | Nincs nyoma, hogy ez a loop záró lépése (History felé vezet). |
| **A 3 kérdés üres state-e** | Első alkalommal mind a 3 textarea üres, nincs placeholder-példa a "mentett állapot" visszajelzésére | A user nem tudja, milyen mélységű válasz az "elég". |
| **A `+ Adj hozzá újabb sort` gomb szövege a `Még egy cucc` onboarding-panel mintát idézi** | A debrief UX-ét a Phase 2 onboarding-panel mintája ihlette, de a debrief NEM onboarding — inkább egy "strukturált reflexió" | A debrief gyorsabban használható lenne, ha a 3 kérdés egy-egy "gyors input" (1 soros input, max 120 char) lenne, nem 3-szor bővíthető textarea (Phase 5 §4.5). |

A Sprint 4.2 audit `45d28d8` (fix(comfort): inline save feedback) a komfort-cardra hozott inline feedback-et, de a debrief section-re ez a patch NEM terjedt ki — a komfort a `GearFormModal` része (auto-save on modal close), a debrief külön section (explicit save gomb). A P0.1 ezt a különbséget hidalja át.

### 2.2 A P0.1 célja (user-üzenet alapján)

A P0.1 card leírása: *"a Megosztás gomb mintájára: a /trips/[id] oldalon a Debrief section legyen megtalálható inline (NE rejtve). A 3 kérdés (felesleges/hiányzó/kényelmetlen) legyen könnyen szerkeszthető, a mentés-visszajelzés látható (Sprint 4.2 #3 komfort-feedback mintájára)."*

Konkrétan:
1. **A Debrief section vizuálisan kiemelt**, ne a lap legalján legyen a 4. card (hanem a recap UTÁN, de a loadout-recs ELŐTT — mert a loadout a debrief-ből olvas, logikailag későbbi).
2. **Inline save feedback** a komfort-minta szerint: a "Debrief mentése" gomb mellett (vagy felette) egy `Mentve ✓` checkmark + hiba esetén egy `data-testid="debrief-error"` lokális piros szöveg.
3. **A 3 kérdés legyen könnyen szerkeszthető**: 1 soros `<input>` mezőnként (maxlength=120), ne textarea — a Phase 5 §4.5 textarea-ját cseréljük inputra, mert a Phase 7 #22 loadout-recs a `excess_items`-t aggregálja item-szinten (nem szabad szövegként); az 1-soros input jobban jelzi, hogy "item-szintű" bejegyzés.
4. **Loop-lezáró framing**: a section alcíme legyen *"Zárd le a túrát — 3 kérdés, 1 perc"* (MemoFox "warm/playful" voice), jelezve, hogy ez a loop utolsó lépése a History felé.

### 2.3 A P0.1 schema-változás: NINCS

A `trip_debriefs` tábla (Phase 5, `20260816000001_trip_debrief.sql`) pontosan megfelel: 3 `text[]` mező (excess / missing / uncomfortable) + `unique (trip_id)`. **Nincs új migration.** Nincs új endpoint. Nincs új utility class.

A P0.1 kizárólag a `pages/trips/[id].vue` módosítása (és opcionálisan a `composables/useTrips.ts` `saveDebrief` metódusának kiegészítése a save-feedback flag-gel).

### 2.4 A P0.1 UI-változás (3 pont, mind a `pages/trips/[id].vue`-ben)

#### (a) Section-áthelyezés: a Debrief a `canViewRecap` gate-en BELÜL, a recap-rész UTÁN, a `trip-aware loadout` ELŐTT

A jelenlegi sorrend (a `0a262b3` master-en):
```
... recap section (canViewRecap gate) ...
... debrief section (isOwnerViewer gate, mint 4. card) ...
... trip-aware loadout section (isOwnerViewer gate, mint 5. card) ...
```

A P0.1 új sorrendje:
```
... recap section (canViewRecap gate) ...
... debrief section (isOwnerViewer gate, kiemelt) ...
... trip-aware loadout section (isOwnerViewer gate, változatlan) ...
```

A debrief section a `data-testid="debrief-section"` azonosítót megtartja (QA hook), DE a `class` attribútumot kiegészítjük egy sötétebb kerettel és bal oldali 4px-es brand-500 sávval (a "kiemelt card" vizuális mintája, a MemoFox design rendszer §2.3 sötét espresso-kártyák ihletésére — a kontraszt-blokk a lapon).

A section fölött megjelenik egy 1-soros "Zárd le a túrát" felirat, kis ikon (MemoFox `icon-accent text-ember-500`), hogy a vizuális hierarchiában ez legyen a fókusz.

#### (b) Input-csere textarea-ról 1-soros input-ra

A jelenlegi 3 textarea (`<textarea v-model="debriefExcess[idx]" ...>`) → 1-soros `<input type="text" v-model="debriefExcess[idx]" maxlength="120">`. A `removeDebriefRow` / `addDebriefRow` változatlan (a 3 kérdés fix, max 50 item / mező a Phase 5 §4.4 zod séma szerint). A `placeholder` a MemoFox voice-hoz illeszkedően:

- Felesleges: *"pl. extra kulacs, sosem használt bicska"*
- Hiányzott: *"pl. jobb fejlámpa, plusz réteg"*
- Kényelmetlen: *"pl. matrac túl kemény, hálózsák túl szűk"*

A 120 karakter limit a `maxlength` attribútumban és a `compactDebrief` függvényben (már létezik, `pages/trips/[id].vue:586-588`) változatlan.

#### (c) Save feedback (Sprint 4.2 #3 minta)

A meglévő `debriefSaving` ref kibővül `debriefSavedRecently` ref-fel (`boolean`, 2 másodpercig `true` a sikeres save után). A "Debrief mentése" gomb mellett egy `<span data-testid="debrief-saved">` "✓ Mentve" felirat jelenik meg, ha `debriefSavedRecently === true`.

A `saveDebriefHandler` kiegészül:

```ts
const saveDebriefHandler = async () => {
  debriefSaving.value = true;
  debriefSavedRecently.value = false;
  try {
    await saveDebrief(tripId.value, {
      excess_items: compactDebrief(debriefExcess.value),
      missing_items: compactDebrief(debriefMissing.value),
      uncomfortable_items: compactDebrief(debriefUncomfortable.value),
    });
    debriefInitialized.value = true;
    debriefSavedRecently.value = true;
    setTimeout(() => { debriefSavedRecently.value = false; }, 2000);
  } catch {
    // A state.error-ba megy (Phase 5 §13.3), a debrief section feletti
    // <ErrorBanner>-szerű lokális hibaüzenet (data-testid="debrief-error")
    // jelenik meg, piros szöveggel.
  } finally {
    debriefSaving.value = false;
  }
};
```

A hibaüzenet a section-höz lokális (nem a page-szintű `ErrorBanner`), hogy a user ne veszítse el a kontextust, ha közben más section-ön dolgozik. A `data-testid="debrief-error"` a QA hook.

### 2.5 A P0.1 elfogadási kritériumok (QA hook)

A P0.1 kártyán a QA 6 mérhető feltételt ellenőriz:

1. **Section-sorrend**: a `pages/trips/[id].vue` DOM-jában a `debrief-section` a `recap-section` UTÁN és a `loadout-recs-section` ELŐTT jelenik meg (owner-ként, `isOwnerViewer=true`).
2. **Vizuális kiemelés**: a debrief section egy 4px-es bal oldali brand-500 sávval és sötétített kerettel rendelkezik (a többi section-höz képest vizuálisan domináns).
3. **Input-csere**: a 3 kérdés mezője `<input type="text">` (NEM `<textarea>`), `maxlength="120"` attribútummal.
4. **Save feedback**: sikeres save után 2 másodpercig "✓ Mentve" felirat látható a save gomb mellett (`data-testid="debrief-saved"`); hiba esetén a `data-testid="debrief-error"` lokális piros üzenet jelenik meg.
5. **Loop-framing**: a section alcíme *"Zárd le a túrát — 3 kérdés, 1 perc"* (vagy a PO által jóváhagyott alternatíva, ha a Designer mást kér — §8 #2).
6. **Nincs schema-migráció**: a `supabase/migrations/` könyvtárban a P0.1 commit-jában nincs új fájl; a `trip_debriefs` tábla változatlan.

### 2.6 A P0.1 rollback-út

A P0.1 egyetlen fájl módosítása (`pages/trips/[id].vue`), becsült diff: ~40-60 sor (section-áthelyezés + input-csere + save-feedback). Rollback: a section visszahelyezése a jelenlegi helyére + textarea-visszaállítás + `debriefSavedRecently` ref törlése. A `useTrips` composable nem változik (a `saveDebrief` metódus változatlan; csak a `saveDebriefHandler` page-lokális ref-et vezérel).

---

## 3. P0.2 — My Gear finomítás (a /gear lap)

### 3.1 A jelenlegi állapot (audit, 2026-08-16, `0a262b3`)

A `pages/gear/index.vue` (354 sor) + `components/GearOnboardingPanel.vue` (286 sor) + `components/GearFormModal.vue` (20888 byte) a meglévő flow. A Sprint 4.2 #2 + #3 + #4 három konkrét UX-bugot javított (`16df043`, `45d28d8`, `07e15d9`):
- #2: `POST /api/lists` hibaüzenet surface-elése (a megosztás panelen).
- #3: komfort save feedback (inline checkmark + error toast).
- #4: `+Újabb cucc` gomb reset (forcedComplete + comfort).

A P0.2 card leírása a fennmaradó UX-fennakadásokat listázza (user által explicit): *"onboarding-panel feltételes megjelenése a meglévő itemszám alapján, összsúly placeholder ha nincs item, üres állapot CTA-copy, etc."*

### 3.2 A P0.2 user-listája és a szűkítés

A P0.2 kártya scope-listája 8 elem:
1. gear hozzáadás
2. kategória
3. súly
4. lista
5. összsúly
6. edit/delete
7. üres állapot
8. onboarding

A 8 elemből a **Phase 2 + 4.2 már megoldotta**: az 1, 2, 3, 4, 6, 8 (részben — Sprint 4.2 #4 fix). A P0.2 a **fennmaradó 3 konkrét UX-fennakadásra** fókuszál, mert az Architect hatáskör a "scope-adjacent fix" (2-es szintű), NEM az "új funkció":

| # | Fennakadó elem | Javítás |
|---|---|---|
| **F1** | Összsúly placeholder ha nincs item | A `BaseWeightSummary` jelenleg `—` karaktert mutat 0 item-nél. A P0.2 a placeholder-t *"Még nincs súlyod — adj hozzá egy cuccot!"* szövegre cseréli (MemoFox voice), a `BaseWeightSummary.vue` módosításával. |
| **F2** | Üres állapot CTA-copy | A `GearOnboardingPanel` A. fázisa jelenleg azonnal a form-ot mutatja (Phase 2 döntés: "ne kérdezzen wizard-szerűen"). A P0.2 az A. fázisú alcímet finomítja: a jelenlegi *"Mi van a felszerelésedben?"* → *"Mi volt nálad a legutóbbi túrán?"* csak akkor, ha a user már túrázott (az `excess_items` / `trip_debriefs` tábla üressége a proxy). A P0.2 ezt NEM implementálja új mezővel — ehelyett: az A. fázisú alcím VÁLTOZATLAN marad (MemoFox Phase 2 döntése), de a panel alatti `<p class="text-xs italic">` segéd-szöveg kiegészül egy sorral: *"Kezdd a legfontosabbal — a többit később is felviheted."* (1 sor, vizuálisan halvány). |
| **F3** | Onboarding-panel feltételes megjelenése meglévő itemszám alapján | A jelenlegi `showOnboarding = computed(() => state.value.items.length < ONBOARDING_KÜSZÖB && !!user.value)` (page/gear/index.vue:37-39) jó, DE a `forcedComplete` (Sprint 4.2 #4) lokálisan C. fázisba kényszeríti, míg a page-szintű `showOnboarding` az item-számon alapul — ez a kettősség azt eredményezi, hogy ha a user "Ennyi volt"-ot mond 2 item-nél, a panel C.-be megy (slim completion bar), DE a `state.value.items.length < ONBOARDING_KÜSZÖB` (2 < 3 = true) miatt a panel ÚJRA megjelenik, ha bármi triggereli a re-render-t. A P0.2 javítás: a `showOnboarding` computed a `forcedComplete` flag-et is figyelembe veszi (a panel `composables/useOnboardingPhase.ts`-ban van, de a flag jelenleg csak a panel belső state-je). |

### 3.3 A P0.2 célja (leszűkítve)

A P0.2 **3 konkrét UX-finomítás**, mind a meglévő komponensek módosítása (NEM új komponens, NEM új endpoint, NEM új migration):

- **F1 — Összsúly placeholder**: `BaseWeightSummary.vue` 1 sor szöveg-csere.
- **F2 — Onboarding-panel A. fázisú segéd-szöveg**: `GearOnboardingPanel.vue` 1 sor HTML-kiegészítés.
- **F3 — Onboarding-panel `forcedComplete` flag page-szintű respektálása**: a `pages/gear/index.vue` `showOnboarding` computed kiegészítése egy `forcedComplete` flag figyeléssel — ehhez a flag-et a panelből a page-szintű state-be kell emelni, vagy a panel egy `provide/inject` mintát használ.

### 3.4 A P0.2 schema-változás: NINCS

A meglévő `gear_items`, `categories` (globalizálva Phase 1), `gear_base_weights_view` táblák / view-k elegendőek. **Nincs új migration.** Nincs új endpoint. Nincs új utility class.

### 3.5 A P0.2 UI-változás (3 fájl, kicsi diff-ek)

#### (a) F1 — `BaseWeightSummary.vue` placeholder

A jelenlegi `0 g` / `—` érték 0 item-nél → *"Még nincs súlyod — adj hozzá egy cuccot!"* (MemoFox warm voice, halvány szín). A módosítás 1 fájl, ~5 sor diff.

#### (b) F2 — `GearOnboardingPanel.vue` A. fázisú segéd-szöveg

A jelenlegi alcím: *"Ha már túráztál, vedd sorra, mi volt nálad — ha még nem, kezdj a legfontosabbal."* (panel:148-151) → kiegészül egy harmadik sorral: *"Kezdd a legfontosabbal — a többit később is felviheted."* 1 fájl, ~3 sor diff.

#### (c) F3 — `pages/gear/index.vue` `showOnboarding` + `forcedComplete` page-szintű respektálása

A jelenlegi panel-lokális `forcedComplete` ref-et a panelből a page-szintű state-be emeljük (egy `provide/inject` kulcspár, vagy a panel `defineExpose({ forcedComplete })` + a page `useTemplateRef`). A page-szintű `showOnboarding` computed kiegészül:

```ts
const panelRef = useTemplateRef('panelRef');
const showOnboarding = computed(
  () =>
    state.value.items.length < ONBOARDING_KÜSZÖB &&
    !!user.value &&
    !panelRef.value?.forcedComplete,
);
```

A panel `defineExpose({ forcedComplete })` exportálja a flag-et. 2 fájl, ~10 sor diff.

### 3.6 A P0.2 elfogadási kritériumok (QA hook)

A P0.2 kártyán a QA 5 mérhető feltételt ellenőriz:

1. **F1 placeholder**: 0 item esetén a `BaseWeightSummary` "Még nincs súlyod — adj hozzá egy cuccot!" szöveget mutat (NEM `—` / `0 g`).
2. **F2 segéd-szöveg**: a `GearOnboardingPanel` A. fázisában (0 item) a 3. sor *"Kezdd a legfontosabbal — a többit később is felviheted."* megjelenik.
3. **F3 forcedComplete respektálás**: a user 2 item + "Ennyi volt" → panel C.-be (slim completion bar); a page-szintű `showOnboarding` `false` a C.-ben (nem jelenik meg a panel A./B. form újra); ha a user később töröl 1 item-et (item-szám 1), a panel újra A./B. fázisba kerül (a `forcedComplete` törlődik a panel új mount-jakor).
4. **Nincs schema-migráció**: a `supabase/migrations/` könyvtárban a P0.2 commit-jában nincs új fájl.
5. **Nincs új utility class / endpoint**: a `composables/`, `server/api/`, `shared/` könyvtárakban nincs új fájl.

### 3.7 A P0.2 rollback-út

A P0.2 három apró módosítás (F1, F2, F3), becsült össz diff: ~18 sor, 3 fájlban. Rollback: a 3 módosítás revertálása (vissza a Phase 2 / 4.2 állapotra). Nincs új komponens, nincs új utility.

---

## 4. P0.3 — Activation funnel mérés (6 szakasz)

### 4.1 A 6 szakasz (user-üzenet alapján)

A P0.3 card leírása 6 eseményt sorol fel:

| # | Esemény | Trigger | Adatforrás |
|---|---|---|---|
| 1 | `signup_completed` | Az `auth.users` INSERT sikeres (jelszó-regisztráció flow vége) | Supabase Auth webhook VAGY kliens-oldali `$fetch('/auth/v1/signup', ...)` success |
| 2 | `first_gear_added` | A user első `gear_items` INSERT-je | `useGear().create()` success, `items.length === 1` ellenőrzéssel |
| 3 | `first_trip_created` | A user első `trips` INSERT-je | `useTrips().create()` success, `trips.length === 1` ellenőrzéssel |
| 4 | `first_loadout_assembled` | A user első `trip_gear` INSERT-je | `useTrips().addGearToTrip()` (vagy a meglévő neve) success, `trip_gear` count > 0 |
| 5 | `first_completed_trip` | A user első `trips.completed_at` NOT NULL UPDATE-je | Új `markTripCompleted(tripId)` metódus, owner-only |
| 6 | `first_debrief_written` | A user első `trip_debriefs` INSERT-je | `useTrips().saveDebrief()` success, `debriefByTripId[tripId] === null` előtte |

### 4.2 A `first_completed_trip` önálló mérföldkő

A P0.3 card explicit kimondja: *"first_completed_trip ← ÖNÁLLÓ mérföldkő (tervezés vs. kirándulás szétválasztása)"*. A loop szempontjából ez a **Hike** láncszem (a `Trip → Loadout → Hike → Debrief` átmenet). A user jelenleg nem különbözteti meg a "tervezett" és a "megtörtént" túrát — minden `trips` rekord ugyanaz. A P0.3 ezt vezeti be:

- **Séma-migráció**: `trips.completed_at timestamptz` (NULL default = tervezett; NOT NULL = elment).
- **UI**: a `pages/trips/[id].vue` és a `pages/trips/index.vue` lapokon egy "Túra lezárása" gomb (owner-only), ami `markTripCompleted(tripId)` hívást indít.
- **Debrief gate**: a P0.1 fix-elt debrief section CSAK akkor jelenjen meg, ha `state.value.current.completed_at !== null` (a loop logikája: Hike → Debrief). Ha a user a debrief section-t akarja kitölteni, előbb le kell zárnia a túrát. Ez a 3-as szintű UX-döntés (a "Mikor érhető el a debrief?" kérdés) a P0.3 §10 open question.

### 4.3 A 6 szakasz 3-as szintű user-döntése: PostHog vs. saját events tábla

A P0.3 card leírása explicit kimondja: *"3-as szintű user-döntés szükséges: PostHog (3rd-party) vs. saját events tábla (privacy-first, GDPR-barát). Az Architect-spec NEM dönt, hanem explicit user-inputot kér."*

A két opció részletes összehasonlítása:

| Szempont | PostHog | Saját events tábla |
|---|---|---|
| **Adat-tulajdon** | PostHog (3rd-party) — EU-ban tartható (PostHog Cloud EU region), de a useradatok kikerülnek a Supabase-ből | Saját Supabase (privacy-first, nincs 3rd-party) |
| **GDPR / consent** | Cookie-banner / consent-modal szükséges (PostHog script a kliensen fut) | Nincs 3rd-party script, a RLS + Supabase saját auth-flow |
| **Séma** | Nincs saját migration (a PostHog a saját szerverén tárol) | Új `funnel_events` tábla: `(id uuid, user_id uuid, event_name text, payload jsonb, created_at timestamptz)` + RLS (user_id = auth.uid() SELECT, NO INSERT/UPDATE/DELETE — csak service-role írhat) |
| **Kliens-oldali SDK** | `posthog-js` npm csomag, `posthog.capture('signup_completed')` | Saját helper: `trackEvent('signup_completed', { ... })` → `supabase.from('funnel_events').insert(...)` |
| **Lekérdezés / dashboard** | PostHog UI (funnel analysis, retention, stb.) — a user bejelentkezik a PostHog-ba | Saját SQL VIEW-k + admin-oldal (későbbi fázis, NEM a P0.3-ban) |
| **Költség** | PostHog Cloud free tier: 1M event / hó — P0 induláskor bőven elég | Saját Supabase tárhely + sávszélesség (marginális) |
| **Vercel deploy** | A `posthog-js` client-side bundle-be kerül (Vite bundle méret nő ~30KB-tal) | Nincs client-side bundle-növekedés (a saját helper a meglévő Supabase klienst használja) |
| **Reverzibilitás** | A `posthog-js` uninstall + a capture-hívások törlése reverzibilis; a PostHog-fiókban az adatok megmaradnak (törölhetők) | A `funnel_events` tábla `drop` reversibilis (a service-role insert policy törlésével együtt) |
| **Sprint 5 P1+ mérés** | A PostHog a meglévő funnel-n kívül is használható (retention, feature-flags, A/B test) | A saját tábla csak a 6 szakaszt méri; a további metrikák (P1 Community Routes) új táblát igényelnek |

A spec **NEM dönt** — a parent-agent a 3-as szintű user-döntést a user felé továbbítja. A §11 a döntési szempontokat prezentálja, és a parent a user válasza UTÁN dispatchol P0.3 Full-stack-et.

### 4.4 A P0.3 séma-változás (a döntéstől függ)

#### (a) PostHog opció esetén

- Nincs saját migration.
- Kliens-oldali: `posthog-js` npm install + `plugins/posthog.client.ts` (Nuxt plugin, `POSTHOG_API_KEY` runtime config).
- 6 capture-hívás a megfelelő helyeken (lásd §4.5).

#### (b) Saját events tábla opció esetén

- 1 új migration: `funnel_events` tábla + service-role-only INSERT policy.
- Kliens-oldali: `composables/useFunnelEvents.ts` (új composable, a `useGear` / `useTrips` mintára).
- 6 hívás a megfelelő helyeken (lásd §4.5).

Mindkét opció esetén **1 séma-migráció** a `trips.completed_at` mezőre (független a döntéstől).

### 4.5 A P0.3 kliens-oldali hívások helye (mindkét opciónál azonos)

| # | Esemény | Hívás helye |
|---|---|---|
| 1 | `signup_completed` | `pages/signup.vue` (sikeres `signUp` után, közvetlenül a `navigateTo('/signin')` ELŐTT) |
| 2 | `first_gear_added` | `composables/useGear.ts` `create()` metódus, sikeres INSERT után: `if (items.value.length === 1) trackEvent('first_gear_added')` |
| 3 | `first_trip_created` | `composables/useTrips.ts` `create()` metódus, sikeres INSERT után: `if (state.value.items.length === 1) trackEvent('first_trip_created')` |
| 4 | `first_loadout_assembled` | `composables/useTrips.ts` `addGearToTrip()` metódus, sikeres INSERT után: a `trip_gear` count > 0 ellenőrzéssel |
| 5 | `first_completed_trip` | `composables/useTrips.ts` `markTripCompleted()` metódus, sikeres UPDATE után: ha a user első completed trip-je |
| 6 | `first_debrief_written` | `composables/useTrips.ts` `saveDebrief()` metódus, sikeres INSERT után: ha `debriefByTripId[tripId] === null` volt előtte |

A `first_*` guard mindenhol azért fontos, mert a P0.3 nem minden insert/update-et akar mérni, csak a **funnel-átmenetet** (az 1. eseményt user-szinten).

### 4.6 A P0.3 elfogadási kritériumok (QA hook)

A P0.3 kártyán a QA 7 mérhető feltételt ellenőriz (a user-döntés UTÁN):

1. **Séma-migráció**: a `supabase/migrations/` könyvtárban 2 új fájl van (`20260816000000_trips_completed_at.sql` + `20260816*_funnel_events.sql` ha a saját tábla opció, vagy csak az első ha a PostHog).
2. **`completed_at` trigger**: egy új `markTripCompleted(tripId)` endpoint + composable metódus owner-only, `trips.completed_at = now()` update.
3. **UI**: a "Túra lezárása" gomb a `pages/trips/[id].vue` lap owner-főnézetén, csak akkor látható, ha `completed_at === null`.
4. **Debrief gate**: a P0.1 fix-elt debrief section csak `completed_at !== null` esetén jelenik meg (a loop logikája: Hike → Debrief).
5. **6 capture-hívás**: a `trackEvent` / `posthog.capture` hívások a megadott 6 helyen megvannak (grep a `composables/useGear.ts`, `useTrips.ts`, `pages/signup.vue` fájlokban).
6. **`first_*` guard**: minden capture-hívás `if (first_X) ...` guard-dal van védve (nem minden INSERT-et mér).
7. **Nincs public adat-expozíció**: a `funnel_events` tábla RLS-e user-scoped (saját eseményeket láthat), a publikus `/list/{id}` route NEM gyűjt funnel events-t.

### 4.7 A P0.3 rollback-út

- PostHog opció: `posthog-js` uninstall + 6 capture-hívás törlése + plugin törlése. Reverzibilis, nincs DB-migráció-rollback.
- Saját tábla opció: `funnel_events` tábla `drop` + `trips.completed_at` column `drop` + a `markTripCompleted` endpoint + composable metódus törlése + 6 capture-hívás törlése.

---

## 5. Schema + endpoint változások — összefoglaló

### 5.1 Migration-ök

| Fájl | P0 pont | Státusz |
|---|---|---|
| `20260816000000_trips_completed_at.sql` | P0.3 | NEW |
| `20260816000001_funnel_events.sql` | P0.3 (saját tábla opció) | NEW, CSAK HA a user a saját tábla opciót választja |

### 5.2 Endpoint-ok

| Fájl | P0 pont | Státusz |
|---|---|---|
| `server/api/trips/[id]/complete.post.ts` | P0.3 | NEW (owner-only, `trips.completed_at = now()` UPDATE) |

### 5.3 Composables

| Fájl | P0 pont | Státusz |
|---|---|---|
| `composables/useTrips.ts` | P0.1 + P0.3 | MÓDOSÍTÁS: `saveDebrief` flow-t a P0.1 nem nyúlja (a page-lokális `saveDebriefHandler` felel); `markTripCompleted(tripId)` metódus hozzáadása |
| `composables/useFunnelEvents.ts` | P0.3 | NEW (saját tábla opció esetén); a PostHog opció NEM igényli |
| `composables/useGear.ts` | P0.3 | MÓDOSÍTÁS: `create()` végén `first_gear_added` capture |

### 5.4 UI komponensek

| Fájl | P0 pont | Módosítás |
|---|---|---|
| `pages/trips/[id].vue` | P0.1 + P0.3 | P0.1: section-áthelyezés, input-csere, save feedback; P0.3: "Túra lezárása" gomb, debrief gate a `completed_at`-ra |
| `pages/gear/index.vue` | P0.2 | F3: `showOnboarding` + `forcedComplete` page-szintű respektálás |
| `components/BaseWeightSummary.vue` | P0.2 | F1: placeholder szöveg 0 item-nél |
| `components/GearOnboardingPanel.vue` | P0.2 | F2: A. fázisú segéd-szöveg kiegészítés; `defineExpose({ forcedComplete })` |
| `pages/signup.vue` | P0.3 | `signup_completed` capture a sikeres signUp után |

### 5.5 Ami NEM történik a P0-ban

- Nincs új utility class (a meglévő `useGear` / `useTrips` / `useOnboardingPhase` elegendő).
- Nincs új endpoint a P0.1-re vagy P0.2-re.
- Nincs publikus adat-expozíció (a P0.3 funnel_events RLS-e user-scoped, NEM publikus).
- Nincs külső API integration a Cloudflare Analytics / Mixpanel / stb. felé.
- Nincs fizetős tier / subscription.
- Nincs ML / AI.
- Nincs push-notification / email.
- Nincs új kategória a taxonómiában.
- Nincs a `trips.visibility` / `participation` mezők funkcióba hozatala.

---

## 6. A P0 és a v2 §0 elvek összefoglalása

| v2 §0 elv | P0.1 Debrief UX | P0.2 My Gear finomítás | P0.3 Activation funnel |
|---|---|---|---|
| **#1 Valós adat > feltételezés** | A user DEBRIEF-bevitelét jobb UX-szel láthatóvá teszi | A user GEAR-bevitelét gyorsabbá teszi | A user VALÓDI aktivációját méri |
| **#2 Minimális súrlódás** | A meglévő debrief section-t teszi megtalálhatóvá | A meglévő gear-flow-t finomítja | NEM igényel új user-inputot (passzív mérés) |
| **#3 Niche-igény validáció nélkül** | NEM vezet be új debrief-dimenziót | NEM vezet be új gear-mezőt | NEM becsül, hanem mér |
| **#4 Séma-szintű olcsó** | NINCS migration | NINCS migration | 1 (vagy 2) migration — `trips.completed_at` (+ `funnel_events` ha saját tábla) |
| **#5 Trip ≠ My Gear** | Trip-szintű (debrief a `trip_debriefs`-en) | My Gear-szintű (gear CRUD a `gear_items`-en) | A kettő közötti határt méri |

---

## 7. Decisions log (Architect, ebben a fázisban)

| # | Döntés | Indoklás |
|---|---|---|
| 1 | **P0.1 input-csere textarea → 1-soros input** | A Phase 5 §4.5 textarea döntését a P0.1 felülírja. A Phase 7 #22 loadout-recs item-szinten aggregálja az `excess_items`-t (NEM szabad szövegként); az 1-soros input vizuálisan jobban jelzi, hogy "item-szintű" bejegyzés. A 120 karakter limit a `maxlength` attribútumban változatlan. |
| 2 | **P0.1 section-áthelyezés: debrief a recap UTÁN, a loadout ELŐTT** | A loop logikája: Trip → Hike (loadout) → Debrief. A vizuális hierarchia tükrözze a loop-ot: a debrief a loadout ELŐTT jelenjen meg, mert a loadout a debrief-ből olvas (adat-fogyasztó). A loadout a debrief UTÁN a jelenlegi állapot; a P0.1 megfordítja. |
| 3 | **P0.1 save feedback lokális (nem page-szintű ErrorBanner)** | A Sprint 4.2 #3 a komfort-cardra lokális feedback-et adott; a P0.1 ugyanazt a mintát követi. A page-szintű `ErrorBanner` a gear-flow hibáit kezeli; a debrief hibái a debrief section-höz lokálisak. |
| 4 | **P0.2 3 finomítás (F1, F2, F3), NEM 8 elem teljes újra-tervezése** | A user scope-listája 8 elemet sorol fel, de 6-ot a Phase 2 + 4.2 már megoldott. A P0.2 a 3 fennmaradó, konkrét UX-fennakadásra fókuszál (2-es szintű scope-adjacent fix). A 8-as lista NEM bővül — csak a fennmaradó 3-at javítjuk. |
| 5 | **P0.2 F3 megoldás: `forcedComplete` page-szintű exportálása** | A panel-lokális `forcedComplete` ref-et a page-szintű `showOnboarding` computed nem látja; ez a kettősség okozza a "újra megjelenő panel" bugot. A megoldás: `defineExpose({ forcedComplete })` + `useTemplateRef` a page-en. Minimális, NEM igényel új provide/inject rendszert. |
| 6 | **P0.3 6 capture-hívás helye explicit a `useGear` / `useTrips` / `pages/signup.vue`-ban** | A 6 esemény természetes módon a meglévő INSERT/UPDATE sikeres ágaira kerül; NEM új middleware / interceptor. A `first_*` guard user-szinten szűr (ne minden INSERT-et mérjen). |
| 7 | **P0.3 `trips.completed_at` mező a `trips` táblán** | A v2 §4-ben rögzített `visibility` / `participation` mezőkkel azonos séma-mintát követ (forward-only, NULL default, NEM törlünk meglévő oszlopot). A `completed_at` a "tervezett → elment" átmenetet jelzi; a `trips.status = closed` triggelés a Phase 7+ későbbi scope-pivotokba tartozik (NEM a P0-ba). |
| 8 | **P0.3 debrief gate: `completed_at !== null`** | A loop logikája: Hike → Debrief. A user nem írhat debriefet egy tervezett túrához. A UX-finomítás (a "Túra lezárása" gomb → debrief megjelenik) a loop-ot tanítja a usernek. |
| 9 | **P0.3 PostHog vs. saját tábla: spec NEM dönt** | A user explicit 3-as szintű döntést kért. A spec §4.3 + §11 prezentálja a két opciót; a parent-agent a user-input UTÁN dispatchol Full-stack-et. |
| 10 | **P0.3 NEM Cloudflare Analytics / Mixpanel / stb.** | A user card leírása explicit kizárta. A P0.3 csak a két opció (PostHog vagy saját tábla) között kér döntést. |

---

## 8. Open questions (a PO/Designer hatásköre a P0 implementáció előtt)

1. **P0.1 input-csere**: a textarea → 1-soros input döntés (§7 #1) visszafordítható, ha a Designer a többsoros bevitel mellett érvel (pl. "a kényelmetlenség leírása néha hosszabb, mint 120 karakter"). A döntés a §4.4 zod séma `max(120)` limitjét nem érinti (mindkét UI-forma alatt ugyanaz a szerver-oldali limit).
2. **P0.1 alcím**: a *"Zárd le a túrát — 3 kérdés, 1 perc"* a Phase 5 §8 #2 "🦊 róka" ikonjával együtt; a Designer dönthet más ikon / más szöveg mellett.
3. **P0.2 F1 placeholder pontos szövege**: a *"Még nincs súlyod — adj hozzá egy cuccot!"* a MemoFox warm voice-hoz illeszkedő javaslat; a Designer / PO rövidebb alternatívát kérhet (pl. *"Adj hozzá egy cuccot!"*).
4. **P0.2 F2 segéd-szöveg**: a *"Kezdd a legfontosabbal — a többit később is felviheted."* a javaslat; ha a PO szerint a jelenlegi panel-voice már elég erős, a 3. sor elhagyható.
5. **P0.3 "Túra lezárása" gomb szövege és ikonja**: a javaslat *"Túra lezárása"* + MemoFox `icon-accent text-ember-500`; a Designer alternatívát kérhet (pl. *"Kész — lezárom"* + ✓).
6. **P0.3 debrief gate szigorúsága**: a §7 #8 döntés (a debrief csak `completed_at !== null` esetén) visszafordítható, ha a user szerint a debrief egy tervezett túrához is írható (loop-logika nélkül). Ez 3-as szintű UX-döntés.
7. **P0.3 funnel_events payload**: ha a saját tábla opciót választja a user, a `payload jsonb` mező tartalmát a Full-stack implementáció dönti el (event-specifikus: pl. `signup_completed` → `{ source: 'email' }`, `first_gear_added` → `{ category_slug: 'shelter' }`). Az Architect NEM írja elő az egyes event-ek payload-ját — a Full-stack hatáskör.

---

## 9. Rollback-út (orphan-komponensek + diff-méret)

A P0 NEM töröl meglévő komponenst; minden módosítás kiegészítő:

| Fájl | P0 pont | Becsült diff (sor) | Rollback-művelet |
|---|---|---|---|
| `pages/trips/[id].vue` | P0.1 + P0.3 | ~80-100 sor (P0.1: ~50; P0.3: ~30) | A section-áthelyezés, input-csere, save-feedback, "Túra lezárása" gomb, debrief gate revertálása |
| `pages/gear/index.vue` | P0.2 F3 | ~10 sor | A `forcedComplete` page-szintű respektálás revertálása |
| `components/BaseWeightSummary.vue` | P0.2 F1 | ~5 sor | A placeholder szöveg revertálása |
| `components/GearOnboardingPanel.vue` | P0.2 F2 | ~5 sor | A segéd-szöveg kiegészítés + `defineExpose` revertálása |
| `composables/useGear.ts` | P0.3 | ~5 sor | A `first_gear_added` capture-hívás törlése |
| `composables/useTrips.ts` | P0.3 | ~25 sor | A `markTripCompleted` metódus + 4 capture-hívás törlése |
| `pages/signup.vue` | P0.3 | ~3 sor | A `signup_completed` capture-hívás törlése |
| `composables/useFunnelEvents.ts` (új) | P0.3 (saját tábla opció) | ~50 sor (új fájl) | Fájl törlése |
| `server/api/trips/[id]/complete.post.ts` (új) | P0.3 | ~30 sor (új fájl) | Fájl törlése |
| `supabase/migrations/20260816000000_trips_completed_at.sql` (új) | P0.3 | ~15 sor (új fájl) | `down` migration: `alter table public.trips drop column completed_at;` |
| `supabase/migrations/20260816000001_funnel_events.sql` (új) | P0.3 (saját tábla opció) | ~25 sor (új fájl) | `down` migration: `drop table public.funnel_events;` |

**Nincs orphan-komponens** — a P0 nem cserél le v1 komponenst v2-re.

---

## 10. Out of scope (explicit lista)

A P0 NEM terjeszkedik az alábbiakra (a v2 §0 #3 elv — niche-igény validáció nélkül, ÉS a Sprint 5 P1-P4 explicit stop):

- **P1 — Community Routes / Shared Trips**: "Felfedezés a régióban" / "Mások túrái" listaoldal. NE indul, amíg a P0 nincs kész és lezárva.
- **P2 — Csomaglista-egyeztetés** ("Ki mit visz"): NE indul, amíg a P0 + P1 stabilizálódása után.
- **P3 — Mély Discover** (nehézség, szezon, családbarát szűrők): NE indul, amíg nincs elég adat (P1-ből) + külső adatforrás-döntés (OSM, Wikiloc, AllTrails).
- **P4 — SaaS / social / subscription / public Trip → Discover → Request to join**: nem fejlesztjük, csak tudjuk az irányt.
- ML-alapú comfort-ajánlás, push-notification, weatherproof dimenzió, photo-stats, trip-export PDF.
- A `trips.visibility` / `participation` mezők funkcióba hozatala (v2 §4 — séma megvan, UI/logika későbbi fázis).
- Többnyelvűség (a debrief UI jelenleg magyar).
- Cloudflare Analytics / Mixpanel / Amplitude / stb. (a user kizárta).
- A debrief gate szigorúság-váltása (a §7 #8 döntés — 3-as szintű UX-döntés).

---

## 11. A P0.3 3-as szintű user-döntés prezentáció

A parent-agent a user felé az alábbi döntési-blokkot postolja (a spec NEM dönt — a user válaszol, a parent dispatchol):

**Kérdés**: Melyik funnel-implementációt választod?

| Opció | Előny | Hátrány | Költség |
|---|---|---|---|
| **A. PostHog** (3rd-party) | Kész funnel-analysis UI, retention, feature-flags, A/B test; kevesebb saját kód | GDPR consent-modal szükséges; useradatok kikerülnek a Supabase-ből; Vite bundle +30KB | PostHog Cloud free tier: 1M event/hó (P0 induláskor bőven elég) |
| **B. Saját events tábla** (`funnel_events`) | Privacy-first, nincs 3rd-party, nincs consent-modal; saját Supabase RLS | Saját SQL VIEW-k + admin-oldal később (P1+ scope); kevesebb "out-of-the-box" analitika | Marginális Supabase tárhely |

A döntés a P0.3 Full-stack dispatch ELŐTT szükséges. A spec §4.4 / §4.5 / §5 mindkét opcióra felkészült.

---

## 12. Handoff (a P0 után)

A P0 lezárása után a Sprint 5 P0-munka lezárult. A parent-agent a következő lépéseket hozza:

1. **P0.1 + P0.2 Full-stack dispatch** (a user-döntés NÉLKÜL is mehet, mert nincs 3-as szintű blokkoló).
2. **P0.3 Full-stack dispatch** CSAK a user PostHog vs. saját tábla döntése UTÁN.
3. A 3 P0 pont párhuzamosan is mehet (shared composable módosítás nincs köztük — `pages/trips/[id].vue` P0.1+P0.3 egyszerre, `pages/gear/index.vue` csak P0.2).
4. A P0 lezárása UTÁN a parent-agent a Sprint 5 P1 (Community Routes) priorizálását a user felé jelzi — DE NEM dispatchol semmit, amíg a user explicit jóvá nem hagyja.

A P0 NEM épít a Sprint 4 Phase 6 #24 trip-stats-ra vagy a Phase 7 #22 trip-aware loadout-ra — ezek már deploy-olva vannak (`fc1cab7`, `a15d7c8`). A P0.3 funnel-events a meglévő `trip_debriefs`, `gear_items`, `trips`, `trip_gear` táblákra épít (NEM a trip-stats view-ra).

---

## 13. A `[deploy]` commit scope (a QA jóváhagyás UTÁN)

A Vercel-deploy trigger a parent-agent munkafolyamat része. A `[deploy]` commit várható:

```
[deploy] Sprint 5 P0: Product Loop v1 (Debrief UX + My Gear finomítás + Activation funnel)

UI:
- pages/trips/[id].vue: P0.1 section-áthelyezés, input-csere, save feedback, "Túra lezárása" gomb, debrief gate
- pages/gear/index.vue: P0.2 F3 forcedComplete page-szintű respektálás
- components/BaseWeightSummary.vue: P0.2 F1 placeholder
- components/GearOnboardingPanel.vue: P0.2 F2 segéd-szöveg + defineExpose
- pages/signup.vue: P0.3 signup_completed capture

Composables:
- composables/useGear.ts: P0.3 first_gear_added capture
- composables/useTrips.ts: P0.3 markTripCompleted + 4 capture-hívás
- composables/useFunnelEvents.ts: P0.3 (saját tábla opció esetén)

Endpoints:
- server/api/trips/[id]/complete.post.ts: P0.3 (owner-only completed_at UPDATE)

Migrations:
- supabase/migrations/20260816000000_trips_completed_at.sql: P0.3 NEW
- supabase/migrations/20260816000001_funnel_events.sql: P0.3 NEW (saját tábla opció)

Docs:
- docs/sprint-5-p0-product-loop.md: NEW (Architect spec)

#Sprint5-P0-Product-Loop-v1 — v2 §0 #1, #2, #4, #5
```

A commit **MOST NEM JÖN LÉTRE** — a parent-agent QA workflow-ja hozza létre, miután a user/PO jóváhagyta a specifikációt és a QA kipipálta az acceptance criteria-kat. A P0.3-as rész csak a user PostHog vs. saját tábla döntése UTÁN kerül a commitba.

---

## 14. Trello-paste blokkok (a parent-agent által postolandó)

### 14.1 P0.1 Trello-paste blokk (`6a80e641720faa5874f56aaf`)

```
Sprint 5 P0.1 — Debrief UX fix — Architect spec (részlet a docs/sprint-5-p0-product-loop.md fájlból)

Cél: a /trips/[id] oldalon a Debrief section legyen megtalálható inline (NE rejtve),
a 3 kérdés könnyen szerkeszthető, a mentés-visszajelzés látható (Sprint 4.2 #3 minta).

Döntések (Architect hatáskör, 3-szintű szabály 2-es szint):
1. Section-áthelyezés: a debrief a recap UTÁN, a trip-aware loadout ELŐTT
   - Indoklás: a loop logikája Hike → Debrief; a loadout a debrief-ből olvas.
2. Input-csere textarea → 1-soros input (maxlength=120)
   - Indoklás: a Phase 7 #22 loadout-recs item-szinten aggregálja az excess_items-t;
     az 1-soros input vizuálisan jobban jelzi az "item-szintű" bejegyzést.
3. Save feedback lokális (Mentve ✓ + piros hibaüzenet)
   - Indoklás: Sprint 4.2 #3 komfort-minta; a debrief section-höz lokális,
     NEM page-szintű ErrorBanner.
4. Loop-lezáró framing: "Zárd le a túrát — 3 kérdés, 1 perc"
   - Indoklás: MemoFox warm voice; a vizuális hierarchiában a debrief a fókusz.
5. NINCS schema-migráció (a trip_debriefs tábla Phase 5-ből megvan)

Módosítás:
- MÓDOSÍTÁS: pages/trips/[id].vue (~50 sor diff)
  + section-áthelyezés a loadout-recs-section ELÉ
  + 4px-es bal oldali brand-500 sáv (kiemelt card vizuális)
  + textarea → 1-soros input csere (3 kérdés)
  + saveDebriefHandler: debriefSavedRecently ref + setTimeout(2000)
  + data-testid="debrief-saved" + data-testid="debrief-error" lokális feedback
- Nincs új endpoint, nincs új utility class, nincs új migration

Acceptance criteria (6 mérhető, QA-hook):
1. Section-sorrend: debrief a recap UTÁN, loadout ELŐTT
2. Vizuális kiemelés: 4px-es bal oldali brand-500 sáv
3. Input-csere: <input type="text"> (NEM textarea)
4. Save feedback: "✓ Mentve" 2mp-ig + lokális piros hiba
5. Loop-framing: "Zárd le a túrát — 3 kérdés, 1 perc"
6. Nincs új migration a supabase/migrations/-ben

Specifikáció teljes terjedelme: docs/sprint-5-p0-product-loop.md §2
[deploy] commit scope (QA jóváhagyás után): lásd §13 a spec fájlban.
next: Full-stack implementation (a parent-agent QA workflow része).
```

### 14.2 P0.2 Trello-paste blokk (`6a80e6426acee2df605e45ab`)

```
Sprint 5 P0.2 — My Gear finomítás — Architect spec (részlet a docs/sprint-5-p0-product-loop.md fájlból)

Cél: a /gear funkciók gyorsabbá és egyszerűbbé tétele (8 elem user-listájából
a Phase 2 + 4.2 után fennmaradó 3 UX-fennakadás: F1, F2, F3).

Döntések (Architect hatáskör, 3-szintű szabály 2-es szint):
1. Leszűkítés: NEM a 8-as user-lista teljes újra-tervezése, hanem 3 fennmaradó
   konkrét UX-fennakadás (F1, F2, F3) javítása
   - Indoklás: a 8 elemből 6-ot a Phase 2 + 4.2 már megoldott; a P0.2 a
     scope-adjacent fix (2-es szintű), NEM újrafaktorálás.
2. F1 — Összsúly placeholder: "Még nincs súlyod — adj hozzá egy cuccot!"
   - Indoklás: MemoFox warm voice; a 0 g / — vizuálisan szegény.
3. F2 — Onboarding A. fázisú segéd-szöveg kiegészítés
   - "Kezdd a legfontosabbal — a többit később is felviheted."
4. F3 — forcedComplete page-szintű respektálása
   - Indoklás: a panel-lokális forcedComplete flag a page-szintű
     showOnboarding-ot nem befolyásolta; ez okozta a "újra megjelenő panel" bugot.
   - Megoldás: defineExpose({ forcedComplete }) + useTemplateRef a page-en.
5. NINCS schema-migráció (a gear_items, categories táblák elegendőek)

Módosítás:
- MÓDOSÍTÁS: components/BaseWeightSummary.vue (~5 sor, F1 placeholder)
- MÓDOSÍTÁS: components/GearOnboardingPanel.vue (~5 sor, F2 segéd-szöveg + defineExpose)
- MÓDOSÍTÁS: pages/gear/index.vue (~10 sor, F3 forcedComplete respektálás)
- Nincs új endpoint, nincs új utility class, nincs új migration

Acceptance criteria (5 mérhető, QA-hook):
1. F1: 0 item-nél "Még nincs súlyod — adj hozzá egy cuccot!" placeholder
2. F2: A. fázisban "Kezdd a legfontosabbal — a többit később is felviheted."
3. F3: 2 item + "Ennyi volt" → panel C.-ben marad; item-törlés → A./B.-be visszaáll
4. Nincs új migration a supabase/migrations/-ben
5. Nincs új utility class / endpoint

Specifikáció teljes terjedelme: docs/sprint-5-p0-product-loop.md §3
[deploy] commit scope (QA jóváhagyás után): lásd §13 a spec fájlban.
next: Full-stack implementation (a parent-agent QA workflow része).
```

### 14.3 P0.3 Trello-paste blokk (`6a80e6438af56d56df99fa20`)

```
Sprint 5 P0.3 — Activation funnel mérés (6 szakasz) — Architect spec (részlet a docs/sprint-5-p0-product-loop.md fájlból)

Cél: 6 aktivációs esemény mérése (signup_completed → first_debrief_written),
hogy a loop hol szakad el, mérhető legyen.

⚠ 3-AS SZINTŰ USER-DÖNTÉS SZÜKSÉGES (a card leírás alapján):
A spec NEM dönt, hanem prezentálja a két opciót (§11):
- A. PostHog (3rd-party): GDPR consent-modal, kész funnel-analysis UI
- B. Saját events tábla (funnel_events): privacy-first, nincs 3rd-party

A parent-agent a user válasza UTÁN dispatchol Full-stack-et.

Döntések (Architect hatáskör, 3-szintű szabály 2-es szint — a döntés ELŐTTI rész):
1. trips.completed_at timestamptz NULL mező hozzáadása (forward-only)
   - Indoklás: a "tervezett → elment" átmenet jelzése; v2 §4 mintát követi.
2. first_completed_trip önálló mérföldkő
   - Indoklás: a trip → loadout → HIKE → debrief loop-ban a Hike a
     completed_at !== null pillanat.
3. Debrief gate: a debrief section CSAK completed_at !== null esetén
   - Indoklás: a loop logikája Hike → Debrief.
4. 6 capture-hívás helye: useGear.create, useTrips.create + addGearToTrip
   + saveDebrief, useTrips.markTripCompleted, pages/signup.vue
   - Indoklás: a meglévő INSERT/UPDATE sikeres ágaira épít; first_* guard user-szinten.
5. NINCS public adat-expozíció (funnel_events RLS user-scoped)
6. NEM Cloudflare Analytics / Mixpanel / stb. (a user kizárta)

Séma-migráció (a user-döntéstől FÜGGETLEN):
- supabase/migrations/20260816000000_trips_completed_at.sql (NEW)

Séma-migráció (CSAK HA a user a saját tábla opciót választja):
- supabase/migrations/20260816000001_funnel_events.sql (NEW)

Endpoint:
- ÚJ: server/api/trips/[id]/complete.post.ts (owner-only completed_at UPDATE)

Composables (a döntéstől függően):
- ÚJ: composables/useFunnelEvents.ts (saját tábla opció esetén)
- MÓDOSÍTÁS: composables/useGear.ts (first_gear_added capture)
- MÓDOSÍTÁS: composables/useTrips.ts (markTripCompleted + 4 capture-hívás)

UI:
- MÓDOSÍTÁS: pages/trips/[id].vue ("Túra lezárása" gomb + debrief gate)
- MÓDOSÍTÁS: pages/signup.vue (signup_completed capture)

Acceptance criteria (7 mérhető, QA-hook — a döntés UTÁN):
1. 1 (vagy 2) új migration a supabase/migrations/-ben
2. markTripCompleted(tripId) endpoint + composable metódus owner-only
3. "Túra lezárása" gomb owner-only, completed_at === null esetén látható
4. Debrief section csak completed_at !== null esetén jelenik meg
5. 6 capture-hívás a megadott helyeken (grep a useGear/useTrips/signup fájlokban)
6. first_* guard minden capture-hívásnál
7. funnel_events RLS user-scoped (NEM publikus)

Specifikáció teljes terjedelme: docs/sprint-5-p0-product-loop.md §4
[deploy] commit scope (QA jóváhagyás után): lásd §13 a spec fájlban.

⚠ A parent-agent a user PostHog vs. saját tábla döntése UTÁN dispatchol
Full-stack-et (3-as szintű side-effect: új külső SDK vagy új migration).

next: User-döntés a §11 kérdésben, UTÁNA Full-stack implementation.
```

---

**Megjegyzés a parent-agent számára:** a fenti három blokk a spec §2-§4 + §14 alapján készült. A sub-agent (Architect, ez a fájl) a 3 Trello-kártyára kommentként postolja a blokkokat (§14.1, §14.2, §14.3), és a szövegek a `docs/sprint-5-p0-product-loop.md` kanonikus forrásra hivatkoznak. A P0.3 esetében a 3-as szintű user-döntés a spec §11 + §14.3 blokk alapján kérdezendő — a parent-agent a döntés UTÁN dispatchol P0.3 Full-stack-et.