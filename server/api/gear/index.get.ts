import { serverSupabaseClient } from '#supabase/server';
import type { Database } from '~/types/db';

/**
 * GET /api/gear
 * Returns the current user's gear items, newest first. RLS limits rows to
 * the calling user automatically (serverSupabaseClient forwards the JWT).
 */
export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient<Database>(event);
  const { data, error } = await supabase
    .from('gear_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }
  return data ?? [];
});