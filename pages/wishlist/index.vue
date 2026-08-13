<script setup lang="ts">
/**
 * Wishlist list page. Reads/writes the user's own wishlist_items via
 * useWishlist() and offers a manual Refresh button that calls
 * /api/wishlist/refresh.
 *
 * UI states:
 *  - loading: small "Loading…" line (Designer can elevate)
 *  - error:   ErrorBanner above the list
 *  - empty:   WishlistEmptyState CTA
 *  - populated: list of WishlistCard rows
 *
 * Add + Edit go through WishlistFormModal (single source of truth for
 * the form). Delete uses a native confirm() per Architect spec.
 */
import type { WishlistItemRow } from '~/types/db';

definePageMeta({
  title: 'Wishlist',
});

const { state, lastRefreshAt, list, create, update, remove, refreshAll, resetError } =
  useWishlist();
const { state: catState, list: listCategories } = useCategories();
const user = useSessionUser();

// Gated by middleware; defensive guard for SSR pre-hydration.
if (import.meta.client && !user.value) {
  await navigateTo('/signin?next=/wishlist');
}

// Local UI state for the modal + refresh button.
const modalOpen = ref(false);
const editingItem = ref<WishlistItemRow | null>(null);
const submitting = ref(false);
const refreshing = ref(false);

const openCreate = () => {
  editingItem.value = null;
  modalOpen.value = true;
};

const openEdit = (item: WishlistItemRow) => {
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
  retailer_url: string;
  current_price: number | null;
  target_price: number | null;
}) => {
  submitting.value = true;
  try {
    if (editingItem.value) {
      await update(editingItem.value.id, payload);
    } else {
      await create(payload);
    }
    closeModal();
  } catch {
    // Error is already surfaced into state.error by the composable.
  } finally {
    submitting.value = false;
  }
};

const handleDelete = async (item: WishlistItemRow) => {
  if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
  try {
    await remove(item.id);
  } catch {
    // surfaced via state.error
  }
};

const handleRefresh = async () => {
  refreshing.value = true;
  try {
    await refreshAll();
  } catch {
    // surfaced via state.error
  } finally {
    refreshing.value = false;
  }
};

const lastCheckedLabel = computed(() => {
  if (!lastRefreshAt.value) return 'Never checked';
  const ts = new Date(lastRefreshAt.value);
  if (Number.isNaN(ts.getTime())) return 'Never checked';
  return `Last checked ${ts.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
});

onMounted(async () => {
  await Promise.all([list(), listCategories()]);
});
</script>

<template>
  <section>
    <div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h2 class="text-xl font-semibold text-gray-900">Wishlist</h2>
        <p class="text-sm text-gray-500">
          Own rows only · Supabase RLS gated by auth.uid()
        </p>
      </div>
      <div class="flex items-center gap-2">
        <RefreshPricesButton
          :loading="refreshing"
          :last-checked-label="lastCheckedLabel"
          :item-count="state.items.length"
          @refresh="handleRefresh"
        />
        <button
          type="button"
          class="btn-primary"
          @click="openCreate"
        >
          + Add item
        </button>
      </div>
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
      <WishlistEmptyState @add="openCreate" />
    </div>

    <ul v-else class="mt-2 space-y-2">
      <li v-for="w in state.items" :key="w.id">
        <WishlistCard
          :item="w"
          :category="categoryById.get(w.category_id) ?? null"
          @edit="openEdit"
          @delete="handleDelete"
        />
      </li>
    </ul>

    <WishlistFormModal
      :open="modalOpen"
      :item="editingItem"
      :categories="catState.items"
      :submitting="submitting"
      @close="closeModal"
      @submit="handleSubmit"
    />
  </section>
</template>
