import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database } from '~/types/db';
import { getServiceRoleClient } from '~/server/utils/publicShareClient';

/**
 * GET /api/trips/:id
 *
 * Two read paths:
 *   1. Authenticated caller (serverSupabaseClient): the trip + nested
 *      `trip_gear(gear_item_id, quantity)` in a single round-trip.
 *      Cross-user access is silently dropped by the trips SELECT policy
 *      + the trip_gear SELECT policy (both keyed on the parent trip's
 *      user_id), so if the caller doesn't own the row, .single() throws
 *      and we surface 404.
 *   2. Anonymous caller: P1 (Sprint 5) added this path so the
 *      "Felfedezés a régióban" /discover listing can deep-link into a
 *      trip without requiring auth. The service-role client reads the
 *      row, but ONLY if `visibility = 'public'`. Private trips return
 *      404 — indistinguishable from "not found" — so hostile probes
 *      cannot enumerate trip ids by status code.
 *
 * The nested `trip_gear(*)` is INTENTIONALLY omitted from the public
 * path (it would leak the owner's gear list — v2 §0 #4 minimum scope).
 * Public callers receive the trip row only.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' });
  }

  const user = await serverSupabaseUser(event);

  // ---- Anonymous / public path (Sprint 5 P1) --------------------------------
  if (!user) {
    const serviceClient = getServiceRoleClient();
    const { data, error } = await serviceClient
      .from('trips')
      .select(
        'id, name, description, start_date, end_date, region, region_source, gpx_metadata, completed_at',
      )
      .eq('id', id)
      .eq('visibility', 'public')
      .maybeSingle();

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: `Public trip lookup failed: ${error.message}`,
      });
    }
    if (!data) {
      // Either id is wrong or the trip is private. Same 404 either way.
      throw createError({ statusCode: 404, statusMessage: 'Not found' });
    }
    return data;
  }

  // ---- Authenticated path (owner-scoped via RLS) ---------------------------
  const supabase = await serverSupabaseClient<Database>(event);
  const { data, error } = await supabase
    .from('trips')
    .select('*, trip_gear(*)')
    .eq('id', id)
    .single();

  if (error) {
    // .single() throws when no row matched — RLS blocked or id is wrong.
    throw createError({ statusCode: 404, statusMessage: 'Not found or not owned' });
  }
  return data;
});