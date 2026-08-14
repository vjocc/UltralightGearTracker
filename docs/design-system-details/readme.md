# MemoFox Design System

MemoFox egy videó-szerkesztő szolgáltatás (nyers felvételekből — utazás, esküvő, sport — szerkesztett emlékfilmet készítenek). Ez a design system a MemoFox marketing weboldal (jelenleg egyetlen kész felület: a főoldal) Figma tervéből lett kinyerve, és a hiányzó UI-elemekkel (form mezők, táblázat, badge, modal stb.) van kiegészítve, hogy egy teljes, prototípuskészítésre alkalmas rendszer legyen.

**Forrás:** Figma fájl "MemoFox" (csatolva, `Design` page → `Home` frame). Nincs kapcsolt kódbázis vagy GitHub repó.

## Index

- `styles.css` — a globális belépési pont, importálja az összes tokent
- `tokens/` — színek, tipográfia, spacing/radius, shadow, fontok
- `assets/brand/` — MemoFox logó (embléma, szöveg, kombinált) + a CTA gomb Figma-materializálása + `fig-tokens.css` (Figma Variables)
- `assets/icons/` — a márka saját tartalom-ikonjai (Outdoors Water Sun 6 kategória-ikon, CircleWavyCheck) `Icon.jsx`-ként, plusz Phosphor Duotone CDN a general UI ikonokhoz
- `assets/images/` — a Figma tervből kimásolt valódi fotók és háttérképek
- `components/` — újrahasználható UI elemek, csoportosítva: `buttons/`, `forms/`, `data-display/`, `table/`, `feedback/`, `navigation/`
- `guidelines/` — szín, tipográfia, spacing, radius, shadow, brand specimen kártyák
- `ui_kits/marketing-site/` — a teljes főoldal újraépítve a komponensekből

## Content fundamentals

- Nyelv: magyar, magázás nélkül, közvetlen "Te" megszólítás ("Készen állsz a kalandra?", "Bízd ránk!").
- Rövid, lendületes mondatok, sok felkiáltójel a CTA-kban ("Töltsd fel!", "Ünnepelj!", "Rendeld meg!").
- Nincs emoji, nincs unicode ikon szövegben — minden vizuális hangsúly ikon vagy kép.
- A gombszövegek mindig felszólító módban, cselekvésre ösztönző ("Töltsd fel a videóid!", "Ismerd meg!", "Megrendelem").
- A copy érzelmi regisztere: nosztalgikus, kalandkereső, megkönnyebbülést ígérő ("dőlj hátra és lazíts, miközben...").

## Visual foundations

- **Színek:** meleg, barna alapú ("brand-900" `#2e0e05` a fő tinta és a hero háttér), három egyhue accent (narancs, lila, menta), és egy olívzöld a lábjegyzet sávhoz. A szekcióhátterek finoman eltérő meleg/hűvös neutrálok (bézs, halványkék, halványpeach) — ez adja a görgetés közbeni ritmust, nem a tartalom.
- **Tipográfia:** Unbounded (bold, geometrikus) minden címsorhoz; Plus Jakarta Sans a törzsszövegekhez és gombokhoz; Quicksand csak a hero alcímén, ritka hangsúlyelem. **Nincs betűtípus-fájl a Figma-forrásban** — Google Fonts helyettesítő van betöltve, jelezve a hiányt.
- **Spacing:** nagy, levegős paddingek (64/80/120px a szekciókban) — a márka nem sűrű, UI-szerű, hanem "prémium utazási magazin" jellegű elrendezést használ.
- **Sarkok:** gombok mindig teljesen lekerekítettek (pill, 100px). Kártyák 12–32px sugárral, méret szerint nő a sugár a kártya méretével (kis tartalom-kártya 12px, nagy step-kártya 32px).
- **Árnyékok:** sosem tiszta fekete — mindig `rgba(12,12,13,…)` vagy `rgba(0,0,0,…)` meleg tintaszínű, puha, nagy elmosódású árnyékok (pl. `0px 12px 60px rgba(0,0,0,0.4)` a lebegő fotóknál).
- **Képek:** valódi fotók, teljes szélességű hero, kerekített (20px) képkártyák árnyékkal. Nincs illusztráció, nincs gradiens a felületeken (a hero gomb egyetlen kivétel, ahol két szín van rétegezve).
- **Interakció:** a Figma statikus terv, hover/press state nincs definiálva — a komponensekben pragmatikus alapértelmezéseket adtunk (opacity csökkenés disabled-nél, stb.), ezeket érdemes véleményezni.

## Iconography

- A márka saját, kézzel rajzolt duo-tone content-ikonjai (utazás, túra, extrém sport, esemény, vlog, "időfelszabadítás" kategóriák + egy pajzs-checkmark) — ezek Figma-ból lettek kinyerve, **ne cseréld le őket** máshonnan, `assets/icons/icon-data.js` + `Icon.jsx`.
- Általános UI-ikonokra (chevron, close, upload stb.) a Figma nem definiál semmit → **Phosphor Duotone** (CDN, `unpkg.com/@phosphor-icons/web`) lett választva, a felhasználó kérése szerint, kerekded stílus a márka lekerekített formáihoz illően.
- Nincs emoji, nincs unicode-ikon a tervben.

## Intentional additions (a Figma nem definiálja, de a kérésre bekerült)

- Form mezők: Input, Textarea, Select, Checkbox, Radio, Switch
- Data display: Card, Badge, Avatar, Progress, Stepper, Table
- Feedback: Alert, Tooltip, Modal
- Navigation: Breadcrumb, Pagination, Accordion
- Button `secondary` és `ghost` variánsok (a forrás csak `primary`/`outline` CTA-t definiál)
- Kisebb tipográfiai lépcsők (h5, h6, caption, overline) és kisebb radius-értékek (xs, sm) — a forrás csak a nagyobb méreteket definiálja
- Állapot-színek (success/danger/warning/info)

## Caveats / kérés a felhasználó felé

- **Nincs betűtípus-fájl** — Unbounded / Plus Jakarta Sans / Quicksand Google Fonts CDN-ről töltve. Ha vannak saját (pl. licencelt) fontfájlok, küldd el, és lecseréljük self-hosted `@font-face`-re.
- A lábjegyzet hegy-illusztrációja a Figma-ban ~1000 apró vektorból álló zajtextúra — a design systembe a fő sziluett SVG-k kerültek át (`assets/images/cover-mountains*.svg`), a finom szemcsézettség nélkül, egyszerűsített formában.
- A Figma terv csak a főoldalt (Home) tartalmazza — más felületek (bejelentkezés, dashboard, blog) nincsenek, ezekhez további tervek szükségesek.
- Kérünk, nézd át a `guidelines/` és `components/` kártyákat, és jelezd, ha valamelyik szín/méret/komponens nem felel meg — élesben irányítjuk a további iterációt ezek alapján!
