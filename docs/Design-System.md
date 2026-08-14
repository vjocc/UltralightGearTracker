# MemoFox — Design System

*A weboldal (MF-Home) vizuális auditja alapján összeállított design system. Képek és logó tartalma nem része a dokumentumnak — kizárólag a felület, a stílus és a komponensrendszer van dokumentálva.*

---

## 1. Márkakarakter

MemoFox egy videószerkesztő szolgáltatás, amely nyers, kalandos felvételekből (túrázás, utazás, esküvő, extrémsport) készít vágott, hangulatos emlékfilmet. A vizuális nyelv ebből fakadóan:

- **Meleg, barátságos, "outdoor" hangulat** — barnás/földszínek, égetett narancs, mohazöld
- **Playful, rounded forma világ** — lekerekített sarkok, pirula alakú gombok, kerekded fejlécbetűtípus
- **Egy erős accent szín (lila CTA)**, ami kiemeli a konverziós pontokat egy egyébként visszafogott, meleg semleges palettából
- Nagy, teljes szélességű fotók (kaland/élmény) váltakoznak tiszta, tartalom-központú szekciókkal

---

## 2. Színpaletta

### 2.1 Elsődleges márkaszínek

| Név | Hex | Használat |
|---|---|---|
| **Brand Purple** | `#7936EB` | Elsődleges CTA gombok, kiemelt akciógombok ("Töltsd fel a videóid!", "Megrendelem") |
| **Espresso (Ink Brown)** | `#2D0E05` | Fő szövegszín (headline-ok, body text), sötét kártyák háttere, footer illusztráció legsötétebb rétege |
| **Ember Orange** | `#EB5D36` | Logó accent, ikonok kontúrszíne a sötét kártyákon és a "Mikor válassz minket?" szekcióban |
| **Moss Olive** | `#867E36` | Elválasztó/akcent sáv (full-width divider a két képes szekció között) |

### 2.2 Semleges / háttérszínek

| Név | Hex | Használat |
|---|---|---|
| **White** | `#FFFFFF` | Kártya háttér (pl. "Mindenkinek van kamerája" panel) |
| **Fog Grey** | `#D9DDDE` | Szekcióháttér (semleges, hűvös szürke szekció) |
| **Ice Blue** | `#EDF4F6` | Világoskék kártyaháttér ("Bízd ránk!" panel) |
| **Blush Light** | `#FBF4F2` | Krémes szekcióháttér + világos kártyák háttere (feature-kártyák, "Rázkódás javítása" overlay panel) |
| **Blush Mid (Taupe)** | `#EBE2DF` | Szekcióháttér váltásra ("Mikor válassz minket?", galéria szekció háttér) |
| **Umber (Mountain Mid)** | `#573933` | Footer illusztráció középső hegyréteg |

### 2.3 Színhasználati elv

- A layout **váltakozó szekcióhátterekkel** dolgozik (fehér → szürke → krém → taupe → krém), hogy vizuálisan tagolja a hosszú oldalt anélkül, hogy elválasztó vonalakat használna.
- A **sötét espresso-barna** kártyák (pl. "Rendeld meg / Tedd egyedivé / Töltsd fel / Ünnepelj") mindig fehér szöveggel és narancs ikonnal párosulnak — ez a legerősebb kontraszt-blokk az oldalon.
- A **lila** kizárólag interaktív, elsődleges akciókra van fenntartva — sehol máshol nem jelenik meg dekorációként, így megtartja a figyelemfelkeltő erejét.
- Minden szöveg a meleg semleges hátterek felett **espresso-barnában** fut a tiszta fekete helyett — ez adja az oldal barátságos, hideg-kontraszt-mentes karakterét.

---

## 3. Tipográfia

Két jól elkülönülő betűkarakter réteg:

### 3.1 Display / Heading font
Kerekded, geometrikus, extra bold **rounded sans-serif** (a Baloo 2 / Fredoka / Poppins ExtraBold karakteréhez hasonló megjelenés) — minden H1–H3 címsorban és gombfeliratban.

- **Stílus:** Bold–ExtraBold, kerekded terminálokkal, nagy x-height
- **Szín:** Espresso `#2D0E05` (sötét háttéren fehér)
- **Sortávolság:** szoros (~1.05–1.15), a nagy méret miatt

### 3.2 Body / UI font
Semleges, jól olvasható **humanist sans-serif** (Inter/Poppins Regular karakterű) a leíró szövegekhez, navigációhoz, gombfeliratokhoz kisebb méretben.

