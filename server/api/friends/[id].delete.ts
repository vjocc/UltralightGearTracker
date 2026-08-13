import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database } from '~/types/db';
import { getUserId } from '~/server/utils/auth';

/**
 * DELETE /api/friends/:id
 *
 * Either member of the pair may drop the friendship. RLS DELETE USING
 * policy already enforces membership (auth.uid() = user_a OR user_b).
 * The migration also enforces `user_a < user_b` so we don't need to
 * defend the canonical ordering here.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' });
  }

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' });
  }

  const supabase = await serverSupabaseClient<Database>(event);

  // Surface 404 explicitly: a silent 0-row delete is indistinguishable
  // from "RLS blocked" otherwise.
  const { data: existing, error: selectError } = await supabase
    .from('friendships')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (selectError) {
    throw createError({ statusCode: 500, statusMessage: selectError.message });
  }
  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Friendship not found',
    });
  }

  const { error: deleteError } = await supabase
    .from('friendships')
    .delete()
    .eq('id', id);

  if (deleteError) {
    throw createError({ statusCode: 400, statusMessage: deleteError.message });
  }

  setResponseStatus(event, 204);
  return null;
});