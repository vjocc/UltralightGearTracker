<script setup lang="ts">
/**
 * Trips list page. Reads/writes the user's own trips via useTrips().
 * Own-rows-only is enforced server-side by Supabase RLS.
 *
 * UI states:
 *  - loading: small "Loading…" line (Designer can elevate to skeleton)
 *  - error: ErrorBanner above the list
 *  - empty: TripEmptyState CTA
 *  - populated: list of TripCard rows
 *
 * Add + Edit go through TripFormModal (single source of truth for the
 * form). Delete uses a native confirm() per Architect spec. Open
 * navigates to the trip detail page (TripGearPicker).
 *
 * The list endpoint deliberately omits `trip_gear(*)` to keep the
 * payload light; the gear count is fetched per-trip via the cached
 * `state.current.trip_gear` array once a detail is loaded.
 */
import type { TripRow } from '~/types/db';

definePageMeta({
  title: 'Trips',
});

const { state, list, get, create, update, remove, resetError } = useTrips();
const user = useSessionUser();

// Gated by middleware; defensive guard for SSR pre-hydration.
if (import.meta.client && !user.value) {
  await navigateTo('/signin?next=/trips');
}

// Local UI state for the modal.
const modalOpen = ref(false);
const editingTrip = ref<TripRow | null>(null);
const submitting = ref(false);

const openCreate = () => {
  editingTrip.value = null;
  modalOpen.value = true;
};

const openEdit = (trip: TripRow) => {
  editingTrip.value = trip;
  modalOpen.value = true;
};

const closeModal = () => {
  modalOpen.value = false;
  editingTrip.value = null;
};

const openTrip = async (trip: TripRow) => {
  // Warm state.current with the nested trip_gear so the detail page
  // doesn't have to refetch on mount.
  await get(trip.id);
  await navigateTo(`/trips/${trip.id}`);
};

const handleSubmit = async (payload: {
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
}) => {
  submitting.value = true;
  try {
    if (editingTrip.value) {
      await update(editingTrip.value.id, payload);
    } else {
      await create(payload);
    }
    closeModal();
  } catch {
    // surfaced via state.error
  } finally {
    submitting.value = false;
  }
};

const handleDelete = async (trip: TripRow) => {
  if (!confirm(`Delete "${trip.name}"? This cannot be undone.`)) return;
  try {
    await remove(trip.id);
  } catch {
    // surfaced via state.error
  }
};

onMounted(async () => {
  await list();
});
</script>

<template>
  <section>
    <div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h2 class="text-xl font-semibold text-gray-900">Trips</h2>
        <p class="text-sm text-gray-500">
          Own rows only · Supabase RLS gated by auth.uid()
        </p>
      </div>
      <button
        type="button"
        class="btn-primary"
        @click="openCreate"
      >
        + Add trip
      </button>
    </div>

    <ErrorBanner
      :message="state.error"
      dismissible
      @dismiss="resetError"
    />

    <p v-if="state.loading && state.items.length === 0" class="text-sm text-gray-500">
      Loading…
    </p>

    <div
      v-else-if="!state.loading && state.items.length === 0"
      class="mt-2"
    >
      <TripEmptyState @add="openCreate" />
    </div>

    <ul v-else class="mt-2 space-y-2">
      <li v-for="t in state.items" :key="t.id">
        <TripCard
          :trip="t"
          :is-owner-viewer="t.user_id === user?.id"
          @open="openTrip"
          @edit="openEdit"
          @delete="handleDelete"
        />
      </li>
    </ul>

    <TripFormModal
      :open="modalOpen"
      :item="editingTrip"
      :submitting="submitting"
      @close="closeModal"
      @submit="handleSubmit"
    />
  </section>
</template>