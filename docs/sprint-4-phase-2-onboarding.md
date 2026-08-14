# Sprint 4 — Phase 2: Onboarding-flow ("Mi van a felszerelésedben?") Architect Spec

**Author:** Architect (role:architect)
**Date:** 2026-08-15
**Source of truth:** `docs/product-architecture-v2.md` §2 (jóváhagyva 2026-08-14) + §0 döntési elvek
**Phase context:** Sprint 4 v2 prioritás-sorrendben a **2. fázis** (a kategóriák-globalize = Phase 1, jóváhagyva és deployolva, `1802b98`).
**Working tree:** `ultralight-gear-tracker` branch `master` (a `design-pass` branch kanonikus design forrás a 0. szintű szabály alapján)
**Trello kártya:** user által kitöltendő (lásd 10. szekció — Decisions log)

---

## 0. Scope-pivot emlékeztető

A v2 §2 javaslatából Phase 2-be kerül minden, **kivéve**:

- A starter pack koncepció (kész, klónozható listák) — **örökre törölve** a Sprint 4 scope-ból (§2. döntés: "starter pack ötlet kikerül a Sprint 4 scope-ból").
- A Trip-rekord, GPX, dátum — **Phase 2-ben sem jelenik meg.** A 0. elv #5 kimondja: "Egy onboarding-emlékeztető a My Gear-t tölti fel, nem hoz létre Trip-rekordot." Ez a Phase 2 legfontosabb elhatárolása.

A Phase 2 kizárólag a **My Gear / `gear_items` táblát tölti** — ugyanaz a CRUD, amit a meglévő `pages/gear/index.vue` + `GearFormModal` + `useGear()` már megvalósít. Az új komponens ezt a meglévő csővezetéket használja, **nem épít semmilyen párhuzamos write-utat.**

---

## 1. Cél és a 0. szekció elveinek leképezése

| 0. elv | Phase 2 megvalósulása |
|---|---|
| **#1 Valós felhasználói adat > feltételezés** | A felhasználó a SAJÁT, valódi tárgyait viszi fel; nem kínálunk fel kész listát. |
| **#2 Minimalizáld az onboarding-súrlódást** | A komponens ott van, AHOL a felhasználó amúgy is dolgozik (Gear menü tetején); a meglévő `GearFormModal` form-logikáját újrahasznosítjuk, nem építünk újat. |
| **#3 Ne épülj be niche-igényre validáció nélkül** | A v2 §2 alapján a teljes My Gear felület leftáll a Phase 1-ből — az onboarding csak a "0 item" állapotot kezeli, nem talál ki új listát. |
| **#4 Séma-szintű jövő-biztosítás olcsó** | **Nincs új migration.** A Phase 2 tisztán UI/logika; a `gear_items` séma nem változik. |
| **#5 Trip ≠ My Gear** | Tilos bármilyen Trip-rekord, GPX, dátum, vagy "túra" mező a Phase 2-ből. A komponens csak a My Gear listát tölti. |

**További, implicit elv a jelen fázisra**: a Phase 2 **2-es szintű hatáskör** (dokumentált, jóváhagyott sorrend, NINCS új scope / config / credential). A 3 nyitott kérdést (copy, küszöb, animáció) a Designer/PO hatáskörben eldöntöttem — a döntések a 3. szekcióban, indoklással. A Trello kártyán dokumentálom, a user jóváhagyását NEM várom meg (3-szintű szabály).

---

## 2. A komponens neve, helye, életciklusa

### 2.1 Név

`GearOnboardingPanel.vue` — a komponens neve. Az "Panel" utótag jelzi, hogy ez a Gear lista fölötti, in-page panel, nem külön oldal vagy modal.

### 2.2 Hol jelenik meg

A `pages/gear/index.vue` page-en, **a page header (`<h2>...</h2>`) és a `BaseWeightSummary` KÖZÖTT**, a meglévő "+ Add gear" gomb felett. A `GearEmptyState` jelenlegi helye (a lista alatt, ha 0 item) **eltűnik** — a felhasználó a Phase 2 bevezetésével a panel-onboarding felületet fogja látni a 0-item állapotban, nem a page alján lévő CTA-t. A `GearEmptyState` komponens egyelőre **megmarad a fájlrendszerben** (orphan), hogy a rollback-út nyitva maradjon, de a page nem importálja.

A Phase 2 **csak a `pages/gear/index.vue` route-on** aktív. A `pages/gear/new.vue` és `pages/gear/[id].vue` page-ek (egyedi gear create/edit) **érintetlenek** maradnak — ezek a power-user útvonalak, ahol a wizard-panel zavaró lenne.

