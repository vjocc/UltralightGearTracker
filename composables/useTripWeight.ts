/**
 * Trip total weight composable.
 *
 * Pulls the per-trip aggregate from GET /api/trips/:id/weight. The
 * server endpoint queries the `trip_weight_summary` view (server-side
 * Σ weight_g × quantity over owned, non-excluded gear_items) and a
 * per-category join on the gear_base_weights_view. RLS is enforced
 * server-side via security_invoker; the client never sends user_id.
 *
 * State shape mirrors useBaseWeight — three slots (data / pending /
 * error) — so the TripWeightSummary panel can read it the same way the
 * BaseWeightSummary panel reads its base-weight state.
 *
 * Each trip has its own useState cache keyed `trip-weight-<id>` so two
 * open trip pages don't clobber each other (and trip mutations only
 * invalidate the current trip's key via refreshNuxtData).
 *
 * `formatGrams` is re-exported from useBaseWeight so the panel and any
 * future surface (e.g. share-image export) can share one hu-HU number
 * formatter without duplicating it.
 */

export interface TripWeightPerCategory {
  category_id: string;
  category_name: string | null;
  grams: number;
  item_count: number;
}

export interface TripWeightSummary {
  total_grams: number;
  item_count: number;
  per_category: TripWeightPerCategory[];
}

interface UseTripWeightState {
  data: TripWeightSummary | null;
  pending: boolean;
  error: string | null;
}

export function useTripWeight(tripId: string) {
  const cacheKey = `trip-weight-${tripId}`;
  const state = useState<UseTripWeightState>(cacheKey, () => ({
    data: null,
    pending: false,
    error: null,
  }));

  const fetchOnce = async () => {
    state.value.pending = true;
    state.value.error = null;
    try {
      const data = await $fetch<TripWeightSummary>(
        `/api/trips/${tripId}/weight`
      );
      state.value.data = data;
    } catch (e) {
      const err = e as { statusMessage?: string; message?: string };
      state.value.error =
        err?.statusMessage ?? err?.message ?? 'Failed to load trip weight';
    } finally {
      state.value.pending = false;
    }
  };

  const refresh = async () => {
    // Drop any cached useFetch payload for this key, then refetch via
    // the same code path. Safe to call from anywhere; no-op if no
    // cache exists yet.
    await refreshNuxtData(cacheKey);
    await fetchOnce();
  };

  // Convenience refs — mirror useBaseWeight's shape so the panel
  // destructures uniformly.
  const totalGrams = computed(() => state.value.data?.total_grams ?? 0);
  const itemCount = computed(() => state.value.data?.item_count ?? 0);
  const perCategory = computed(
    () => state.value.data?.per_category ?? []
  );
  const isEmpty = computed(
    () =>
      !state.value.pending &&
      !state.value.error &&
      (state.value.data?.total_grams ?? 0) === 0 &&
      (state.value.data?.item_count ?? 0) === 0
  );

  return {
    state,
    totalGrams,
    itemCount,
    perCategory,
    isEmpty,
    refresh,
    fetchOnce,
    pending: computed(() => state.value.pending),
    error: computed(() => state.value.error),
  };
}

// Re-export so any future trip-weight surface (share-image, CSV export)
// can share one hu-HU formatter with the base-weight panel — don't
// duplicate the Intl.NumberFormat call.
export { formatGrams } from '~/composables/useBaseWeight';