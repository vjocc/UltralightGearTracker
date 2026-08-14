# Ultralight Gear Tracker (Trip Loadout) — DEV dokumentáció

**Ennek a dokumentumnak a célja:** minden eddig meghozott döntés, irány és funkció egy helyen, priorizálva. A csapat (Domain Director, PO, Architect, Full-stack, Designer, QA, Marketing/Copy) ezt tekintse a projekt hivatkozási alapjának.

## 0. KÖTELEZŐ ELSŐ LÉPÉS: audit a jelenlegi állapotról

Mielőtt bármi új munka elindulna, a Domain Director végezzen egy teljes körű ellenőrzést:

**Minden alább "✅ Kész" jelöléssel szereplő funkciónál ellenőrizni kell, hogy a jelenlegi kód/deployed app ténylegesen úgy viselkedik-e, ahogy itt le van írva.** Ha eltérést találtok:
- **Ne javítsátok ki csendben.** Dokumentáljátok a Trello-n (QA debt kártyaként vagy kommentként), és jelentsétek vissza a felhasználónak.
- Az audit eredményét (mi egyezik, mi nem) egy összefoglaló Trello-kártyán rögzítsétek, mielőtt új Sprint-munka indulna.

---

## 1. Product thesis

**Motto (implementált marketing copy):** "Komfort is számít, nem csak a könnyű súly."

**Mélyebb, hosszú távú thesis (irányadó, még nem teljesen implementált):** "Pakolj tudatosabban. Túrázz kényelmesebben. Tanulj a saját tapasztalataidból."

A termék nem versenyez direktben a LighterPack-kel (statikus gear-lista) — a cél egy **döntéstámogató rendszer**, ami segít eldönteni, mit vigyél egy adott túrára, és idővel megtanulja, mi működik a felhasználónak.

---

## 2. Funkciólista — PRIORITÁS SZERINT

### ✅ KÉSZ — MVP (Sprint 1)

| # | Funkció | Elfogadási kritérium |
|---|---|---|
| 1 | Regisztráció / bejelentkezés | **Jelszó-alapú** (`signUp` / `signInWithPassword`). Magic link NEM az elsődleges flow (ld. 4. pont). |
| 2 | Felszerelés (gear) CRUD | Név, kategória, súly (gramm), ár. Csak a saját `auth.uid()`-hoz tartozó sorok láthatók/szerkeszthetők (RLS). |
| 3 | Kategóriák kezelése | Felhasználónkénti egyedi kategória-lista (`categories` tábla, `unique(user_id, slug)`). |
| 4 | Base weight számítás | Kategóriánkénti és összesített alapsúly (`gear_base_weights_view`). |
| 5 | Wishlist CRUD (korlátozott) | Csak alap CRUD — **ár-értesítés/scraper véglegesen KIVETVE a scope-ból** (ld. 5. pont). |

### ✅ KÉSZ — Sprint 2 (P1: túra-alapú gear-választás + GPX)

| # | Funkció | Elfogadási kritérium |
|---|---|---|
| 6 | Túra (trip) létrehozása | Cél/dátum megadása. |
| 7 | GPX import | Fájl feltöltése → táv és szintemelkedés automatikus kiolvasása. |
| 8 | Gear-választás túrához | A saját gear-listából kiválasztható, mit visz az adott túrára (`trip_gear` M:N tábla). |
| 9 | Trip-szintű súly-összesítés | `trip_weight_summary` view — mennyi az összsúly az adott túrához választott gear alapján. |

### ✅ KÉSZ (nagyrészt) — Sprint 3 (P2: social alap réteg)

| # | Funkció | Elfogadási kritérium |
|---|---|---|
| 10 | Barátok kezelése | `friendships` tábla + keresés `SECURITY DEFINER` függvényen keresztül. |
| 11 | Felszerelés-kommentek | `gear_comments` tábla, RLS-védett. |
| 12 | Landing page (P3.1) | Hero (cím+alcím+2 CTA) + 3 előny blokk + CTA szekció + footer. Copy-v2 alapján, föld-színpalettával. **NEM a belső Gear táblát mutatja bejelentkezés nélkül** — ez korábbi hiba volt, ellenőrizendő az audit során. |
| 13 | Trip-share invite social surface (P3.2) | Barát meghívása egy konkrét túrára, `trip_share_invites` tábla. |
| 14 | Recap friends feed RLS (P3.3) | A meghívott barátok is lássák a `trip_recap_photos`-t, ne csak a tulajdonos + public toggle. |
| 15 | Polish sweep (P3.5) | Spinner dedup, `btn-secondary`/`btn-danger` utility-tokenizáció, stepper a11y (`aria-label`). |

### ⏸️ ELHALASZTVA Sprint 4-re (tudatos döntés, nem elfelejtve)

