import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database, TripShareInviteRow } from '~/types/db';
import { getUserId } from '~/server/utils/auth';

/**
 * POST /api/trips/:id/invites/:inviteId/decline
 *
 * Mirror of accept.post.ts but sets status='declined'. RLS UPDATE policy
 * enforces invitee-only; same 404/403/409 mapping as accept.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' });
  }

  const tripId = getRouterParam(event, 'id');
  const inviteId = getRouterParam(event, 'inviteId');
  if (!tripId || !inviteId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing trip id or inviteId',
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);
  const callerId = getUserId(user);

  const { data: row, error: selectError } = await supabase
    .from('trip_share_invites')
    .select('id, invitee_user_id, status')
    .eq('id', inviteId)
    .eq('trip_id', tripId)
    .maybeSingle();

  if (selectError) {
    throw createError({ statusCode: 500, statusMessage: selectError.message });
  }
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Invite not found' });
  }

  if (row.invitee_user_id !== callerId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only the invitee can decline',
    });
  }
  if (row.status !== 'pending') {
    throw createError({
      statusCode: 409,
      statusMessage: `Cannot decline: status=${row.status}`,
    });
  }

  const { data: updated, error: updateError } = await supabase
    .from('trip_share_invites')
    .update({ status: 'declined', responded_at: new Date().toISOString() })
    .eq('id', inviteId)
    .select(
      'id, trip_id, inviter_id, invitee_email, invitee_user_id, status, created_at, responded_at',
    )
    .single();

  if (updateError) {
    throw createError({ statusCode: 400, statusMessage: updateError.message });
  }
  return updated as TripShareInviteRow;
});
