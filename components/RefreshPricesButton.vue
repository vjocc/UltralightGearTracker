<script setup lang="ts">
/**
 * Header button that fires /api/wishlist/refresh. While the request is
 * in flight the button shows a spinner and is disabled. lastCheckedLabel
 * is supplied by the parent (computed from lastRefreshAt) so this
 * component stays presentational.
 */
defineProps<{
  loading: boolean;
  /** Pre-rendered label like "Last checked 2026-08-12 18:39 UTC" or
   *  "Never checked" — owned by the page so it can read lastRefreshAt. */
  lastCheckedLabel: string;
  /** Number of wishlist rows currently in view; disables when 0. */
  itemCount: number;
}>();

const emit = defineEmits<{
  (e: 'refresh'): void;
}>();
</script>

<template>
  <div class="flex items-center gap-3">
    <span class="text-xs text-gray-500">{{ lastCheckedLabel }}</span>
    <button
      type="button"
      class="btn-primary"
      :disabled="loading || itemCount === 0"
      :aria-busy="loading ? 'true' : 'false'"
      @click="emit('refresh')"
    >
      <AppSpinner
        v-if="loading"
        class="mr-2"
        label="Frissítés folyamatban"
      />
      {{ loading ? 'Refreshing…' : 'Refresh prices' }}
    </button>
  </div>
</template>
