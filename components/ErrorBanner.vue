<script setup lang="ts">
/**
 * Generic red error banner fed by useGear().error (or any string).
 * Reusable across pages; the gear list owns the data source.
 */
const props = defineProps<{
  message: string | null;
  dismissible?: boolean;
}>();

const emit = defineEmits<{
  (e: 'dismiss'): void;
}>();

const visible = computed(() => !!props.message);
</script>

<template>
  <Transition name="fade">
    <p
      v-if="visible"
      role="alert"
      class="mb-4 flex items-start justify-between gap-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
    >
      <span class="break-words">{{ message }}</span>
      <button
        v-if="dismissible"
        type="button"
        class="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100"
        @click="emit('dismiss')"
      >
        Bezárás
      </button>
    </p>
  </Transition>
</template>
