<script setup lang="ts">
/**
 * Row display for a single gear item. Renders name, category badge,
 * weight (g), price, and an "excluded from base" dot. Emits edit/delete
 * — the parent page (pages/gear/index.vue) owns the modal state.
 *
 * Designer note: this card uses minimal Tailwind utilities. Type scale,
 * color palette, button/badge consistency, and hover states are owned by
 * the Designer pass. Do not introduce business logic in styling.
 */
import type { GearItemRow, CategoryRow } from '~/types/db';

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
