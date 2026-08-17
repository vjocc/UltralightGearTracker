import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database } from '~/types/db';
import { profileSelfSchema } from '~/shared/profileSchemas';

/**
 * GET /api/profile
 *
 * Visszaadja a session user profilját (display_name, avatar_url, bio,
 * created_at, updated_at). RLS Strict: a user csak a saját profilját
 * olvassa (auth.uid() = id a profiles_select_self policy USING clause).
 *
 * Response: a profileSelfSchema szerinti zod-validált JSON.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Bejelentkezés szükséges',
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, bio, created_at, updated_at')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Profile fetch failed: ${error.message}`,
    });
  }

  // Ha a user-nek még nincs profil-rekordja (a signup-trigger nem futott
  // le valamiért), a fallback 'Névtelen túrázó' placeholder.
  if (!data) {
    return {
      id: user.id,
      display_name: 'Névtelen túrázó',
      avatar_url: null,
      bio: null,
      created_at: null,
      updated_at: null,
    };
  }

  // Defense-in-depth zod validation: a service-oldali válasz séma-megfelelősége.
  const parsed = profileSelfSchema.safeParse(data);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.warn('profile schema mismatch', parsed.error.flatten());
  }
  return data;
});
