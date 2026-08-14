# Product Architecture v2 — Döntési dokumentum

**Ez a dokumentum felülírja/pontosítja a `dev-documentation.md` #18 (starter packs) pontját és a jelenlegi user-owned kategória-modellt. Cél: az adatmodell alapjait rendbe tenni, mielőtt bármilyen új feature-fejlesztés folytatódna.**

## 0. Döntési elvek — erre kell hivatkozni felülíráskor

Ez a szekció **nem csak erre a dokumentumra vonatkozik** — bármelyik role bármikor hivatkozhat rá, amikor egy jegyet/javaslatot módosít vagy felülír. **Szabály: egy javaslat felülírása csak akkor fogadható el, ha explicit megnevezi, melyik elvet szolgálja jobban — "szerintem ez jobb" önmagában nem elég indoklás.**

1. **Valós felhasználói adat > feltételezés.** Ne kínáljunk fel előre kitalált tartalmat (pl. starter pack), ha egy egyszerűbb, a felhasználó saját adatára épülő megoldás is elérhető.
2. **Minimalizáld az onboarding-súrlódást.** Az első értékes pillanatig vezető út legyen a lehető legrövidebb — ne kérjünk döntést/adminisztrációt (pl. kategória-kezelés) a tényleges érték (saját gear látása) előtt.
3. **Ne épülj be egy tapasztalt/niche felhasználó (akár a sajátunk) speciális igényére validáció nélkül.** Amíg nincs adat arra, hogy az átlagfelhasználó is így gondolkodik, a funkció maradjon later/backlog.
4. **A séma-szintű "jövő-biztosítás" olcsó, az UI/logika-szintű nem.** Extra mezők felvétele egy migrationben elfogadható korai előkészítésként; teljes funkció megépítése validáció előtt nem.
5. **Trip és My Gear két külön fogalom, nem keverendő.** A My Gear állandó, felhasználó-szintű inventárium. A Trip egy konkrét, dátumhoz/GPX-hez kötött esemény. Egy onboarding-emlékeztető ("mi volt nálad legutóbb") a My Gear-t tölti fel, nem hoz létre Trip-rekordot.

---



## 1. Kategóriák — rendszer-definiált, nem felhasználó-kezelt

**Döntés:** a kategóriák **globális, előre definiált taxonómia**, amit a rendszer ad (seedelt migration), nem a felhasználó hozza létre/törli.

**Indoklás:** a felhasználónak nem feladata kitalálni egy kategória-rendszert, mielőtt egyáltalán elkezdhetné felvinni a felszerelését — ez felesleges döntési teher, ami az onboarding legelején veszít el embereket. Analógia: egy webshop sem várja el a vásárlótól, hogy ő találja ki a termékkategóriákat.

**Terjedelem:** kb. **12-15 top-level kategória** (nem 40, de nem is 3-4).

**Taxonómia-szabály (nem csak a szám, hanem a besorolási elv):**
- Egy top-level kategória = **funkcionális outdoor kategória** (mire való a tárgy), NEM márka, NEM fizikai tárolási hely, NEM trip-típus.
- **Egy gear itemnek pontosan egy elsődleges kategóriája van.** A későbbi tag/setup/container réteg (ld. 3. pont) nem változtatja meg a kategóriát, csak kiegészíti.
- A webshop-analógiából az **elvet** vesszük át (előre definiált, navigálható struktúra), nem szó szerint egy webshop termékfáját — pl. az "Electronics" egy webshopban természetes csoport, de túrázáskor a telefon/GPS/kamera/fejlámpa inkább külön funkciót tölt be, érdemes lehet külön kategorizálni.

Példa-struktúra (finomítandó, konkrét lista legyen az Architect/PO döntése az elv alapján):

- Shelter (sátor, tarp, cölöpök, rudak)
- Sleep (hálózsák, quilt, matrac, párna)
- Pack (hátizsák, csípőöv, pack liner)
- Cooking (tűzhely, edény, üzemanyag, evőeszköz)
- Clothing (base layer, réteg, esőruha, zokni, kesztyű)
- Electronics (telefon, kamera, fejlámpa, powerbank)
- Safety (elsősegély, navigáció, vészhelyzet)
- Food & Water (élelem, víz, szűrő, palack)
- (+ néhány további, ahogy a valós használat kirajzolja)

