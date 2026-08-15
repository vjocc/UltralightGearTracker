<script setup lang="ts">
/**
 * Row display for a single gear item. Renders name, category badge,
 * weight (g), price, and an "excluded from base" dot. Emits edit/delete
 * — the parent page (pages/gear/index.vue) owns the modal state.
 *
 * Designer note: this card uses minimal Tailwind utilities. Type scale,
 * color palette, button/badge consistency, and hover states are owned by
 * the Designer pass. Do not introduce business logic in styling.
 *
 * P5 / v2 #21 — comfort-summary badge:
 *   - Mind a 3 dimenzió kitöltött: "😊 4.3" (átlag 1 tizedesre), brand-500.
 *   - 1-2 dimenzió kitöltött: "😊 4.0 (2/3)" badge, brand-200 (halványabb).
 *   - 0 dimenzió: nincs badge.
 *   - Natív `title` attribútum tooltip-pel (per-dimenzió: "Alvás X/5 · …").
 *
 * A publikus /list/{id} route a comfort mezőt nem olvassa (Phase 3), így
 * ez a badge kizárólag a bejelentkezett user saját gear-listáján jelenik
 * meg (v2 §0 #5 elv).
 */
import type { GearItemRow, CategoryRow, GearComfort } from '~/types/db';

const props = defineProps<{
  item: GearItemRow;
  category?: CategoryRow | null;
}>();

const emit = defineEmits<{
  (e: 'edit', item: GearItemRow): void;
  (e: 'delete', item: GearItemRow): void;
}>();

const priceLabel = computed(() => {
  if (props.item.price == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(props.item.price);
});

// --- P5 comfort summary -----------------------------------------------------
type ComfortKey = keyof GearComfort;

const comfortMeta: Array<{ key: ComfortKey; label: string }> = [
  { key: 'sleep', label: 'Alvás' },
  { key: 'cold', label: 'Hidegben' },
  { key: 'weight', label: 'Súlya' },
];

interface ComfortSummary {
  ratedCount: number;
  average: number; // rounded to 1 decimal
  tooltip: string;
}

const comfortSummary = computed<ComfortSummary | null>(() => {
  const c = props.item.comfort;
  if (!c) return null;
  const ratings = comfortMeta
    .map(({ key, label }) => ({ label, value: c[key] }))
    .filter((r): r is { label: string; value: number } => typeof r.value === 'number');
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((acc, r) => acc + r.value, 0);
  const avg = sum / ratings.length;
  return {
    ratedCount: ratings.length,
    average: Math.round(avg * 10) / 10,
    tooltip: ratings
      .map((r) => `${r.label} ${r.value}/5`)
      .join(' · '),
  };
});
</script>

<template>
  <article
    class="flex items-center justify-between gap-4 rounded border border-gray-200 bg-white p-4 hover:bg-gray-50"
  >
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="truncate text-sm font-semibold text-gray-900">
          {{ item.name }}
        </h3>
        <span
          v-if="category"
          class="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
        >
          {{ category.name }}
        </span>
        <span
          v-if="item.excluded_from_base"
          class="inline-block h-2 w-2 rounded-full bg-amber-500"
          title="Excluded from base weight"
        />
        <!--
          P5 / v2 #21 comfort summary badge. 3-state:
          ratedCount === 3 → brand-500, "😊 X.Y"
          ratedCount 1..2  → brand-200, "😊 X.Y (n/3)"
          ratedCount 0     → nem renderelünk (computed → null)
          A `title` attribútum adja a natív tooltipet (per-dimenzió).
        -->
        <span
          v-if="comfortSummary"
          class="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tabular-nums"
          :class="
            comfortSummary.ratedCount === 3
              ? 'bg-brand-500 text-white'
              : 'bg-brand-200 text-brand-800'
          "
          :title="comfortSummary.tooltip"
          :aria-label="`Komfort: ${comfortSummary.tooltip}`"
        >
          <span aria-hidden="true" class="mr-1">😊</span>
          {{ comfortSummary.average.toFixed(1) }}<span
            v-if="comfortSummary.ratedCount < 3"
            class="ml-1 text-[10px] font-medium opacity-75"
          >
            ({{ comfortSummary.ratedCount }}/3)
          </span>
        </span>
      </div>
      <dl class="mt-1 flex flex-wrap gap-x-4 text-xs text-gray-500">
        <div>
          <dt class="sr-only">Weight</dt>
          <dd class="tabular-nums">{{ item.weight_g }} g</dd>
        </div>
        <div>
          <dt class="sr-only">Price</dt>
          <dd class="tabular-nums">{{ priceLabel }}</dd>
        </div>
      </dl>
    </div>
    <div class="flex shrink-0 gap-2">
      <button
        type="button"
        class="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
        @click="emit('edit', item)"
      >
        Edit
      </button>
      <button
        type="button"
        class="btn-danger px-2 py-1 text-xs"
        @click="emit('delete', item)"
      >
        Delete
      </button>
    </div>
  </article>
</template>