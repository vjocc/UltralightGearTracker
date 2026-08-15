<script setup lang="ts">
/**
 * Public gear-list page — v2 #19 /list/{id}.
 *
 * Renders the gear projection of a user's "My Gear" collection behind an
 * opaque `share_token` URL. NO authentication required: the parent
 * `nuxt.config.ts` lists `/list/*` under `redirectOptions.exclude` so the
 * Supabase middleware does NOT redirect anonymous visitors to /signin.
 *
 * v2 §0 alignment:
 *   2. elv (anonymous READ): GET /api/lists/[id] uses the service-role
 *      client with a two-key gate (token + is_public=true + not-expired)
 *      enforced server-side by the `public_list_lookup` helper.
 *   1. elv (no snapshot): the response joins the live gear_items table
 *      at request time, so the OWNER's edits are visible immediately.
 *
 * SEO: `useSeoMeta` populates <title>, meta description, og:title,
 * og:description, og:image. og:image falls back to the project's static
 * og-default until a per-list card is wired in a later phase (the v2
 * spec does not require dynamic generation).
 *
 * Error model: 404 from the API collapses to a friendly "Nem található"
 * state — the page does NOT redirect (anonymous callers have no home
 * to bounce back to).
 */
import type { PublicListResponse } from '~/types/db';

definePageMeta({
  title: 'Public Gear List',
  // Auth middleware will skip this route via redirectOptions.exclude in
  // nuxt.config.ts. The page itself does NOT call useUser() / useSessionUser().
});

const route = useRoute();
const token = computed(() => String(route.params.id ?? ''));

// Validate the UUID shape client-side too — saves a server round-trip on
// obvious typos and lets us render the 404 state immediately.
const isValidUuid = computed(() =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    token.value
  )
);

const state = ref<{
  loading: boolean;
  error: string | null;
  data: PublicListResponse | null;
}>({
  loading: true,
  error: null,
  data: null,
});

const fetchList = async () => {
  state.value = { loading: true, error: null, data: null };
  if (!isValidUuid.value) {
    state.value = {
      loading: false,
      error: 'A megosztott lista nem található.',
      data: null,
    };
    return;
  }
  try {
    const data = await $fetch<PublicListResponse>(
      `/api/lists/${encodeURIComponent(token.value)}`
    );
    state.value = { loading: false, error: null, data };
  } catch (err: unknown) {
    // $fetch throws FetchError with .statusCode; collapse ALL non-2xx to
    // a single "not found" message so hostile probes can't tell a
    // private token from a missing one.
    const fetchErr = err as { statusCode?: number; status?: number };
    const status = fetchErr?.statusCode ?? fetchErr?.status ?? 0;
    state.value = {
      loading: false,
      error:
        status === 404
          ? 'A megosztott lista nem található vagy már nem publikus.'
          : 'A lista betöltése nem sikerült. Próbáld újra később.',
      data: null,
    };
  }
};

onMounted(fetchList);

// ---- SEO -----------------------------------------------------------------
// `useSeoMeta` is the Nuxt 3 recommended API for head meta. We pull the
// title from the list label (or fall back to a generic string) so search
// engines + social cards see something meaningful per share URL.
const seoTitle = computed(() => {
  if (state.value.data?.label) return `${state.value.data.label} · Gear lista`;
  if (state.value.loading) return 'Gear lista betöltése…';
  return 'Gear lista';
});
const seoDescription = computed(() => {
  const count = state.value.data?.gear.length ?? 0;
  if (state.value.data) {
    return `Ultralight gear lista · ${count} tétel · ultralight-gear-tracker`;
  }
  return 'Ultralight gear lista — megosztva az ultralight-gear-tracker alkalmazásból.';
});

const config = useRuntimeConfig();
const ogImage = `${config.public.supabase.url}/storage/v1/object/public/og/og-default.png`;

useSeoMeta({
  title: seoTitle,
  description: seoDescription,
  ogTitle: seoTitle,
  ogDescription: seoDescription,
  ogImage,
  ogType: 'website',
  // Search engines: do NOT index this URL by default — public gear
  // lists may contain personal data the owner later unpublishes.
  // Phase 4 may revisit (Phase 3 spec keeps indexing opt-out to be
  // safe).
  robots: 'noindex, nofollow',
});

// ---- Derived UI ----------------------------------------------------------
const totalGrams = computed(() =>
  (state.value.data?.gear ?? []).reduce((acc, g) => acc + g.weight_g, 0)
);

const formattedTotal = computed(() => {
  const g = totalGrams.value;
  if (g >= 1000) return `${(g / 1000).toFixed(2)} kg`;
  return `${g} g`;
});
</script>

<template>
  <section>
    <!-- Loading state — thin line so the page never flashes blank. -->
    <p v-if="state.loading" class="text-sm text-gray-500">Loading…</p>

    <!-- Error / 404 state. No CTA — anonymous callers don't have a home
         to bounce back to. -->
    <div
      v-else-if="state.error"
      class="rounded border border-gray-200 bg-white p-6 text-center"
    >
      <h1 class="text-lg font-semibold text-gray-900">Nem található</h1>
      <p class="mt-1 text-sm text-gray-600">{{ state.error }}</p>
    </div>

    <!-- Populated state. -->
    <div v-else-if="state.data">
      <header class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 class="text-2xl font-semibold text-gray-900">
            {{ state.data.label || 'Gear lista' }}
          </h1>
          <p class="text-sm text-gray-500">
            {{ state.data.gear.length }} tétel · Összesen {{ formattedTotal }}
          </p>
        </div>
      </header>

      <p
        v-if="state.data.gear.length === 0"
        class="rounded border border-gray-200 bg-white p-6 text-center text-sm text-gray-500"
      >
        Ez a lista még nem tartalmaz megosztható felszerelést.
      </p>

      <ul v-else class="space-y-2">
        <li
          v-for="g in state.data.gear"
          :key="g.id"
          class="flex items-baseline justify-between gap-3 rounded border border-gray-200 bg-white px-4 py-3"
        >
          <div class="min-w-0">
            <p class="truncate font-medium text-gray-900">{{ g.name }}</p>
            <p class="text-xs text-gray-500">
              {{ g.category_name ?? 'Egyéb' }}
            </p>
          </div>
          <p class="shrink-0 text-sm font-medium text-gray-700">
            {{ g.weight_g }} g
          </p>
        </li>
      </ul>
    </div>
  </section>
</template>