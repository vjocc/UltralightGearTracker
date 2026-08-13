import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database, TripShareInviteRow, TripInviteStatus } from '~/types/db';
import { getUserId } from '~/server/utils/auth';

/**
 * GET /api/trips/:id/invites
 *
 * Returns invites for a given trip.
 *
 * Query params:
 *   status=pending|accepted|declined|incoming
 *     - pending|accepted|declined: returns invites on this trip with that
 *       status (RLS filters to caller-visible rows; the trip owner sees
 *       everything, the invitee sees only their own row).
 *     - incoming: SPECIAL — returns invites for which the caller is the
 *       invitee (matched by invitee_user_id) AND status='pending'. This
 *       is the AppHeader badge feed, which crosses trip boundaries. The
 *       trip id in the URL is irrelevant for `status=incoming` — the
 *       endpoint still scopes to trip_share_invites rows the caller can
 *       see via RLS (which the SELECT policy allows when invitee_user_id
 *       matches).
 *
 * RLS does the visibility filtering; we don't pre-filter by trip_id when
 * status='incoming' (the badge feed is cross-trip), but for the other
 * statuses we DO scope by trip_id.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' });
  }

  const tripId = getRouterParam(event, 'id');
  if (!tripId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing trip id' });
  }

  const query = getQuery(event);
  const statusParam =
    typeof query.status === 'string' ? query.status : 'pending';

  if (!isInviteStatus(statusParam)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid status: ${statusParam}`,
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);

  let q = supabase
    .from('trip_share_invites')
    .select(
      'id, trip_id, inviter_id, invitee_email, invitee_user_id, status, created_at, responded_at',
    )
    .order('created_at', { ascending: false });

  if (statusParam === 'incoming') {
    // Cross-trip badge feed: invitee_user_id = caller AND status='pending'.
    q = q
      .eq('invitee_user_id', getUserId(user))
      .eq('status', 'pending');
  } else {
    q = q.eq('trip_id', tripId).eq('status', statusParam);
  }

  const { data, error } = await q;
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }
  return data ?? ([] as TripShareInviteRow[]);
});

function isInviteStatus(v: string): v is TripInviteStatus | 'incoming' {
  return (
    v === 'pending' ||
    v === 'accepted' ||
    v === 'declined' ||
    v === 'incoming'
  );
}
