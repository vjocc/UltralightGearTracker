# Sprint 4 — Design Refactor (Architect Brief)

**Author:** Architect (role:architect)
**Date:** 2026-08-14
**Source of truth:** `docs/Design-System.md` (208 lines, 12 sections), `docs/MF-Home.pdf`, `docs/Hero/*`, `docs/design-system-details/`
**Working tree:** `ultralight-gear-tracker` (NUXT 3 + Supabase)
**Trello card:** `6a7e44455f1a3687cc6d326b`

---

## ⚠️ CRITICAL SCOPE-PIVOT (must be resolved by user before any phase starts)

The canonical design system (`docs/Design-System.md`) is for **MemoFox**, a **video-editor service** (túrázás / utazás / esküvő / extrémsport footage → edited memory film). The current product is the **Ultralight Gear Tracker**, a hiking gear CRUD + trip planner.

Sections of the design system that DO NOT translate 1:1 to this product:

| Design-System section | MemoFox framing | Translation needed for Gear Tracker |
|---|---|---|
| Section 1 "Márkakarakter" | "video editor service, nyers kalandos felvételekből vágott emlékfilm" | Replace with "hiking gear tracker, túracsomag tudatos tervezése" |
| Section 6 "Példák: Töltsd fel a videóid! / Megrendelem" | upload video + order video | Replace with "Összerakom a túracsomagomat / Tervezem a következő túrát" |
| Section 7.1 "4 lépéses folyamatbemutató" (Rendeld meg → Tedd egyedivé → Töltsd fel → Ünnepelj) | ordering → customisation → upload → celebrate | Must be re-imagined for gear tracker (e.g. **Gyűjtsd össze a cuccod → Tervezd meg a túrát GPX-szel → Oszd meg a bandával → Éld meg / Írd meg a beszámolót**) |
| Section 8 "Ikonográfia" motifs | kosár, ceruza, felhő+feltöltés, monitor+play, napkelte, hegycsúcs, rakéta, konfetti, kamera, csengő | Some motifs (hegycsúcs, napkelte) overlap; others (kamera, konfetti, rakéta) don't |
| Section 9 "Footer illusztráció" | "lapos, réteges hegyvonulat-illusztráció, 3 barna árnyalati réteg" | Mountain motif FITS the hiking product — keep! |
| Section 11 Component inventory (10 components) | Nav, Hero, Split panel, Zig-zag, Process block, Use-case grid, Showcase + overlay, Moss divider, Feature zig-zag, Footer illustration | Translate to Gear Tracker equivalent: Nav, Hero, Gear benefits grid, Trip planner showcase, Process block (gear CRUD), Friends sharing, Recap photo grid, Footer |

**Verdict:** The **palette, typography, border-radius, card patterns, and section-rhythm principles** are product-agnostic and transfer cleanly. The **illustration motifs, copy, and 10-component page architecture** must be re-interpreted for the gear tracker.

---

## 1. Dependency graph (6 phases)

```
P4.0 Tailwind palette swap  ──┐
                              ├──► P4.4 Buttons + Forms ──┐
P4.1 Hero redesign (assets)  ──┘                         │
                              ┌──► P4.2 Landing page    ──┤
                              │                            │
                              │                            ▼
P4.3 UI components refactor  ──┴──► (uses tokens from P4.0) ──► P4.5 Marketing copy
```

- **P4.0** is the foundation — every later phase depends on the new tokens (brand, espresso, ember, moss, fog grey, ice blue, blush light, blush mid, umber + radii + typography).
- **P4.4** consolidates the component-level utilities on top of P4.0; can be merged with P4.3 if scope is tight.
- **P4.1** can start in parallel with P4.0 (Hero images are static assets, no token dependency) — but the actual implementation needs P4.0.
- **P4.2** depends on P4.0, P4.1, P4.4.
- **P4.3** depends on P4.0, P4.4; can parallel-track P4.2.
- **P4.5** depends on P4.2 (landing structure must be in place) + P4.3 (component language must be consistent).

**Recommended execution order:** P4.0 → (P4.4 ∥ P4.1) → (P4.3 ∥ P4.2) → P4.5

---

## 2. Phase-by-phase scope

