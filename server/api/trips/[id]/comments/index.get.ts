import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database, TripCommentRow } from '~/types/db';

/**
 * GET /api/trips/:id/comments
 *
 * Returns the comment thread for a given trip. RLS does the visibility
 * filtering — callers who cannot see the parent trip (stranger) receive
 * an empty array. The endpoint does NOT 404 on "no comments": an empty
 * thread is a valid first-paint state for the UI's empty copy.
 *
 * Order: newest first (`created_at DESC`).
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

  const supabase = await serverSupabaseClient<Database>(event);
  const { data, error } = await supabase
    .from('trip_comments')
    .select('id, trip_id, user_id, body, created_at, updated_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }
  return data ?? ([] as TripCommentRow[]);
});
