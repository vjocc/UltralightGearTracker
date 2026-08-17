import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database, TripStatsRow } from '~/types/db';
import { getUserId } from '~/server/utils/auth';

/**
 * GET /api/stats
 *
 * Returns the signed-in user's aggregated trip + gear statistics.
 * Pure aggregation over the trip_stats VIEW (security_invoker = true,
 * so RLS from trips + gear_items is inherited automatically).
 *
 * Visibility:
 *   * serverSupabaseUser() — 401 if anonymous.
 *   * RLS on the underlying tables (trips.user_id = auth.uid(),
 *     gear_items.user_id = auth.uid()) — owner-only via security_invoker.
 *
 * Why server-side and not client-side aggregation?
 *   The Phase 5 spec already established that aggregation belongs on
 *   the server (see server/api/gear/base-weight.get.ts rationale).
 *   The trip_stats VIEW is the single source of truth; the JS layer
 *   never re-implements SUM / AVG / jsonb aggregation, avoiding
 *   hydration drift.
 *
 * The endpoint also fetches the user's recent trip list (newest 10)
 * so the page can render a "Trip-történet" timeline without a
 * second round-trip. The trip list itself is owner-scoped via RLS
 * on the trips table — no extra filter needed.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Bejelentkezés szükséges',
    });
  }

  const userId = getUserId(user);
  const supabase = await serverSupabaseClient<Database>(event);

  // 1) Aggregated stats from the trip_stats VIEW.
  //    The WHERE user_id = auth.uid() filter is redundant (security_invoker
  //    + trips.user_id = auth.uid() RLS already scopes to the caller),
  //    but we keep it as a defense-in-depth assertion.
  const { data: statsRow, error: statsError } = await supabase
    .from('trip_stats')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (statsError) {
    throw createError({ statusCode: 500, statusMessage: statsError.message });
  }

  // 2) Recent trips for the timeline section (newest first, limit 10).
  //    The Phase 5 spec did NOT introduce a timeline; this is the
  //    Phase 6 addition. LIMIT is server-side; client pagination is
  //    out-of-scope for v2 #24.
  const { data: recentTrips, error: tripsError } = await supabase
    .from('trips')
    .select('id, name, start_date, end_date, created_at')
    .order('start_date', { ascending: false, nullsFirst: false })
    .limit(10);

  if (tripsError) {
    throw createError({ statusCode: 500, statusMessage: tripsError.message });
  }

  // If the user has zero trips, statsRow is null (the FULL OUTER JOIN
  // gives 1 row per user_id that appears in *any* CTE; a totally empty
  // user has no row at all). The frontend renders the "Még nincs
  // elég adat" empty state in that case.
  return {
    stats: (statsRow as TripStatsRow | null) ?? null,
    recent_trips: (recentTrips ?? []) as Array<{
      id: string;
      name: string;
      start_date: string | null;
      end_date: string | null;
      created_at: string;
    }>,
  };
});
