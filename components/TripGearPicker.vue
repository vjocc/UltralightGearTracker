<script setup lang="ts">
/**
 * TripGearPicker — gear selection editor for a single trip.
 *
 * Lists the user's own `gear_items` with a checkbox + qty stepper per
 * row. Save batches the diff against the current `trip.trip_gear` rows:
 *   * newly checked → POST /api/trips/:id/gear
 *   * unchecked     → DELETE /api/trips/:id/gear/:gearId
 *   * quantity changed → PATCH /api/trips/:id/gear/:gearId
 *
 * Own-rows-only is enforced server-side by Supabase RLS. The picker
 * is purely a presentation + diff driver; the page owns the
 * useTrips() state and refresh.
 */
import type { GearItemRow, CategoryRow, TripWithGear } from '~/types/db';

const props = defineProps<{
  trip: TripWithGear;
  gear: GearItemRow[];
  categories: CategoryRow[];
  submitting?: boolean;
}>();

const emit = defineEmits<{
  (
    e: 'save',
    payload: {
      add: Array<{ gear_item_id: string; quantity: number }>;
      update: Array<{ gear_item_id: string; quantity: number }>;
      remove: string[];
    }
  ): void;
}>();

/**
 * Local draft: gear_item_id → { checked, quantity }. Seeded from the
 * current trip_gear rows; user changes accumulate here until Save.
 * The page reads the diff on submit and decides which endpoints to hit.
 */
interface Draft {
  checked: boolean;
  quantity: number;
}
const draft = reactive<Record<string, Draft>>({});

const initDraft = () => {
  // Reset every render — cheap for typical kit sizes (< 200 items).
  for (const k of Object.keys(draft)) delete draft[k];
  for (const g of props.gear) {
    const existing = props.trip.trip_gear.find(
      (tg) => tg.gear_item_id === g.id
    );
    draft[g.id] = {
      checked: !!existing,
      quantity: existing?.quantity ?? 1,
    };
  }
};

watch(
  () => [props.gear.length, props.trip.id, props.trip.trip_gear.length],
  () => initDraft(),
  { immediate: true }
);

const categoryById = computed(() => {
  const map = new Map<string, CategoryRow>();
  for (const c of props.categories) map.set(c.id, c);
  return map;
});

const increment = (id: string) => {
  const d = draft[id];
  if (!d) return;
  d.quantity = Math.min(d.quantity + 1, 99);
};

const decrement = (id: string) => {
  const d = draft[id];
  if (!d) return;
  d.quantity = Math.max(d.quantity - 1, 1);
};

const isDirty = computed(() => {
  const original = new Map(
    props.trip.trip_gear.map((tg) => [tg.gear_item_id, tg.quantity])
  );
  for (const g of props.gear) {
    const d = draft[g.id];
    if (!d) continue;
    const prev = original.get(g.id);
    if (d.checked && !prev) return true;
    if (!d.checked && prev !== undefined) return true;
    if (d.checked && prev !== undefined && d.quantity !== prev) return true;
  }
  return false;
});

const handleSave = () => {
  if (!isDirty.value) return;
  const add: Array<{ gear_item_id: string; quantity: number }> = [];
  const update: Array<{ gear_item_id: string; quantity: number }> = [];
  const remove: string[] = [];

  const original = new Map(
    props.trip.trip_gear.map((tg) => [tg.gear_item_id, tg.quantity])
  );

  for (const g of props.gear) {
    const d = draft[g.id];
    if (!d) continue;
    const prev = original.get(g.id);
    if (d.checked && prev === undefined) {
      add.push({ gear_item_id: g.id, quantity: d.quantity });
    } else if (d.checked && prev !== undefined && d.quantity !== prev) {
      update.push({ gear_item_id: g.id, quantity: d.quantity });
    } else if (!d.checked && prev !== undefined) {
      remove.push(g.id);
    }
  }

  emit('save', { add, update, remove });
};
</script>

<template>
  <div class="space-y-3">
    <p v-if="gear.length === 0" class="text-sm text-gray-500">
      No gear in your kit yet. Add some on the Gear page first.
    </p>

    <ul v-else class="divide-y divide-gray-200 rounded border border-gray-200 bg-white">
      <li
        v-for="g in gear"
        :key="g.id"
        class="flex items-center justify-between gap-3 px-3 py-2"
      >
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <input
            :id="`trip-gear-${g.id}`"
            v-model="draft[g.id].checked"
            type="checkbox"
            class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label
            :for="`trip-gear-${g.id}`"
            class="flex min-w-0 flex-1 cursor-pointer flex-col"
          >
            <span class="truncate text-sm font-medium text-gray-900">
              {{ g.name }}
            </span>
            <span class="text-xs text-gray-500">
              <span v-if="categoryById.get(g.category_id)">
                {{ categoryById.get(g.category_id)?.name }} ·
              </span>
              <span class="tabular-nums">{{ g.weight_g }} g</span>
            </span>
          </label>
        </div>

        <div
          v-if="draft[g.id]?.checked"
          class="flex shrink-0 items-center gap-1"
        >
          <button
            type="button"
            class="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
            aria-label="Mennyiség csökkentése"
            :disabled="draft[g.id].quantity <= 1"
            @click="decrement(g.id)"
          >
            −
          </button>
          <span class="w-8 text-center text-sm tabular-nums">
            {{ draft[g.id].quantity }}
          </span>
          <button
            type="button"
            class="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
            aria-label="Mennyiség növelése"
            :disabled="draft[g.id].quantity >= 99"
            @click="increment(g.id)"
          >
            +
          </button>
        </div>
      </li>
    </ul>

    <div class="flex justify-end">
      <button
        type="button"
        :disabled="!isDirty || submitting"
        class="btn-primary"
        :aria-busy="submitting ? 'true' : 'false'"
        @click="handleSave"
      >
        <span
          v-if="submitting"
          class="spinner mr-2 inline-block h-4 w-4"
          aria-hidden="true"
        />
        {{ submitting ? 'Saving' : 'Save gear' }}
      </button>
    </div>
  </div>
</template>