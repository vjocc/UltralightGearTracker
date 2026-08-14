<script setup lang="ts">
/**
 * Empty-state CTA shown when the signed-in user has no gear rows yet.
 * Architect spec: "Add your first piece of gear".
 */
defineProps<{
  /** Optional pre-fetched categories count for richer empty copy. */
  categoryCount?: number;
}>();

const emit = defineEmits<{
  (e: 'add'): void;
}>();
</script>

<template>
  <div class="rounded-card border border-dashed border-gray-300 bg-white p-10 text-center">
    <h3 class="text-lg font-semibold text-gray-900">No gear yet</h3>
    <p class="mt-1 text-sm text-gray-500">
      Start by adding the first piece of gear in your kit.
    </p>
    <button
      type="button"
      class="btn-primary"
      @click="emit('add')"
    >
      Add your first piece of gear
    </button>
  </div>
</template>
