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
 *
 * Sprint 5 P2 — owner-only "Ki mit visz" user-selector dropdown
 * minden trip-gear item sor mellett. A §5.1 spec alapján inline, NEM
 * új modál (a §0.1 #2 elv: minimális súrlódás). A kiválasztható
 * user-ek listája: a `participants` prop (owner + accepted invitee-k,
 * a meglévő TripParticipantRow típusból). A PATCH azonnal megtörténik
 * (debounce 300 ms) és a useTrips a state.current.trip_gear tömböt
 * frissíti.
 */
import type { GearItemRow, CategoryRow, TripWithGear, TripParticipantRow } from '~/types/db';

const props = defineProps<{
  trip: TripWithGear;
  gear: GearItemRow[];
  categories: CategoryRow[];
  /** Sprint 5 P2 — owner + accepted invitee-k listája a §0.2 #2 elvhez. */
  participants?: TripParticipantRow[];
  /**
   * Owner-only gate. Ha true, a user-selector dropdown megjelenik
   * minden gear-item sor mellett. A P2 default (§11.2 A): owner-only.
   */
  isOwnerViewer?: boolean;
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
  /**
   * Sprint 5 P2 — owner-only user-hozzárendelés PATCH. A page-en
   * keresztül megy az updateGearAssignment composable metódusra,
   * ami a PATCH /api/trips/:id/gear/:gearId endpoint-ot hívja.
   */
  (
    e: 'assign',
    payload: { gear_item_id: string; assigned_to_user_id: string | null }
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

// ---------------------------------------------------------------------------
// Sprint 5 P2 — "Ki mit visz" user-hozzárendelés (owner-only inline dropdown)
// ---------------------------------------------------------------------------
/**
 * Lookup a `trip.trip_gear` sor `assigned_to_user_id`-ja alapján.
 * A read-only label és a dropdown value is ezt használja (a reaktivitás
 * biztosítja, hogy a PATCH után azonnal újra-rendereljen a sor).
 */
const assignedTo = (gearItemId: string): string | null | undefined => {
  const row = props.trip.trip_gear.find((tg) => tg.gear_item_id === gearItemId);
  return row?.assigned_to_user_id;
};

/**
 * A sorhoz tartozó user-selector dropdown label (a P2.x keresztnév
 * bugfix: display_name elsőbbséget élvez az email felett). A kliens
 * oldali composable a 'Névtelen túrázó' fallback-et alkalmazza, ha
 * a display_name NULL vagy placeholder.
 */
const assignedParticipantLabel = (gearItemId: string): string => {
  const uid = assignedTo(gearItemId);
  if (!uid) return 'Névtelen túrázó';
  const p = (props.participants ?? []).find((row) => row.user_id === uid);
  // A TripParticipantRow NEM tartalmazza a display_name-t (csak email) —
  // a fallback a label-t az email-re állítja. A Ki-mit-visz blokk a
  // szerver-oldali privacy-safe projection-ből kapja a display_name-t.
  return p?.email ?? (uid.slice(0, 8) + '…');
};

/**
 * A user-selector value kezelése. Az owner kiválaszt egy user-t a
 * legördülő listából, vagy törli a hozzárendelést ("" → null).
 * A PATCH-et a parent-en (pages/trips/[id].vue) keresztül az
 * `updateGearAssignment` composable metódus végzi.
 */
const onAssignSelect = (gearItemId: string, userId: string) => {
  // "" = "Hozzárendelés törlése" opció (NULL).
  const next: string | null = userId === '' ? null : userId;
  emit('assign', { gear_item_id: gearItemId, assigned_to_user_id: next });
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
              <!--
                Sprint 5 P2 — read-only "Hozzárendelve: …" label.
                Minden viewer számára látható (a §5.1 spec szerint), de
                a szerkesztés csak owner-only.
              -->
              <span
                v-if="draft[g.id]?.checked && assignedTo(g.id)"
                class="ml-2 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700"
              >
                {{ assignedParticipantLabel(g.id) }}
              </span>
              <span
                v-else-if="draft[g.id]?.checked"
                class="ml-2 rounded border border-dashed border-gray-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500"
              >
                Nincs hozzárendelve
              </span>
            </span>
          </label>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <!--
            Sprint 5 P2 — owner-only user-selector dropdown. Csak ha
            (a) az item be van jelölve ÉS (b) az viewer a trip owner-e.
            A kiválasztható user-ek listája: a `participants` prop
            (owner + accepted invitee-k). A "" opció a "Hozzárendelés
            törlése" (NULL).
          -->
          <select
            v-if="draft[g.id]?.checked && isOwnerViewer && (participants?.length ?? 0) > 0"
            :value="assignedTo(g.id) ?? ''"
            class="rounded border border-gray-300 bg-white px-1.5 py-1 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            :aria-label="`Hozzárendelés: ${g.name}`"
            @change="(e) => onAssignSelect(g.id, (e.target as HTMLSelectElement).value)"
          >
            <option value="">Hozzárendelés törlése</option>
            <option
              v-for="p in participants ?? []"
              :key="p.user_id"
              :value="p.user_id"
            >
              {{ p.email ?? (p.user_id.slice(0, 8) + '…') }}
              <template v-if="p.role === 'owner'">(tulajdonos)</template>
            </option>
          </select>

          <div
            v-if="draft[g.id]?.checked"
            class="flex items-center gap-1"
          >
            <button
              type="button"
              class="btn-secondary px-2 py-0.5 text-xs"
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
              class="btn-secondary px-2 py-0.5 text-xs"
              aria-label="Mennyiség növelése"
              :disabled="draft[g.id].quantity >= 99"
              @click="increment(g.id)"
            >
              +
            </button>
          </div>
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
        <AppSpinner
          v-if="submitting"
          class="mr-2"
          label="Mentés folyamatban"
        />
        {{ submitting ? 'Saving' : 'Save gear' }}
      </button>
    </div>
  </div>
</template>
