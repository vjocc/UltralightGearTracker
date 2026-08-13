import { serverSupabaseClient } from '#supabase/server';
import type { Database } from '~/types/db';

/**
 * DELETE /api/trips/:id
 * Returns 204 on success. The FK `trip_gear.trip_id ... on delete cascade`
 * removes all M:N switch rows for this trip in the same transaction.
 * RLS USING on the DELETE policy gates this to the owning user.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' });
  }

  const supabase = await serverSupabaseClient<Database>(event);
  const { error } = await supabase.from('trips').delete().eq('id', id);

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message });
  }
  setResponseStatus(event, 204);
  return null;
});