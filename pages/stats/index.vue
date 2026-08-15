<script setup lang="ts">
/**
 * Trip-történet + személyes statisztika — Phase 6 / v2 #24.
 *
 * Owner-only page. Aggregated stats come from the `trip_stats` VIEW
 * (security_invoker = true) via GET /api/stats. The recent-trip list
 * is also fetched in the same round-trip so the timeline renders
 * without a second call.
 *
 * UI states (per spec §5.2):
 *  - loading: minimal "Loading…" line
 *  - error: ErrorBanner with the message
 *  - empty (zero trips): MemoFox "Még nincs elég adat" CTA
 *  - populated: 4 statisztika-kártya + base weight trend SVG +
 *               comfort aggregáció + trip-történet timeline
 *
 * The trend chart is an inline SVG line-chart computed from the
 * JSONB `base_weight_trend.trips` time-series. SSR-safe — the
 * viewBox is computed at build time from the data, no width/height
 * attribute on the SVG (scales with container).
 */
import type { TripStatsTrendPoint } from '~/types/db';

definePageMeta({
  title: 'Stats',
});

const { state, load, resetError } = useStats();
const user = useSessionUser();

if (import.meta.client && !user.value) {
  await navigateTo('/signin?next=/stats');
}

onMounted(() => {
  void load();
});

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

const stats = computed(() => state.value.stats);
const recentTrips = computed(() => state.value.recentTrips);
const loading = computed(() => state.value.loading);
const error = computed(() => state.value.error);

// Trip-stats spec §5.2: empty state ha a usernek 0 trip-je van
// (statsRow null). A trend + comfort aggregáció ettől független
// megjelenhet (ha van gear comfort de nincs trip), de a page
// elsődlegesen a Trip-re fókuszál.
const isEmpty = computed(
  () => !loading.value && !error.value && (stats.value === null || stats.value.trip_count === 0),
);

// Trip-specifikus számok formázása
const tripCount = computed(() => stats.value?.trip_count ?? 0);
const totalKm = computed(() => {
  const km = stats.value?.total_km ?? 0;
  return km.toFixed(1);
});
const avgBaseWeightKg = computed(() => {
  const g = stats.value?.base_weight_trend.avg_grams ?? 0;
  if (!g) return '0.0';
  return (g / 1000).toFixed(1);
});
const debriefCompletions = computed(() => {
  const s = stats.value;
  if (!s) return '0 / 0';
  return `${s.debrief_count} / ${s.trip_count}`;
});

// Debrief aggregáció (excess / missing / uncomfortable)
const totalExcess = computed(() => stats.value?.total_excess_items ?? 0);
const totalMissing = computed(() => stats.value?.total_missing_items ?? 0);
const totalUncomfortable = computed(() => stats.value?.total_uncomfortable_items ?? 0);

// Comfort aggregáció (3 dimenzió)
const comfortSleep = computed(() => stats.value?.avg_comfort_sleep ?? null);
const comfortCold = computed(() => stats.value?.avg_comfort_cold ?? null);
const comfortWeight = computed(() => stats.value?.avg_comfort_weight ?? null);
const comfortItemsCount = computed(() => stats.value?.comfort_items_count ?? 0);

// ---------------------------------------------------------------------------
// Base weight trend SVG (inline, SSR-safe)
// ---------------------------------------------------------------------------

// A trend JSONB time-series pontjai (ASC by date).
const trendPoints = computed<TripStatsTrendPoint[]>(
  () => stats.value?.base_weight_trend.trips ?? [],
);

// SVG layout: 600 × 160-as viewBox, 12px padding. A min/max grams
// határozza meg az Y-tartományt; ha a min === max, akkor egy konstans
// vízszintes vonalat rajzolunk a közepére.
const SVG_WIDTH = 600;
const SVG_HEIGHT = 160;
const SVG_PADDING = 16;

