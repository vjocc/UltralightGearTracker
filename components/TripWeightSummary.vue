<script setup lang="ts">
/**
 * Sticky summary panel for the trip detail page. Surfaces:
 *   - Trip total weight (grams, formatted hu-HU).
 *   - Per-category roll-up, default-sorted grams DESC; click header to
 *     toggle ASC/DESC (matches BaseWeightSummary's interaction).
 *   - Item-count badge (`{n} item`) on the top-right.
 *
 * States:
 *   - pending=true: 3-line skeleton.
 *   - error: red inline message (no full ErrorBanner — this is a panel,
 *     not a page-level error surface).
 *   - empty: "Még nincs kiválasztott felszerelés" copy under a 0 g total.
 *
 * Data source: useTripWeight(tripId) composable. The trip detail page
 * calls refresh() in the TripGearPicker save `finally` block so the
 * numbers update as soon as the picker commits.
 *
 * Sticky positioning mirrors BaseWeightSummary: `top-16 z-10` lines up
 * with the AppHeader's h-16 band.
 */
import {
  formatGrams,
  type TripWeightPerCategory,
} from '~/composables/useTripWeight';

const props = defineProps<{
  tripId: string;
}>();

const {
  totalGrams,
  itemCount,
  perCategory,
  isEmpty,
  pending,
  error,
} = useTripWeight(props.tripId);

type SortDir = 'desc' | 'asc';
const sortDir = ref<SortDir>('desc');

const sortedCategories = computed<TripWeightPerCategory[]>(() => {
  const list = [...perCategory.value];
  list.sort((a, b) =>
    sortDir.value === 'desc' ? b.grams - a.grams : a.grams - b.grams
  );
  return list;
});

const toggleSort = () => {
  sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc';
};

const sortLabel = computed(() =>
  sortDir.value === 'desc' ? 'gramm DESC' : 'gramm ASC'
);
</script>

<template>
  <section
    class="sticky top-16 z-10 mb-4 rounded-card border border-gray-200 bg-white p-4 shadow-sm"
    aria-labelledby="trip-weight-heading"
  >
    <div class="flex items-baseline justify-between gap-3">
      <div>
        <p
          id="trip-weight-heading"
          class="text-xs uppercase tracking-wide text-gray-500"
        >
          Trip súly
        </p>
        <p class="mt-1 text-3xl font-bold tabular-nums text-gray-900">
          <span
            v-if="pending"
            class="inline-block h-7 w-24 animate-pulse rounded bg-gray-200 align-middle"
          />
          <span v-else>{{ formatGrams(totalGrams) }} g</span>
        </p>
      </div>

      <span
        v-if="!pending"
        class="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
        :title="`${itemCount} gear item a tripben`"
      >
        {{ itemCount }} item
      </span>
    </div>

    <p
      v-if="error"
      role="alert"
      class="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700"
    >
      {{ error }}
    </p>

    <!-- Empty state -->
    <p
      v-else-if="isEmpty"
      class="mt-3 text-sm text-gray-500"
    >
      Még nincs kiválasztott felszerelés
    </p>

    <!-- Per-category list -->
    <template v-else-if="perCategory.length > 0">
      <button
        type="button"
        class="mt-3 flex w-full items-center justify-between text-xs font-medium text-gray-500 hover:text-gray-700"
        :aria-sort="sortDir === 'desc' ? 'descending' : 'ascending'"
        @click="toggleSort"
      >
        <span>Per kategória ({{ perCategory.length }})</span>
        <span class="inline-flex items-center gap-1">
          {{ sortLabel }}
          <span aria-hidden="true">{{ sortDir === 'desc' ? '↓' : '↑' }}</span>
        </span>
      </button>

      <ul class="mt-2 divide-y divide-gray-100">
        <li
          v-for="cat in sortedCategories"
          :key="cat.category_id"
          class="flex items-baseline justify-between py-1.5 text-sm"
        >
          <span class="min-w-0 truncate text-gray-700">
            {{ cat.category_name ?? '—' }}
            <span class="ml-1 text-xs text-gray-400">×{{ cat.item_count }}</span>
          </span>
          <span class="shrink-0 tabular-nums text-gray-900">
            {{ formatGrams(cat.grams) }} g
          </span>
        </li>
      </ul>
    </template>

    <!-- Loading skeleton (when per-category list would otherwise be empty) -->
    <ul
      v-else-if="pending"
      class="mt-3 space-y-1.5"
      aria-hidden="true"
    >
      <li
        v-for="n in 3"
        :key="n"
        class="h-4 w-full animate-pulse rounded bg-gray-100"
      />
    </ul>
  </section>
</template>