<script setup lang="ts">
/**
 * Sticky summary panel for the gear list page. Surfaces:
 *   - Total base weight (grams, formatted hu-HU).
 *   - Per-category breakdown, default-sorted grams DESC; click header to
 *     toggle ASC/DESC (Designer can elevate later if needed).
 *   - Excluded-items badge (top-right) when excluded_count > 0.
 *
 * States:
 *   - pending=true: 3-line skeleton.
 *   - error: red inline message (no full ErrorBanner — this is a panel,
 *     not a page-level error surface).
 *   - empty: "Még nincs gear item-ed" copy under a 0 g total.
 *
 * Data source: useBaseWeight() composable. Refresh is auto-triggered by
 * useGear mutations via refreshNuxtData('base-weight').
 */
import {
  formatGrams,
  type BaseWeightPerCategory,
} from '~/composables/useBaseWeight';

const {
  totalGrams,
  perCategory,
  excludedGrams,
  excludedCount,
  isEmpty,
  pending,
  error,
} = useBaseWeight();

type SortDir = 'desc' | 'asc';
const sortDir = ref<SortDir>('desc');

const sortedCategories = computed<BaseWeightPerCategory[]>(() => {
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
    class="sticky top-16 z-10 mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    aria-labelledby="base-weight-heading"
  >
    <div class="flex items-baseline justify-between gap-3">
      <div>
        <p id="base-weight-heading" class="text-xs uppercase tracking-wide text-gray-500">
          Teljes base weight
        </p>
        <p class="mt-1 text-3xl font-bold tabular-nums text-gray-900">
          <span v-if="pending" class="inline-block h-7 w-24 animate-pulse rounded bg-gray-200 align-middle" />
          <span v-else>{{ formatGrams(totalGrams) }} g</span>
        </p>
      </div>

      <span
        v-if="excludedCount > 0 && !pending"
        class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
        :title="`${excludedCount} item kizárva a base weight-ből`"
      >
        <span class="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
        {{ excludedCount }} kizárva · {{ formatGrams(excludedGrams) }} g
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
      Még nincs gear item-ed — adj hozzá egyet lent, és a base weight összegzés itt fog megjelenni.
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