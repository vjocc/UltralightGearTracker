import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database, TripRecapPhotoRow } from '~/types/db';
import { photoPatchSchema } from '~/server/utils/recapSchemas';

/**
 * PATCH /api/trips/:id/recap/photos/:photoId
 *
 * Owner-only. Updates caption + display_order on a single photo row.
 * Storage objects are immutable — caption/reorder edits never touch the
 * bucket, just the metadata. The caller-context client is sufficient:
 * the `trip_recap_photos_update_owner` policy (migration
 * 20260813150000_fix_trip_recap_photo_update.sql) gates UPDATE on trip
 * ownership. We still do an explicit owner check at the top so a
 * non-owner gets a clean 404 before the RLS round-trip.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Bejelentkezés szükséges' });
  }

  const tripId = getRouterParam(event, 'id');
  const photoId = getRouterParam(event, 'photoId');
  if (!tripId || !photoId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Hiányzó túra vagy fotó azonosító',
    });
  }

  const body = await readBody(event);
  const parsed = photoPatchSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Érvénytelen fotó patch payload',
      data: parsed.error.flatten(),
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);

  // Owner check via the parent trip — mirrors the SELECT policy on
  // trip_recap_photos (which is owner-or-visible, not owner-only).
  const { data: tripRow, error: tripErr } = await supabase
    .from('trips')
    .select('user_id')
    .eq('id', tripId)
    .maybeSingle();
  if (tripErr) {
    throw createError({ statusCode: 500, statusMessage: tripErr.message });
  }
  if (!tripRow) {
    throw createError({
      statusCode: 404,
      statusMessage: 'A túra nem található',
    });
  }
  const callerId = (user as { sub?: string; id?: string }).sub
    ?? (user as { id?: string }).id
    ?? '';
  if (tripRow.user_id !== callerId) {
    throw createError({
      statusCode: 404,
      statusMessage: 'A fotó nem található vagy nem a tiéd',
    });
  }

  const updatePayload: Record<string, unknown> = {};
  if (parsed.data.caption !== undefined) {
    updatePayload.caption = parsed.data.caption;
  }
  if (parsed.data.display_order !== undefined) {
    updatePayload.display_order = parsed.data.display_order;
  }

  const { data, error } = await supabase
    .from('trip_recap_photos')
    .update(updatePayload)
    .eq('id', photoId)
    .eq('trip_id', tripId)
    .select()
    .single();

  if (error || !data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'A fotó frissítése sikertelen',
    });
  }

  return data as TripRecapPhotoRow;
});