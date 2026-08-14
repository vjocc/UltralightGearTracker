/**
 * Tailwind toolchain config.
 *
 * P4.0 (Sprint 4 — MemoFox design refactor) — palette, radius, typography swap.
 *
 * Source of truth: docs/Design-System.md §2.1 (brand colors), §2.2
 * (neutrals), §3.3 (type scale), plus docs/sprint-4-architect-brief.md
 * §2 P4.0. Old P1 earth-palette (`bark`, `moss` legacy, `sand`, `clay`,
 * `loam`) has been REMOVED — see migration table in
 * docs/sprint-4-architect-brief.md §2 P4.3 (UI refactor) for the
 * mechanical rewrite of ~125 call-sites in 8 component files.
 *
 * Brand palette (full 50–900 scale, hex values derived from the
 * design system seeds):
 *  - brand     : Brand Purple `#7936EB` — primary CTA, action accent
 *  - espresso  : Ink Brown    `#2D0E05` — primary text, dark process card bg
 *  - ember     : Ember Orange `#EB5D36` — icon outline on dark cards,
 *                                          accent badges
 *  - moss      : Moss Olive   `#867E36` — divider band, secondary accent
 *
 * Neutrals (single-hex tokens, also exposed at 50–900 for consistency
 * with the P4.3 spread-usage):
 *  - fogGrey   : `#D9DDDE`  section background (neutral grey)
 *  - iceBlue   : `#EDF4F6`  light blue card bg
 *  - blushLight: `#FBF4F2`  cream section bg + feature cards
 *  - blushMid  : `#EBE2DF`  taupe section bg
 *  - umber     : `#573933`  footer illustration mid-layer
 *
 * Border-radius tokens (MemoFox §3 — playful rounded form language):
 *  - pill    : 9999px  — CTA buttons
 *  - card    : 24px    — large cards
 *  - cardLg  : 28px    — hero / showcase cards
 *  - panel   : 18px    — overlay panels
 *  - panelSm : 16px    — small inline panels
 *
 * Typography tokens (MemoFox §3 — display + body font pairing):
 *  - display : Baloo 2 (Google Fonts, rounded ExtraBold) — H1–H3, button labels
 *  - body    : Inter (Google Fonts) — body, nav, UI
 *  See nuxt.config.ts app.head.link for the Google Fonts <link>.
 */
import type { Config } from 'tailwindcss';

/** Inline scale generator — keeps the 50–900 entries readable. */
const scale = (seed: string): Record<string, string> => ({
  50: seed,
  100: seed,
  200: seed,
  300: seed,
  400: seed,
  500: seed,
  600: seed,
  700: seed,
  800: seed,
  900: seed,
});

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
        // --- Brand palette (full 50–900) -------------------------------------
        brand: {
          50: '#F4ECFD',
          100: '#E7D6FB',
          200: '#CFADF6',
          300: '#B584F1',
          400: '#9A5BED',
          500: '#7936EB', // design-system seed
          600: '#6027C2',
          700: '#481B94',
          800: '#311267',
          900: '#1A0939',
        },
        espresso: {
          50: '#F8F2EF',
          100: '#E9D9D0',
          200: '#C9A99A',
          300: '#9C7661',
          400: '#6B4734',
          500: '#3F2117',
          600: '#34180E',
          700: '#2A130A',
          800: '#210E07',
          900: '#2D0E05', // design-system seed (Ink Brown)
        },
        ember: {
          50: '#FDF1EB',
          100: '#FBDDCD',
          200: '#F7B89D',
          300: '#F2946D',
          400: '#EF7A50',
          500: '#EB5D36', // design-system seed (Ember Orange)
          600: '#CC4A23',
          700: '#A0391B',
          800: '#742912',
          900: '#481809',
        },
        moss: {
          50: '#F6F5EC',
          100: '#E8E6C9',
          200: '#D3CF9F',
          300: '#BBB774',
          400: '#A39E53',
          500: '#867E36', // design-system seed (Moss Olive)
          600: '#706930',
          700: '#5A552A',
          800: '#454123',
          900: '#302D1A',
        },
        // --- Neutrals (full 50–900) ------------------------------------------
        fogGrey: {
          50: '#F7F8F8',
          100: '#EEEFEF',
          200: '#E3E4E5',
          300: '#D9DDDE', // design-system seed
          400: '#B8BDBE',
          500: '#979D9F',
          600: '#767D7F',
          700: '#555D5F',
          800: '#343D40',
          900: '#131E20',
        },
        iceBlue: {
          50: '#EDF4F6', // design-system seed
          100: '#DDEAEE',
          200: '#C5DBE0',
          300: '#A9C9D0',
          400: '#85B3BE',
          500: '#5F9AA7',
          600: '#427A88',
          700: '#305C66',
          800: '#1F3F46',
          900: '#0E2327',
        },
        blushLight: {
          50: '#FBF4F2', // design-system seed
          100: '#F4E5DF',
          200: '#E9CFC4',
          300: '#DDB7A6',
          400: '#C99A85',
          500: '#A87A66',
          600: '#855C4B',
          700: '#624033',
          800: '#3F271E',
          900: '#1F110B',
        },
        blushMid: {
          50: '#EBE2DF', // design-system seed
          100: '#E0D3CE',
          200: '#C9B4AB',
          300: '#AE9386',
          400: '#947767',
          500: '#795E50',
          600: '#5F493D',
          700: '#47362D',
          800: '#31251E',
          900: '#1C130E',
        },
        umber: {
          50: '#F1E9E6',
          100: '#DAC8C0',
          200: '#C2A89D',
          300: '#A78A7C',
          400: '#896C5C',
          500: '#71564A',
          600: '#5C433B',
          700: '#573933', // design-system seed (Mountain Mid)
          800: '#3B2620',
          900: '#1F1310',
        },
      },
      borderRadius: {
        // MemoFox design §3 — playful rounded form language
        pill: '9999px',   // CTA buttons
        card: '24px',     // large cards
        cardLg: '28px',   // hero / showcase cards
        panel: '18px',    // overlay panels
        panelSm: '16px',  // small inline panels
      },
      fontFamily: {
        // MemoFox §3.1 — display: rounded ExtraBold sans-serif
        display: ['"Baloo 2"', 'ui-rounded', 'system-ui', 'sans-serif'],
        // MemoFox §3.2 — body: humanist sans-serif
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Backwards-compat fallback (P3.x components used `font-sans`).
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      fontSize: {
        // MemoFox §3.3 — desktop scale, rounded to clean px values
        hero:    ['56px',  { lineHeight: '1.1',  fontWeight: '800', letterSpacing: '-0.01em' }],
        h2:      ['40px',  { lineHeight: '1.15', fontWeight: '800', letterSpacing: '-0.01em' }],
        h3:      ['26px',  { lineHeight: '1.2',  fontWeight: '700' }],
        h4:      ['20px',  { lineHeight: '1.3',  fontWeight: '700' }],
        bodyLg:  ['18px',  { lineHeight: '1.5',  fontWeight: '400' }],
        body:    ['16px',  { lineHeight: '1.5',  fontWeight: '400' }],
        button:  ['16px',  { lineHeight: '1.2',  fontWeight: '600' }],
        nav:     ['15px',  { lineHeight: '1.3',  fontWeight: '500' }],
      },
    },
  },
  plugins: [],
};