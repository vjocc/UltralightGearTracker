<script setup lang="ts">
/**
 * Gear detail page. Single source of truth for a gear item view + its
 * comment thread. Inline-mounts the GearCommentThread per Architect
 * decision (rather than a modal on the index page).
 *
 * The page reads from useGear().state.items when possible (avoiding a
 * second fetch) and falls back to a server-side fetch when the id is
 * not in the cache. In both cases the row is RLS-gated, so a stranger
 * who lands here directly gets a 404-equivalent.
 */
import type { GearItemRow } from '~/types/db';

definePageMeta({
  title: 'Gear detail',
});

const route = useRoute();
const user = useSessionUser();
const { state, list } = useGear();

const gearId = computed(() => String(route.params.id ?? ''));

// Defensive SSR guard — middleware already protects /gear.
if (import.meta.client && !user.value) {
  await navigateTo(`/signin?next=/gear/${gearId.value}`);
}

const item = ref<GearItemRow | null>(null);
const loading = ref(false);
const notFound = ref(false);

const findOrFetch = async (): Promise<GearItemRow | null> => {
  const cached = state.value.items.find((g) => g.id === gearId.value);
  if (cached) return cached;
  // Item isn't in the cache (e.g. direct deep-link). Fetch the list and
  // look again; RLS will hide rows the caller cannot see, so a non-visible
  // id surfaces as `notFound`.
  await list();
  return state.value.items.find((g) => g.id === gearId.value) ?? null;
};

onMounted(async () => {
  loading.value = true;
  try {
    const found = await findOrFetch();
    if (found) {
      item.value = found;
    } else {
      notFound.value = true;
    }
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section>
    <div class="mb-4 flex items-baseline justify-between gap-2">
      <div>
        <NuxtLink
          to="/gear"
          class="text-xs font-medium text-gray-500 hover:text-gray-700"
        >
          ← Vissza a Gear listához
        </NuxtLink>
        <h2 class="text-xl font-semibold text-gray-900">
          {{ item?.name ?? 'Gear' }}
        </h2>
      </div>
      <NuxtLink
        v-if="item"
        :to="`/gear/${item.id}/edit`"
        class="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
      >
        Edit
      </NuxtLink>
    </div>

    <p v-if="loading" class="text-sm text-gray-500">Loading…</p>

    <div
      v-else-if="notFound"
      class="rounded border border-gray-200 bg-white p-4 text-sm text-gray-500"
    >
      Gear item not found, vagy nincs jogosultságod megtekinteni.
    </div>

    <template v-else-if="item">
      <article class="mb-4 rounded border border-gray-200 bg-white p-4">
        <dl class="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt class="text-xs font-medium uppercase text-gray-500">Weight</dt>
            <dd class="tabular-nums text-gray-900">{{ item.weight_g }} g</dd>
          </div>
          <div>
            <dt class="text-xs font-medium uppercase text-gray-500">Price</dt>
            <dd class="tabular-nums text-gray-900">
              {{
                item.price == null
                  ? '—'
                  : new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(item.price)
              }}
            </dd>
          </div>
          <div>
            <dt class="text-xs font-medium uppercase text-gray-500">Status</dt>
            <dd class="text-gray-900">
              {{ item.excluded_from_base ? 'Excluded from base' : 'In base weight' }}
            </dd>
          </div>
        </dl>
      </article>

      <GearCommentThread
        :gear-item-id="item.id"
        :current-user-id="user?.id ?? ''"
        :gear-owner-id="item.user_id"
      />
    </template>
  </section>
</template>