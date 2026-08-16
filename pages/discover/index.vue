<script setup lang="ts">
/**
 * Public discover page — Sprint 5 P1 — "Felfedezés a régióban".
 *
 * Lists every trip where `visibility = 'public'`, grouped by region
 * (§11.2 B opció: régiónkénti ABC). NO authentication required: the
 * parent `middleware/auth.global.ts` and `nuxt.config.ts` `redirectOptions
 * .exclude` keep this route reachable for anonymous visitors.
 *
 * Privacy alignment (v2 §0):
 *   #1 elv (no snapshot): the response is a live SELECT — region
 *      changes / visibility flips / new trips appear immediately.
 *   #2 elv (anonymous): no JWT required. The composable calls the
 *      service-role endpoint; the page itself does NOT call
 *      useUser() / useSessionUser().
 *   #3 elv (descriptive, not ranked): NO popularity/score/rating
 *      rendered. NO "top X" framing. The title is "Felfedezés a
 *      régióban" — descriptive, not evaluative.
 *   #4 elv (minimal scope): the response contains no owner_user_id,
 *      no email. The page never asks for them.
 *
 * SEO: `useSeoMeta` populates <title>, meta description, og:title,
 * og:description. og:image falls back to the project's static
 * og-default until a per-list card is wired in a later phase.
 *
 * Empty state: 0 public trips → friendly "Még nincs publikus trip a
 * közösségben" message — NOT an error.
 *
 * Error state: 5xx from /api/discover → "A felfedezés-oldal nem
 * tölthető be" banner with retry.
 */
import { useDiscover } from '~/composables/useDiscover';
import type { DiscoverResponse } from '~/shared/discoverSchemas';

definePageMeta({
  title: 'Felfedezés a régióban',
});

const { state, fetch, resetError } = useDiscover();

useSeoMeta({
  title: 'Felfedezés a régióban — Ultralight Gear Tracker',
  description:
    'A közösség által megosztott túrák, régiónként csoportosítva. Nézd meg, mások merre járnak a hegyekben.',
  ogTitle: 'Felfedezés a régióban — Ultralight Gear Tracker',
  ogDescription:
    'A közösség által megosztott túrák, régiónként csoportosítva.',
});

const isEmpty = computed(
  () =>
    !state.value.loading &&
    !state.value.error &&
    (state.value.data?.regions?.length ?? 0) === 0,
);

const totalTripCount = computed(() => {
  const data: DiscoverResponse | null = state.value.data;
  if (!data) return 0;
  return data.regions.reduce(
    (sum: number, region) => sum + region.trips.length,
    0,
  );
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const handleRetry = () => {
  void fetch();
};

onMounted(async () => {
  await fetch();
});
</script>

<template>
  <section>
    <div class="mb-6">
      <h1 class="font-display text-2xl font-bold text-espresso-900">
        Felfedezés a régióban
      </h1>
      <p class="mt-1 text-sm text-espresso-700">
        A közösség által megosztott túrák, régiónként csoportosítva.
        <span v-if="!state.loading && !state.error && totalTripCount > 0">
          ({{ totalTripCount }} trip, {{ state.data?.regions.length }} régió)
        </span>
      </p>
    </div>

    <ErrorBanner
      :message="state.error"
      dismissible
      @dismiss="resetError"
    />

    <div
      v-if="state.error"
      class="mt-4 flex justify-center"
    >
      <button
        type="button"
        class="btn-secondary px-4 py-2 text-sm"
        @click="handleRetry"
      >
        Újrapróbálkozás
      </button>
    </div>

    <p v-else-if="state.loading" class="text-sm text-gray-500">
      Betöltés…
    </p>

    <div
      v-else-if="isEmpty"
      class="mt-6 rounded-card border border-dashed border-espresso-200 bg-blushLight-50/40 p-8 text-center"
    >
      <p class="text-base font-medium text-espresso-900">
        Még nincs publikus trip a közösségben.
      </p>
      <p class="mt-2 text-sm text-espresso-700">
        Ha te is szeretnéd megosztani a túráidat, a
        <strong>Trips</strong> oldalon kapcsold át a
        „Publikus" opciót — egy szabadon választott régióval
        megjelennek itt is.
      </p>
    </div>

    <div v-else class="mt-2 space-y-8">
      <section
        v-for="region in state.data?.regions"
        :key="region.region"
        :id="`region-${slugify(region.region)}`"
        class="scroll-mt-20"
      >
        <h2 class="font-display text-lg font-semibold text-espresso-900">
          {{ region.region }}
          <span class="ml-1 text-sm font-normal text-espresso-700">
            ({{ region.trips.length }})
          </span>
        </h2>

        <ul class="mt-3 space-y-2">
          <li
            v-for="trip in region.trips"
            :key="trip.id"
            class="rounded-card border border-espresso-200 bg-white p-4"
          >
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <h3 class="font-medium text-espresso-900">{{ trip.name }}</h3>
              <span
                v-if="trip.start_date || trip.end_date"
                class="text-xs tabular-nums text-espresso-700"
              >
                <template v-if="trip.start_date && trip.end_date">
                  {{ trip.start_date }} → {{ trip.end_date }}
                </template>
                <template v-else>
                  {{ trip.start_date ?? trip.end_date }}
                </template>
              </span>
            </div>

            <p
              v-if="trip.description"
              class="mt-2 text-sm text-espresso-700"
            >
              {{ trip.description }}
            </p>

            <div
              v-if="trip.distance_km || trip.elevation_gain_m"
              class="mt-3 flex gap-4 text-xs text-espresso-700"
            >
              <span v-if="trip.distance_km">
                Táv:
                <strong class="tabular-nums">{{ trip.distance_km.toFixed(1) }} km</strong>
              </span>
              <span v-if="trip.elevation_gain_m">
                Szint:
                <strong class="tabular-nums">{{ trip.elevation_gain_m.toFixed(0) }} m</strong>
              </span>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>