### P4.0 — Tailwind config palette swap · 3 SP
- **Files:** `tailwind.config.ts`, `assets/css/tailwind.css`
- **Add MemoFox palette:** `brand` (#7936EB, 50–900), `espresso` (#2D0E05, 50–900), `ember` (#EB5D36, 50–900), `moss` (#867E36, 50–900), `fogGrey` (#D9DDDE), `iceBlue` (#EDF4F6), `blushLight` (#FBF4F2), `blushMid` (#EBE2DF), `umber` (#573933).
- **Remove:** `bark`, `moss` (old), `sand`, `clay`, `loam` — but **only after a repo-wide grep to find all references** (high blast radius: `tailwind.config.ts`, all `components/*.vue`, `pages/*.vue`, `assets/css/tailwind.css`).
- **Add border-radius tokens:** `pill: '9999px'`, `card: '24px'`, `cardLg: '28px'`, `panel: '18px'`, `panelSm: '16px'`.
- **Add typography tokens:** `fontFamily.display` (Baloo 2 / Fredoka / Poppins ExtraBold — assigned to a Google Fonts link in `nuxt.config.ts`), `fontFamily.body` (Inter/Poppins Regular).
- **Add font-size scale:** hero h1 (52–56), h2 (36–40), h3 (22–26), h4 (18–20), body-lg (18), body (16), button (16), nav (15).
- **Risks:** old palette is referenced in ~20 components. Plan a **mechanical refactor PR** with a `rg "bark-|moss-|sand-|clay-|loam-"` dry-run before bulk-rename.

### P4.1 — Hero redesign + parallax · 5 SP
- **Files:** `components/LandingHero.vue`, `public/hero/background.png` (copy from `docs/Hero/Hero-image-background.png`), `public/hero/front.png` (copy from `docs/Hero/Hero-image-front.png`).
- **Composite:** 2 layered `<img>` elements, background full-width ~800px tall z-index 0, front z-index 10 with intentional offset.
- **Parallax:** CSS-only `transform: translateY(scrollY * 0.3)` via `useScroll` from `@vueuse/core` (already in Nuxt stack — no new dep) OR `@nuxt/image` + `loading="lazy"` + manual `requestAnimationFrame` throttling.
- **Responsive:** stack on mobile, side-by-side on >= sm; background keeps width, front constrains to 60–70% width.
- **CTA pair:** filled (brand purple pill) + outline (espresso pill) — matches Design System section 6.3.
- **Out of scope:** don't add the mountain footer illustration here (that's P4.5 scope).

### P4.2 — Landing page redesign · 5 SP
- **Files:** `pages/index.vue`, `components/LandingBenefits.vue`, `components/LandingCta.vue`, `components/LandingFooter.vue`.
- **Container:** max-w-7xl (1280px) instead of current max-w-5xl.
- **Section rhythm:** alternating background — Hero (gradient) → White → Fog Grey → Blush Light → Blush Mid → Blush Light → Footer (Umber illustration).
- **Typography:** H1 display ExtraBold (52–56), H2 ExtraBold (36–40), H3 Bold (22–26).
- **Zig-zag layout:** 2 image+text blocks (image left, text panel right, then swap), offset overlap with `shadow-md`.
- **Copy:** **WAITING ON USER PIVOT** — see open questions. The MemoFox "Rendeld meg / Tedd egyedivé / Töltsd fel / Ünnepelj" 4-step process must be re-interpreted for gear tracker.

### P4.3 — UI components refactor · 8 SP
- **Files (18 components):** `GearCard`, `WishlistCard`, `TripCard`, `TripFormModal`, `TripGearPicker`, `GearFormModal`, `WishlistFormModal`, `RefreshPricesButton`, `AppHeader`, `AppSpinner`, `FriendsCard`, `RecapForm`, `RecapPhotoGrid`, `TripCommentThread`, `GearCommentThread`, `BaseWeightSummary`, `TripWeightSummary`, `ErrorBanner`.
- **Card patterns:**
  - **Dark process card pattern** (`@layer components .card-dark`): `bg-espresso text-white rounded-card` with ember icon.
  - **Light feature card pattern** (`@layer components .card-light`): `bg-blushLight text-espresso rounded-card` with ember icon.
- **Token sweep:** every `bg-bark-*`, `text-bark-*`, `bg-clay-*`, `bg-sand-*`, `bg-moss-*`, `border-bark-*` → MemoFox equivalent.
- **Border-radius sweep:** every `rounded-md` → `rounded-card`, `rounded-lg` → `rounded-card`, `rounded-full` stays.
- **Typography sweep:** `<h2>` → `font-display font-extrabold`, body text → `font-body`.