- **Stílus:** Regular / Medium
- **Szín:** Espresso `#2D0E05` világos háttéren, fehér sötét kártyákon
- **Sortávolság:** laza (~1.5) a jobb olvashatóságért hosszabb bekezdéseknél

### 3.3 Méretskála (deszktop, becsült arányok a layout alapján)

| Szint | Méret (px) | Súly | Felhasználás |
|---|---|---|---|
| Hero H1 | ~52–56 | ExtraBold | Fő hero címsor (2 soros) |
| H2 (szekció cím) | ~36–40 | ExtraBold | "Mert az időd drága", "Mikor válassz minket?" |
| H3 (kártya/panel cím) | ~22–26 | Bold | "Mindenkinek van kamerája", "Rázkódás javítása" |
| H4 (mini kártya cím) | ~18–20 | Bold | Feature-kártyák címei ("Rendeld meg!") |
| Body Large | ~18 | Regular | Hero alszöveg, szekció leadek |
| Body | ~16 | Regular | Kártyaszövegek, leírások |
| Button label | ~16 | SemiBold/Bold | Minden CTA felirat |
| Nav link | ~15 | Medium | Fejléc navigáció |

---

## 4. Elrendezés / Grid

- **Konténer szélesség:** kb. 1200–1280px max-width, középre igazítva, bőséges oldalsó margóval
- **Szekció függőleges térköz:** nagy, konzisztens padding (~100–140px) szekciók között — ez adja az oldal "levegős", prémium tempóját
- **Rács:**
  - 4 oszlopos kártyarács a "Mert az időd drága" folyamat-lépéseknél (Rendeld meg → Tedd egyedivé → Töltsd fel → Ünnepelj)
  - 3 oszlopos kártyarács a "Mikor válassz minket?" use-case kártyáknál (2 sor × 3 oszlop)
  - 2 oszlopos, aszimmetrikus, **zig-zag layout** kép + szöveg panelekhez (kép balra/jobbra váltakozva, a szövegpanel enyhén rálóg a képre, offset "shadow" kártyahatással)
- **Rétegzés (layering):** a szöveges panelek gyakran **átfedésben** vannak a szomszédos szekció/kép hátterével (pl. a fehér kártya alján egy második, világoskék panel csúszik alá) — ez ismétlődő, jellegzetes mintázat.

---

## 5. Sarokrádiusz (Border Radius) rendszer

| Elem | Radius | Megjegyzés |
|---|---|---|
| Elsődleges / másodlagos gomb | **Full pill** (9999px) | Minden CTA gomb teljesen lekerekített |
| Nagy kártyák (feature, use-case, dark process card) | **20–28px** | Konzisztens, közepesen kerekített |
| Képek / nagy média blokkok | **20–28px** | Ugyanaz a rádiusz, mint a kártyáké — egységes rendszer |
| Kis inline panel (overlay szövegdoboz képen) | **16–20px** | Kicsit szorosabb, mint a nagy kártyáké |

Nincs éles (0px) sarok sehol a felületen — ez alapszabály a komponensrendszerben.

---

## 6. Gombok (Buttons)

### 6.1 Primary (Filled)
- Háttér: `#7936EB`
- Szöveg: `#FFFFFF`, SemiBold/Bold
- Forma: pirula (full-radius)
- Padding: bőséges, kb. 16–18px függőleges / 32–36px vízszintes
- Példák: "Töltsd fel a videóid!", "Megrendelem"

### 6.2 Secondary (Outline)
- Háttér: transzparens
- Szegély: 1.5–2px, `#2D0E05`
- Szöveg: `#2D0E05`, SemiBold
- Forma: pirula, azonos padding-logika, mint a primary gomb
- Példák: "Ismerd meg!", "Töltsd fel a videóid!" (világos szekciókban)

### 6.3 Állapot-elv
A két gombtípus (filled + outline) mindig **együtt** jelenik meg a hero-ban, egyértelmű elsődleges/másodlagos hierarchiát adva. Önálló, szekciózáró CTA-knál (pl. "Megrendelem") csak a filled variáns fut, teljes önállósággal.

---

## 7. Kártyák (Cards)

Négy visszatérő kártyatípus azonosítható:

### 7.1 Dark Process Card
- Háttér: `#2D0E05`
- Ikon: `#EB5D36` outline stílusú ikon, középre igazítva, felül
- Cím: fehér, Bold
- Leírás: fehér/halványabb fehér, Regular, középre igazítva
- Használat: 4 lépéses folyamatbemutató

### 7.2 Light Feature Card
- Háttér: `#FBF4F2` (vagy fehér, kontextustól függően)
- Ikon: `#EB5D36` outline ikon, balra igazítva
- Cím: `#2D0E05` Bold
- Leírás: `#2D0E05` Regular
- Használat: 6 use-case kártya rácsban

