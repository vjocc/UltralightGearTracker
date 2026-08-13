<script setup lang="ts">
/**
 * Controlled modal for create + edit gear. Prefilled for edit, blank for
 * create. Submits via the parent-supplied handler so the page can drive
 * the useGear() mutation + the modal close state.
 *
 * Form state lives in the modal (closeable draft, parent decides what to
 * do with the result on submit). zod validation runs on every change so
 * the submit button is disabled until valid.
 *
 * Notes: per Architect design, the spec includes a "notes" textarea but
 * the current gear_items migration has no notes column. Capturing notes
 * client-side without persistence would mislead users, so the form
 * omits the field. Tracked as a follow-up (see handoff comment).
 */
import { z } from 'zod';
import { gearCreateSchema } from '~/shared/gearSchemas';
import type { GearItemRow, CategoryRow } from '~/types/db';

const props = defineProps<{
  open: boolean;
  categories: CategoryRow[];
  /** Provided for edit mode; undefined for create mode. */
  item?: GearItemRow | null;
  submitting?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (
    e: 'submit',
    payload: {
      name: string;
      category_id: string;
      weight_g: number;
      price: number | null;
      excluded_from_base: boolean;
    }
  ): void;
}>();

// Form state (price uses '' to represent blank; coerced to null on submit).
const form = reactive({
  name: '',
  category_id: '',
  weight_g: '' as number | '',
  price: '' as number | '' | null,
  excluded_from_base: false,
});

const fieldErrors = ref<Record<string, string>>({});

const isEdit = computed(() => !!props.item);

const resetForm = () => {
  form.name = props.item?.name ?? '';
  form.category_id = props.item?.category_id ?? '';
  form.weight_g = props.item?.weight_g ?? '';
  form.price = props.item?.price ?? '';
  form.excluded_from_base = props.item?.excluded_from_base ?? false;
  fieldErrors.value = {};
};

// Reset whenever the modal opens (new draft) or the target item changes.
watch(
  () => [props.open, props.item?.id],
  ([open]) => {
    if (open) resetForm();
  },
  { immediate: true }
);

// Coerce raw form values to the zod-validated payload shape.
const buildPayload = () => {
  const weight = form.weight_g === '' ? NaN : Number(form.weight_g);
  let price: number | null = null;
  if (form.price !== '' && form.price !== null) {
    price = Number(form.price);
  }
  return {
    name: form.name.trim(),
    category_id: form.category_id,
    weight_g: weight,
    price,
    excluded_from_base: form.excluded_from_base,
  };
};

// Live validation; button is disabled until this returns success.
const validation = computed(() =>
  gearCreateSchema.safeParse(buildPayload())
);

const canSubmit = computed(() => {
  // Block when categories are not loaded (avoids empty <select> submits).
  if (props.categories.length === 0) return false;
  return validation.value.success;
});

const onSubmit = () => {
  if (!canSubmit.value) return;
  emit('submit', buildPayload());
};

const fieldError = (key: string) => fieldErrors.value[key] ?? '';

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
      // Wait for the dialog to mount, then move focus into the first field.
      await nextTick();
      const focusables = getFocusable();
      // Prefer the first real form input/button over the cancel button.
      const target =
        focusables.find((el) => el.id === 'gear-name') ?? focusables[0];
      target?.focus();
    } else {
      // Restore focus to whatever opened the modal.
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
      :aria-label="isEdit ? 'Edit gear' : 'Add gear'"
      @click.self="emit('close')"
    >
      <div
        ref="dialogRef"
        class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
      >
        <h2 class="text-lg font-semibold text-gray-900">
          {{ isEdit ? 'Edit gear' : 'Add gear' }}
        </h2>
        <form class="mt-4 space-y-4" @submit.prevent="onSubmit">
          <div>
            <label for="gear-name" class="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="gear-name"
              v-model="form.name"
              type="text"
              maxlength="80"
              required
              autocomplete="off"
              class="input"
            />
            <p v-if="!validation.success" class="mt-1 text-xs text-red-600">
              {{ fieldError('name') || validation.error?.issues.find((i) => i.path[0] === 'name')?.message }}
            </p>
          </div>

          <div>
            <label for="gear-category" class="block text-sm font-medium text-gray-700">
              Category
            </label>
            <select
              id="gear-category"
              v-model="form.category_id"
              required
              class="input"
            >
              <option value="" disabled>Select a category</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select>
            <p v-if="!validation.success" class="mt-1 text-xs text-red-600">
              {{ fieldError('category_id') || validation.error?.issues.find((i) => i.path[0] === 'category_id')?.message }}
            </p>
            <p v-if="categories.length === 0" class="mt-1 text-xs text-gray-500">
              No categories yet. Create one in the categories page first.
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="gear-weight" class="block text-sm font-medium text-gray-700">
                Weight (g)
              </label>
              <input
                id="gear-weight"
                v-model.number="form.weight_g"
                type="number"
                min="0"
                max="50000"
                step="1"
                required
                class="input"
              />
              <p v-if="!validation.success" class="mt-1 text-xs text-red-600">
                {{ fieldError('weight_g') || validation.error?.issues.find((i) => i.path[0] === 'weight_g')?.message }}
              </p>
            </div>
            <div>
              <label for="gear-price" class="block text-sm font-medium text-gray-700">
                Price (USD)
              </label>
              <input
                id="gear-price"
                :value="form.price ?? ''"
                type="number"
                min="0"
                step="0.01"
                class="input"
                @input="(e) => (form.price = (e.target as HTMLInputElement).value === '' ? '' : Number((e.target as HTMLInputElement).value))"
              />
              <p v-if="!validation.success" class="mt-1 text-xs text-red-600">
                {{ fieldError('price') || validation.error?.issues.find((i) => i.path[0] === 'price')?.message }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <input
              id="gear-excluded"
              v-model="form.excluded_from_base"
              type="checkbox"
              class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label for="gear-excluded" class="text-sm text-gray-700">
              Exclude from base weight
            </label>
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
              <span
                v-if="submitting"
                class="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                aria-hidden="true"
              />
              {{ submitting ? 'Saving' : isEdit ? 'Save changes' : 'Add gear' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
