<script setup lang="ts">
/**
 * Empty-state CTA shown when the signed-in user has no wishlist rows yet.
 * Architect spec: "Add your first wishlist item".
 */
defineProps<{
  categoryCount?: number;
}>();

const emit = defineEmits<{
  (e: 'add'): void;
}>();
</script>

<template>
  <div class="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
    <h3 class="text-lg font-semibold text-gray-900">No wishlist items yet</h3>
    <p class="mt-1 text-sm text-gray-500">
      Track gear you're eyeing: add a name, link, and an optional target price to get notified when it drops.
    </p>
    <button
      type="button"
      class="btn-primary"
      @click="emit('add')"
    >
      Add your first wishlist item
    </button>
  </div>
</template>
