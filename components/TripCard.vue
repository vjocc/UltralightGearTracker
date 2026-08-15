<script setup lang="ts">
/**
 * TripCard — single-row display for the trips list page.
 *
 * Renders the trip name, an optional date range, the gear count (caller
 * supplies the number — we don't embed a nested select on the list page
 * to keep the GET /api/trips response small), and Edit/Delete buttons.
 *
 * SECURITY (Sprint 4.2 / P4 audit round): the Edit / Delete buttons are
 * owner-only. The parent page supplies `isOwnerViewer`; we refuse to
 * render the controls when the caller isn't the trip owner. This is a
 * defense-in-depth layer on top of the trips RLS policies
 * (`trips_update_own` + `trips_delete_own` are already strict owner-only
 * at the SQL level — but the UI must not invite the friend to click on
 * non-functional buttons that 404 in the background). See docs §P4.2
 * backend fix for the matching 403 semantic.
 */
import type { TripRow } from '~/types/db';

const props = defineProps<{
  trip: TripRow;
  gearCount?: number;
  isOwnerViewer: boolean;
}>();

const emit = defineEmits<{
  (e: 'open', trip: TripRow): void;
  (e: 'edit', trip: TripRow): void;
  (e: 'delete', trip: TripRow): void;
}>();

const dateLabel = computed(() => {
  const { start_date, end_date } = props.trip;
  if (!start_date && !end_date) return 'No dates set';
  if (start_date && end_date && start_date === end_date) return start_date;
  if (start_date && end_date) return `${start_date} → ${end_date}`;
  return start_date ?? end_date ?? '';
});
</script>

<template>
  <article
    class="flex items-center justify-between gap-4 rounded border border-gray-200 bg-white p-4 hover:bg-gray-50"
  >
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="truncate text-sm font-semibold text-gray-900">
          {{ trip.name }}
        </h3>
        <span
          v-if="gearCount !== undefined"
          class="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
        >
          {{ gearCount }} gear
        </span>
      </div>
      <dl class="mt-1 flex flex-wrap gap-x-4 text-xs text-gray-500">
        <div>
          <dt class="sr-only">Dates</dt>
          <dd class="tabular-nums">{{ dateLabel }}</dd>
        </div>
      </dl>
    </div>
    <div class="flex shrink-0 gap-2">
      <button
        type="button"
        class="btn-secondary px-2 py-1 text-xs"
        @click="emit('open', trip)"
      >
        Open
      </button>
      <button
        v-if="isOwnerViewer"
        type="button"
        class="btn-secondary px-2 py-1 text-xs"
        @click="emit('edit', trip)"
      >
        Edit
      </button>
      <button
        v-if="isOwnerViewer"
        type="button"
        class="btn-danger px-2 py-1 text-xs"
        @click="emit('delete', trip)"
      >
        Delete
      </button>
    </div>
  </article>
</template>