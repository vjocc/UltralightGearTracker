<script setup lang="ts">
/**
 * Gear list page. Reads/writes the user's own gear_items via useGear().
 * Own-rows-only is enforced server-side by Supabase RLS.
 *
 * UI states:
 *  - loading: skeleton-free thin loading line (Designer can elevate)
 *  - error: ErrorBanner above the table
 *  - empty: GearEmptyState CTA
 *  - populated: list of GearCard rows
 *
 * Add + Edit go through GearFormModal (single source of truth for the
 * form). Delete uses a native confirm() per Architect spec.
 */
import type { GearItemRow } from '~/types/db';

definePageMeta({
  title: 'Gear',
});

const { state, list, create, update, remove, resetError } = useGear();
const { state: catState, list: listCategories } = useCategories();
const { refresh: refreshBaseWeight } = useBaseWeight();
const user = useSessionUser();

// Gated by middleware; this is a defensive guard for SSR pre-hydration.
if (import.meta.client && !user.value) {
  await navigateTo('/signin?next=/gear');
}

// Local UI state for the modal.
const modalOpen = ref(false);
const editingItem = ref<GearItemRow | null>(null);
const submitting = ref(false);

const openCreate = () => {
  editingItem.value = null;
  modalOpen.value = true;
};

const openEdit = (item: GearItemRow) => {
  editingItem.value = item;
  modalOpen.value = true;
};

const closeModal = () => {
  modalOpen.value = false;
  editingItem.value = null;
};

const categoryById = computed(() => {
  const map = new Map<string, (typeof catState.value.items)[number]>();
  for (const c of catState.value.items) map.set(c.id, c);
  return map;
});

const handleSubmit = async (payload: {
  name: string;
  category_id: string;
  weight_g: number;
  price: number | null;
  excluded_from_base: boolean;
}) => {
  submitting.value = true;
  try {
    if (editingItem.value) {
      await update(editingItem.value.id, {
        ...payload,
        // Coerce empty price to null so the row's price column stays NULL.
        price: payload.price === null || Number.isNaN(payload.price) ? null : payload.price,
      });
    } else {
      await create({
        ...payload,
        price: payload.price === null || Number.isNaN(payload.price) ? null : payload.price,
      });
    }
    closeModal();
  } catch {
    // Error is already surfaced into state.error by the composable.
  } finally {
    submitting.value = false;
  }
};

const handleDelete = async (item: GearItemRow) => {
  if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
  try {
    await remove(item.id);
  } catch {
    // surfaced via state.error
  }
};

onMounted(async () => {
  await Promise.all([list(), listCategories(), refreshBaseWeight()]);
});
</script>

<template>
  <section>
    <div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h2 class="text-xl font-semibold text-gray-900">Gear</h2>
        <p class="text-sm text-gray-500">
          Own rows only · Supabase RLS gated by auth.uid()
        </p>
      </div>
      <button
        type="button"
        class="btn-primary"
        @click="openCreate"
      >
        + Add gear
      </button>
    </div>

    <BaseWeightSummary />

    <ErrorBanner
      :message="state.error"
      dismissible
      @dismiss="resetError"
    />

    <p v-if="state.loading" class="text-sm text-gray-500">Loading…</p>

    <div
      v-else-if="state.items.length === 0"
      class="mt-2"
    >
      <GearEmptyState @add="openCreate" />
    </div>

    <ul v-else class="mt-2 space-y-2">
      <li v-for="g in state.items" :key="g.id">
        <GearCard
          :item="g"
          :category="categoryById.get(g.category_id) ?? null"
          @edit="openEdit"
          @delete="handleDelete"
        />
      </li>
    </ul>

    <GearFormModal
      :open="modalOpen"
      :item="editingItem"
      :categories="catState.items"
      :submitting="submitting"
      @close="closeModal"
      @submit="handleSubmit"
    />
  </section>
</template>
