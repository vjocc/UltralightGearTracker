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
 *
 * DIAGNOSTIC (Bugfix 2026-08-17 — RLS violation debug):
 *   A user 500-as hibát jelentett a Profil-mentésnél: "new row
 *   violates row-level security policy for table 'profiles'". A
 *   gyanú: a request során az auth.uid() NULL-t ad vissza (a session
 *   NEM propagálódik). Az egyszerűsített diagnosztika CSAK a user.id
 *   meglétét és a sub mezőt logolja a Vercel Dashboard Logs fülön
 *   valós időben megtekinthető formában (a Vercel free-tier logs csak
 *   1 órát őriz, így a tesztnek ÉS a logolásnak egy időben kell
 *   történnie).
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);

  // ── DIAGNOSTIC #2: TELJES user obj dump (user reported user.id is
  // undefined but user exists: true → property name confusion) ─────────
  // eslint-disable-next-line no-console
  console.log('[DIAG] user:', JSON.stringify(user));

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

  // A meglévő user lehet, hogy nem rendelkezik profiles sorral (a signup
  // trigger nem futott le). Először SELECT-et végzünk a user_id-vel, és
  // ha nincs, INSERT-et végzünk. Ez véd a PGRST116 (.single() 0 row) 500
  // hibától, és a meglévő userek menthetnek nevet.
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  let data: { id: string; display_name: string; avatar_url: string | null; bio: string | null; created_at: string; updated_at: string } | null = null;

  if (!existing) {
    // Nincs profiles sor — INSERT-et végzünk (a meglévő user-ek helyzete).
    const { data: inserted, error: insertErr } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
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
      .eq('id', user.id)
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
