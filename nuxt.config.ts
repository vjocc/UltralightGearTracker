// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  modules: ['@nuxtjs/supabase', '@nuxtjs/tailwindcss'],

  // Global stylesheet — Tailwind's base/components/utilities layers.
  // Without this file the @nuxtjs/tailwindcss module emits an empty
  // CSS pipeline and every utility class in our templates renders as
  // a no-op (Designer "Changes" verdict, round 1).
  css: ['~/assets/css/tailwind.css'],

  // Google Fonts — MemoFox design system §3.1 (display: Baloo 2,
  // rounded ExtraBold) + §3.2 (body: Inter, humanist sans).
  // The preconnect links cut the FOUT window for both fonts;
  // `display=swap` ensures the layout never blocks on the font load.
  // P4.0 swap: wires the font tokens into tailwind.config.ts
  // (`fontFamily.display` + `fontFamily.body`); P4.3 will switch
  // component `font-sans` usages to `font-body` / `font-display`.
  app: {
    head: {
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Unbounded:wght@600;700;800&family=Plus+Jakarta+Sans:wght@200;400;500;600;700&display=swap',
        },
      ],
    },
  },

  // Wire the hand-typed Database shape into the Supabase module so all
  // serverSupabaseClient(event) calls return a strongly-typed client.
  // Once a real Supabase project is available, replace types/db.ts with
  // `npx supabase gen types typescript --project-id <ref>` output.
  typescript: {
    strict: true,
    typeCheck: false, // typecheck on every dev start would be slow; CI runs `nuxt typecheck`
  },

  supabase: {
    // Point the module at our hand-typed Database shape so serverSupabaseClient()
    // is strongly typed. Replace with `npx supabase gen types typescript` once a
    // real Supabase project is linked.
    types: '~/types/db',

    // URL / key / service-key / secret-key are read from env automatically by
    // @nuxtjs/supabase v2 (see dist/module.mjs defaults). Configure them in
    // Vercel as NUXT_PUBLIC_SUPABASE_URL / NUXT_PUBLIC_SUPABASE_KEY / NUXT_SUPABASE_SECRET_KEY
    // (or the legacy SUPABASE_URL / SUPABASE_KEY / SUPABASE_SECRET_KEY). No
    // runtimeConfig override needed — the module handles env resolution.

    redirectOptions: {
      login: '/signin',
      // PKCE / magic link exchange lands here, then /auth/callback.vue
      // forwards to ?next=... (or /gear by default).
      callback: '/auth/callback',
      // These paths never auto-redirect — they own their own UX.
      exclude: ['/', '/signin', '/signup', '/auth/callback'],
      include: ['/gear', '/wishlist', '/trips', '/settings'],
    },
  },
});
