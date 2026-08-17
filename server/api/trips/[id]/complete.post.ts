import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database } from '~/types/db';
import { getUserId } from '~/server/utils/auth';

/**
 * POST /api/trips/:id/complete
 *
 * Sprint 5 P0.3 — Owner-only "Túra lezárása" action.
 *
 * Sets `trips.completed_at = now()` on the target trip. Only the
 * trip owner can call this (RLS Strict — a `trips` UPDATE policy
 * matches `auth.uid() = user_id`; non-owner UPDATE silently affects
 * 0 rows, which surfaces as PostgREST error → 404).
 *
 * A spec §4.2 / §4.4 (b) indoklás: a `completed_at` NULL default
 * (= "tervezett") → NOT NULL (= "elment") átmenet a user explicit
 * jelzése. A `useTrips.markTripCompleted()` composable metódus
 * hívja (a trips/[id].vue "Túra lezárása" gombjából), majd a
 * sikeres válasz UTÁN a kliens oldalon a `useFunnelEvents`
 * `trackEvent('first_completed_trip', { trip_id })` capture hívás
 * fut le (a kliensoldali komfortmentés-analógia: a response-ből a
 * kliens tüzel, nem a szerver).
 *
 * Miért NEM trigger a DB-oldali ON UPDATE → funnel_events:
 *   * A funnel events tábla INSERT-je service-role-t igényel
 *     (BYPASSRLS), a DB trigger-ből hívott service-role RPC
 *     felesleges komplexitás.
 *   * A kliens-oldali trigger a user oldali flow-t jobban
 *     tükrözi (a gomb megnyomásakor a user szándéka explicit).
 *   * A kliens-oldali useState flag + a szerver-oldali endpoint
 *     idempotens first_* guard kettős védelmet ad.
 *
 * Response: the updated trip row (with `completed_at` set). The
 * client mirrors the local state via the composition's `update()`.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Bejelentkezés szükséges',
    });
  }

  const tripId = getRouterParam(event, 'id');
  if (!tripId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Hiányzó túra azonosító',
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);

  const userId = getUserId(user);

  // Owner-only UPDATE. RLS Strict — a trips UPDATE policy
  // (auth.uid() = user_id) silently drops non-owner rows. A
  // `.single()` + `.eq('id', tripId)` + `.eq('user_id', userId)`
  // dual-condition kettős védelmet ad (ha bármiért a trips
  // RLS policy lazulna, a második feltétel még mindig
  // owner-only-t tart).
  const { data, error } = await supabase
    .from('trips')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', tripId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) {
    // RLS denial OR trip not owned → 404 hides the cause.
    throw createError({
      statusCode: 404,
      statusMessage: 'A túra nem található vagy nem a tiéd',
    });
  }

  return data;
});
