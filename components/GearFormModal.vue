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
 * P5 / v2 #21 — comfort rating: a 3-row star-rating section ("Mennyire
 * kényelmes?") at the bottom of the modal, before the action buttons.
 * 3 dimensions (sleep / cold / weight) × 1..5 integer. Each is optional;
 * the user can fill in any subset (or none). The form state is a
 * `GearComfort | null` and is hydrated from the existing item on edit
 * (or reset to all-null on create).
 */
import { z } from 'zod';
import { gearCreateSchema } from '~/shared/gearSchemas';
import type { GearItemRow, CategoryRow, GearComfort } from '~/types/db';

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
      comfort: GearComfort | null;
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
  comfort: { sleep: undefined, cold: undefined, weight: undefined } as GearComfort,
});

const fieldErrors = ref<Record<string, string>>({});

const isEdit = computed(() => !!props.item);

const resetForm = () => {
  form.name = props.item?.name ?? '';
  form.category_id = props.item?.category_id ?? '';
  form.weight_g = props.item?.weight_g ?? '';
  form.price = props.item?.price ?? '';
  form.excluded_from_base = props.item?.excluded_from_base ?? false;
  // Comfort comes back as GearComfort | null from the server. Coerce null
  // → empty object so the star rows render in the unrated state. The
  // submit pipeline decides whether to send null (no rating) vs the
  // partial object (some / all ratings).
  const c = props.item?.comfort ?? null;
  form.comfort = {
    sleep: c?.sleep,
    cold: c?.cold,
    weight: c?.weight,
  };
  fieldErrors.value = {};
};

// Reset whenever the modal opens (new draft) or the target item changes.
watch(
  () => [props.open, props.item?.id],
  ([open]) => {
    if (open) {
      resetForm();
    }
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
  // Strip undefined dimensions — if the user didn't rate any axis, send
  // `null` (matches the migration's NULL semantics); if they rated at
  // least one, send a partial object so the server-side zod keeps it.
  const hasAnyRating =
    form.comfort.sleep !== undefined ||
    form.comfort.cold !== undefined ||
    form.comfort.weight !== undefined;
  const comfort: GearComfort | null = hasAnyRating
    ? {
        ...(form.comfort.sleep !== undefined ? { sleep: form.comfort.sleep } : {}),
        ...(form.comfort.cold !== undefined ? { cold: form.comfort.cold } : {}),
        ...(form.comfort.weight !== undefined ? { weight: form.comfort.weight } : {}),
      }
    : null;
  return {
    name: form.name.trim(),
    category_id: form.category_id,
    weight_g: weight,
    price,
    excluded_from_base: form.excluded_from_base,
    comfort,
  };
};

// Live validation; button is disabled until this returns success.
const validation = computed(() =>
  gearCreateSchema.safeParse(buildPayload())
);

const canSubmit = computed(() => {
  // The inline create-category sub-form covers the "no categories yet"
  // case — don't block submission solely on an empty <select>.
  return validation.value.success;
});

// --- P5 comfort star-row helpers -------------------------------------------
type ComfortKey = keyof GearComfort;

const comfortLabels: Array<{ key: ComfortKey; label: string; hint: string }> = [
  { key: 'sleep', label: 'Alvás', hint: 'Mennyire kényelmes alvás közben?' },
  { key: 'cold', label: 'Hidegben', hint: 'Mennyire tart melegen hideg időben?' },
  { key: 'weight', label: 'Súlya', hint: 'Mennyire érezhető a vállon / háton?' },
];

const setComfort = (key: ComfortKey, value: number) => {
  form.comfort[key] = value;
};

const clearComfort = (key: ComfortKey) => {
  form.comfort[key] = undefined;
};

const starTitle = (key: ComfortKey, value: number): string => {
  const hint = comfortLabels.find((l) => l.key === key)?.hint ?? '';
  return `${hint} — ${value} / 5`;
};

// --- Categories are now a global, system-defined taxonomy (Sprint 4 v2) ----
// The 13 top-level categories come pre-seeded; the <select> in the template
// is populated from the `categories` prop. No inline create sub-form here.
const { state: catState } = useCategories();

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
        class="w-full max-w-md rounded-card bg-white p-6 shadow-xl"
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

          <!--
            P5 / v2 #21 comfort rating — 3 star-rating rows
            (MemoFox brand palette: brand-500 fill, brand-200 outline).
            Each row: label + 5 buttons + a "clear" link. The fill state is
            driven by form.comfort[key]; buttons call setComfort(). Aria
            label provides a screen-reader hint; the native button focus
            stays inside the existing focus trap.
          -->
          <fieldset
            class="mt-2 border-t border-gray-200 pt-4"
            aria-label="Mennyire kényelmes?"
          >
            <legend class="text-sm font-medium text-gray-700">
              Mennyire kényelmes?
            </legend>
            <p class="mt-1 text-xs italic text-gray-500">
              Opcionális — töltsd ki, ha van saját tapasztalatod.
            </p>
            <div class="mt-3 space-y-3">
              <div
                v-for="row in comfortLabels"
                :key="row.key"
                class="flex items-center gap-3"
              >
                <span class="w-20 shrink-0 text-xs font-medium text-gray-700">
                  {{ row.label }}
                </span>
                <div
                  class="flex items-center gap-1"
                  role="radiogroup"
                  :aria-label="row.label"
                >
                  <button
                    v-for="n in 5"
                    :key="n"
                    type="button"
                    class="h-7 w-7 rounded text-lg leading-none transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1"
                    :class="
                      form.comfort[row.key] !== undefined && form.comfort[row.key]! >= n
                        ? 'bg-brand-500 text-white hover:bg-brand-600'
                        : 'bg-brand-100 text-brand-300 hover:bg-brand-200'
                    "
                    :aria-label="`${row.label} ${n} / 5`"
                    :aria-pressed="form.comfort[row.key] === n"
                    :title="starTitle(row.key, n)"
                    @click="setComfort(row.key, n)"
                  >
                    ★
                  </button>
                </div>
                <button
                  v-if="form.comfort[row.key] !== undefined"
                  type="button"
                  class="text-[10px] font-medium uppercase tracking-wide text-gray-500 underline hover:text-gray-700"
                  @click="clearComfort(row.key)"
                >
                  Törlés
                </button>
                <span v-else class="text-[10px] uppercase tracking-wide text-gray-400">
                  —
                </span>
              </div>
            </div>
          </fieldset>

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
              {{ submitting ? 'Saving' : isEdit ? 'Save changes' : 'Add gear' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>