import { serverSupabaseClient } from '#supabase/server';
import type { Database } from '~/types/db';

/**
 * GET /api/trips/:id
 * Trip + nested `trip_gear(gear_item_id, quantity)` in a single round-trip.
 *
 * Cross-user access is silently dropped by the trips SELECT policy + the
 * trip_gear SELECT policy (both keyed on the parent trip's user_id), so
 * if the caller doesn't own the row, .single() throws and we surface 404.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' });
  }

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