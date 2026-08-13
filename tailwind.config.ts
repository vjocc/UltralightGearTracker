/**
 * Tailwind toolchain config.
 *
 * P1 (Designer round) — föld-színpaletta a túrázós hangulathoz.
 *
 * A P1 GPX import card bevezetésével landelnek az első design tokenek.
 * A "komfort + súly" mottóhoz a hideg kék/szürke helyett meleg föld-színek
 * (barna, olíva, homok, mohás zöld) kerülnek a rendszerbe. Ezeket a
 * "Trip Plan" / "GPX upload" blokk használja először; a többi oldal
 * fokozatosan költözik át a későbbi round-okban.
 *
 * - bark    : sötét barna (primary text, headings)
 * - moss    : mohás zöld (primary action / accent — track, CTA)
 * - sand    : homok (felületek, kártya-háttér)
 * - clay    : agyag-barna (keretek, elválasztók)
 * - loam    : sötét olíva (secondary text, lábjegyzet)
 *
 * A Tailwind beépített `stone-*`, `amber-*`, `lime-*` skáláit
 * használjuk a kompozícióhoz, hogy ne kelljen egyedi hex értékeket
 * szórni a markupba. Az itt definiált szemantikus nevek bridge-ként
 * szolgálnak, hogy a későbbi round-okban egy lépésben át tudjuk
 * színezni az egész appot anélkül, hogy minden utility class-t
 * végig kéne nézni.
 */
import type { Config } from 'tailwindcss';

export default <Partial<Config>>{
  content: [
    './pages/**/*.{vue,ts}',
    './components/**/*.{vue,ts}',
    './layouts/**/*.{vue,ts}',
    './composables/**/*.{vue,ts}',
    './app.vue',
  ],
  theme: {
    extend: {
      colors: {
        // Föld-színpaletta — túrázós, meleg, alacsony kontrasztú.
        bark: {
          50: '#faf6f1', // háttér (legvilágosabb)
          100: '#f1e8db',
          200: '#e2cfb4',
          300: '#caab83',
          500: '#8a6b46',
          700: '#5a4528', // secondary text
          900: '#2d2218', // primary text / headings
        },
        moss: {
          50: '#f4f7ec',
          100: '#e6ecd0',
          300: '#b5c485',
          500: '#7d9a3f', // hover state
          600: '#627a2c', // default
          700: '#4d7c0f', // primary action / track stroke (lime-700 rokona)
          800: '#3a5a0d',
          900: '#26400a', // badge sötét szöveg (elfogadva)
        },
        sand: {
          50: '#fbf7ee', // kártya-háttér (legvilágosabb)
          100: '#f5ecd6',
          200: '#ead9b0',
          300: '#d9c39b', // badge keret (elutasítva)
        },
        clay: {
          100: '#ede2c7', // badge háttér (pending)
          200: '#d9c39b', // keret
          300: '#c0a472', // erősebb keret / focus ring
          500: '#9a7a48',
          900: '#3a2a14', // badge sötét szöveg (pending)
        },
        loam: {
          500: '#7b6438', // lábjegyzet / meta
          700: '#5b4a26',
        },
      },
      fontFamily: {
        // A P1 summary card stat-soraihoz tabular-nums kell — ezt
        // utility class-szal oldjuk meg (lásd pages/trips/[id].vue),
        // nem kell új fontFace. A default sans marad.
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      // Tabular-nums utility (stat-sorokhoz: "12.4 km").
      // Tailwind 3.4+ támogatja a font-variant-numeric értékeit a
      // numeric variantokon keresztül — a későbbi round-okban bármely
      // stat-sor ráhúzhatja ezt az utility-t.
    },
  },
  plugins: [],
};
