import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database, TripShareInviteRow } from '~/types/db';
import { getUserId } from '~/server/utils/auth';

/**
 * POST /api/trips/:id/invites/:inviteId/accept
 *
 * Invitee accepts the invite. RLS UPDATE policy enforces invitee-only,
 * server-side we additionally:
 *   * SELECT the invite to distinguish 404 (no row / RLS denied) from
 *     403 (caller is not the invitee),
 *   * refuse if invitee_user_id is null (the recipient hasn't signed up
 *     yet — they need to register first before they can accept),
 *   * refuse if status !== 'pending' (409 conflict).
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

  // RLS SELECT scopes this to caller-visible rows (invitee OR owner).
  const { data: row, error: selectError } = await supabase
    .from('trip_share_invites')
    .select(
      'id, trip_id, inviter_id, invitee_email, invitee_user_id, status, created_at, responded_at',
    )
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
      statusMessage: 'Only the invitee can accept',
    });
  }
  if (row.status !== 'pending') {
    throw createError({
      statusCode: 409,
      statusMessage: `Cannot accept: status=${row.status}`,
    });
  }

  // UPDATE — RLS policy additionally enforces status in ('accepted','declined')
  // AND responded_at IS NOT NULL — set both atomically.
  const { data: updated, error: updateError } = await supabase
    .from('trip_share_invites')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
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
