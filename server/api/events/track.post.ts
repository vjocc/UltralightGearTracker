import { serverSupabaseUser } from '#supabase/server';
import { getServiceRoleClient } from '~/server/utils/publicShareClient';
import { getUserId } from '~/server/utils/auth';
import { z } from 'zod';

/**
 * POST /api/events/track
 *
 * Sprint 5 P0.3 — Activation funnel capture endpoint (B opció: saját
 * events tábla). A kliens-oldali `useFunnelEvents` composable
 * POST-ol ide; a service-role client INSERT-eli a `funnel_events`
 * sorát (BYPASSRLS, mert NEM adunk INSERT policy-t authenticated
 * role-ra — lásd `supabase/migrations/20260816000001_funnel_events.sql`).
 *
 * Biztonság:
 *   * A service-role key SOHA nem kerül a kliens bundle-be (a
 *     `getServiceRoleClient` helper kizárólag /server alatt fut).
 *   * A user-JWT-t a `serverSupabaseUser` olvassa; ha nincs session,
 *     401.
 *   * Az event_name zod enum-validált (NEM free-form): a user nem
 *     tud új eseménytípust kitalálni / hamisítani.
 *   * A user_id-t a body-ban(opcionálisan) CSAK a saját auth.uid()-jével
 *     fogadjuk el — egy másik user_id payload 400. A user nem tud más
 *     nevében event-et küldeni.
 *   * Duplikált first_* event-ek elleni dupla guard:
 *       1) A szerver ellenőrzi, hogy az adott (user_id, event_name)
 *          már létezik-e a `funnel_events`-ban. Ha igen, 200 + no-op
 *          (idempotens).
 *       2) A kliens-oldali `useFunnelEvents` useState flag-gel
 *          szűri a felesleges hálózati round-trip-eket.
 *
 * Miért NEM REST API-t hívunk a Supabase-hoz közvetlenül a kliensről:
 *   * A service-role key-t a kliensben tárolni tilos (a kliens
 *     bundle-be belekerülne, és bárki a hálózatról kiolvashatná).
 *   * A Supabase anon key NEM BYPASSRLS — azzal a user csak
 *     `user_id = auth.uid()`-val írhat, ha adnánk INSERT policy-t
 *     (nem adunk, lásd migration).
 *   * Ez a szerver-oldali endpoint a híd: a user azonosítva van (a
 *     session-JWT), és a service-role INSERT-eli a sort az ő
 *     nevében.
 *
 * A 6 capture-helyhez (docs/sprint-5-p0-product-loop.md §4.5):
 *   1. signup_completed         — pages/signup.vue
 *   2. first_gear_added         — composables/useGear.ts create()
 *   3. first_trip_created       — composables/useTrips.ts create()
 *   4. first_loadout_assembled  — composables/useTrips.ts addGear()
 *   5. first_completed_trip     — composables/useTrips.ts markTripCompleted()
 *   6. first_debrief_written    — composables/useTrips.ts saveDebrief()
 */
const ALLOWED_EVENTS = [
  'signup_completed',
  'first_gear_added',
  'first_trip_created',
  'first_loadout_assembled',
  'first_completed_trip',
  'first_debrief_written',
] as const;

const trackEventSchema = z.object({
  event_name: z.enum(ALLOWED_EVENTS),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
  // Optional override; default to auth.uid(). A user_id payload-t CSAK
  // a saját auth.uid()-jével fogadjuk el (security check lentebb).
  user_id: z.string().uuid().optional(),
});

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Bejelentkezés szükséges',
    });
  }

  const body = await readBody(event);
  const parsed = trackEventSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Érvénytelen event payload',
      data: parsed.error.flatten(),
    });
  }

  const sessionUserId = getUserId(user);

  // Security: a body.user_id CSAK a saját session user_id-val egyezhet meg.
  // Így a user nem küldhet más user nevében event-et.
  if (parsed.data.user_id && parsed.data.user_id !== sessionUserId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A user_id nem egyezik a session user_id-val',
    });
  }

  const insertUserId = parsed.data.user_id ?? sessionUserId;

  // Dupla guard: ha az adott (user_id, event_name) már létezik,
  // nem írunk duplikált sort — idempotens visszatérés 200 + no-op.
  // (A `first_*` guard a kliens-oldali useState flag-gel együtt: a
  // useState flag a felesleges hálózati round-trip-et kerüli el, a
  // szerver-oldali ellenőrzés a védelmet adja.)
  const service = getServiceRoleClient();
  const { data: existing, error: existingError } = await service
    .from('funnel_events')
    .select('id')
    .eq('user_id', insertUserId)
    .eq('event_name', parsed.data.event_name)
    .limit(1);

  if (existingError) {
    throw createError({
      statusCode: 500,
      statusMessage: `Funnel event lookup failed: ${existingError.message}`,
    });
  }

  if (existing && existing.length > 0) {
    // Idempotens: a user már kiváltotta ezt az event-et, nem írunk
    // duplikátot. A 200-as válasz + `created: false` flag-gel a kliens
    // is tudja, hogy mi történt; a useState flag a kliensoldali
    // védelmet adja, ez a szerveroldali.
    return { ok: true, created: false, event_name: parsed.data.event_name };
  }

  const { error: insertError } = await service.from('funnel_events').insert({
    user_id: insertUserId,
    event_name: parsed.data.event_name,
    payload: parsed.data.payload ?? {},
  });

  if (insertError) {
    throw createError({
      statusCode: 500,
      statusMessage: `Funnel event insert failed: ${insertError.message}`,
    });
  }

  return { ok: true, created: true, event_name: parsed.data.event_name };
});
