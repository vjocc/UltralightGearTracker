<script setup lang="ts">
/**
 * Row display for a single wishlist entry. Shows:
 *  - name + Price alert badge when current_price ≤ target_price
 *  - retailer_url as an external link
 *  - current_price (decimal, formatted USD) or '—' if missing
 *  - target_price or '—' if not set
 *  - last_checked_at as a relative "Last checked …" timestamp
 *
 * Designer note: minimal Tailwind utilities, mirroring GearCard.
 * Designer pass can elevate type scale, color palette, badge styling.
 */
import type { WishlistItemRow, CategoryRow } from '~/types/db';

const props = defineProps<{
  item: WishlistItemRow;
  category?: CategoryRow | null;
}>();

const emit = defineEmits<{
  (e: 'edit', item: WishlistItemRow): void;
  (e: 'delete', item: WishlistItemRow): void;
}>();

const formatPrice = (value: number | null): string => {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};

const priceLabel = computed(() => formatPrice(props.item.current_price));
const targetLabel = computed(() => formatPrice(props.item.target_price));

const priceAlertActive = computed(() => {
  if (props.item.target_price == null) return false;
  if (props.item.current_price == null) return false;
  return props.item.current_price <= props.item.target_price;
});

const lastCheckedLabel = computed(() => {
  if (!props.item.last_checked_at) return 'Never checked';
  const ts = new Date(props.item.last_checked_at);
  // Locale-agnostic short timestamp — Designer pass can swap for a
  // proper relative-time formatter (e.g. Intl.RelativeTimeFormat).
  return `Last checked ${ts.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
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
          v-if="priceAlertActive"
          class="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
          :title="`Current price (${priceLabel}) is at or below target (${targetLabel})`"
        >
          <span class="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          Price alert
        </span>
      </div>

      <dl class="mt-1 flex flex-wrap gap-x-4 text-xs text-gray-500">
        <div>
          <dt class="sr-only">Current price</dt>
          <dd class="tabular-nums">
            <span class="text-gray-400">Now</span>
            <span class="ml-1 text-gray-700">{{ priceLabel }}</span>
          </dd>
        </div>
        <div>
          <dt class="sr-only">Target price</dt>
          <dd class="tabular-nums">
            <span class="text-gray-400">Target</span>
            <span class="ml-1 text-gray-700">{{ targetLabel }}</span>
          </dd>
        </div>
        <div>
          <dt class="sr-only">Last checked</dt>
          <dd class="text-gray-400">{{ lastCheckedLabel }}</dd>
        </div>
      </dl>

      <a
        :href="item.retailer_url"
        target="_blank"
        rel="noopener"
        class="mt-1 inline-block max-w-full truncate text-xs text-indigo-600 hover:underline"
      >
        {{ item.retailer_url }}
      </a>
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
