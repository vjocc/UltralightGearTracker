import { serverSupabaseClient } from '#supabase/server';
import type { Database, TripRecapPhotoRow, TripRecapRow } from '~/types/db';

/**
 * GET /api/trips/:id/recap
 *
 * Returns `{ recap: TripRecapRow | null, photos: TripRecapPhotoRow[] }`.
 * Visibility is gated by RLS:
 *   * trip_recaps SELECT — owner OR `public = true` OR `trip_visible_to(trip_id)`
 *   * trip_recap_photos SELECT — visibility propagates through the parent recap.
 * The trip must exist at all — otherwise the caller has no visibility claim
 * and the inner .single() throws 404.
 *
 * Photos are decorated with `public_url` via
 * `supabase.storage.from('trip-photos').getPublicUrl(storage_path)`. The
 * bucket is public-read so no signed URL is needed; this also lets the
 * <img> tag in the page render without an extra round-trip.
 */
export default defineEventHandler(async (event) => {
  const tripId = getRouterParam(event, 'id');
  if (!tripId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing trip id' });
  }

  const supabase = await serverSupabaseClient<Database>(event);

  // The trip existence check uses the SELECT policy itself — if the caller
  // cannot see this trip, the .single() below throws and we surface 404.
  // We don't need a second explicit trips-SELECT round-trip.
  const { data: recap, error: recapError } = await supabase
    .from('trip_recaps')
    .select('*')
    .eq('trip_id', tripId)
    .maybeSingle();

  if (recapError) {
    throw createError({ statusCode: 500, statusMessage: recapError.message });
  }

  const { data: photos, error: photosError } = await supabase
    .from('trip_recap_photos')
    .select('*')
    .eq('trip_id', tripId)
    .order('display_order', { ascending: true });

  if (photosError) {
    throw createError({ statusCode: 500, statusMessage: photosError.message });
  }

  // Decorate each photo with its public storage URL so the page can
  // render `<img :src>` without computing the bucket URL itself.
  const decorated: TripRecapPhotoRow[] = (photos ?? []).map((p) => {
    const { data: pub } = supabase.storage
      .from('trip-photos')
      .getPublicUrl(p.storage_path);
    return { ...p, public_url: pub.publicUrl };
  });

  return {
    recap: (recap as TripRecapRow | null) ?? null,
    photos: decorated,
  };
});