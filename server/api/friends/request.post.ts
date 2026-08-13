import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import { z } from 'zod';
import type { Database } from '~/types/db';
import { getUserId } from '~/server/utils/auth';

/**
 * POST /api/friends/request
 * Body: { recipient_email: string }
 *
 * Creates a pending friendship row in canonical (user_a < user_b) order.
 * `requested_by` is always auth.uid() (the caller), which forces the
 * recipient-side semantics: the OTHER user has to accept.
 *
 * Lookup flow:
 *   1. SECURITY DEFINER `friend_search_users(email)` → matched user_id
 *   2. SELECT existing friendship (RLS-scoped, may be empty) to make
 *      idempotency explicit (caller-initiated concurrent duplicate is
 *      collapsed by the (user_a, user_b) UNIQUE constraint at the DB).
 *
 * 400 self-request, 404 unknown email, 409 already-related.
 */
const bodySchema = z.object({
  recipient_email: z.string().trim().email('Invalid email'),
});

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' });
  }

  const body = await readBody(event);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid body',
      data: parsed.error.flatten(),
    });
  }

  const callerId = getUserId(user);
  const recipientEmail = parsed.data.recipient_email;

  const supabase = await serverSupabaseClient<Database>(event);

  // 1. Resolve recipient uuid via the SECURITY DEFINER helper.
  const { data: matches, error: rpcError } = await supabase.rpc(
    'friend_search_users' as never,
    { p_email: recipientEmail } as never,
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

  const recipientId = (hit as { user_id: string; email: string }).user_id;

  if (recipientId === callerId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Cannot send a friend request to yourself',
    });
  }

  // Canonical pair ordering — DB has CHECK (user_a < user_b).
  const user_a = callerId < recipientId ? callerId : recipientId;
  const user_b = callerId < recipientId ? recipientId : callerId;

  // 2. Idempotency check: any existing friendship between these two is
  //    surfaced explicitly rather than relying on a UNIQUE-constraint
  //    violation, so the UI can distinguish "already pending" vs "already
  //    accepted" vs "already blocked".
  const { data: existing, error: existingError } = await supabase
    .from('friendships')
    .select('id, status, requested_by')
    .eq('user_a', user_a)
    .eq('user_b', user_b)
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') {
    throw createError({ statusCode: 500, statusMessage: existingError.message });
  }

  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: `Already in relationship (status=${existing.status})`,
    });
  }

  // 3. INSERT — RLS INSERT policy requires caller = requested_by AND
  //    caller in (user_a, user_b) AND status='pending', all true here.
  const { data: row, error: insertError } = await supabase
    .from('friendships')
    .insert({
      user_a,
      user_b,
      requested_by: callerId,
      status: 'pending',
    })
    .select('id, user_a, user_b, status, requested_by, created_at, accepted_at')
    .single();

  if (insertError) {
    throw createError({ statusCode: 400, statusMessage: insertError.message });
  }

  setResponseStatus(event, 201);
  return row;
});