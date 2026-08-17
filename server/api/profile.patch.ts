import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database } from '~/types/db';
import { profileUpdateSchema } from '~/shared/profileSchemas';

/**
 * PATCH /api/profile
 *
 * Frissíti a session user profilját (display_name, avatar_url, bio).
 * RLS Strict: a user csak a saját profilját UPDATE-elheti (auth.uid() =
 * id a profiles_update_self policy USING + WITH CHECK).
 *
 * A display_name validáció: trim whitespace, 1-50 char (a profiles
 * tábla CHECK constraint-je a migration-ben).
 *
 * Response: a frissített profileSelfSchema szerinti zod-validált JSON.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Bejelentkezés szükséges',
    });
  }

  const body = await readBody(event);
  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: `Profile update validation failed: ${parsed.error.message}`,
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);

  const { data, error } = await supabase
    .from('profiles')
    .update({
      display_name: parsed.data.display_name,
      avatar_url: parsed.data.avatar_url ?? null,
      bio: parsed.data.bio ?? null,
    })
    .eq('id', user.id)
    .select('id, display_name, avatar_url, bio, created_at, updated_at')
    .single();

  if (error || !data) {
    throw createError({
      statusCode: 500,
      statusMessage: `Profile update failed: ${error?.message ?? 'no data'}`,
    });
  }

  return data;
});
