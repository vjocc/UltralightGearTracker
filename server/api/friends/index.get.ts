import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database, FriendListEntry, FriendStatus } from '~/types/db';
import { getUserId } from '~/server/utils/auth';

/**
 * GET /api/friends
 * Query params:
 *   status=pending|accepted|blocked (optional, default: accepted)
 *   direction=incoming|outgoing    (only meaningful with status=pending;
 *                                  "incoming" = caller is the receiver side,
 *                                  "outgoing" = caller sent the request)
 *
 * Returns FriendListEntry[] — the canonical FriendshipRow plus the
 * resolved friend_id + friend_email of the other side of the pair.
 *
 * Two round-trips:
 *  1. SELECT from `friendships` (RLS already limits to caller pairs),
 *  2. RPC `friend_lookup_emails(uuids)` to resolve each distinct other-
 *     side uuid to its email via the SECURITY DEFINER helper (the only
 *     sanctioned way to read auth.users from app code).
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' });
  }

  const query = getQuery(event);
  const statusParam = typeof query.status === 'string' ? query.status : 'accepted';
  const directionParam =
    typeof query.direction === 'string' ? query.direction : null;

  if (!isFriendStatus(statusParam)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid status: ${statusParam}`,
    });
  }
  if (directionParam && directionParam !== 'incoming' && directionParam !== 'outgoing') {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid direction: ${directionParam}`,
    });
  }
  if (directionParam && statusParam !== 'pending') {
    // Direction only makes sense for pending requests; accepted pairs are
    // symmetric from the UI's perspective.
    throw createError({
      statusCode: 400,
      statusMessage: 'direction is only valid when status=pending',
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);
  const callerId = getUserId(user);

  let q = supabase
    .from('friendships')
    .select('id, user_a, user_b, status, requested_by, created_at, accepted_at')
    .eq('status', statusParam)
    .or(`user_a.eq.${callerId},user_b.eq.${callerId}`);

  if (directionParam === 'incoming') {
    // Caller is the receiver — the other side sent the request.
    q = q.neq('requested_by', callerId);
  } else if (directionParam === 'outgoing') {
    q = q.eq('requested_by', callerId);
  }

  const { data: rows, error } = await q.order('created_at', { ascending: false });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }
  if (!rows || rows.length === 0) return [];

  // Resolve "other side" emails in one batched SECURITY DEFINER call.
  const otherIds = Array.from(
    new Set(
      rows.map((r) => (r.user_a === callerId ? r.user_b : r.user_a)),
    ),
  );

  const emailById = new Map<string, string>();
  if (otherIds.length > 0) {
    const { data: resolved, error: rpcError } = await supabase.rpc(
      'friend_lookup_emails' as never,
      { p_user_ids: otherIds } as never,
    );
    if (rpcError) {
      throw createError({ statusCode: 500, statusMessage: rpcError.message });
    }
    for (const row of (resolved ?? []) as Array<{ user_id: string; email: string }>) {
      emailById.set(row.user_id, row.email);
    }
  }

  const entries: FriendListEntry[] = rows.map((r) => {
    const isCallerA = r.user_a === callerId;
    const friend_id = isCallerA ? r.user_b : r.user_a;
    return {
      id: r.id,
      status: r.status,
      friend_id,
      friend_email: emailById.get(friend_id) ?? '',
      requested_by: r.requested_by,
      accepted_at: r.accepted_at,
      created_at: r.created_at,
    };
  });

  return entries;
});

function isFriendStatus(v: string): v is FriendStatus {
  return v === 'pending' || v === 'accepted' || v === 'blocked';
}