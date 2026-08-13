import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database, FriendListEntry } from '~/types/db';
import { getUserId } from '~/server/utils/auth';

/**
 * GET /api/friends/search?email=…
 *
 * Looks up a user by exact, case-insensitive email match via the
 * SECURITY DEFINER helper `friend_search_users(email)`. Returns the
 * matched user_id + email + any existing friendship status with the
 * caller (none / pending-incoming / pending-outgoing / accepted).
 *
 * 404 when no auth.users row matches — keeps the email enumeration
 * surface tight (the client has to provide an exact match to learn
 * that a user exists).
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' });
  }

  const query = getQuery(event);
  const rawEmail = typeof query.email === 'string' ? query.email : '';
  const email = rawEmail.trim();
  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'Missing email' });
  }

  const supabase = await serverSupabaseClient<Database>(event);

  const { data: matches, error: rpcError } = await supabase.rpc(
    'friend_search_users' as never,
    { p_email: email } as never,
  );
  if (rpcError) {
    throw createError({ statusCode: 500, statusMessage: rpcError.message });
  }

  const hit = Array.isArray(matches) ? matches[0] : null;
  if (!hit) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No user with that email',
    });
  }

  const matched = hit as { user_id: string; email: string };

  // Look up any existing friendship with the caller. RLS on the table
  // already scopes the query to caller-visible rows.
  const callerId = getUserId(user);
  const isCallerA = matched.user_id < callerId; // canonical ordering
  const { data: existing, error: fsError } = await supabase
    .from('friendships')
    .select('id, user_a, user_b, status, requested_by, created_at, accepted_at')
    .eq(isCallerA ? 'user_a' : 'user_b', isCallerA ? matched.user_id : callerId)
    .eq(isCallerA ? 'user_b' : 'user_a', isCallerA ? callerId : matched.user_id)
    .maybeSingle();

  if (fsError && fsError.code !== 'PGRST116') {
    throw createError({ statusCode: 500, statusMessage: fsError.message });
  }

  let existingFriendship: FriendListEntry | null = null;
  if (existing) {
    existingFriendship = {
      id: existing.id,
      status: existing.status,
      friend_id: matched.user_id,
      friend_email: matched.email,
      requested_by: existing.requested_by,
      accepted_at: existing.accepted_at,
      created_at: existing.created_at,
    };
  }

  return {
    user_id: matched.user_id,
    email: matched.email,
    // Self-search guard: the UI hides the "Send invite" button when this
    // is true. We still return the search result so the UI can render a
    // "this is you" hint.
    is_self: matched.user_id === callerId,
    existing_friendship: existingFriendship,
  };
});