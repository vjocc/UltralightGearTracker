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
 *
 * Phase 3 (public share): the page exposes a single "Megosztás" toggle
 * that drives the user's `public_lists` row via /api/lists (POST). The
 * URL is built from `share_token` + window.location.origin, copied to
 * the clipboard with the modern Clipboard API (with a fallback path for
 * non-secure contexts where navigator.clipboard is undefined).
 */
import type { GearItemRow, PublicListRow } from '~/types/db';
import { ONBOARDING_KÜSZÖB } from '~/composables/useOnboardingPhase';

definePageMeta({
  title: 'Gear',
});

const { state, list, create, update, remove, resetError } = useGear();
const { state: catState, list: listCategories } = useCategories();
const { refresh: refreshBaseWeight } = useBaseWeight();
const user = useSessionUser();
const supabase = useSupabaseClient();

// Phase 2: show the inline onboarding panel while the user is still in
// the 0..KÜSZÖB-1 window. The KÜSZÖB const is shared with the panel
// (composables/useOnboardingPhase.ts) so the two stay in sync.
const showOnboarding = computed(
  () => state.value.items.length < ONBOARDING_KÜSZÖB && !!user.value
);

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
  // Phase 3: fetch the current user's public_lists row (if any). RLS
  // limits the SELECT to user_id = auth.uid() — same shape as gear_items.
  await refreshPublicShare();
});

// ---- Phase 3: public share state + handlers ------------------------------
const publicShare = ref<PublicListRow | null>(null);
const shareBusy = ref(false);
const shareCopied = ref(false);
let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

const refreshPublicShare = async () => {
  if (!user.value) {
    publicShare.value = null;
    return;
  }
  // maybeSingle() returns null when the row doesn't exist — the user
  // hasn't toggled share yet, which is the privacy-default state.
  const { data } = await supabase
    .from('public_lists')
    .select('*')
    .maybeSingle();
  publicShare.value = (data as unknown as PublicListRow | null) ?? null;
};

const publicShareUrl = computed(() => {
  const token = publicShare.value?.share_token;
  if (!token || !import.meta.client) return '';
  return `${window.location.origin}/list/${token}`;
});

const toggleShare = async () => {
  if (shareBusy.value) return;
  shareBusy.value = true;
  try {
    const nextPublic = !(publicShare.value?.is_public ?? false);
    const updated = await $fetch<PublicListRow>('/api/lists', {
      method: 'POST',
      body: { is_public: nextPublic },
    });
    publicShare.value = updated;
    // When turning share ON for the first time, also copy the URL to
    // the clipboard so the user lands on a useful next-action.
    if (nextPublic && updated.share_token) {
      await copyShareUrl();
    }
  } catch {
    // surfaced via state.error on the gear composable OR an ErrorBanner
    // below — keep this UX minimal for now (Phase 3 spec did not call
    // for a dedicated share-error banner).
  } finally {
    shareBusy.value = false;
  }
};

const copyShareUrl = async () => {
  const url = publicShareUrl.value;
  if (!url) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      // Fallback for non-secure contexts (e.g. http:// localhost previews).
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    shareCopied.value = true;
    if (copyResetTimer) clearTimeout(copyResetTimer);
    copyResetTimer = setTimeout(() => {
      shareCopied.value = false;
    }, 2000);
  } catch {
    // Silent — the user can still copy the URL manually from the
    // visible text below the button.
  }
};
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
      <div class="flex flex-wrap items-center gap-2">
        <!-- Phase 3: public share toggle. The toggle button label flips
             between "Megosztás" (off) and "Megosztva" (on). When ON, the
             URL becomes the visible next-action and a secondary copy
             button appears next to it. -->
        <button
          v-if="state.items.length > 0"
          type="button"
          :class="publicShare?.is_public ? 'btn-secondary' : 'btn-primary'"
          :disabled="shareBusy"
          :aria-pressed="publicShare?.is_public ?? false"
          @click="toggleShare"
        >
          {{ publicShare?.is_public ? 'Megosztva ✓' : 'Megosztás' }}
        </button>
        <button
          v-if="state.items.length > 0"
          type="button"
          class="btn-primary"
          @click="openCreate"
        >
          + Add gear
        </button>
      </div>
    </div>

    <!-- Phase 3: when a public_lists row exists (regardless of is_public
         state), surface the share URL + clipboard helper. The URL is
         stable across re-toggles (share_token is generated server-side
         ONCE on INSERT and never regenerated on UPDATE). -->
    <div
      v-if="publicShare?.share_token"
      class="mb-4 rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm"
      data-testid="public-share-panel"
    >
      <p class="font-medium text-gray-900">
        {{ publicShare.is_public ? 'Publikus megosztási link' : 'Megosztási link (jelenleg privát)' }}
      </p>
      <div class="mt-1 flex flex-wrap items-center gap-2">
        <input
          type="text"
          readonly
          :value="publicShareUrl"
          class="min-w-0 flex-1 truncate rounded border border-gray-300 bg-white px-2 py-1 font-mono text-xs text-gray-700"
          aria-label="Public share URL"
          data-testid="public-share-url"
          @focus="($event.target as HTMLInputElement).select()"
        />
        <button
          type="button"
          class="btn-secondary"
          data-testid="public-share-copy"
          @click="copyShareUrl"
        >
          {{ shareCopied ? 'Másolva ✓' : 'URL másolása' }}
        </button>
      </div>
      <p class="mt-1 text-xs text-gray-500">
        A link a gear-listád aktuális állapotát mutatja — a szerkesztéseid azonnal látszanak a másik oldalon.
      </p>
    </div>

    <BaseWeightSummary />

    <!-- Phase 4 (visual-weight #20): per-category horizontal bar chart.
         Reuses useBaseWeight() via <WeightBreakdownChart />; renders
         nothing on error / empty (BaseWeightSummary already surfaces
         those). -->
    <WeightBreakdownChart />

    <!-- Phase 2: inline onboarding panel (A/B/C phases). Replaces the
         former GearEmptyState CTA — GearEmptyState.vue is kept on disk
         as an orphan for rollback. -->
    <GearOnboardingPanel v-if="showOnboarding" />

    <ErrorBanner
      :message="state.error"
      dismissible
      @dismiss="resetError"
    />

    <p v-if="state.loading" class="text-sm text-gray-500">Loading…</p>

    <TransitionGroup
      v-else
      tag="ul"
      name="gear-list"
      class="mt-2 space-y-2"
    >
      <li v-for="g in state.items" :key="g.id">
        <GearCard
          :item="g"
          :category="categoryById.get(g.category_id) ?? null"
          @edit="openEdit"
          @delete="handleDelete"
        />
      </li>
    </TransitionGroup>

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
