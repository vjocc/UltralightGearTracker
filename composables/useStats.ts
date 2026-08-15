/**
 * useStats — /api/stats ref-je.
 *
 * Mintát a useBaseWeight.ts (Phase 1) és useTrips.ts (Phase 3) ad.
 *
 * A stats kevert forrású (Trip + My Gear comfort), ezért dedikált
 * composable — a useTrips() bővítése a v2 §0 #5 (Trip ≠ My Gear)
 * elvvel ütközne. A page N+1 lekérdezését kerüli: a stats + a
 * recent trip lista 1 db GET /api/stats hívással jön.
 */
import type { TripStatsRow } from '~/types/db';

export interface RecentTrip {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface UseStatsState {
  stats: TripStatsRow | null;
  recentTrips: RecentTrip[];
  loading: boolean;
  error: string | null;
}

export const useStats = () => {
  const state = useState<UseStatsState>('trip-stats', () => ({
    stats: null,
    recentTrips: [],
    loading: false,
    error: null,
  }));

  const load = async () => {
    state.value.loading = true;
    state.value.error = null;
    try {
      const data = await $fetch<{
        stats: TripStatsRow | null;
        recent_trips: RecentTrip[];
      }>('/api/stats');
      state.value.stats = data.stats;
      state.value.recentTrips = data.recent_trips;
    } catch (e) {
      const err = e as { statusMessage?: string; message?: string };
      state.value.error =
        err?.statusMessage ?? err?.message ?? 'Stats betöltése sikertelen';
    } finally {
      state.value.loading = false;
    }
  };

  const resetError = () => {
    state.value.error = null;
  };

  return { state, load, resetError };
};