const trendPath = computed(() => {
  const pts = trendPoints.value;
  if (pts.length < 2) return '';

  const grams = pts.map((p) => p.total_grams);
  const minG = Math.min(...grams);
  const maxG = Math.max(...grams);
  const range = maxG - minG || 1; // 0 → 1, hogy ne nullával osszunk
  const innerW = SVG_WIDTH - 2 * SVG_PADDING;
  const innerH = SVG_HEIGHT - 2 * SVG_PADDING;

  return pts
    .map((p, i) => {
      const x = SVG_PADDING + (i / (pts.length - 1)) * innerW;
      const y = SVG_PADDING + innerH - ((p.total_grams - minG) / range) * innerH;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
});

const trendRange = computed(() => {
  const t = stats.value?.base_weight_trend;
  if (!t || t.first_date === null) return null;
  return `${t.first_date} → ${t.last_date ?? t.first_date}`;
});

// Trend pontok száma + min/max gramm
const trendMeta = computed(() => {
  const t = stats.value?.base_weight_trend;
  if (!t || trendPoints.value.length === 0) return null;
  return {
    min: t.min_grams,
    max: t.max_grams,
    avg: t.avg_grams,
    pointCount: trendPoints.value.length,
  };
});

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

const formatComfort = (v: number | null): string => {
  if (v === null) return '—';
  return `${v.toFixed(1)} / 5`;
};

const formatTripDate = (start: string | null, end: string | null): string => {
  if (!start && !end) return 'Dátum nélkül';
  if (start && end) return `${start} → ${end}`;
  return start ?? end ?? '';
};
</script>

<template>
  <section class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
    <header class="mb-6">
      <h1 class="text-2xl font-semibold tracking-tight text-gray-900">
        📊 Trip-történet és statisztika
      </h1>
      <p class="mt-1 text-sm text-gray-600">
        Saját túráid összesítése · kizárólag a te adataidból
      </p>
    </header>

    <ErrorBanner
      v-if="error"
      :message="error"
      class="mb-4"
      @dismiss="resetError"
    />

    <div
      v-if="loading && !stats"
      class="rounded-card border border-gray-200 bg-white p-6 text-sm text-gray-500"
    >
      Loading…
    </div>

    <div
      v-else-if="isEmpty"
      class="rounded-card border border-espresso-200 bg-blushLight-50 p-8 text-center"
    >
      <p class="text-lg font-semibold text-espresso-900">
        Még nincs elég adat
      </p>
      <p class="mt-2 text-sm text-espresso-700">
        Menj, túrázz, és töltsd fel a debrief-et — aztán itt összesítünk mindent!
      </p>
      <NuxtLink
        v-if="user"
        to="/trips"
        class="mt-4 inline-flex items-center rounded-card border border-moss-500 bg-moss-50 px-4 py-2 text-sm font-medium text-moss-700 hover:bg-moss-100"
      >
        Túrák megtekintése
      </NuxtLink>
    </div>

    <template v-else-if="stats">
      <!-- 4 statisztika-kártya -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-card border border-gray-200 bg-white p-5">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500">
            Túrák száma
          </p>
          <p class="mt-2 text-3xl font-bold tabular-nums text-brand-600">
            {{ tripCount }}
          </p>
        </div>
        <div class="rounded-card border border-gray-200 bg-white p-5">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500">
            Összesített km
          </p>
          <p class="mt-2 text-3xl font-bold tabular-nums text-brand-600">
            {{ totalKm }} km
          </p>
        </div>
        <div class="rounded-card border border-gray-200 bg-white p-5">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500">
            Átlagos base weight
          </p>
          <p class="mt-2 text-3xl font-bold tabular-nums text-brand-600">
            {{ avgBaseWeightKg }} kg
          </p>
        </div>
        <div class="rounded-card border border-gray-200 bg-white p-5">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500">
            Debrief kitöltések
          </p>
          <p class="mt-2 text-3xl font-bold tabular-nums text-brand-600">
            {{ debriefCompletions }}
          </p>
        </div>
      </div>

      <!-- Base weight trend -->
      <div class="mt-6 rounded-card border border-gray-200 bg-white p-6">
        <div class="mb-3 flex items-baseline justify-between">
          <h2 class="text-base font-semibold text-gray-900">
            Base weight trend
          </h2>
          <p v-if="trendRange" class="text-xs text-gray-500">
            {{ trendRange }}
          </p>
        </div>
        <div v-if="trendPoints.length < 2" class="text-sm text-gray-500">
          Még legalább 2 túra kell a trend megjelenítéséhez.
        </div>
        <div v-else>
          <svg
            :viewBox="`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`"
            class="h-40 w-full"
            preserveAspectRatio="none"
            role="img"
            aria-label="Base weight trend idősor"
          >
            <path
              :d="trendPath"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-brand-500"
            />
          </svg>
          <div
            v-if="trendMeta"
            class="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600"
          >
            <span>
              <span class="font-medium">Min:</span>
              {{ (trendMeta.min / 1000).toFixed(2) }} kg
            </span>
            <span>
              <span class="font-medium">Átlag:</span>
              {{ (trendMeta.avg / 1000).toFixed(2) }} kg
            </span>
            <span>
              <span class="font-medium">Max:</span>
              {{ (trendMeta.max / 1000).toFixed(2) }} kg
            </span>
            <span>
              <span class="font-medium">Minták:</span>
              {{ trendMeta.pointCount }}
            </span>
          </div>
        </div>
      </div>

      <!-- Debrief aggregáció + Comfort aggregáció -->
      <div class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div class="rounded-card border border-gray-200 bg-white p-6">
          <h2 class="text-base font-semibold text-gray-900">
            🦊 Mit bántam meg? <span class="text-sm font-normal text-gray-500">(aggregált)</span>
          </h2>
          <dl class="mt-4 space-y-3 text-sm">
            <div class="flex items-baseline justify-between">
              <dt class="text-gray-700">Felesleges</dt>
              <dd class="font-semibold tabular-nums text-gray-900">
                {{ totalExcess }} item
              </dd>
            </div>
            <div class="flex items-baseline justify-between">
              <dt class="text-gray-700">Hiányzott</dt>
              <dd class="font-semibold tabular-nums text-gray-900">
                {{ totalMissing }} item
              </dd>
            </div>
            <div class="flex items-baseline justify-between">
              <dt class="text-gray-700">Kényelmetlen</dt>
              <dd class="font-semibold tabular-nums text-gray-900">
                {{ totalUncomfortable }} item
              </dd>
            </div>
          </dl>
        </div>

        <div class="rounded-card border border-gray-200 bg-white p-6">
          <h2 class="text-base font-semibold text-gray-900">
            😊 Átlagos komfort <span class="text-sm font-normal text-gray-500">(a gear-listádon)</span>
          </h2>
          <dl class="mt-4 space-y-3 text-sm">
            <div class="flex items-baseline justify-between">
              <dt class="text-gray-700">Alvás</dt>
              <dd class="font-semibold tabular-nums text-gray-900">
                {{ formatComfort(comfortSleep) }}
                <span class="text-xs font-normal text-gray-500">
                  ({{ comfortItemsCount }} item)
                </span>
              </dd>
            </div>
            <div class="flex items-baseline justify-between">
              <dt class="text-gray-700">Hidegben</dt>
              <dd class="font-semibold tabular-nums text-gray-900">
                {{ formatComfort(comfortCold) }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between">
              <dt class="text-gray-700">Súlya</dt>
              <dd class="font-semibold tabular-nums text-gray-900">
                {{ formatComfort(comfortWeight) }}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <!-- Trip-történet timeline (utolsó 10 túra) -->
      <div class="mt-6 rounded-card border border-gray-200 bg-white p-6">
        <h2 class="mb-4 text-base font-semibold text-gray-900">
          Trip-történet (utolsó 10 túra)
        </h2>
        <div v-if="recentTrips.length === 0" class="text-sm text-gray-500">
          Még nincs túra a listában.
        </div>
        <ul v-else class="divide-y divide-gray-100">
          <li
            v-for="trip in recentTrips"
            :key="trip.id"
            class="py-3 first:pt-0 last:pb-0"
          >
            <NuxtLink
              :to="`/trips/${trip.id}`"
              class="flex items-baseline justify-between gap-4 rounded px-2 py-1 hover:bg-gray-50"
            >
              <div class="min-w-0">
                <p class="truncate font-medium text-gray-900">
                  {{ trip.name }}
                </p>
                <p class="text-xs text-gray-500">
                  {{ formatTripDate(trip.start_date, trip.end_date) }}
                </p>
              </div>
              <span class="shrink-0 text-xs text-gray-500">→</span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>
