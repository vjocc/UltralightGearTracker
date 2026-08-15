/**
 * Base-weight summary composable.
 *
 * Pulls aggregated numbers from GET /api/gear/base-weight (server-side
 * Postgres aggregation over the gear_base_weights_view). The composable
 * wraps useFetch so the response is cached by Nuxt under the
 * `base-weight` key, and useGear mutations can invalidate it via
 * `refreshNuxtData('base-weight')`.
 *
 * Returns reactive refs the panel can read directly. Number formatting
 * (hu-HU, space thousands separator, max 1 fraction digit) lives in
 * the component via `formatGrams()` — keeping the composable
 * format-agnostic.
 */

export interface BaseWeightPerCategory {
  category_id: string;
  category_name: string | null;
  grams: number;
  item_count: number;
  // Phase 4 (visual-weight): server-computed decoration for the
  // WeightBreakdownChart. `percent` is 0-100 with one decimal;
  // `color_token` is a MemoFox palette key (brand / ember / moss /
  // umber / espresso, cyclic).
  percent: number;
  color_token: string;
}

export interface BaseWeightSummary {
  total_grams: number;
  per_category: BaseWeightPerCategory[];
  excluded_grams: number;
  excluded_count: number;
}

interface UseBaseWeightState {
  data: BaseWeightSummary | null;
  pending: boolean;
  error: string | null;
}

export function useBaseWeight() {
  const state = useState<UseBaseWeightState>('base-weight', () => ({
    data: null,
    pending: false,
    error: null,
  }));

  const fetchOnce = async () => {
    state.value.pending = true;
    state.value.error = null;
    try {
      const data = await $fetch<BaseWeightSummary>('/api/gear/base-weight');
      state.value.data = data;
    } catch (e) {
      const err = e as { statusMessage?: string; message?: string };
      state.value.error =
        err?.statusMessage ?? err?.message ?? 'Failed to load base weight';
    } finally {
      state.value.pending = false;
    }
  };

  const refresh = async () => {
    // Drop any cached useFetch payload for this key and re-fetch. Safe to
    // call from anywhere; no-op if no cache exists yet.
    await refreshNuxtData('base-weight');
    await fetchOnce();
  };

  // Convenience refs for the panel. Pulled out so the component can
  // destructure once and not depend on the wrapper object.
  const totalGrams = computed(() => state.value.data?.total_grams ?? 0);
  const perCategory = computed(
    () => state.value.data?.per_category ?? []
  );
  const excludedGrams = computed(() => state.value.data?.excluded_grams ?? 0);
  const excludedCount = computed(() => state.value.data?.excluded_count ?? 0);
  const isEmpty = computed(
    () =>
      !state.value.pending &&
      !state.value.error &&
      (state.value.data?.total_grams ?? 0) === 0 &&
      (state.value.data?.per_category.length ?? 0) === 0
  );

  return {
    state,
    totalGrams,
    perCategory,
    excludedGrams,
    excludedCount,
    isEmpty,
    refresh,
    pending: computed(() => state.value.pending),
    error: computed(() => state.value.error),
  };
}

/**
 * Format a gram count as a localized string. Pure utility — exported so
 * future surfaces (e.g. share-image export) can reuse it without
 * reaching into the composable.
 *
 * Format: hu-HU with space thousands separator and comma decimal,
 * max 1 fraction digit (PO acceptance criteria F.5).
 *
 * Examples:
 *   formatGrams(0)        => "0"
 *   formatGrams(1234)     => "1 234"
 *   formatGrams(1234.5)   => "1 234,5"
 *   formatGrams(5678.9)   => "5 678,9"
 */
export function formatGrams(grams: number): string {
  if (!Number.isFinite(grams)) return '0';
  return new Intl.NumberFormat('hu-HU', {
    maximumFractionDigits: 1,
  }).format(grams);
}