import {
  serverSupabaseClient,
  serverSupabaseServiceRole,
  serverSupabaseUser,
} from '#supabase/server';
import type { Database } from '~/types/db';
import { tripGearUpdateSchema } from '~/server/utils/tripSchemas';
import { getUserId } from '~/server/utils/auth';

/**
 * PATCH /api/trips/:id/gear/:gearId
 * Updates either the `quantity` column or the `assigned_to_user_id`
 * column on a trip_gear row. The composite PK (trip_id, gear_item_id)
 * is the natural WHERE clause.
 *
 * RLS WITH CHECK on trip_gear_update_own re-validates the parent trip
 * ownership — a PATCH on a trip the caller doesn't own silently
 * affects 0 rows, which we surface as 404.
 *
 * Sprint 5 P2 — "Ki mit visz" (csoportos csomaglista-egyeztetés):
 *   * assigned_to_user_id (optional, uuid nullable). The P2 §11.1 A
 *     default: a mező NULL lehet, backfill nélkül. A PATCH endpoint
 *     a `assigned_to_user_id` user-t a trip résztvevőinek körére
 *     szűri (owner + accepted invitee). A check egy dedikált SELECT,
 *     ami a meglévő trips + trip_share_invites táblákat olvassa —
 *     a trip_visible_to() function-t a P2 NEM bővíti.
 */
export default defineEventHandler(async (event) => {
  const tripId = getRouterParam(event, 'id');
  const gearId = getRouterParam(event, 'gearId');
  if (!tripId || !gearId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing route params' });
  }

  const body = await readBody(event);
  const parsed = tripGearUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid trip_gear patch',
      data: parsed.error.flatten(),
    });
  }
  const patch = parsed.data as {
    quantity?: number;
    assigned_to_user_id?: string | null;
  };

  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' });
  }
  const callerId = getUserId(user);

  // P2 §3.2 — ha a patch `assigned_to_user_id`-t hoz, a megcélzott user
  // a trip résztvevőinek körében kell legyen (owner + accepted invitee).
  // A trips SELECT RLS owner-scoped → service-role kell a target-user
  // validációhoz (a trips táblából csak a saját sorát olvashatjuk, és
  // itt a TARGET user jogosultságát kell ellenőrizni, nem a caller-ét).
  // A trip_share_invites RLS az owner-t és a meghívott user-t is
  // engedi a saját sorára, de service-role olvasással egyszerűbb a
  // kétlépcsős check (meglévő P3 mintát követve).
  if (patch.assigned_to_user_id !== undefined) {
    const targetUserId = patch.assigned_to_user_id; // string | null
    if (targetUserId !== null) {
      // Null = törlés, nincs validáció (bárki törölheti a saját
      // trip-je során — owner-only RLS ezt eleve szűri).
      // Self-assignment short-circuit: ha a user önmagát jelöli meg és
      // ő a trip owner-e, engedélyezzük (egyébként is átjutna az owner
      // RLS-en, de így egy DB roundtripet megspórolunk).
      if (targetUserId !== callerId) {
        const service = serverSupabaseServiceRole<Database>(event);
        const { data: tripRow, error: tripErr } = await service
          .from('trips')
          .select('user_id')
          .eq('id', tripId)
          .maybeSingle();
        if (tripErr || !tripRow) {
          throw createError({
            statusCode: 404,
            statusMessage: 'Trip not found',
          });
        }
        const isOwner = tripRow.user_id === targetUserId;
        let isAcceptedInvitee = false;
        if (!isOwner) {
          const { data: inviteRow } = await service
            .from('trip_share_invites')
            .select('id')
            .eq('trip_id', tripId)
            .eq('invitee_user_id', targetUserId)
            .eq('status', 'accepted')
            .maybeSingle();
          isAcceptedInvitee = !!inviteRow;
        }
        if (!isOwner && !isAcceptedInvitee) {
          throw createError({
            statusCode: 400,
            statusMessage:
              'assigned_to_user_id must be the trip owner or an accepted invitee',
          });
        }
      }
    }
  }

  // A tényleges UPDATE — az RLS-en megy át (owner-only); service-role
  // itt nem kell, mert a trip_gear_update_own WITH CHECK ellenőrzi a
  // parent trip ownershipot. Ha a caller nem owner, 0 sor update-elve
  // → 404-et dobunk.
  const supabase = await serverSupabaseClient<Database>(event);
  // Csak a megadott mezőket updateeljük, hogy ne érintsünk más oszlopokat.
  const updatePayload: Record<string, unknown> = {};
  if (patch.quantity !== undefined) updatePayload.quantity = patch.quantity;
  if (patch.assigned_to_user_id !== undefined) {
    updatePayload.assigned_to_user_id = patch.assigned_to_user_id;
  }
  const { data, error } = await supabase
    .from('trip_gear')
    .update(updatePayload)
    .eq('trip_id', tripId)
    .eq('gear_item_id', gearId)
    .select()
    .single();

  if (error) {
    throw createError({ statusCode: 404, statusMessage: 'Trip_gear row not found or not owned' });
  }
  return data;
});