### P4.4 — Buttons + Forms · 3 SP
- **Files:** `assets/css/tailwind.css`.
- **Rewrite `@layer components`:**
  - `.btn-primary` → `bg-brand text-white rounded-pill px-7 py-3 font-display font-extrabold hover:bg-brand-700`.
  - `.btn-secondary` → `border-2 border-espresso text-espresso bg-transparent rounded-pill px-7 py-3 font-display font-extrabold hover:bg-espresso hover:text-white`.
  - `.btn-danger` → `border-2 border-red-500 text-red-700 bg-white rounded-pill px-5 py-2 font-bold hover:bg-red-50`.
  - `.input` → `bg-blushLight border border-espresso/20 rounded-pill px-4 py-2 text-espresso focus:border-brand focus:ring-1 focus:ring-brand`.
  - `.spinner` → `border-2 border-ember/40 border-t-ember rounded-full animate-spin`.
  - `.card-dark` + `.card-light` utility classes (shared with P4.3).
- **Risk:** backwards-compat — every component currently using `btn-primary` will pick up the new style. Audit call-sites.

### P4.5 — Marketing copy + footer illustration · 3 SP
- **Files:** `components/LandingHero.vue`, `components/LandingBenefits.vue`, `components/LandingCta.vue`, `components/LandingFooter.vue`, `pages/index.vue`.
- **Brand voice:** warm, playful, "outdoor" — matches design system section 1.
- **Hero copy:** currently "Csomagold tudatosan a grammokat" — keep (it fits MemoFox voice). Replace secondary line "| Az Ultralight Gear Tracker segít |" with warmer "| Te rakod össze a túracsomagod — a grammok, a kényelem, a banda egyensúlyban.".
- **3 benefits:** keep titles (Komfort/súly, GPX-tervezés, Beszámoló), refresh body copy to playful MemoFox voice.
- **4-step process:** re-interpret for gear tracker (see open questions PIVOT-2).
- **Footer micro-copy:** refresh copyright + tagline.
- **Footer illustration:** 3-layer SVG mountain silhouette (espresso + umber + blush mid fills). Use as `<svg>` in `LandingFooter.vue` — no raster asset needed.

---

## 3. Out of scope (confirmed)

- Backend, schema, RLS, business logic changes
- Migration-ök
- Photographic content (only the 2 hero images integrate; other photography stays in `docs/design-system-details/`)
- New `node_modules` dependencies (use existing Nuxt stack + `@vueuse/core` if already present)

---

## 4. Total story points: ~27 SP

P4.0 = 3, P4.1 = 5, P4.2 = 5, P4.3 = 8, P4.4 = 3, P4.5 = 3.

---

## 5. Open questions for the user (block scope-pivot approval)

1. **PIVOT-1 (BRAND IDENTITY) — critical:** The design system is for "MemoFox", a video-editor service. Should we (a) rebrand Gear Tracker to MemoFox for the outdoor market, (b) keep both brands (MemoFox = design system, Gear Tracker = product), or (c) reuse the design system tokens for Gear Tracker with re-interpreted copy?
2. **PIVOT-2 (4-STEP PROCESS) — major:** The MemoFox "Rendeld meg → Tedd egyedivé → Töltsd fel → Ünnepelj" process doesn't fit Gear Tracker. Propose: **Gyűjtsd össze a cuccod → Tervezd meg a túrát GPX-szel → Oszd meg a bandával → Éld meg + Beszámoló**. Confirm or re-spec.
3. **PIVOT-3 (HERO PHOTOS) — minor:** The 2 hero images are stock footage-asset-like. Should they integrate as-is, or do we want a custom gear-themed photoshoot (out of scope for this sprint)?
4. **PIVOT-4 (MOTTO) — minor:** MemoFox voice is "warm, playful, outdoor". The current "Komfort is számít" motto maps cleanly. Keep, or provide a new motto?
5. **PIVOT-5 (TYPOGRAPHY) — minor:** Display font must be a Google Font (Baloo 2 / Fredoka / Poppins ExtraBold). Confirm which one (or pick based on availability test).
6. **PIVOT-6 (PARALLAX LIBRARY) — minor:** Parallax via `@vueuse/core useScroll` (if already in deps) or plain `requestAnimationFrame`? Need to confirm `@vueuse/core` is present.

---

## 6. Handoff plan

- **Card stays In Progress** (Architect scope: design + scope-pivot; doesn't close until user answers open questions).
- **Label swap:** `role:product-owner` → `role:architect` (after this brief is posted).
- **Once user approves pivots:** the 6 phases become 6 separate Backlog cards (p4.0 through p4.5), each with the spec from this brief.
- **Next agent:** `role:domain-director` (NOT `role:fullstack` — the user said "stays in progress" but the next phase is full implementation; the domain-director reviews the brief, breaks it into story cards, and assigns to fullstack).