**Mi TÖRLŐDIK a scope-ból ezzel:** a felhasználói kategória-kezelő felület (létrehozás/szerkesztés/törlés UI), és minden hozzá kapcsolódó RLS-logika.

**Migrationök:**
1. `categories` tábla átalakítása globális (nem `user_id`-hoz kötött) táblává, seedelt adatokkal
2. `gear_items.category_id` marad, de a hivatkozott tábla mostantól rendszer-szintű
3. A jelenlegi (ha van) felhasználó-létrehozta kategóriák egyszeri migrálása/mappelése a legközelebbi rendszer-kategóriára

---

## 2. Onboarding — "Mi volt nálad a legutóbbi túrán?", NEM starter pack

**Döntés:** a korábban tervezett starter pack ötlet (kész, klónozható gear-listák felkínálása regisztrációkor) **kikerül a Sprint 4 scope-ból.**

**Indoklás:** egy előre elkészített lista esélye, hogy pontosan egyezzen azzal, amije a felhasználónak ténylegesen van, gyakorlatilag nulla. Ehelyett egy gyors, natív felviteli élmény: *"Mi volt nálad a legutóbbi túrán?"* — a felhasználó egyesével felviszi a saját, valódi tárgyait (név → kategória → súly), és ez azonnal bekerül a "My Gear" listájába. Ez olcsóbb fejleszteni, és valós adatot ad, nem feltételezést.

**UX-elv:** ne kérdezze végig wizard-szerűen az összes kategóriát egyenként — legyen egy gyors, folyamatos hozzáadás-felület, ahol a felhasználó pörgősen felviheti, amit akar, amilyen sorrendben eszébe jut.

---

## 3. Personal organization (pod/container/setup) — külön, KÉSŐBBI feature

**Döntés:** a "hol tartom fizikailag" (pl. pakolós pod-ok) szervezési réteg **nem kategória**, és **nem most épül.**

**Indoklás:** ez valós, hasznos igény lehet tapasztalt ultralight-túrázóknak, de nincs adat arra, hogy az átlagos felhasználó is így gondolkodik-e. Ne épüljön be egyetlen (akár a sajátunk) tapasztalt-felhasználói perspektívára validáció nélkül. Ha felmerül az igény, ez egy önálló, később hozzáadható koncepció (Setup / Container / Tag), ami a kategóriától függetlenül létezik.

---

## 4. Trip — visibility és participation mezők most, UI/logika nélkül

**Döntés:** a `trips` tábla kapjon két új mezőt **most**, séma-szinten:

- `visibility` — `private` | `public` (alapértelmezett: `private`)
- `participation` — `invite_only` | `request_to_join` (alapértelmezett: `invite_only`)

**Indoklás:** ez egy olcsó, alacsony kockázatú "jövő-biztosítás" — néhány extra mező egy migrationben szinte semmibe nem kerül most, de elkerüli egy fájdalmas, később szükséges adatmodell-migrációt, ha a termék a nyilvános/szervezett túrák irányába fejlődik (ld. hosszú távú SaaS-vízió).

**Explicit korlát:** ehhez a két mezőhöz **most nem épül UI, nem épül elfogadási/jelentkezési logika, nem épül fizetés.** A mezők léteznek, alapértelmezett értékkel, de a jelenlegi funkcionalitás (privát, meghívásos túra) változatlan marad.

**Domain-szabály a megengedett kombinációkra (dokumentálandó, DB-constraint szinten is érdemes rögzíteni):**
- `private` túra csak `invite_only` lehet.
- `public` túra lehet `invite_only` VAGY `request_to_join`.
- A `private` + `request_to_join` kombináció **érvénytelen állapot**, ezt meg kell akadályozni (pl. CHECK constraint a táblán).

**Future direction (egy mondatban, hogy a fejlesztő tudja, miért készül elő ez a mező):** *a Trip később nyilvánosan felfedezhető, jelentkezéshez kötött közösségi eseménnyé válhat, ahol a szervező kezeli a résztvevőket. Ennek monetizációja (pl. szervezői előfizetés vagy fizetős túra) jelenleg hipotézis, nem terméki követelmény — a mezők előkészítése nem jelenti, hogy ez a funkció hamarosan épül.*

