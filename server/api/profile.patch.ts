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
 * DIAGNOSTIC LOGGING (Bugfix 2026-08-17 — session context debug):
 *   A user 500-as hibát jelentett a Profil-mentésnél: "new row violates
 *   row-level security policy for table 'profiles'". A policy-k
 *   (migrációban definiált) `auth.uid() = id` WITH CHECK-et alkalmaznak,
 *   DE a hiba oka valószínűleg az, hogy a request során `auth.uid()`
 *   NULL-t ad vissza (a request hitelesítés nélküli / anon kontextusban
 *   fut). Ezt a hipotézist ellenőrizzük INSTRUMENTÁLIS loggolással:
 *   a diagnostic SELECT auth.uid() lekérdezés UGYANAZZAL a supabase
 *   kliens fut, mint a tényleges INSERT/UPDATE. Ha NULL-t ad, a
 *   hiba tényleges oka: a client session nem propagálja a user JWT-t
 *   a request során.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Bejelentkezés szükséges',
    });
  }

  // eslint-disable-next-line no-console
  console.error('[profile.patch] session.getClaims result:', {
    user_id_from_claims: user.sub ?? user.id ?? null,
    user_id_top_level: (user as { id?: string }).id ?? null,
    user_email: user.email ?? null,
    claims_keys: Object.keys(user ?? {}),
    raw_claims_present: !!(user && typeof user === 'object'),
  });

  const body = await readBody(event);
  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: `Profile update validation failed: ${parsed.error.message}`,
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);

  // ── DIAGNOSTIC #1+2: auth.uid() & Request JWT a request kontextusában ─
  // UGYANAZ a supabase kliens, mint ami a tényleges INSERT/UPDATE-et
  // fogja futtatni. Ha NULL, a user JWT NEM propagálódik a request során,
  // és az RLS policy (auth.uid() = id) önmagában NEM teljesül.
  //
  // POSTGRES oldalról: a current_setting('request.jwt.claims', true)
  // visszaadja a PostgREST request JWT claimjeit — DE ez NEM elérhető
  // REST API-n át, mert a `current_setting('request.jwt.claims', true)`
  // nem engedélyezett a public API-n. A PostgREST a `getClaims()`
  // endpoint-ot (és a `serverSupabaseUser` composable-t) használja.
  //
  // Mivel a `select auth.uid()` PostgREST-ből a Supabase REST API-n
  // nem elérhető, a getClaims() response-ből olvassuk ki az user_id-t.
  // Ez a kulcsfontosságú diagnosztika — ha a `user.sub` (vagy `user.id`)
  // itt NULL, de a `parseCookieHeader` tartalmaz cookie-t, akkor a
  // session-cookie ÉL, DE a `serverSupabaseUser` nem olvassa ki.
  // eslint-disable-next-line no-console
  console.error('[profile.patch] DIAGNOSTIC #1: serverSupabaseUser (getClaims) result — user_id_from_sub:', {
    user_sub: (user as { sub?: string }).sub ?? null,
    user_id_top_level: (user as { id?: string }).id ?? null,
    user_email: (user as { email?: string }).email ?? null,
    user_role: (user as { role?: string }).role ?? null,
    user_aud: (user as { aud?: string }).aud ?? null,
    claims_keys: Object.keys(user ?? {}),
    raw_claims_present: !!(user && typeof user === 'object'),
  });

  // ── DIAGNOSTIC #1b: a tényleges INSERT user-context-je ───────────────
  // Az INSERT meghívás ugyanazzal a supabase klienssel történik. A
  // user_id a session-ből jön. Ha a request cookie-ból a Supabase user
  // access token-t nem olvassa ki a SSR client, akkor a user.id-nek
  // NEM szabadna egyeznie a sessions.getClaims outputjával — DE mivel
  // a `user.id` SERVER-SIDE a Supabase-ból jön, ez mindig a user
  // UUID-t adja. A hiba oka tehát a **client request context**:
  // amikor a `from('profiles').insert(...)` a request során fut, a
  // postgrest dispatcher látható auth.uid()-je NULL.

  // A meglévő user lehet, hogy nem rendelkezik profiles sorral (a signup
  // trigger nem futott le). Először SELECT-et végzünk a user_id-vel, és
  // ha nincs, INSERT-et végzünk. Ez véd a PGRST116 (.single() 0 row) 500
  // hibától, és a meglévő userek menthetnek nevet.
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  // eslint-disable-next-line no-console
  console.error('[profile.patch] existing profile check:', {
    existing_id: existing?.id ?? null,
    existing_was_null: existing === null,
    session_user_id: user.sub ?? user.id ?? null,
    eq_id_used: user.id,
  });

  let data: { id: string; display_name: string; avatar_url: string | null; bio: string | null; created_at: string; updated_at: string } | null = null;

  if (!existing) {
    // eslint-disable-next-line no-console
    console.error('[profile.patch] INSERT branch entered (no existing row). Attempting insert with:', {
      id_being_inserted: user.id,
      display_name: parsed.data.display_name,
    });
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
    // eslint-disable-next-line no-console
    console.error('[profile.patch] INSERT result:', {
      insert_error_message: insertErr?.message ?? null,
      insert_error_code: insertErr?.code ?? null,
      inserted_id: inserted?.id ?? null,
    });
    if (insertErr || !inserted) {
      throw createError({
        statusCode: 500,
        statusMessage: `Profile insert failed: ${insertErr?.message ?? 'no data'}`,
      });
    }
    data = inserted;
  } else {
    // eslint-disable-next-line no-console
    console.error('[profile.patch] UPDATE branch entered (existing row found). Attempting update with:', {
      id_being_updated: existing.id,
      new_display_name: parsed.data.display_name,
    });
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
    // eslint-disable-next-line no-console
    console.error('[profile.patch] UPDATE result:', {
      update_error_message: updateErr?.message ?? null,
      update_error_code: updateErr?.code ?? null,
      updated_id: updated?.id ?? null,
    });
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
