import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database } from '~/types/db';
import { getUserId } from '~/server/utils/auth';

/**
 * DELETE /api/gear/:id/comments/:commentId
 *
 * RLS DELETE policy allows the comment author OR the parent gear owner.
 * 404 on missing row OR RLS denial — same status either way to avoid
 * leaking the row's existence.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' });
  }

  const gearItemId = getRouterParam(event, 'id');
  const commentId = getRouterParam(event, 'commentId');
  if (!gearItemId || !commentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing gear_item_id or commentId' });
  }

  const supabase = await serverSupabaseClient<Database>(event);
  const { error } = await supabase
    .from('gear_comments')
    .delete()
    .eq('id', commentId)
    .eq('gear_item_id', gearItemId);

  if (error) {
    throw createError({ statusCode: 404, statusMessage: 'Not found or not authorized' });
  }
  return { ok: true };
});