<script setup lang="ts">
/**
 * Empty-state CTA shown when the signed-in user has no trips yet.
 * Mirrors GearEmptyState / WishlistEmptyState.
 */
const emit = defineEmits<{
  (e: 'add'): void;
}>();
</script>

<template>
  <div class="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
    <h3 class="text-lg font-semibold text-gray-900">No trips yet</h3>
    <p class="mt-1 text-sm text-gray-500">
      Plan a trip: name, optional dates, optional description — then pick gear from your kit.
    </p>
    <button
      type="button"
      class="btn-primary"
      @click="emit('add')"
    >
      Add your first trip
    </button>
  </div>
</template>