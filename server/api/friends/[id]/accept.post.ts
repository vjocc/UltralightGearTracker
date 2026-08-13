import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database } from '~/types/db';
import { getUserId } from '~/server/utils/auth';

/**
 * POST /api/friends/:id/accept
 *
 * Marks the friendship as accepted. RLS UPDATE policy enforces that the
 * caller is a member of the pair AND is NOT the requester (i.e. only the
 * receiver side can accept). Server-side we additionally:
 *   * SELECT the row first to distinguish 404 (no row) from 403
 *     (caller is not the receiver).
 *   * Refuse if the row is already accepted / blocked.
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
  const callerId = getUserId(user);

  // RLS SELECT scopes this to caller-visible rows (members only).
  const { data: row, error: selectError } = await supabase
    .from('friendships')
    .select('id, status, requested_by')
    .eq('id', id)
    .maybeSingle();

  if (selectError) {
    throw createError({ statusCode: 500, statusMessage: selectError.message });
  }
  if (!row) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Friendship not found',
    });
  }

  if (row.requested_by === callerId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only the recipient can accept the request',
    });
  }
  if (row.status !== 'pending') {
    throw createError({
      statusCode: 409,
      statusMessage: `Cannot accept: status=${row.status}`,
    });
  }

  // RLS UPDATE policy additionally enforces status in ('accepted','blocked')
  // AND accepted_at IS NOT NULL — set both atomically.
  const { data: updated, error: updateError } = await supabase
    .from('friendships')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, user_a, user_b, status, requested_by, created_at, accepted_at')
    .single();

  if (updateError) {
    throw createError({ statusCode: 400, statusMessage: updateError.message });
  }

  return updated;
});