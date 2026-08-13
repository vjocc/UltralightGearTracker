import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database } from '~/types/db';
import { getUserId } from '~/server/utils/auth';

/**
 * DELETE /api/trips/:id/invites/:inviteId
 *
 * Owner-only delete (the invitee uses decline instead). RLS DELETE policy
 * allows owner OR invitee, but the endpoint restricts to owner so the
 * invitee always goes through the `decline` route (which records
 * responded_at).
 *
 * 404 on missing row OR RLS denial — same status either way to avoid
 * leaking the row's existence.
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

  // Owner-check via trips SELECT — distinguishes 404 from 403.
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id, user_id')
    .eq('id', tripId)
    .maybeSingle();
  if (tripError) {
    throw createError({ statusCode: 500, statusMessage: tripError.message });
  }
  if (!trip || trip.user_id !== callerId) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not found or not authorized',
    });
  }

  const { error } = await supabase
    .from('trip_share_invites')
    .delete()
    .eq('id', inviteId)
    .eq('trip_id', tripId);

  if (error) {
    throw createError({ statusCode: 404, statusMessage: 'Not found or not authorized' });
  }
  return { ok: true };
});
