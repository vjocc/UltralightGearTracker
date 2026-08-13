import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database } from '~/types/db';
import { getUserId } from '~/server/utils/auth';

/**
 * DELETE /api/trips/:id/comments/:commentId
 *
 * RLS DELETE policy allows the comment author OR the parent trip owner.
 * 404 on missing row OR RLS denial — same status either way to avoid
 * leaking the row's existence.
 *
 * Mirrors server/api/gear/[id]/comments/[commentId].delete.ts. Differs
 * only in the parent table + FK column (trip_comments / trip_id).
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' });
  }

  const tripId = getRouterParam(event, 'id');
  const commentId = getRouterParam(event, 'commentId');
  if (!tripId || !commentId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing trip id or commentId' });
  }

  const supabase = await serverSupabaseClient<Database>(event);
  const { error } = await supabase
    .from('trip_comments')
    .delete()
    .eq('id', commentId)
    .eq('trip_id', tripId);

  if (error) {
    throw createError({ statusCode: 404, statusMessage: 'Not found or not authorized' });
  }
  return { ok: true };
});
