import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database } from '~/types/db';
import { profileUpdateSchema } from '~/shared/profileSchemas';
import { getUserId } from '~/server/utils/auth';

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

  // A serverSupabaseUser() JwtPayload-ot ad (sub = auth.users.uuid), NEM
  // User típust — getUserId() helper olvassa ki a sub-ot (és fallback az id-re).
  const userId = getUserId(user);

  const body = await readBody(event);
  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: `Profile update validation failed: ${parsed.error.message}`,
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);

  // A meglévő user lehet, hogy nem rendelkezik profiles sorral (a signup
  // trigger nem futott le). Először SELECT-et végzünk a user_id-vel, és
  // ha nincs, INSERT-et végzünk. Ez véd a PGRST116 (.single() 0 row) 500
  // hibától, és a meglévő userek menthetnek nevet.
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  let data: { id: string; display_name: string; avatar_url: string | null; bio: string | null; created_at: string; updated_at: string } | null = null;

  if (!existing) {
    // Nincs profiles sor — INSERT-et végzünk (a meglévő user-ek helyzete).
    const { data: inserted, error: insertErr } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        display_name: parsed.data.display_name,
        avatar_url: parsed.data.avatar_url ?? null,
        bio: parsed.data.bio ?? null,
      })
      .select('id, display_name, avatar_url, bio, created_at, updated_at')
      .single();
    if (insertErr || !inserted) {
      throw createError({
        statusCode: 500,
        statusMessage: `Profile insert failed: ${insertErr?.message ?? 'no data'}`,
      });
    }
    data = inserted;
  } else {
    // Van profiles sor — UPDATE-et végzünk (.maybeSingle()-nel, nem .single()).
    const { data: updated, error: updateErr } = await supabase
      .from('profiles')
      .update({
        display_name: parsed.data.display_name,
        avatar_url: parsed.data.avatar_url ?? null,
        bio: parsed.data.bio ?? null,
      })
      .eq('id', userId)
      .select('id, display_name, avatar_url, bio, created_at, updated_at')
      .maybeSingle();
    if (updateErr || !updated) {
      throw createError({
        statusCode: 500,
        statusMessage: `Profile update failed: ${updateErr?.message ?? 'no data'}`,
      });
    }
    data = updated;
  }

  return data;
});