| # | Funkció | Miért P4 |
|---|---|---|
| 16 | Recap comments (P3.4) | A social surface természetes bővítése, de nem sürgető. |
| 17 | Túra-nyilvános URL megosztás (`/t/{recap_id}`, P3.6) | Jelentős önálló feature, várjon a piackutatási visszajelzésre. |

### 🔨 KÖVETKEZŐ LÉPÉSEK — a jelenlegi core loopot erősítő funkciók (javasolt Sprint 4 fókusz)

Ezek a **legmagasabb prioritású, még nem implementált** funkciók — ezek adják a valódi differenciáló értéket, nem a social réteg bővítése:

| # | Funkció | Leírás | Miért fontos most |
|---|---|---|---|
| 18 | Induló sablonok (starter packs) | Regisztrációkor 3-4 kész, klónozható gear-lista (pl. "3 napos nyári könnyű túra", "kempingezős hétvége"). | Azonnali érték, ne üres táblát lásson az új user. |
| 19 | Publikus, csak-olvasható megosztási link | `/list/{id}` — bejelentkezés nélkül megtekinthető gear-lista, szerves terjesztéshez (pl. fórumon megosztva). | Ingyenes, szerves marketing csatorna. |
| 20 | Vizuális súly-bontás | Kategóriánkénti sáv/kördiagram nézet a base weight mellett, nem csak egy szám. | Az "aha-élmény" motorja — megmutatja, hol lehet faragni. |
| 21 | "My comfort" dimenziók | Minden gear-tételhez **szubjektív, saját** komfort-értékelés (nem objektív pontszám!) — pl. "alvás: 5/5, hidegben: 4/5, súly: 3/5". | A "komfort is számít" motto tényleges, kézzelfogható implementációja. |
| 22 | Trip-aware loadout üzenet | Egyszerű, szabály-alapú (NEM AI-ajánlómotor) összefüggés: táv+szint (GPX-ből) + korábbi komfort-értékelés alapján kontextus-üzenet, pl. "Ez a setup könnyű ehhez a túrához, a korábbi hasonló túrákon kényelmesnek értékelted." | A "killer feature" — ezt senki más nem tudja, mert nálunk kapcsolódik össze gear+GPX+személyes history. |
| 23 | "Mit bántam meg?" debrief | Túra után 3 egyszerű kérdés: mi volt felesleges / mi hiányzott / mi volt kényelmetlen. | Ez indítja el a tanulási hurkot — ettől lesz a rendszer idővel egyre okosabb a felhasználóról. |
| 24 | Trip-történet + személyes statisztika | Összesített km, túrák száma, base weight trendje idővel. | Retenciós motor — a saját múlt látványa húz vissza (Strava-minta). |

### ❌ VÉGLEGESEN KIVEZETVE a scope-ból

- **Wishlist ár-értesítés / élő scraper** — technikai/jogi kockázat túl nagy egyszemélyes karbantartáshoz. A `refreshPrices` dummy-logika a kódban maradhat, de éles scraperre soha ne épüljön rá új feature.
- **Photo filters (EXIF strip, auto-tagging), bulk photo upload, trip-summary PDF export** — feature creep, nem MVP-releváns.

### 🔮 HOSSZÚ TÁVÚ VÍZIÓ — NEM implementálandó most

Lásd a külön `ultralight-gear-tracker-design-brief.md` fájl 11. szekcióját (social/network réteg, csoportok, monetizáció, matching). **Ez a dokumentáció tudatában legyen ennek a lehetséges jövőnek** (pl. adatmodell ne zárjon ki egy jövőbeli bővítést), de **ne kezdjen hozzá az implementációhoz** külön jóváhagyás nélkül.

---

## 3. Auth-döntés (rögzített, ne kérdőjeleződjön meg indoklás nélkül)

- **Elsődleges: jelszó-alapú** regisztráció/bejelentkezés.
- **Magic link technikailag él a Supabase-en**, de nincs használatban az UI-n. Ha bármikor vissza akarnátok kapcsolni: a Supabase-en nincs külön "Magic Link" toggle (tévhit volt korábban) — az Email provider engedélyezésével automatikusan elérhető, csak a Site URL/Redirect URL kell hozzá helyesen legyen beállítva.
- **Confirm Email** beállítás projektfázistól függően ON/OFF.

---

## 4. Adatmodell — migrationök (FK-sorrendben, mind lefuttatva)

1. `init_gear` — categories, gear_items, wishlist_items + RLS
2. `base_weight_view`
3. `wishlist_alerts`
4. `trips` + trip_gear (M:N) + RLS
5. `friendships` + keresés (SECURITY DEFINER)
6. `gear_comments` + RLS
7. `trip_weight_summary`
8. `gpx_import` — trips bővítés + gpx_track_points
9. `trip_share` — meghívók, trip_comments, láthatósági szabályok

---

## 5. Tech stack és infrastruktúra