### 2.3 Életciklus (3 fázis)

| Fázis | Trigger | UI állapot |
|---|---|---|
| **A. Felkínálkozás** | `state.items.length === 0` ÉS a user be van jelentkezve | A panel látszik, teljes szöveggel, kompakt gyors formmal |
| **B. Haladás** | a user elkezdett cuccot felvinni, de még nem érte el a küszöböt | A panel **NEM tűnik el** — látja a saját listáját nőni a panel alatt, a panel haladás-számlálóval frissül (pl. "1 / 3 cucc felvíve") |
| **C. Záródás** | `state.items.length >= KÜSZÖB` (lásd 3.2) | A panel **összezsugorodik** egy slim "completion bar" állapotba — 1 sor, "+ Újabb cucc" gombbal |

A panel **soha nem tűnik el hirtelen, soha nem pattog ki** (lásd 3.3 animáció).

### 2.4 Mikor NEM jelenik meg

- A user nincs bejelentkezve → a panel nem renderelődik (a page middleware miatt a user amúgy is a `/signin` route-ra kerül).
- A user már elérte a küszöböt (3 Phase 2.3 / C. fázis) → a panel slim completion bar-ban van, ami opcionálisan elrejthető (egy bezáró X gombbal a felső sarokban), DE a 0-items trigger nem áll fenn többé, így a panel soha nem jelenik meg újra, amíg a user manuálisan töröl vissza 3 alá.
- A user a küszöb elérése UTÁN töröl gear-itemeket, és visszamegy 2-re → a panel **nem jelenik meg újra**. A panel csak `0` → `KÜSZÖB` átmenetben aktív; onnan "megtanulta", hogy a user tudja a flow-t. (Ha a user későbbiekben töröl — ez a user döntése, nem onboarding-terület.) **Indoklás**: ha a user egyszer már elérte a küszöböt, és utána kitakarítja a listáját, az NEM "reseteli" az onboarding-státuszt. Az újrafelhasználó-élmény fontosabb, mint a panel újbóli megjelenése.

### 2.5 Mikor hívja a meglévő API-t

A komponens **kizárólag a meglévő `useGear().create()` függvényt hívja** — ugyanazt, amit a `pages/gear/index.vue` is használ. A write-út, a zod validáció, a base-weight refresh, a komponensek közötti reaktivitás (a `GearCard` listája is frissül) mind automatikusan jönnek.

A komponens **NEM hív** semmilyen új API-t, **NEM nyit** új endpoints-ot, **NEM nyúl** a Supabase-hoz közvetlenül. Ez a 0. elv #4 "séma-szintű jövő-biztosítás olcsó" megfordítása: **logika-szintű jövő-biztosítás DRÁGA** — nem építünk párhuzamos write-utat.

---

## 3. A 3 nyitott kérdés eldöntve (Designer/PO hatáskör)

### 3.1 Copywriting — KÉT RÉTEG, KÉT SZÖVEG

A v2 §2 **"Mi van a felszerelésedben?"** + **"Ha már túráztál, felviheted a legutóbbi túrád felszerelését"** szövege **VÉGLEGESÍTÉSRE KERÜL** az alábbi módosításokkal:

| Szint | Szöveg | Indoklás |
|---|---|---|
| **Főcím (H3)** | **"Mi van a felszerelésedben?"** | Végleges. Személyes, birtokos, közvetlen. H3 szint, `font-display font-bold` (~22-26px a MemoFox §3.3 alapján). |
| **Segédprompt (body)** | **"Ha már túráztál, vedd sorra, mi volt nálad — ha még nem, kezdd a legfontosabbal."** | Apró finomítás: a "felviheted a legutóbbi túrád felszerelését" túl hosszú és accusativusos; az új szöveg rövidebb, kétfelé ágazik (volt már túrázó / kezdő), és aktív cselekvésre szólít. A "legfontosabbal" szó később, kiegészítésként használható, ha a user 0 item-ről indul. |
| **Mentés utáni gomb (elsődleges)** | **"Még egy cucc"** | Végleges (v2 verbatim). A "cucc" szó informalitása illeszkedik a MemoFox "warm, playful" voice-hoz. |
| **Mentés utáni gomb (másodlagos befejező)** | **"Ennyi volt"** | Végleges (v2 verbatim). Magyarban természetes, "kész vagyok" értelemben. |
| **Haladás-számláló (B. fázis)** | **"X / 3 cucc felvíve"** | A küszöböt (3) explicit megmutatja — a user tudja, mennyi van hátra. A 3-as szám a tervezés-pszichológia "mágikus szám" tartományában van (Kahneman: 3 item elég a "flow" érzethez). |
| **Completion bar (C. fázis)** | **"Szép, van miről tervezned. Ide bármikor visszajöhetsz."** | A "szép" szó MemoFox brand voice-ot idézi; a "van miről tervezned" utal a 0. elv #5-re (a My Gear kész, Trip-rekord jöhet, de ebben a fázisban még nem). |

