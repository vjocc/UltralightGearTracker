import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database, TripCommentRow } from '~/types/db';
import { commentUpdateSchema } from '~/server/utils/commentSchemas';
import { getUserId } from '~/server/utils/auth';

/**
 * PATCH /api/trips/:id/comments/:commentId
 *
 * Edits a trip comment's body. Only the comment author may edit —
 * RLS UPDATE policy enforces `auth.uid() = user_id`. The body length
 * is also re-checked on the policy level (1..2000 chars).
 *
 * 404 when the comment doesn't exist OR RLS blocks the UPDATE (i.e.
 * the caller is not the author). Same status either way so we don't
 * leak the row's existence to non-authors.
 *
 * Mirrors server/api/gear/[id]/comments/[commentId].patch.ts.
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

  const body = await readBody(event);
  const parsed = commentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid comment payload',
      data: parsed.error.flatten(),
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);
  const { data, error } = await supabase
    .from('trip_comments')
    .update({ body: parsed.data.body })
    .eq('id', commentId)
    .eq('trip_id', tripId)
    .select('id, trip_id, user_id, body, created_at, updated_at')
    .single();

  if (error) {
    throw createError({ statusCode: 404, statusMessage: 'Not found or not the author' });
  }
  return data as TripCommentRow;
});
