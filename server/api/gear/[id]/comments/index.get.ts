import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database, GearCommentRow } from '~/types/db';

/**
 * GET /api/gear/:id/comments
 *
 * Returns the comment thread for a given gear item. RLS does the visibility
 * filtering — callers who cannot see the parent gear_item (stranger)
 * receive an empty array. The endpoint does NOT 404 on "no comments": an
 * empty thread is a valid first-paint state for the UI's empty copy.
 *
 * Order: newest first (`created_at DESC`) so the top of the list is the
 * most recently posted / edited comment.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' });
  }

  const gearItemId = getRouterParam(event, 'id');
  if (!gearItemId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing gear_item_id' });
  }

  const supabase = await serverSupabaseClient<Database>(event);
  const { data, error } = await supabase
    .from('gear_comments')
    .select('id, gear_item_id, user_id, body, created_at, updated_at')
    .eq('gear_item_id', gearItemId)
    .order('created_at', { ascending: false });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }
  return data ?? ([] as GearCommentRow[]);
});