import { serverSupabaseClient } from '#supabase/server';
import type { Database, TripDebriefRow } from '~/types/db';

/**
 * GET /api/trips/:id/debrief
 *
 * Returns `{ debrief: TripDebriefRow | null }`. Visibility is gated by RLS:
 *   * trip_debriefs SELECT — owner OR `trip_visible_to(trip_id)`
 *     (owner + accepted invitee + accepted friend, from P2).
 *
 * The trip must exist at all — otherwise the caller has no visibility
 * claim and the `.maybeSingle()` returns null (no 404 needed here:
 * strangers get `debrief: null`).
 */
export default defineEventHandler(async (event) => {
  const tripId = getRouterParam(event, 'id');
  if (!tripId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing trip id' });
  }

  const supabase = await serverSupabaseClient<Database>(event);

  const { data, error } = await supabase
    .from('trip_debriefs')
    .select('*')
    .eq('trip_id', tripId)
    .maybeSingle();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  return { debrief: (data as TripDebriefRow | null) ?? null };
});