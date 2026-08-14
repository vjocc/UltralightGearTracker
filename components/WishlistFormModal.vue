<script setup lang="ts">
/**
 * Controlled modal for create + edit wishlist row. Mirrors GearFormModal
 * but works with the smaller wishlist schema (no weight/price/excluded).
 * Current_price + target_price can be null (cleared) or blank (number-
 * input empty); submit coerces to null before handing to zod.
 *
 * Validation runs on every change; submit is gated until success.
 */
import { wishlistCreateSchema } from '~/shared/wishlistSchemas';
import type { WishlistItemRow, CategoryRow } from '~/types/db';

const props = defineProps<{
  open: boolean;
  categories: CategoryRow[];
  /** Provided for edit mode; undefined for create mode. */
  item?: WishlistItemRow | null;
  submitting?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (
    e: 'submit',
    payload: {
      name: string;
      category_id: string;
      retailer_url: string;
      current_price: number | null;
      target_price: number | null;
    }
  ): void;
}>();

// Form state — current_price / target_price are '' when blank so the
// number input plays nicely with v-model.
const form = reactive({
  name: '',
  category_id: '',
  retailer_url: '',
  current_price: '' as number | '' | null,
  target_price: '' as number | '' | null,
});

const fieldErrors = ref<Record<string, string>>({});

const isEdit = computed(() => !!props.item);

const resetForm = () => {
  form.name = props.item?.name ?? '';
  form.category_id = props.item?.category_id ?? '';
  form.retailer_url = props.item?.retailer_url ?? '';
  form.current_price = props.item?.current_price ?? '';
  form.target_price = props.item?.target_price ?? '';
  fieldErrors.value = {};
};

watch(
  () => [props.open, props.item?.id],
  ([open]) => {
    if (open) resetForm();
  },
  { immediate: true }
);

const buildPayload = () => {
  const parseOptional = (v: number | '' | null): number | null => {
    if (v === '' || v === null) return null;
    return Number(v);
  };
  return {
    name: form.name.trim(),
    category_id: form.category_id,
    retailer_url: form.retailer_url.trim(),
    current_price: parseOptional(form.current_price),
    target_price: parseOptional(form.target_price),
  };
};

// Live validation; button is disabled until success.
const validation = computed(() => wishlistCreateSchema.safeParse(buildPayload()));

const canSubmit = computed(() => {
  if (props.categories.length === 0) return false;
  return validation.value.success;
});

const onSubmit = () => {
  if (!canSubmit.value) return;
  emit('submit', buildPayload());
};

const fieldError = (key: string) => fieldErrors.value[key] ?? '';

const issueFor = (key: string) =>
  validation.value.success
    ? ''
    : validation.value.error?.issues.find((i) => i.path[0] === key)?.message ?? '';

// --- Focus trap + Esc-to-close -------------------------------------------------
const dialogRef = ref<HTMLElement | null>(null);
const previouslyFocused = ref<HTMLElement | null>(null);

const focusableSelector =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable]';

const getFocusable = (): HTMLElement[] => {
  if (!dialogRef.value) return [];
  return Array.from(
    dialogRef.value.querySelectorAll<HTMLElement>(focusableSelector)
  ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
};

const onKeydown = (e: KeyboardEvent) => {
  if (!props.open) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    emit('close');
    return;
  }
  if (e.key !== 'Tab') return;
  const focusables = getFocusable();
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (e.shiftKey) {
    if (active === first || !dialogRef.value?.contains(active)) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (active === last) {
      e.preventDefault();
      first.focus();
    }
  }
};

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previouslyFocused.value = document.activeElement as HTMLElement | null;
      await nextTick();
      const focusables = getFocusable();
      const target =
        focusables.find((el) => el.id === 'wishlist-name') ?? focusables[0];
      target?.focus();
    } else {
      previouslyFocused.value?.focus?.();
      previouslyFocused.value = null;
    }
  }
);

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="isEdit ? 'Edit wishlist item' : 'Add wishlist item'"
      @click.self="emit('close')"
    >
      <div
        ref="dialogRef"
        class="w-full max-w-md rounded-card bg-white p-6 shadow-xl"
      >
        <h2 class="text-lg font-semibold text-gray-900">
          {{ isEdit ? 'Edit wishlist item' : 'Add wishlist item' }}
        </h2>
        <form class="mt-4 space-y-4" @submit.prevent="onSubmit">
          <div>
            <label for="wishlist-name" class="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="wishlist-name"
              v-model="form.name"
              type="text"
              maxlength="80"
              required
              autocomplete="off"
              class="input"
            />
            <p v-if="issueFor('name')" class="mt-1 text-xs text-red-600">
              {{ fieldError('name') || issueFor('name') }}
            </p>
          </div>

          <div>
            <label for="wishlist-category" class="block text-sm font-medium text-gray-700">
              Category
            </label>
            <select
              id="wishlist-category"
              v-model="form.category_id"
              required
              class="input"
            >
              <option value="" disabled>Select a category</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select>
            <p v-if="issueFor('category_id')" class="mt-1 text-xs text-red-600">
              {{ fieldError('category_id') || issueFor('category_id') }}
            </p>
            <p v-if="categories.length === 0" class="mt-1 text-xs text-gray-500">
              No categories yet. Create one in the categories page first.
            </p>
          </div>

          <div>
            <label for="wishlist-url" class="block text-sm font-medium text-gray-700">
              Retailer URL
            </label>
            <input
              id="wishlist-url"
              v-model="form.retailer_url"
              type="url"
              required
              autocomplete="off"
              class="input"
              placeholder="https://…"
            />
            <p v-if="issueFor('retailer_url')" class="mt-1 text-xs text-red-600">
              {{ fieldError('retailer_url') || issueFor('retailer_url') }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="wishlist-current-price" class="block text-sm font-medium text-gray-700">
                Current price (USD)
              </label>
              <input
                id="wishlist-current-price"
                :value="form.current_price ?? ''"
                type="number"
                min="0"
                step="0.01"
                class="input"
                @input="(e) => (form.current_price = (e.target as HTMLInputElement).value === '' ? '' : Number((e.target as HTMLInputElement).value))"
              />
              <p v-if="issueFor('current_price')" class="mt-1 text-xs text-red-600">
                {{ fieldError('current_price') || issueFor('current_price') }}
              </p>
            </div>
            <div>
              <label for="wishlist-target-price" class="block text-sm font-medium text-gray-700">
                Target price (USD)
              </label>
              <input
                id="wishlist-target-price"
                :value="form.target_price ?? ''"
                type="number"
                min="0"
                step="0.01"
                class="input"
                @input="(e) => (form.target_price = (e.target as HTMLInputElement).value === '' ? '' : Number((e.target as HTMLInputElement).value))"
              />
              <p v-if="issueFor('target_price')" class="mt-1 text-xs text-red-600">
                {{ fieldError('target_price') || issueFor('target_price') }}
              </p>
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-2">
            <button
              type="button"
              class="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              @click="emit('close')"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="!canSubmit || submitting"
              class="btn-primary"
              :aria-busy="submitting ? 'true' : 'false'"
            >
              <AppSpinner
                v-if="submitting"
                class="mr-2"
                label="Mentés folyamatban"
              />
              {{ submitting ? 'Saving' : isEdit ? 'Save changes' : 'Add item' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
