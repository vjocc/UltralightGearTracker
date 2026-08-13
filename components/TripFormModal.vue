<script setup lang="ts">
/**
 * Controlled modal for create + edit trip. Mirrors GearFormModal but
 * works with the tripCreateSchema (name required, dates optional,
 * description optional, start <= end refine).
 *
 * Date inputs return '' when blank, which is mapped to null on submit
 * so the underlying Postgres DATE column gets a clean NULL.
 *
 * Live zod validation; submit is gated until success.
 */
import { tripCreateSchema, type TripFormShape } from '~/shared/tripSchemas';
import type { TripRow } from '~/types/db';

const props = defineProps<{
  open: boolean;
  /** Provided for edit mode; undefined for create mode. */
  item?: TripRow | null;
  submitting?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (
    e: 'submit',
    payload: {
      name: string;
      description: string | null;
      start_date: string | null;
      end_date: string | null;
    }
  ): void;
}>();

// Form state — description + dates use '' to represent blank; submit
// coerces '' → null so the DB column gets NULL, not ''.
const form = reactive<TripFormShape>({
  name: '',
  description: '',
  start_date: '',
  end_date: '',
});

const fieldErrors = ref<Record<string, string>>({});

const isEdit = computed(() => !!props.item);

const resetForm = () => {
  form.name = props.item?.name ?? '';
  form.description = props.item?.description ?? '';
  form.start_date = props.item?.start_date ?? '';
  form.end_date = props.item?.end_date ?? '';
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
  const trimToNull = (v: string): string | null => (v.trim() === '' ? null : v.trim());
  return {
    name: form.name.trim(),
    description: trimToNull(form.description),
    start_date: trimToNull(form.start_date),
    end_date: trimToNull(form.end_date),
  };
};

const validation = computed(() => tripCreateSchema.safeParse(buildPayload()));

const canSubmit = computed(() => validation.value.success);

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
        focusables.find((el) => el.id === 'trip-name') ?? focusables[0];
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
      :aria-label="isEdit ? 'Edit trip' : 'Add trip'"
      @click.self="emit('close')"
    >
      <div
        ref="dialogRef"
        class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
      >
        <h2 class="text-lg font-semibold text-gray-900">
          {{ isEdit ? 'Edit trip' : 'Add trip' }}
        </h2>
        <form class="mt-4 space-y-4" @submit.prevent="onSubmit">
          <div>
            <label for="trip-name" class="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="trip-name"
              v-model="form.name"
              type="text"
              maxlength="120"
              required
              autocomplete="off"
              class="input"
            />
            <p v-if="issueFor('name')" class="mt-1 text-xs text-red-600">
              {{ fieldError('name') || issueFor('name') }}
            </p>
          </div>

          <div>
            <label for="trip-description" class="block text-sm font-medium text-gray-700">
              Description (optional)
            </label>
            <textarea
              id="trip-description"
              v-model="form.description"
              rows="3"
              maxlength="2000"
              class="input"
            />
            <p v-if="issueFor('description')" class="mt-1 text-xs text-red-600">
              {{ fieldError('description') || issueFor('description') }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="trip-start" class="block text-sm font-medium text-gray-700">
                Start date
              </label>
              <input
                id="trip-start"
                v-model="form.start_date"
                type="date"
                class="input"
              />
              <p v-if="issueFor('start_date')" class="mt-1 text-xs text-red-600">
                {{ fieldError('start_date') || issueFor('start_date') }}
              </p>
            </div>
            <div>
              <label for="trip-end" class="block text-sm font-medium text-gray-700">
                End date
              </label>
              <input
                id="trip-end"
                v-model="form.end_date"
                type="date"
                class="input"
              />
              <p v-if="issueFor('end_date')" class="mt-1 text-xs text-red-600">
                {{ fieldError('end_date') || issueFor('end_date') }}
              </p>
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-2">
            <button
              type="button"
              class="btn-secondary px-3 py-1.5 text-sm"
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
                class="spinner mr-2 inline-block h-4 w-4"
                aria-hidden="true"
              />
              {{ submitting ? 'Saving' : isEdit ? 'Save changes' : 'Add trip' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>