---

## 5. Catalog / termék-matching — expliciten NEM most

**Döntés:** a "felismert termék a katalógusban" koncepció (ahol a felhasználó saját gear-bejegyzése idővel egy központi termék-adatbázishoz kapcsolódik, lehetővé téve a "mások ezt viszik hasonló túrákra" típusú ajánlásokat) **dokumentált, hosszú távú irány, de nem implementálandó most.**

**Indoklás:** ez egy jelentős, önálló adatvagyon-építési projekt, ami csak akkor van értelme, ha már van elég felhasználói adat. Korai, félkész implementáció félrevezető vagy használhatatlan lenne.

**Adatmodell-követelmény:** a `gear_items` tábla struktúrája ne zárja ki egy jövőbeli `catalog_products` tábla utólagos hozzákapcsolását (pl. egy opcionális `catalog_product_id` mező hozzáadható legyen később migrationnel, most nem kell felvenni).

**Fogalmi modell — rögzítendő most, még ha az FK később jön is:** a Catalog Product és a My Gear **két különböző entitás**, nem ugyanaz.
- **Catalog Product** azt válaszolja meg: "mi ez a termék, általánosságban?" (pl. "Durston X-Mid 1").
- **My Gear** azt válaszolja meg: "nekem ebből van egy konkrét példányom, ezzel a súllyal, ezzel a saját tapasztalattal" (pl. "az én X-Mid-em, 782g, ilyen komfort-értékeléssel, ilyen jegyzettel").

Ez a megkülönböztetés a jövőbeli catalog-matchinghez lesz fontos, de a mostani implementációt nem befolyásolja — csak a fogalmi tisztánlátást szolgálja.

---

## Összefoglaló — mi történik a Sprint 4-gyel

| Korábbi Sprint 4 terv | Új állapot |
|---|---|
| #18 Starter packs | **Törölve**, helyette: "Mi volt nálad?" onboarding-flow |
| #19 Publikus megosztási link | Változatlan, folytatható |
| #20 Vizuális súly-bontás | Változatlan, folytatható |
| #21 "My comfort" dimenziók | Változatlan, folytatható |
| #22 Trip-aware loadout üzenet | Változatlan, folytatható |
| #23 "Mit bántam meg?" debrief | Változatlan, folytatható |
| #24 Trip-történet/statisztika | Változatlan, folytatható |
| **ÚJ, ELSŐ LÉPÉS** | Kategória-migráció (1. pont) + onboarding-flow (2. pont) + Trip mezők (4. pont) — ez blokkolja/megelőzi a többit, mert a jelenlegi kategória-bug miatt a gear CRUD alapból nem működik mindenkinek |

**Javasolt sorrend (finomítva — a Trip-aware loadout csak akkor van értelme, ha már van komfort- és debrief-adat, amire hivatkozhat; a My Comfort viszont felhasználó által manuálisan megadott adat, nem függ a debrieftől, ezért azzal párhuzamosan haladhat):**

1 → 4 → 2 (architektúra-alapok) → 19, 20 (nincs függőség) → 21 My Comfort + 23 Debrief (adatgyűjtő primitívek, mehetnek egymás mellett/közel) → 24 Trip-történet (a felgyűlt adatra épül) → 22 Trip-aware loadout üzenet (ez fut utoljára, mert csak akkor ad értéket, ha már van mire hivatkoznia).

**Megjegyzés, nem blokkoló döntés:** érdemes lesz mérni, hogy a felhasználók ténylegesen **hány gear-tételt visznek fel** (adminisztráció-jellegű mérőszám) helyett inkább azt, **hányan jutnak el egy értelmes trip/loadout állapotig** (tényleges aktiválási mérőszám) — ezt a QA/DD tartsa szem előtt a jövőbeli funkciók értékelésénél, de ez nem állítja meg a jelenlegi sorrendet.

---

## Melléklet: Onboarding-flow — JAVASLAT, nem lezárt spec

**Ez a rész felülírható a Designer/Architect/PO által, DE csak a 0. szekció valamelyik elvére hivatkozva.** Ha egy role jobb megoldást talál, nevezze meg, melyik elvet szolgálja jobban — puszta preferencia nem elég indok a felülírásra.

