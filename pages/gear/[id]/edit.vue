<script setup lang="ts">
/**
 * Edit-only route. Loads the target row, opens GearFormModal prefilled,
 * and PATCHes via useGear().update() on submit.
 */
import type { GearItemRow } from '~/types/db';

definePageMeta({
  title: 'Edit gear',
});

const route = useRoute();
const router = useRouter();
const id = computed(() => String(route.params.id ?? ''));

const { state, list, update } = useGear();
const { state: catState, list: listCategories } = useCategories();

const submitting = ref(false);
const loadingItem = ref(true);
const target = ref<GearItemRow | null>(null);
const notFound = ref(false);
const modalOpen = ref(true);

onMounted(async () => {
  // Ensure both lists are loaded; if the target row is already in state
  // (because the user navigated from the list), no extra fetch needed.
  await Promise.all([list(), listCategories()]);
  const found = state.value.items.find((it) => it.id === id.value) ?? null;
  target.value = found;
  if (!found) {
    // Edge case: deep link to /gear/<id>/edit while list isn't cached. The
    // current API has no GET /api/gear/[id] — list() already pulled all
    // own rows, so a missing id really means the row doesn't exist for
    // this user.
    notFound.value = true;
    modalOpen.value = false;
  }
  loadingItem.value = false;
});

const close = () => {
  modalOpen.value = false;
  nextTick(() => router.push('/gear'));
};

const handleSubmit = async (payload: {
  name: string;
  category_id: string;
  weight_g: number;
  price: number | null;
  excluded_from_base: boolean;
}) => {
  if (!target.value) return;
  submitting.value = true;
  try {
    await update(target.value.id, {
      ...payload,
      price: payload.price === null || Number.isNaN(payload.price) ? null : payload.price,
    });
    await router.push('/gear');
  } catch {
    // surfaced via useGear().state.error
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <section>
    <h2 class="mb-4 text-xl font-semibold text-gray-900">Edit gear</h2>
    <p v-if="loadingItem" class="text-sm text-gray-500">Loading…</p>
    <p
      v-else-if="notFound"
      class="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
    >
      Could not find that gear item. It may have been deleted or belongs to another account.
    </p>
    <GearFormModal
      v-else
      :open="modalOpen"
      :item="target"
      :categories="catState.items"
      :submitting="submitting"
      @close="close"
      @submit="handleSubmit"
    />
  </section>
</template>