### 7.3 Overlay Text Panel (kép fölötti/alatti szövegdoboz)
- Háttér: `#FBF4F2` vagy `#EDF4F6`, félig ráúszva egy fotóra
- Középre igazított cím + leírás
- Finom drop shadow a kiemeléshez
- Használat: "Rázkódás javítása" panel a bicikliző felvétel fölött

### 7.4 Zig-zag Image/Text Card
- Kép + szövegpanel páros, offset elrendezésben (a panel enyhén túlnyúlik a képen)
- A panel háttere váltakozik: Blush Light / Ice Blue / Blush Mid
- Cím: `#2D0E05` Bold, leírás Regular
- Használat: "Zenék és hangok", "Dinamikus átmenetek", "Szín korrekciók" blokkok

---

## 8. Ikonográfia

- **Stílus:** vonalas (outline / stroke), kerekded vonalvégekkel, ~2px stroke súly
- **Szín:** kizárólag `#EB5D36` (Ember Orange), konzekvensen minden ikonon
- **Méret:** kártyánként nagy, jól látható ikon (kb. 40–48px), figyelemvezető elemként funkcionál, nem csak dekoráció
- **Motívumok:** kosár, ceruza, felhő+feltöltés nyíl, monitor+play, napkelte, hegycsúcs, rakéta, konfetti, kamera, csengő — mindegyik egyszerű, geometrikus, playful jelrendszer

---

## 9. Illusztráció

- Az oldal alján (footer előtt) egy **lapos, réteges hegyvonulat-illusztráció** fut végig, 3 barna árnyalati rétegben (`#2D0E05` legsötétebb előtér, `#573933` középső réteg, halványabb barna a legtávolabbi rétegnek) — ez zárja le a hero szín-világát és köti vissza a "outdoor/kaland" témát vektoros formában.
- A teljes szélességű **Moss Olive (`#867E36`) sáv** önálló, tartalom nélküli vizuális elválasztóként fut a két nagy fotós szekció között — ez egy tudatos "légzésszünet" a layoutban.

---

## 10. Fotóhasználati elvek

*(a tényleges képi tartalom nem része a rendszernek, csak a keretezési logika)*

- Nagy, teljes szélességű / teljes szekció-magasságú hero és showcase fotók
- Kisebb, lekerekített sarkú, kártyaszerű fotók a tartalmi szekciókban, mindig szöveges panellel párosítva
- A fotók konzekvensen "akció közben" / POV jellegűek (kaland, felszerelés, stúdió), sosem stockos, pózolt életérzés

---

## 11. Komponens-leltár (oldal felépítése alapján)

1. **Nav bar** — transzparens, logó bal, linkek középen/jobbra, kiemelt pirula "Profil" gomb kontúrral
2. **Hero** — teljes képernyős fotó háttér, 2 soros headline + alszöveg + 2 CTA (filled + outline) + lebegő termékfotó elem
3. **Split panel szekció** — kép + fehér/kék szövegpanel, átfedéssel
4. **Zig-zag történet panel** — kép + krém szövegpanel, átfedéssel, folytatás a következő szekcióba
5. **"Mert az időd drága" folyamat blokk** — 4 dark process card + 1 központi CTA gomb
6. **"Mikor válassz minket?" rács** — 6 light feature card, 2×3 elrendezésben + záró outline CTA
7. **Showcase fotó + overlay panel** — nagy élmény-fotó, középen lebegő szövegdobozzal + outline CTA
8. **Moss Olive divider sáv** — teljes szélességű, üres, csak szín-elválasztó
9. **Feature zig-zag galéria** — 4, váltakozó irányú kép+szöveg blokk (Rázkódás javítása, Zenék és hangok, Dinamikus átmenetek, Szín korrekciók)
10. **Footer illusztráció** — réteges hegyvonulat vektorgrafika, krém háttér előtt

---

## 12. Konzisztencia-elvek összefoglalva

- **Egy accent szín** (lila) kizárólag konverziós CTA-kra
- **Egy ikon-szín** (narancs) minden ikonon, kontextustól függetlenül
- **Minden sarok lekerekített** — nincs éles geometria a rendszerben
- **Váltakozó, de korlátozott (5–6 tónusú) háttérpaletta** a szekciók ritmizálására
- **Kétrétegű tipográfia**: playful rounded display font a címekben, semleges humanist font a törzsszövegben
- **Ismétlődő "offset panel" minta**: szöveges dobozok szinte mindig egy fotóra/másik panelre úsznak rá, sosem önállóan, keret nélkül lebegnek