**A "Magyar a felület" elv**: a P4.5 marketing copy (lásd `LandingHero.vue`, `LandingCta.vue`) **magyar** volt, nem angol. A Phase 2 konzisztens marad — minden mikrocopy magyar. A `gear_items.name` user-től jön, tehát az bármi lehet, de a keret-szövegek fixen magyarok.

### 3.2 Küszöbszám — **3**

A v2 §2 nyitva hagyta: "legalább néhány". **Döntés: 3.**

**Indoklás** (a Designer/PO hatáskör):

1. **3 a "mágikus szám" minimuma** (kognitív pszichológia, Miller's law kapcsolódó határa). 1 item-vel a user még nem "érzi" a listát; 2-vel már igen, de még nem "flow"; 3-mal a user érzékeli a rendszer értelmét (tud súlyt számolni, összehasonlítani, érezni, hogy "van ez is, az is").
2. **A 3 item elég a base-weight summary értelmes megjelenéséhez.** A `BaseWeightSummary` komponens 0 item esetén "—" értéket mutat (vagy üres marad); 3 item felett valódi számot tud mutatni, és a user látja, hogy a rendszer " működik" — ez a Phase 2 Rövid visszacsatolás pillanata.
3. **A 3 item nem túl alacsony** (különben a panel "instant" eltűnne, ami sérti a §0 "haladás-érzet" elvét), **és nem túl magas** (5 felett a user elveszítené a motivációt, és a panel "örökké" ott ülne).
4. **A 3 száma később A/B tesztelhető** — a `KÜSZÖB` egyetlen `const` a komponensben, így a user-visszajelzés alapján 5-re vagy 2-re módosítható anélkül, hogy a flow logikája megváltozna.

**Számláló megjelenítése**: a panel B. fázisában a számláló a haladás-sávban látszik ("1 / 3", "2 / 3"). A 3. item mentésekor a panel **nem tűnik el azonnal** — a 3. mentés animációját (lásd 3.3) használja, és a B. → C. fázis-átmenet 600ms-ig tart.

### 3.3 Vizuális átmenet — **HIBRID COLLAPSE**

A v2 §2 két fontos elvet mond ki, amelyek látszólag feszülnek egymásnak:

- "a komponens **nem tűnik el hirtelen**" (anti-jank)
- "a felhasználó látja, ahogy a saját gear-listája lentebb **élőben nő**" (pozitív visszacsatolás)

**Döntés: a komponens nem tűnik el, hanem a B. fázisban **`height: auto` collapse**-el egy slim completion bar-ba megy át. A lista lent közben animáltan nő (a meglévő Vue `<TransitionGroup>`).

**A 3 fázis vizuális állapotai (MemoFox token-ekkel)**:

#### A. fázis (0 item) — teljes panel

```
┌─────────────────────────────────────────────────────────────────┐
│  Mi van a felszerelésedben?                                     │
│  Ha már túráztál, vedd sorra, mi volt nálad — ha még nem,       │
│  kezdd a legfontosabbal.                                        │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Pl. "Mountain Hardwear Porcelain"          Hálózsák ▾  │  │
│  │                                              820 g    +  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

- Háttér: `bg-blushLight-50` (MemoFox §7.2 light feature card)
- Forma: `rounded-card` (24px), `p-6`, `shadow-sm`
- Panel-ikeronság: bal oldalon egy `icon-accent` (narancs, MemoFox §8) — hátizsák ikon (HeroIcons "backpack"), vonalas stílus, 2px stroke
- Főcím: `font-display font-bold text-espresso-900` (MemoFox §3.1)
- Segédprompt: `font-body text-espresso-900/80` (MemoFox §3.2)
- Haladás-sáv: nem látszik (0 / 3)

#### B. fázis (1-2 item, BÖVÜLÉS) — teljes panel + haladás-sáv

```
┌─────────────────────────────────────────────────────────────────┐
│  Mi van a felszerelésedben?                                     │
│  Ha már túráztál, vedd sorra, mi volt nálad — ha még nem,       │
│  kezdd a legfontosabbal.                                        │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Pl. "Decathlon Forclaz MT100"             Hálózsák ▾   │  │
│  │                                              820 g    +  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ●●○  2 / 3 cucc felvíve                                         │
└─────────────────────────────────────────────────────────────────┘
```

- A panel szerkezete azonos az A. fáziséval
- A haladás-sáv a panel alján: 3 db `h-1.5 w-8 rounded-full` dot, kitöltött = `bg-moss-500`, üres = `bg-espresso-900/15`
- A számláló a haladás-sáv mellett jobbra: `font-body text-sm text-espresso-900/70`
- A lista lent a `<TransitionGroup>`-pel: új item `slide-down + fade-in` 300ms-ig (a meglévő GearCard animáció, ha van; ha nincs, Vue auto-class)

#### C. fázis (3+ item) — SLIM COMPLETION BAR

```
┌─────────────────────────────────────────────────────────────────────┐
│  ✓ Szép, van miről tervezned. Ide bármikor visszajöhetsz.   + Újabb│
└─────────────────────────────────────────────────────────────────────┘
```

- Háttér: `bg-iceBlue-50` (MemoFox §2.2 világoskék, "kész" állapotjelzés)
- Forma: `rounded-pill` (a pill a MemoFox §3.1 "playful rounded" nyelvet viszi tovább a sikeres-komplett állapotban)
- Magasság: 56px, `px-5 py-3`
- Bal oldal: `icon-accent` checkmark ikon (MemoFox §8)
- Jobb oldal: `+ Újabb cucc` gomb (`btn-secondary` kicsiben, 12px-es szöveggel)
- A felső sarok: `×` bezáró gomb (8x8 ikon, `text-espresso-900/40 hover:text-espresso-900/70`) — ez a **manuális elrejtés** kapuja, de a 0. elv #2 ("ne kérjünk döntést/adminisztrációt") miatt **a bezáró gomb NEM reseteli a Phase 2-t** — elrejti a sávot, de `state.items.length >= 3` esetén a panel soha nem jelenik meg újra automatikusan

#### A → B → C animáció

- **A → B**: a haladás-sáv a panelen belül `opacity-0 → opacity-1, height: 0 → auto` 400ms `ease-out` (Vue `<Transition>` name="accordion"). A panel külső mérete nem változik.
- **B → C**: a 3. item mentésekor a panel A/B-tartalma **becsukódik** (`height: auto → 0`, `opacity: 1 → 0`, 500ms `ease-in-out`), a C. fázisú slim bar pedig **megjelenik** (`opacity: 0 → 1`, `translate-y-2 → 0`, 500ms `ease-out`) — az átmenet **szinkronizált** (a B. panel teteje a C. bar aljánál zárul), így a vizuális ugrás minimális.
- **Lista lent (bármely fázisban)**: a `<TransitionGroup>` `name="gear-list"` `slide-down + fade-in` 300ms-re minden új item-re. A `<TransitionGroup>` a `GearCard` kulcsait (`item.id`) használja, így a Vue rendesen mountolja az újakat és nem re-rendereli a meglévőket.

**Anti-jank biztosítékok**:
- A `requestAnimationFrame` NEM kell (a Vue `<Transition>` natívan RAF-ot használ).
- A panel `min-height` értéket kap (`min-h-[280px]`), hogy az A. fázisban ne "ugorjon" a lista a panel alatt, amikor a haladás-sáv megjelenik.
- A `<TransitionGroup>` `tag="ul"`-lel fut, a `ul.mt-2.space-y-2` meglévő osztályait megőrzi.

---

## 4. A komponens belső struktúrája

### 4.1 `GearOnboardingPanel.vue` — szkript-szerkezet

```typescript
// Pseudo-code, a valódi implementáció a fullstack fázis
const props = defineProps<{}>(); // nincs prop — a panel a useGear()-ből olvas
const { state, create } = useGear();

const KÜSZÖB = 3; // lásd 3.2

const computedPhase = computed(() => {
  if (state.value.items.length === 0) return 'A';
  if (state.value.items.length < KÜSZÖB) return 'B';
  return 'C';
});

const submitting = ref(false);
const form = reactive({
  name: '',
  category_id: '',
  weight_g: '' as number | '',
});

// Ugyanaz a zod validáció, mint a GearFormModal-ban
// (a közös séma a shared/gearSchemas.ts-ból jön)
const validation = computed(() => gearCreateSchema.safeParse(buildPayload()));
const canSubmit = computed(() => validation.value.success);

const handlePrimary = async () => {
  if (!canSubmit.value) return;
  submitting.value = true;
  try {
    await create(buildPayload()); // <-- meglévő useGear().create
    // Reset form, stay on panel
    form.name = '';
    form.category_id = '';
    form.weight_g = '';
  } catch {
    // useGear().create() már beírta state.error-ba — a page-en az ErrorBanner jelenik meg
  } finally {
    submitting.value = false;
  }
};

const handleSecondary = () => {
  // "Ennyi volt" — B. fázisban a panelt C. fázisba kényszerítjük
  // (a user döntése, hogy nem akar többet felvinni, de a system Nem reseteli a Phase 2-t,
  // csak a slim bar-ra vált)
  // Megvalósítás: dispatch 'force-complete' event, vagy lokálisan state-tel felülírjuk a computedPhase-ot
};
```

### 4.2 A meglévő séma használata

**Nem építünk új zod-sémát.** A `shared/gearSchemas.ts` `gearCreateSchema` és `GearFormShape` újrafelhasználható. A panel ugyanazt a 3 mezőt kéri (név, kategória, súly), mint a `GearFormModal` — a `price` és `excluded_from_base` **nem jelenik meg** a panelen (zajos, lassítja a flow-t; a Phase 2 csak az onboarding gyors első lépéseit támogatja).

### 4.3 A panel NEM MODAL

A v2 §2 nem mondja, hogy modal legyen, és a meglévő `GearFormModal` alkalmas is lenne, DE:

- A modal bezáródik mentés után → a user elveszíti a kontextust, újra kell kattintania a "+ Add gear" gombra → **sérül a "folyamatos hozzáadás" elv** (v2 §2: "legyen egy gyors, folyamatos hozzáadás-felület").
- A modal leválasztja a user-t a listájáról → **elveszik a "lentebb élőben nő" érzés** (v2 §2).

A panel **inline form**, NEM modal. A `GearFormModal` meglévő kódja referenciaként szolgál (focus trap, Esc-to-close, zod validáció), DE a Phase 2-ben ezek egyike sem kell — a panel mindig látszik, nincs bezárás, nincs focus trap.

### 4.4 A panel szegélye és a "külön érzet"

A panel a page-en **kiemelkedik** a `BaseWeightSummary` és a `GearCard` lista közül, mégsem különül el élesen. A MemoFox §7.2 light feature card formát követi:

- Háttér: `bg-blushLight-50` (halvány krémszín, kontraszt a fehér `GearCard`-okkal + a `bg-gray-50` body-val)
- Border: `border-0` (nincs szegély, a háttérszín elég kontrasztot ad)
- Shadow: `shadow-sm` (finom, nem tolakodó)
- Padding: `p-6` (24px)
- Forma: `rounded-card` (24px — MemoFox §5)

A panel **NEM** használja a `card-dark` (espresso) vagy `card-light` (blushLight) utility-t közvetlenül, mert a `card-light` a `shadow-sm`-on túl nincs specializálva a panel-szintű animációra. A panel a saját Tailwind osztályaival éri el a kinézetet (rugalmasabb animáció-kezelés).

### 4.5 A panel ikonja

MemoFox §8: "ikonok konzekvensen `#EB5D36` (Ember Orange), 2px stroke, ~2px stroke súly, kerekded vonalvégek". A panel ikonja: **backpack** (HeroIcons `outline/backpack`), 40px×40px, 2px stroke, `text-ember-500`. Balra igazítva, a H3 címmel egy sorban (mobilon: a H3 alatt, középre igazítva).

A backpack ikon a termék-branddel is összhangban van (MemoFox §1 "warm, playful, outdoor") — a túra-hátizsák a túra-felszerelés univerzális szimbóluma.

---

## 5. A meglévő `pages/gear/index.vue` módosítása

A meglévő page-en **3 változás** történik:

### 5.1 Import + render

```vue
<script setup>
// ... meglévő importok
import GearOnboardingPanel from '~/components/GearOnboardingPanel.vue';
</script>

<template>
  <section>
    <div class="mb-4 ..."> <!-- meglévő header -->
      <h2>...</h2>
      <button>+ Add gear</button> <!-- meglévő -->
    </div>

    <BaseWeightSummary /> <!-- meglévő -->

    <!-- ÚJ: onboarding panel, ha a Phase 2 aktív -->
    <GearOnboardingPanel v-if="showOnboarding" />

    <ErrorBanner ... /> <!-- meglévő -->
    <p v-if="state.loading">Loading…</p> <!-- meglévő -->

    <!-- A GearEmptyState ELTŰNIK — a panel A. fázisa átveszi a szerepét -->
    <ul v-else class="mt-2 space-y-2">
      <li v-for="g in state.items" :key="g.id">
        <GearCard ... />
      </li>
    </ul>

    <GearFormModal ... /> <!-- meglévő, nem érintett -->
  </section>
</template>
```

### 5.2 `showOnboarding` computed

```typescript
const showOnboarding = computed(() => {
  // A panel mindaddig aktív, amíg a user 0..(KÜSZÖB-1) item között van
  // ÉS a user be van jelentkezve (middleware-biztosítva, de SSR-defensive)
  return state.value.items.length < KÜSZÖB && !!user.value;
});
```

A `KÜSZÖB` (3) a `GearOnboardingPanel` belső konstansa, de a `showOnboarding` feltétel ugyanazt a 3-as értéket használja — a kettő **szinkronban kell legyen**. Megoldás: a `KÜSZÖB` a `composables/useOnboardingPhase.ts` composable-ben él, és a page + a panel is onnan olvassa. (Lásd 6. szekció.)

### 5.3 A `GearEmptyState` eltávolítása

A `pages/gear/index.vue` `<div v-else-if="state.items.length === 0">` blokkja **eltűnik**. A `GearEmptyState.vue` komponens megmarad a fájlrendszerben (orphan, nem importálja senki), hogy rollback esetén a page egy `git checkout` visszaállíthassa. A `GearEmptyState` **NEM törlődik** a Phase 2 PR-ből.

### 5.4 A `+ Add gear` gomb

A meglévő `+ Add gear` gomb **megmarad**, DE **a 0-item állapotban rejtve van** (a panel A. fázisa átvette a CTA szerepét). A `v-if="state.items.length > 0"` feltételt kap. Ha a usernek van 1+ item-e, a gomb továbbra is ott van a page header-ben (power-user útvonal).

---

## 6. A `composables/useOnboardingPhase.ts` — megosztott fázis-logika

A `KÜSZÖB` és a 3 fázis logikája **NE** a `GearOnboardingPanel.vue`-ban éljen egyedül, mert:

- A `pages/gear/index.vue`-nek kell tudnia, mikor mutassa a panelt (lásd 5.2).
- A későbbi A/B-teszt (5-ről 2-re, vagy 3-ról 4-re) egyetlen fájlban módosítható.

```typescript
// composables/useOnboardingPhase.ts
import { computed } from 'vue';
import type { GearItemRow } from '~/types/db';

export const ONBOARDING_KÜSZÖB = 3; // lásd 3.2 indoklás

export type OnboardingPhase = 'A' | 'B' | 'C';

export function useOnboardingPhase(itemCount: ComputedRef<number> | number) {
  const count = computed(() =>
    typeof itemCount === 'number' ? itemCount : itemCount.value
  );

  const phase = computed<OnboardingPhase>(() => {
    if (count.value === 0) return 'A';
    if (count.value < ONBOARDING_KÜSZÖB) return 'B';
    return 'C';
  });

  const isActive = computed(() => phase.value !== 'C' || count.value < ONBOARDING_KÜSZÖB);

  return { phase, isActive, küszöb: ONBOARDING_KÜSZÖB };
}
```

**A `isActive` computed magyarázata**: a panel a C. fázisban (3+ item) is "aktív" marad, csak slim formában. A `pages/gear/index.vue` `showOnboarding` computed-ja a `phase !== 'C'` logikát használja, mert a C. fázisban a panel teljes eltűnése a cél (helyette a slim completion bar él, ami a panel belsejében van, nem a page-en).

---

## 7. A panel űrlapjának komponensei

### 7.1 Az inline form

A panelen belül a form **inline**, nem modal. A mezők:

| Mező | Tipus | Validáció | MemoFox stílus |
|---|---|---|---|
| **Név** | `text` input, `maxlength="80"`, `placeholder="Pl. Decathlon Forclaz MT100"` | `z.string().min(1).max(80)` | `.input` pill, `bg-blushLight-50` |
| **Kategória** | `select`, a `useCategories` listájából | `z.string().uuid()` | `.input` pill |
| **Súly (g)** | `number`, `min="0"`, `max="50000"`, `step="1"`, `placeholder="820"` | `z.number().int().nonnegative().max(50_000)` | `.input` pill |
| **+** (mentés) | `button` (icon-only, 40×40, `bg-ember-500` háttér, fehér `+` ikon) | — | `.input` de kör alakú, `rounded-full` |

A `+` gomb **icon-only** (40×40 px, `rounded-full`, `bg-ember-500`, `text-white`), közvetlenül a súly input után. A `placeholder` a `name` mezőben a "leggyakoribb első item" példát mutatja (hálózsák), hogy a usernek legyen kapaszkodó.

A 3 mező **egysoros** (mobilon: 2 sor, a kategória és a súly egymás mellett, a `+` gomb a súly után). A `gearFormModal` 2-column grid mintáját követi, de a panelen a 3. oszlop a `+` gomb.

### 7.2 A "Még egy cucc" és "Ennyi volt" gombok

A panel **alatt** jelennek meg, **csak az item sikeres mentése után**, a panel alján, 1 sorban:

- **"Még egy cucc"** (elsődleges, `btn-primary` mini, 14px szöveg, `px-5 py-2`)
- **"Ennyi volt"** (másodlagos, `btn-secondary` mini, 14px szöveg, `px-5 py-2`)

A két gomb a panel B. fázisában jelenik meg, a haladás-sáv helyén (vagy a haladás-sáv alatt, ha van hely). A C. fázisban a "Még egy cucc" gomb a slim bar `+ Újabb cucc` gombja.

### 7.3 A "+ Add gear" hatás-viselkedése a panelben

A panel **+** gombja a `useGear().create()` hívás. A `GearFormModal.handleSubmit` kódja **referenciaként** szolgál, de a panel-szintű validáció és a state-kezelés a panelen belül történik (nem kell a page-re hívatkozni).

A panel **nem dob saját error-t**. A `useGear()` `state.error`-ját használja, és a `pages/gear/index.vue` meglévő `ErrorBanner` komponense jeleníti meg (a panel felett vagy alatt, a `state.error` flag alapján). Ezzel elkerüljük, hogy a panelen belül legyen egy másodlagos error-sáv, ami zavaró lenne.

---

## 8. A panel és a `Trip`-route viszonya

A 0. elv #5 kimondja: "ez a flow kizárólag a My Gear listát tölti — NEM hoz létre Trip-rekordot". A Phase 2 **NEM**

- irányítja a usert a `/trips` route-ra,
- kínál "új túra" CTA-t,
- hív trip-create API-t.

A panel C. fázisában a completion bar szövege ("Szép, van miről tervezned") **nem CTA**, hanem visszacsatolás. A "Tervezés" szó a kontextusra utal (a My Gear kész, a Trip jöhet), de a gomb **"Új túra" lenne, és a C. fázisba terelné a usert** — ami a Sprint 4 #22 "Trip-aware loadout" feature későbbi fázisához tartozik, **nem a Phase 2-höz**.

Ha a user a panelen kívül (a page header-ben, vagy a `/trips` route-ról) túrát akar létrehozni, a meglévő flow-ék érintetlenek. A Phase 2 **csak a Gear oldalra localizált**.

---

## 9. Acceptance criteria (Phase 2 doboz)

A Phase 2 akkor tekinthető késznek, ha az alábbi 7 pont mind teljesül:

1. **A `pages/gear/index.vue` 0-item állapotában** a panel A. fázisa látszik, a `GearEmptyState` nem.
2. **1-2 item** állapotában a panel B. fázisa látszik, a haladás-sáv "1 / 3" vagy "2 / 3" szöveggel.
3. **3+ item** állapotában a panel C. fázisában a slim completion bar látszik, a checklist összecsukódott.
4. **A `+` gomb** megnyomása validáció nélkül **disabled**; valid kitöltéssel a `useGear().create()` hívódik, és a panel nem tűnik el (panel reseteli a formot, B. fázisban marad).
5. **A `Még egy cucc` gomb** a panel B. fázisában megnyomva a formot reseteli (clear name, category, weight), focus a name inputra.
6. **Az `Ennyi volt` gomb** a panel B. → C. fázisba kapcsol (a C. fázis slim bar megjelenik).
7. **A `GearCard` lista** minden új item mentésekor animáltan (slide-down + fade-in 300ms) megjelenik a panel alatt.

A 7. pont ellenőrzéséhez a meglévő `<ul>`-ben lévő itemeket `<TransitionGroup name="gear-list" tag="ul">` kell cserélni. A `gear-list` Vue transition osztályait a `assets/css/tailwind.css` végére kell felvenni:

```css
.gear-list-enter-active,
.gear-list-leave-active {
  transition: opacity 300ms ease-out, transform 300ms ease-out;
}
.gear-list-enter-from,
.gear-list-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.gear-list-move {
  transition: transform 300ms ease-out;
}
```

Ez a 8 soros CSS-snippet **nem új utility**, hanem a `<TransitionGroup>` natív Vue API-jához tartozó named class. A `tailwind.config.ts` és a P4.4 utility-készlet **érintetlen**.

---

## 10. Decisions log (Trello kártyára másolandó)

A 3-szintű szabály alapján a döntések a Phase 2-t megvalósító team (Full-stack) hatáskörébe tartoznak, a user jóváhagyása NEM kell. A döntéseket a Trello card description-jében dokumentálom:

```
Sprint 4 — Phase 2: Onboarding-flow ("Mi van a felszerelésedben?")
Spec: docs/sprint-4-phase-2-onboarding.md

Döntések (Designer/PO hatáskör):
1. Copywriting:
   - Főcím: "Mi van a felszerelésedben?" (v2 §2 verbatim)
   - Segédprompt: "Ha már túráztál, vedd sorra, mi volt nálad — ha még nem, kezdd a legfontosabbal."
   - Mentés utáni gombok: "Még egy cucc" / "Ennyi volt" (v2 §2 verbatim)
   - Haladás-számláló: "X / 3 cucc felvíve"
   - Completion bar: "Szép, van miről tervezned. Ide bármikor visszajöhetsz."
2. Küszöbszám: 3 (Miller's law minimum + base-weight summary értelmes megjelenés)
3. Vizuális átmenet: HIBRID COLLAPSE (B. → C. szinkronizált collapse 500ms)

Komponensek:
- ÚJ: components/GearOnboardingPanel.vue
- ÚJ: composables/useOnboardingPhase.ts
- MÓDOSÍTÁS: pages/gear/index.vue (panel import + showOnboarding + GearEmptyState eltávolítása)
- MÓDOSÍTÁS: assets/css/tailwind.css (8 sor .gear-list-* transition class)
- ÉRINTETLEN: components/GearFormModal.vue, components/GearCard.vue, composables/useGear.ts, shared/gearSchemas.ts
- ORPHAN (rollback-út): components/GearEmptyState.vue (fájl megmarad, nem importálja senki)

Nincs új migration, nincs új API endpoint, nincs új utility class.
```

---

## 11. Out of scope (Phase 2-re NEM)

A Phase 2 NEM foglalkozik:

- **Starter pack koncepció** (örökre törölve, v2 §2).
- **Trip-rekord, GPX, dátum** (0. elv #5, külön fázis).
- **Wishlist onboarding** (a Wishlist oldalnak van saját `WishlistEmptyState.vue`, Phase 2 a Gear-re localizált).
- **Greeting modal / first-login tutorial** (a Phase 2 inline, nem modal — a 0. elv #2 "minimalizáld az onboarding-súrlódást" ezt diktálja).
- **Push-notification / email reminder** (jelenleg sincs ilyen feature, a Phase 2 nem épít ilyet).
- **A `GearEmptyState` törlése** (orphan marad, rollback-út).
- **A `+ Add gear` gomb feltételes elrejtése Power-user mode-szal** (a page header-ben lévő gomb 0-item esetén rejtve, de nincs "advanced mode" kapcsoló).
- **A panel animációinak perzisztálása** (a panel állapota a `useGear().state.items.length`-ből származik, nincs külön localStorage vagy cookie — a Phase 2 tisztán a `gear_items` tábla aktuális állapotából dolgozik).

---

## 12. Rollback-út

Ha a Phase 2 nem tetszik a usernek a deploy után:

- A `GearEmptyState` komponens megmaradt a fájlrendszerben.
- A `pages/gear/index.vue` 3 sornyi módosítása (panel import + `showOnboarding` + `GearEmptyState` visszaállítása) visszaállítható.
- A `composables/useOnboardingPhase.ts` törölhető.
- A `components/GearOnboardingPanel.vue` törölhető.
- A `tailwind.css` 8 sornyi kiegészítése (`gear-list-*`) eltávolítható, ha a `<TransitionGroup>` is visszakerül sima `<ul>`-re.

A rollback 1 PR, ~30 sor diff. A `[deploy]` jelölést a parent agent kezeli a QA jóváhagyás után.

---

## 13. Handoff — Phase 2 → Phase 3

A Phase 2 (onboarding) **BEFEJEZÉSE UTÁN** a Sprint 4 v2 prioritás-sorrend következő lépése a **4-es fázis** (v2 §4): a `trips` tábla `visibility` és `participation` mezők hozzáadása + DB-constraint a tiltott kombinációkra. Ez a Phase 2-től **független**, de a `gear_items` séma stabilitásától függ (a Phase 2 nem nyúlt hozzá, így a Phase 3 indulhat).

A Phase 2 az átmenet a "My Gear kész" és a "Trip-tervezés" között — a Sprint 4 #22 (Trip-aware loadout) fázis ezután jön, de csak a #21 (My Comfort) és #23 (Debrief) után, a v2 §Összefoglaló sorrendje szerint.

---

**Vége a Phase 2 spec-nek.** A parent agent a Trello kártyán a 10. szekció "Decisions log" szövegét + a `docs/sprint-4-phase-2-onboarding.md` linkjét veszi fel, majd a Full-stack átveszi a megvalósítást. A `[deploy]` commit a QA jóváhagyás után a parent agent feladata.
