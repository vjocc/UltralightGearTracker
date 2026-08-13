import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database, TripCommentRow } from '~/types/db';
import { commentCreateSchema } from '~/server/utils/commentSchemas';
import { getUserId } from '~/server/utils/auth';

/**
 * POST /api/trips/:id/comments
 *
 * Adds a comment to a trip. The RLS INSERT policy enforces that the
 * parent trip is visible to the caller (owner OR accepted invitee OR
 * accepted friend of the owner) — so a stranger hitting this endpoint
 * will see the row rejected at the DB layer. To return a clearer error
 * than "0 rows inserted", we run an explicit `trip_visible_to(id)` RPC
 * up-front and throw 403 when it returns false.
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
  const parsed = commentCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid comment payload',
      data: parsed.error.flatten(),
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);

  // Up-front visibility check so we can distinguish "trip not visible"
  // (403) from "RLS denied the insert".
  const { data: visible, error: visErr } = await supabase.rpc(
    'trip_visible_to' as never,
    { p_trip_id: tripId } as never,
  );
  if (visErr) {
    throw createError({ statusCode: 500, statusMessage: visErr.message });
  }
  if (!visible) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You cannot comment on this trip',
    });
  }

  // The trip_comments.user_id column is NOT NULL with no DB-side default
  // auth.uid() (intentionally — we own the value at the API layer so the
  // caller's identity is explicit). Pass getUserId(user) so the RLS
  // INSERT WITH CHECK (`auth.uid() = user_id`) matches and the row
  // inserts cleanly. serverSupabaseUser() returns the JWT claims payload,
  // whose primary identifier is `sub` (not `id`), so `user.id` would be
  // `undefined` and the insert would 400 with "null value in column
  // user_id violates not-null constraint" or the RLS WITH CHECK above
  // would reject it.
  const callerId = getUserId(user);
  if (!callerId) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' });
  }

  const { data, error } = await supabase
    .from('trip_comments')
    .insert({
      trip_id: tripId,
      user_id: callerId,
      body: parsed.data.body,
    })
    .select('id, trip_id, user_id, body, created_at, updated_at')
    .single();

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message });
  }
  return data as TripCommentRow;
});
