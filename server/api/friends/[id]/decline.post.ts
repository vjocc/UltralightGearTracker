import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database } from '~/types/db';
import { getUserId } from '~/server/utils/auth';

/**
 * POST /api/friends/:id/decline
 *
 * Removes a pending friendship row. The migration has no 'declined'
 * status — decline and remove share the same DELETE-permitted verb, the
 * split is purely cosmetic at the UI layer.
 *
 * Allowed for any member of the pair (RLS DELETE USING policy).
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

  // RLS DELETE USING already gates to members; a 0-row delete is silently
  // a no-op — we surface 404 explicitly so the UI can react.
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