**A javaslat (frissítve — az eredeti "mi volt nálad legutóbb" copy kizárta a kezdő túrázókat, akik még nem voltak túrán):**

- Bejelentkezés után, ha a felhasználónak még nincs egyetlen gear-bejegyzése sem, a Gear menü tetején megjelenik egy komponens: elsődleges keretezés *"Mi van a felszerelésedben?"* (univerzális, mindenkinek szól), alatta másodlagos, segítő prompt: *"Ha már túráztál, felviheted a legutóbbi túrád felszerelését"* (copywriting mindkét szinten finomítandó — ez irányjelző szöveg).
- A komponens alatt azonnal ott a gyors gear-felviteli form (név → kategória → súly).
- Mentéskor két gomb: **"Ennyi volt"** (befejezi az onboarding-komponenst) és **"Még egy cucc"** (copywriting finomítandó — marad a formban, folytatja a felvitelt).
- **Fontos elhatárolás (5. elv):** ez a flow kizárólag a **My Gear** listát tölti — NEM hoz létre Trip-rekordot, nincs GPX, nincs dátum. Pusztán emlékeztető-keret a gyors felvitelhez.
- Mentés után a komponens **nem tűnik el hirtelen**, hanem a felhasználó látja, ahogy a saját gear-listája lentebb élőben nő — ez ad egy kis haladás-érzetet mentéskor, nem kényszerít újra-kattintásra.
- A komponens akkor szűnik meg végleg megjelenni, amikor a felhasználónak már van legalább néhány (pontos szám finomítandó) gear-bejegyzése.

**Nyitva hagyott kérdések a Designer/PO számára:** pontos copywriting, a "néhány gear" küszöbszám, a komponens vizuális átmenete (eltűnés vs. átalakulás pontos animációja).

---

## KÖTELEZŐ KAPU a migration előtt: Category Taxonomy v1

**A migration (1. pont) NEM indulhat el, amíg ez a lépés le nincs zárva és jóvá nincs hagyva.**

A "rendszer-definiált kategória, funkcionális elv" döntés önmagában nem elég a fejlesztéshez — konkrét, jóváhagyott listára van szükség, ami kezeli a határeset-tárgyakat is. Ha ezt a Supabase-migration megírása közben, menet közben találja ki a Full-stack, olyan döntések születnek, amiket senki nem hagyott jóvá.

**Feladat az Architectnek (a PO segítségével):** tervezze meg és mutassa be a **Category Taxonomy v1**-et — a végleges kategória-listát **plusz egy edge case-táblázatot**, ami megmutatja, hogy a vitatható, nem egyértelmű tárgyak hova kerülnek. Csak jóváhagyás után indulhat a migration.

**Minimum lefedendő edge case-ek** (ezek adják a valódi tesztet arra, hogy jó-e a taxonómia):

| Gear | Kérdés |
|---|---|
| Trekking poles | Shelter? Pack? Külön kategória? |
| Headlamp | Electronics-e, vagy külön "Lighting"? |
| Garmin GPS | Electronics-e, vagy külön "Navigation/Safety"? |
| Rain jacket | Clothing egyértelmű, de külön alkategória kell-e (Insulation vs. Rain)? |
| Water filter | Food & Water, vagy külön "Water"? |
| Knife | Safety? Tools? Cooking? |
| Camera | Electronics, de fotósoknak külön súlya van a döntésben |
| Towel | Melyik kategóriába illik egyáltalán? |

**Ha sok ilyen vitatott eset gyűlik össze,** az önmagában jelzés lehet, hogy az "egy gear = egy elsődleges kategória" modell finomításra szorul (pl. kell-e másodlagos/kereszt-kategória bizonyos tárgyaknál) — ezt a jelet ne hagyja figyelmen kívül az Architect, hanem jelezze vissza, ha a tábla összeállítása közben ilyen mintázatot lát.

**Elfogadási kritérium:** a Category Taxonomy v1 táblázat (teljes lista + edge case-ek) Trello-kártyán bemutatva, a felhasználó jóváhagyja, **és csak ezután** indulhat az 1. pontban leírt migration.
