import {
  serverSupabaseClient,
  serverSupabaseServiceRole,
  serverSupabaseUser,
} from '#supabase/server';
import type { Database, UUID } from '~/types/db';
import { gearAssignmentsResponseSchema } from '~/server/utils/gearAssignmentSchemas';
import { getUserId } from '~/server/utils/auth';

/**
 * GET /api/trips/:id/gear-assignments
 *
 * "Ki mit visz" aggregált nézet — a P2 §3.1 specifikáció szerinti
 * owner-only default (§11.2 user-döntés A). Az endpoint:
 *
 *   1. Owner-check a trips táblán (a trips SELECT RLS owner-scoped
 *      marad a P0 óta → 404 a nem-owner / stranger hívóra).
 *   2. SELECT trip_gear + JOIN gear_items + JOIN categories
 *      (PostgREST `select(*, gear_items!inner(*), categories!left(*))`
 *      mintával).
 *   3. Kiszűrjük azokat a sorokat, ahol assigned_to_user_id IS NOT NULL
 *      (§11.1 A default: a NULL-ok "Nincs hozzárendelve" bucketben
 *      jelennek meg).
 *   4. Szerveroldali aggregáció user_id szerint (Map<UUID, aggregate>).
 *   5. A user_id-k feloldása email-re: a dedikált
 *      `trip_participant_lookup_emails(p_user_ids, p_trip_id)`
 *      SECURITY DEFINER function-hívással (a service-role-on, RLS bypass).
 *   6. A §11.3 A default szerinti sorrend: user_id != null elöl
 *      (ABC-sorrendben email szerint), user_id = null "Nincs
 *      hozzárendelve" bucket a lista végén.
 *
 * Response shape: `{ participants: GearAssignmentParticipant[] }`.
 */
