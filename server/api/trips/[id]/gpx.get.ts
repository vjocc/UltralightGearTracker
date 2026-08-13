import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database } from '~/types/db';

/**
 * GET /api/trips/:id/gpx
 *
 * Returns the trip's GPX metadata blob plus the stored trackpoints
 * (already capped at ≤ 401 rows by the server-side parser).
 *
 * Cross-user reads return 404 via the RLS policies on trips +
 * gpx_track_points. The endpoint does not 404 when metadata is null
 * (a trip with no GPX upload yet is a valid first-paint state); the
 * UI checks `metadata !== null` before rendering the summary card.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Bejelentkezés szükséges',
    });
  }

  const tripId = getRouterParam(event, 'id');
  if (!tripId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Hiányzó túra azonosító',
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id, gpx_metadata, target_date, planned_distance_km, planned_elevation_gain_m')
    .eq('id', tripId)
    .maybeSingle();

  if (tripError) {
    throw createError({
      statusCode: 500,
      statusMessage: tripError.message,
    });
  }

  if (!trip) {
    throw createError({
      statusCode: 404,
      statusMessage: 'A túra nem található vagy nem a tiéd.',
    });
  }

  // Trackpoints are only meaningful once metadata is set; skip the SELECT
  // for trips without a GPX upload to keep the empty-trip first paint cheap.
  let trackpoints: Array<{
    id: string;
    trip_id: string;
    seq: number;
    lat: number;
    lon: number;
    elevation_m: number | null;
    recorded_at: string | null;
    is_summary: boolean;
  }> = [];

  if (trip.gpx_metadata) {
    const { data: pts, error: ptsError } = await supabase
      .from('gpx_track_points')
      .select('id, trip_id, seq, lat, lon, elevation_m, recorded_at, is_summary')
      .eq('trip_id', tripId)
      .order('seq', { ascending: true });

    if (ptsError) {
      throw createError({
        statusCode: 500,
        statusMessage: ptsError.message,
      });
    }
    trackpoints = pts ?? [];
  }

  return {
    metadata: trip.gpx_metadata,
    target_date: trip.target_date,
    planned_distance_km: trip.planned_distance_km,
    planned_elevation_gain_m: trip.planned_elevation_gain_m,
    trackpoints,
  };
});