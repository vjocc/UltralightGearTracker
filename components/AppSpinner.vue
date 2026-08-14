<script setup lang="ts">
/**
 * AppSpinner — tokenized loader used across submit buttons, refresh
 * buttons, and header fetch states. Sized inline (h-3 / h-4 / h-6) so
 * it can sit next to label text with mr-2 / mr-1 call-site spacing;
 * the width/height stay in the spinner (not the parent) for
 * text-baseline alignment.
 *
 * color prop defaults to white for btn-primary backgrounds; bark /
 * moss / sand exist for buttons that aren't indigo (.btn-primary is
 * indigo so white works there too) and for inline loaders on warm
 * panels in pages/trips/[id].vue.
 */
const props = withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg'
    color?: 'white' | 'bark' | 'moss' | 'sand'
    label?: string
  }>(),
  { size: 'md', color: 'white', label: 'Betöltés' },
);

const sizeClass = computed(
  () => ({ sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-6 w-6' })[props.size],
);

const colorClass = computed(
  () =>
    ({
      white: 'border-white/40 border-t-white',
      bark: 'border-espresso-700/30 border-t-espresso-700',
      moss: 'border-moss-600/30 border-t-moss-600',
      sand: 'border-blushMid-300 border-t-blushMid-500',
    })[props.color],
);
</script>

<template>
  <span
    :class="[
      'inline-block animate-spin rounded-full border-2',
      sizeClass,
      colorClass,
    ]"
    role="status"
    :aria-label="label"
  />
</template>
