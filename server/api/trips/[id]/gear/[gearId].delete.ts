import { serverSupabaseClient } from '#supabase/server';
import type { Database } from '~/types/db';

/**
 * DELETE /api/trips/:id/gear/:gearId
 * Removes a single trip_gear switch row. The composite PK is the natural
 * WHERE clause. RLS USING on trip_gear_delete_own re-checks the parent
 * trip's owner before letting the DELETE through.
 */
export default defineEventHandler(async (event) => {
  const tripId = getRouterParam(event, 'id');
  const gearId = getRouterParam(event, 'gearId');
  if (!tripId || !gearId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing route params' });
  }

  const supabase = await serverSupabaseClient<Database>(event);
  const { error } = await supabase
    .from('trip_gear')
    .delete()
    .eq('trip_id', tripId)
    .eq('gear_item_id', gearId);

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message });
  }
  setResponseStatus(event, 204);
  return null;
});