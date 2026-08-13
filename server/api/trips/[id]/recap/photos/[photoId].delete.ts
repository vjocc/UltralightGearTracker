import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database } from '~/types/db';

/**
 * DELETE /api/trips/:id/recap/photos/:photoId
 *
 * Owner-only. Removes both the trip_recap_photos row AND the underlying
 * storage object so the bucket doesn't leak orphan blobs.
 *
 *   1. SELECT the storage_path so we know what to remove from storage.
 *      (RLS SELECT on trip_recap_photos is owner-or-public-or-friend, but
 *      this endpoint is owner-only — the DELETE policy is the gate.)
 *   2. Storage `remove()` — best-effort. If the object is already gone
 *      (e.g. concurrent delete), Supabase returns an error which we
 *      tolerate; the metadata cleanup still happens.
 *   3. DB DELETE on the metadata row.
 *
 * 404 if the row doesn't exist OR the caller isn't the owner.
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

  const supabase = await serverSupabaseClient<Database>(event);

  const { data: row, error: fetchError } = await supabase
    .from('trip_recap_photos')
    .select('storage_path')
    .eq('id', photoId)
    .eq('trip_id', tripId)
    .maybeSingle();

  if (fetchError) {
    throw createError({ statusCode: 500, statusMessage: fetchError.message });
  }
  if (!row) {
    throw createError({
      statusCode: 404,
      statusMessage: 'A fotó nem található vagy nem a tiéd',
    });
  }

  // Storage cleanup first — if it fails we still want the metadata gone.
  try {
    await supabase.storage.from('trip-photos').remove([row.storage_path]);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('photo delete: storage remove threw', e);
  }

  const { error: deleteError } = await supabase
    .from('trip_recap_photos')
    .delete()
    .eq('id', photoId)
    .eq('trip_id', tripId);

  if (deleteError) {
    throw createError({
      statusCode: 404,
      statusMessage: 'A fotó törlése sikertelen',
    });
  }

  setResponseStatus(event, 204);
  return null;
});