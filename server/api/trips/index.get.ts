import { serverSupabaseClient } from '#supabase/server';
import type { Database } from '~/types/db';

/**
 * GET /api/trips
 * Returns the current user's trips, newest first. RLS limits rows to the
 * calling user automatically (serverSupabaseClient forwards the JWT).
 *
 * The list endpoint intentionally does NOT embed `trip_gear(*)` — the
 * card grid only renders the gear count. Per-trip detail pages hit
 * GET /api/trips/:id which does the nested select.
 */
export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient<Database>(event);
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }
  return data ?? [];
});