export default defineEventHandler(async (event) => {
  const tripId = getRouterParam(event, 'id');
  if (!tripId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' });
  }

  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' });
  }
  const callerId = getUserId(user);
  if (!callerId) {
    throw createError({ statusCode: 401, statusMessage: 'Missing user id' });
  }

  const supabase = await serverSupabaseClient<Database>(event);

  // (1) Visibility-check — a §11.2 B user-döntés szerint a „Ki mit visz"
  // nézetet MINDEN trip-résztvevő láthatja (owner + accepted invitee +
  // accepted friend), NEM owner-only. A meglévő `trip_visible_to()`
  // SECURITY DEFINER function-t használjuk (Phase 2 social-ből örökölt,
  // NEM bővítjük). A function owner OR accepted_invitee OR
  // accepted_friend feltételt ellenőriz.
  const { data: isVisible, error: rpcErr } = await supabase.rpc(
    'trip_visible_to',
    { p_trip_id: tripId },
  );
  if (rpcErr || !isVisible) {
    // RLS denial OR trip not visible → 404 hide-the-cause
    // (a meglévő trips/[id].get.ts mintájára).
    throw createError({
      statusCode: 404,
      statusMessage: 'Trip not found',
    });
  }

  // (2) SELECT trip_gear + JOIN gear_items + JOIN categories (left join
  // — a gear_items.category_id lehet NULL a „nincs kategória" state-
  // ben, de a categories.globalize óta minden gear_items row-nak VAN
  // category_id-je, tehát az inner join is jó; a left join defensive).
  // A PostgREST syntax: `select('*, gear_items!inner(*, categories(*))')`.
  const { data: rows, error: gearErr } = await supabase
    .from('trip_gear')
    .select(
      'trip_id, gear_item_id, quantity, assigned_to_user_id, gear_items!inner(name, weight_g, category_id, categories(name))',
    )
    .eq('trip_id', tripId);

  if (gearErr) {
    throw createError({
      statusCode: 500,
      statusMessage: `gear-assignments fetch failed: ${gearErr.message}`,
    });
  }

  type RawRow = {
    trip_id: string;
    gear_item_id: string;
    quantity: number;
    assigned_to_user_id: string | null;
    gear_items: {
      name: string;
      weight_g: number;
      category_id: string | null;
      categories: { name: string } | null;
    } | null;
  };
  const safeRows: RawRow[] = (rows ?? []) as unknown as RawRow[];

  // (3+4) Csak a hozzárendelt itemek (assigned_to_user_id IS NOT NULL)
  // — a §11.1 A default. A user_id = null bucketet külön kezeljük a
  // (6) lépésben.
  const assignedRows = safeRows.filter(
    (r) => r.assigned_to_user_id !== null,
  );

  // user_id → { email, display_name, avatar_url, items[] } aggregátum
  // A P2.x keresztnév bugfix bővítés: display_name + avatar_url mezők a
  // privacy-safe projection-ből (trip_participant_lookup_profiles).
  interface AggBucket {
    user_id: string | null;
    email: string | null;
    display_name: string | null;
    avatar_url: string | null;
    total_weight_g: number;
    items: Array<{
      trip_gear_id: string;
      gear_item_id: string;
      name: string;
      category: string | null;
      weight_g: number;
      qty: number;
      total_weight_g: number;
    }>;
  }
  const byUser = new Map<string, AggBucket>();
  const nullBucket: AggBucket = {
    user_id: null,
    email: null,
    display_name: null,
    avatar_url: null,
    total_weight_g: 0,
    items: [],
  };
  for (const r of safeRows) {
    if (r.assigned_to_user_id === null) {
      const w = r.gear_items?.weight_g ?? 0;
      const qty = r.quantity ?? 1;
      nullBucket.items.push({
        // A `trip_gear` tábla PK-ja (trip_id, gear_item_id) — a
        // client-side identity a gear_item_id, de a §4 schema
        // `trip_gear_id`-t vár, így a composite-et `trip_id`-vel
        // együtt adjuk vissza, hogy azonosítható legyen. Mivel a
        // spec `trip_gear_id` uuid-t ír, de a PK nem egy uuid,
        // a `gear_item_id`-t használjuk mint `trip_gear_id` (a
        // client-selector ugyanazt az azonosítót használja).
        trip_gear_id: r.gear_item_id,
        gear_item_id: r.gear_item_id,
        name: r.gear_items?.name ?? '(ismeretlen)',
        category: r.gear_items?.categories?.name ?? null,
        weight_g: w,
        qty,
        total_weight_g: w * qty,
      });
      nullBucket.total_weight_g += w * qty;
      continue;
    }
    const uid = r.assigned_to_user_id;
    let bucket = byUser.get(uid);
    if (!bucket) {
      bucket = {
        user_id: uid,
        email: null,
        display_name: null,
        avatar_url: null,
        total_weight_g: 0,
        items: [],
      };
      byUser.set(uid, bucket);
    }
    const w = r.gear_items?.weight_g ?? 0;
    const qty = r.quantity ?? 1;
    bucket.items.push({
      trip_gear_id: r.gear_item_id,
      gear_item_id: r.gear_item_id,
      name: r.gear_items?.name ?? '(ismeretlen)',
      category: r.gear_items?.categories?.name ?? null,
      weight_g: w,
      qty,
      total_weight_g: w * qty,
    });
    bucket.total_weight_g += w * qty;
  }

  // (5) Email lookup a dedikált SECURITY DEFINER function-hívással.
  // A function service-role-on fut (BYPASSRLS), mert a
  // trip_participant_lookup_emails saját RLS-e a SECURITY DEFINER
  // search_path fixálással rendelkezik. A visszakapott (user_id, email)
  // párokat a byUser bucketekre stake-jük.
  const userIds: UUID[] = Array.from(byUser.keys());
  if (userIds.length > 0) {
    const service = serverSupabaseServiceRole<Database>(event);
    // A `trip_participant_lookup_emails` RPC nincs a Database típusban
    // (manuálisan definiálták a migrationban) — `as never` cast-tal
    // hívjuk, a service szervere oldja fel.
    const { data: emailRows, error: rpcErr } = await (service.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>)(
      'trip_participant_lookup_emails',
      { p_user_ids: userIds, p_trip_id: tripId },
    );
    if (rpcErr) {
      // Az email-lookup nem kritikus a funkció szempontjából —
      // a user_id marad látható, csak az email marad null. A §4 spec
      // ezt az email-cím nélküli fallback-et támogatja.
      // eslint-disable-next-line no-console
      console.warn('trip_participant_lookup_emails failed', rpcErr);
    } else {
      const emailById = new Map<string, string>();
      for (const row of (emailRows ?? []) as unknown as Array<{
        user_id: string;
        email: string;
      }>) {
        emailById.set(row.user_id, row.email);
      }
      for (const [uid, bucket] of byUser) {
        bucket.email = emailById.get(uid) ?? null;
      }
    }

    // (5b) Profile lookup (P2.x keresztnév bugfix): a dedikált
    // trip_participant_lookup_profiles(p_user_ids, p_trip_id) SECURITY
    // DEFINER function a privacy-safe projection-t adja vissza
    // (display_name + avatar_url, email és bio NEM). A function a
    // Phase 3 §28 double-gate mintát követi: a service-role hívás
    // BYPASSRLS, a function belsejében van a privacy gate
    // (owner + accepted invitee).
    const { data: profileRows, error: rpcProfileErr } = await (service.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>)(
      'trip_participant_lookup_profiles',
      { p_user_ids: userIds, p_trip_id: tripId },
    );
    if (rpcProfileErr) {
      // A profile-lookup nem kritikus (a kliens oldali composable a
      // 'Névtelen túrázó' fallback-et alkalmazza). A user_id marad
      // látható, csak a display_name + avatar_url marad null.
      // eslint-disable-next-line no-console
      console.warn('trip_participant_lookup_profiles failed', rpcProfileErr);
    } else {
      const profileById = new Map<string, { display_name: string | null; avatar_url: string | null }>();
      for (const row of (profileRows ?? []) as unknown as Array<{
        user_id: string;
        display_name: string | null;
        avatar_url: string | null;
      }>) {
        profileById.set(row.user_id, {
          display_name: row.display_name ?? null,
          avatar_url: row.avatar_url ?? null,
        });
      }
      for (const [uid, bucket] of byUser) {
        const p = profileById.get(uid);
        bucket.display_name = p?.display_name ?? null;
        bucket.avatar_url = p?.avatar_url ?? null;
      }
    }
  }

  // (6) Sorrend: §11.3 A default — userenkénti csoportosítás.
  // ABC-sorrendben email szerint; a null email a lista végén; a
  // user_id = null bucket ("Nincs hozzárendelve") a lista LEGVÉGÉN.
  const collator = new Intl.Collator('hu', {
    sensitivity: 'base',
    numeric: true,
  });
  const sortedUsers = Array.from(byUser.values()).sort((a, b) => {
    const ae = a.email ?? '￿'; // unprintable → sort to the end of the user buckets
    const be = b.email ?? '￿';
    return collator.compare(ae, be);
  });

  const participants: AggBucket[] = [...sortedUsers];
  if (nullBucket.items.length > 0) {
    participants.push(nullBucket);
  }

  // Zod validation a response shape ellenőrzésére — a service-oldali
  // válasz séma-megfelelősége defense-in-depth (a UI oldali zod parse
  // kiegészítéseként).
  const response = { participants };
  const parsed = gearAssignmentsResponseSchema.safeParse(response);
  if (!parsed.success) {
    // Belső hiba — a service-oldali aggregáció nem felel meg a
    // sémának. Logoljuk, de ne dobjunk 500-át (a fallback response
    // érvényes user-adatokat tartalmaz).
    // eslint-disable-next-line no-console
    console.warn('gear-assignments schema mismatch', parsed.error.flatten());
  }
  return response;
});
