import { serverSupabaseClient } from '#supabase/server';
import type { Database } from '~/types/db';

/**
 * DELETE /api/gear/:id
 * Returns 204 on success. RLS USING on the DELETE policy gates this.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' });
  }

  const supabase = await serverSupabaseClient<Database>(event);
  const { error } = await supabase.from('gear_items').delete().eq('id', id);

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message });
  }
  setResponseStatus(event, 204);
  return null;
});