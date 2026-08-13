import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database, TripShareInviteRow } from '~/types/db';
import { inviteCreateSchema } from '~/server/utils/tripShareSchemas';
import { getUserId } from '~/server/utils/auth';

/**
 * POST /api/trips/:id/invites
 *
 * Owner invites a friend by email. RLS INSERT policy enforces owner-only;
 * server-side we additionally:
 *   * SELECT the trip to distinguish 404 (no row / RLS denied) from 403
 *     (caller is not the owner),
 *   * resolve the invitee via `friend_search_users(email)` and pre-fill
 *     `invitee_user_id` if a registered user matches (so the accept
 *     endpoint can short-circuit on a non-null invitee_user_id),
 *   * refuse self-invite (caller's email == owner email → 400),
 *   * idempotency: if a row already exists for this (trip, email) tuple,
 *     return it (200, not 201) so the UI doesn't surface a duplicate
 *     invite error on a re-click.
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

  const body = await readBody(event);
  const parsed = inviteCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid body',
      data: parsed.error.flatten(),
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);
  const callerId = getUserId(user);
  const inviteeEmail = parsed.data.invitee_email;

  // Owner-check via SELECT — distinguishes 404 (no row / RLS denied)
  // from 403 (caller is not the owner).
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id, user_id')
    .eq('id', tripId)
    .maybeSingle();

  if (tripError) {
    throw createError({ statusCode: 500, statusMessage: tripError.message });
  }
  if (!trip) {
    throw createError({ statusCode: 404, statusMessage: 'Trip not found' });
  }
  if (trip.user_id !== callerId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Only the owner can invite',
    });
  }

  // Self-invite guard.
  if (
    typeof user.email === 'string' &&
    user.email.toLowerCase() === inviteeEmail.toLowerCase()
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot invite yourself',
    });
  }

  // Idempotency check by email (case-insensitive via lower() index).
  const { data: existing, error: existingError } = await supabase
    .from('trip_share_invites')
    .select(
      'id, trip_id, inviter_id, invitee_email, invitee_user_id, status, created_at, responded_at',
    )
    .eq('trip_id', tripId)
    .ilike('invitee_email', inviteeEmail)
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') {
    throw createError({
      statusCode: 500,
      statusMessage: existingError.message,
    });
  }
  if (existing) {
    // Surface the existing row at 200 (not 201) so the UI can treat it
    // as a re-click on an already-pending invite.
    setResponseStatus(event, 200);
    return existing as TripShareInviteRow;
  }

  // Resolve invitee via SECURITY DEFINER helper.
  const { data: matches, error: rpcError } = await supabase.rpc(
    'friend_search_users' as never,
    { p_email: inviteeEmail } as never,
  );
  if (rpcError) {
    throw createError({ statusCode: 500, statusMessage: rpcError.message });
  }
  const hit = Array.isArray(matches) ? matches[0] : null;
  const inviteeUserId =
    hit && typeof hit === 'object' && 'user_id' in hit
      ? (hit as { user_id: string }).user_id
      : null;

  // INSERT — RLS INSERT policy enforces owner-only + trip ownership.
  const { data: row, error: insertError } = await supabase
    .from('trip_share_invites')
    .insert({
      trip_id: tripId,
      inviter_id: callerId,
      invitee_email: inviteeEmail,
      invitee_user_id: inviteeUserId,
    })
    .select(
      'id, trip_id, inviter_id, invitee_email, invitee_user_id, status, created_at, responded_at',
    )
    .single();

  if (insertError) {
    throw createError({ statusCode: 400, statusMessage: insertError.message });
  }

  setResponseStatus(event, 201);
  return row as TripShareInviteRow;
});
