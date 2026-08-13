import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database, EmailLookupResult } from '~/types/db';
import { lookupEmailsSchema } from '~/server/utils/commentSchemas';

/**
 * POST /api/auth/lookup-emails
 *
 * Batch uuid → email lookup for comment authors. Wraps the SECURITY DEFINER
 * RPC `gear_comment_lookup_authors(uuid[])`, which only returns emails for
 * uuids the caller already has a relationship with (comment authors on
 * visible gear items).
 *
 * The endpoint lives under /api/auth because it is an auth-utility helper
 * with no single-resource surface; the Friends card has its own
 * `/api/friends/lookup-emails` route and pattern.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' });
  }

  const body = await readBody(event);
  const parsed = lookupEmailsSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid lookup payload',
      data: parsed.error.flatten(),
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);
  const { data, error } = await supabase.rpc(
    'gear_comment_lookup_authors' as never,
    { p_user_ids: parsed.data.ids } as never,
  );

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }

  const rows = (data ?? []) as Array<{ user_id: string; email: string }>;
  return rows.map((r) => ({ user_id: r.user_id, email: r.email })) as EmailLookupResult[];
});