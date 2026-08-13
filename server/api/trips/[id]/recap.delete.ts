import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database } from '~/types/db';

/**
 * DELETE /api/trips/:id/recap
 *
 * Owner-only hard delete. The order is deliberate:
 *
 *   1. SELECT the storage_path values for every photo row under this trip
 *      (RLS SELECT on trip_recap_photos is owner-or-public-or-friend, but
 *      the DELETE policy on the parent trip_recaps is owner-only — we can
 *      only reach this branch if we are owner, so the SELECT will succeed
 *      regardless of the RLS arm).
 *   2. Remove every storage object via `supabase.storage.from(...).remove()`.
 *      Errors here are non-fatal — the cascade DELETE in step 3 still removes
 *      the metadata rows, and the orphan blob is acceptable since storage
 *      policies prevent anyone else from reading it (the path prefix is
 *      auth.uid()-scoped).
 *   3. DELETE the trip_recaps row → cascade removes the trip_recap_photos
 *      metadata rows. RLS DELETE policy on trip_recaps is owner-only.
 *
 * Returns 204 on success.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Bejelentkezés szükséges' });
  }

  const tripId = getRouterParam(event, 'id');
  if (!tripId) {
    throw createError({ statusCode: 400, statusMessage: 'Hiányzó túra azonosító' });
  }

  const supabase = await serverSupabaseClient<Database>(event);

  // 1) Gather photo storage_paths so we can clean the bucket afterwards.
  const { data: photos, error: photosError } = await supabase
    .from('trip_recap_photos')
    .select('storage_path')
    .eq('trip_id', tripId);

  if (photosError) {
    throw createError({ statusCode: 500, statusMessage: photosError.message });
  }

  // 2) Best-effort storage cleanup. We swallow errors so a transient
  //    storage outage doesn't strand the metadata cleanup.
  const paths = (photos ?? []).map((p) => p.storage_path);
  if (paths.length > 0) {
    try {
      const { error: storageError } = await supabase.storage
        .from('trip-photos')
        .remove(paths);
      if (storageError) {
        // eslint-disable-next-line no-console
        console.warn('recap delete: storage cleanup partial', storageError.message);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('recap delete: storage cleanup threw', e);
    }
  }

  // 3) Cascade delete the recap row. RLS DELETE on trip_recaps is owner-only.
  const { error: deleteError } = await supabase
    .from('trip_recaps')
    .delete()
    .eq('trip_id', tripId);

  if (deleteError) {
    throw createError({
      statusCode: 404,
      statusMessage: 'A beszámoló nem található vagy nem a tiéd',
    });
  }

  setResponseStatus(event, 204);
  return null;
});