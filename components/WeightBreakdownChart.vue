<script setup lang="ts">
/**
 * Visual weight breakdown chart for the gear list page.
 *
 * Renders the user's own base weight split by category as a series of
 * horizontal bars (one row per category). The data comes from
 * useBaseWeight(), the same composable BaseWeightSummary uses — we
 * don't fetch independently, so SSR + refresh triggers stay in sync.
 *
 * Visual choices (per docs/sprint-4-phase-4-visual-weight-breakdown.md §2.3):
 *   - Horizontal bar (not donut): long category names fit on the left,
 *     comparison-by-length is easier, screen-reader friendly.
 *   - MemoFox palette: brand/ember/moss/umber/espresso in a cyclic
 *     rotation; the server pre-assigns the color_token so SSR ↔ CSR
 *     stay hydration-consistent.
 *
 * States:
 *   - pending: 3-row skeleton.
 *   - populated (perCategory.length > 0): chart with bars + summary line.
 *   - error / empty: component does not render at all — the caller
 *     (pages/gear/index.vue) gates this with v-if, and BaseWeightSummary
 *     surfaces the empty/error copy.
 */
import {
  formatGrams,
  type BaseWeightPerCategory,
} from '~/composables/useBaseWeight';

const { totalGrams, perCategory, pending } = useBaseWeight();

// MemoFox palette → concrete Tailwind bg class. We keep the mapping
// static (literal strings) so Tailwind's content scan picks them up
// at build time. The color_token coming from the API tells us which
// key to look up.
const PALETTE_CLASS: Record<string, string> = {
  brand: 'bg-brand-500',
  ember: 'bg-ember-500',
  moss: 'bg-moss-500',
  umber: 'bg-umber-500',
  espresso: 'bg-espresso-500',
};

// Always grams DESC. The endpoint already sorts that way, but we
// re-sort defensively in case the array ever comes back unordered
// (cheap — typically <20 rows).
const sorted = computed<BaseWeightPerCategory[]>(() =>
  [...perCategory.value].sort((a, b) => b.grams - a.grams)
);
</script>

<template>
  <section
    v-if="perCategory.length > 0 || pending"
    class="mb-4 rounded-card border border-gray-200 bg-white p-4 shadow-sm"
    aria-labelledby="weight-breakdown-heading"
  >
    <h3
      id="weight-breakdown-heading"
      class="font-display font-bold text-espresso-900"
    >
      Súly eloszlása kategóriánként
    </h3>

    <!-- Pending: 3 skeleton rows, mirroring BaseWeightSummary. -->
    <ul
      v-if="pending"
      class="mt-3 space-y-2.5"
      aria-hidden="true"
    >
      <li
        v-for="n in 3"
        :key="n"
        class="h-3 w-full animate-pulse rounded bg-gray-100"
      />
    </ul>

    <!-- Populated: one row per category. -->
    <ul v-else class="mt-3 space-y-2.5">
      <li
        v-for="cat in sorted"
        :key="cat.category_id"
        class="group rounded px-2 py-2 transition-colors duration-150 hover:bg-espresso-900/5"
        :aria-label="`${cat.category_name ?? 'Ismeretlen kategória'}: ${formatGrams(cat.grams)} g, ${cat.percent}%`"
      >
        <div class="flex items-baseline justify-between gap-3">
          <span class="min-w-0 truncate font-body text-espresso-900">
            {{ cat.category_name ?? '—' }}
          </span>
          <span class="shrink-0 text-right">
            <span class="block tabular-nums text-sm text-espresso-900">
              {{ formatGrams(cat.grams) }} g
            </span>
            <span class="block text-xs tabular-nums text-espresso-900/70">
              {{ cat.percent }}%
            </span>
          </span>
        </div>

        <!-- Bar track + filled portion. Inline style sets the width
             because cat.percent is dynamic (0-100). The bg-{token}-500
             class is resolved via PALETTE_CLASS, which keeps Tailwind's
             content scanner happy (literal class strings). -->
        <div
          class="relative mt-1.5 h-2 w-full rounded-full bg-espresso-900/10"
          role="img"
          :aria-label="`${cat.percent}%`"
        >
          <div
            class="absolute left-0 top-0 h-2 rounded-full transition-[width] duration-300"
            :class="PALETTE_CLASS[cat.color_token] ?? 'bg-espresso-500'"
            :style="{ width: `${cat.percent}%` }"
          />
        </div>

        <!-- CSS-only hover tooltip: appears on row hover. -->
        <p
          class="pointer-events-none mt-1 truncate text-right text-xs text-espresso-900/60 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        >
          {{ cat.item_count }} item · {{ formatGrams(cat.grams) }} g · {{ cat.percent }}%
        </p>
      </li>
    </ul>

    <!-- Footer summary line: total grams + category count. -->
    <p
      v-if="!pending && perCategory.length > 0"
      class="mt-3 text-sm font-medium text-espresso-900/80"
    >
      Összesen: {{ formatGrams(totalGrams) }} g · {{ perCategory.length }} kategória
    </p>
  </section>
</template>