- **Frontend/backend:** Nuxt.js
- **DB + auth:** Supabase (PostgreSQL, RLS minden táblán)
- **Deploy:** Vercel
- **Styling:** Tailwind CSS
- **Verziókezelés:** GitHub (`github.com/joccvincze/ultralight-gear-tracker`, private repo)

### Git-munkafolyamat szabály

A felhasználó időnként **saját maga is szerkeszti a kódot közvetlenül**, a saját gépén, `design-pass` nevű branch-en, majd push-olja a GitHub-ra.

**Szigorú szabály: soha nem szabad force-push-olni a `main`-re.** Ha a felhasználó branch-e (pl. `design-pass`) és a csapat aktív munkája ütközne, ezt jelezni kell a felhasználónak — **nem szabad egyoldalúan feloldani** az ütközést.

---

## 6. Landing page — Hero-specifikáció

- Teljes szélességű, ~600-650px magas szekció, háttérben táj/hegyi-túra fotó (`background-size: cover`)
- Felül átlátszó navigáció-overlay: logó balra, menü+gomb jobbra
- Középen centrálva: H1 cím + alcím + 2 CTA gomb (elsődleges: Regisztráció, másodlagos: outline "Ismerd meg")
- Alul, teljes szélességben, a szekció aljához horgonyzott kivágott (átlátszó PNG) sziluett-kép túrázó alak(ok)ról
- **Fotók: jogtiszta forrásból** (pl. Unsplash-licenc), NEM licencelt stock-anyag felhasználásával
- Színvilág: föld-színpaletta (bark/moss/sand/clay/loam) — részletes tokenek a `docs/design-system.md`-ben (külön készül)

---

## 7. Csapat-munkafolyamat (rögzített szabályok)

- **Szerepkör-lánc:** Domain Director (vízió, végső jóváhagyás) → PO (jegyekre bontás, elfogadási kritériumok) → Architect (technikai terv) → Full-stack (implementáció) → Designer (review + label-swap, **kódot NEM módosít**) → QA (funkcionális teszt) → Domain Director (explicit, dokumentált Trello-komment jóváhagyás minden Done-mozgatás előtt).
- **QA next mindig `domain-director`**, nem `fullstack` — a DD explicit review-zza a QA-verdiktet.
- **3-as szintű döntések** (scope-változás, config-módosítás más role-okra kiható hatással, új hitelesítő adat) — mindig kérdezni kell a felhasználótól, **mielőtt** végrehajtásra kerülnek, nem utólag jelenteni.
- **Hitelesítő adatok** (API kulcsok, tokenek) soha nem jelenhetnek meg nyílt szövegben chat-üzenetben vagy sub-agent transcript summary-ban — redakciós szabály kötelező.
- **Full-stack tool-limit:** 75 hívás (a többi role 50-en marad). 45 hívásnál interim closure-t kell posztolni, ha a Trello-handoff még hátravan.

---

## 8. Nyitott QA debt (CLOSED — audit 2026-08-14)

A Sprint 4 docs audit 4 batch-e (delta-findingek a Trello `debt-tracker` kártyán, `6a7d7b62d61ae7a41e8f83ce`) megerősítette, hogy a korábban nyitottként listázott 3 debt valójában CLOSED. A docs szövege 2026-08-14-ig driftben volt a valósággal.

- ✅ **Wishlist ár-értesítés:** CLOSED. Scope-out (wishlist scope véglegesen kivezetve), a `refreshPrices` dummy-logika 401-gyel védett a `POST /api/wishlist/refresh` no-auth hívásnál. A Trello audit comment `6a7f0afe7b490ccfff099e58` rögzítette.
- ✅ **Magic link runtime:** CLOSED. A kód password-only (`supabase.auth.signInWithPassword`), magic-link CTA soha nem volt használatban. A korábbi "never ran live" szöveg a docs-ban **drift volt** — a Trello card history 2026-08-13-án lezárta a debt-et. Docs PR-rel javítva: törölve a "never ran live" szöveg.
- ✅ **Trips SSR regression:** CLOSED. A P3.3 fix (`user.sub` injection) live a deployed app-on, Vercel Deployment Protection OFF, `/trips` no-auth 302→`/signin?next=/trips` redirect-elve. A Trello comment `6a7f0af3543a24acced2e6f7` megerősítette.

**Archiválás**: a 3 debt rendben van, a docs szövege most már a valóságnak megfelel. Jövőbeli debt-ek új kategóriaként (security, performance, data-integrity) kerüljenek be, és legyen a Trello kártyán explicit `next:` marker a domain-director review-hoz.

---

## 9. Kapcsolódó dokumentumok

- `ultralight-gear-tracker-design-brief.md` — teljes termékvízió, hosszú távú irányok, pozicionálás
- `docs/design-system.md` (készül) — konkrét design tokenek (színek, spacing, tipográfia), Hero-implementáció, komponens-guideline-ok
