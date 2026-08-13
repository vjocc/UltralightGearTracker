import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database } from '~/types/db';

/**
 * GET /api/trips/:id/map
 *
 * Returns an SVG path describing the trip's GPX track on a 200×100
 * viewBox. No map tiles, no Mercator projection — just min/max
 * normalisation of the (lat, lon) bounds so the path fits a small
 * mini-preview below the summary card (Architect memo §C, optional).
 *
 * The synthetic midpoint row (`is_summary = true`) is kept in the
 * sequence so the path is continuous from start to end. When there
 * are too few points to draw meaningfully (< 2) we return an empty
 * `d` and the UI simply doesn't render the SVG.
 *
 * Cross-user reads return 404 via the RLS policies.
 */
const VIEWBOX_WIDTH = 200;
const VIEWBOX_HEIGHT = 100;
const PADDING = 4;

interface TrackPointLite {
  seq: number;
  lat: number;
  lon: number;
  is_summary: boolean;
}

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

  // Verify the trip is visible (RLS gates this) and has metadata.
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id, gpx_metadata')
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

  const { data: pts, error: ptsError } = await supabase
    .from('gpx_track_points')
    .select('seq, lat, lon, is_summary')
    .eq('trip_id', tripId)
    .order('seq', { ascending: true });

  if (ptsError) {
    throw createError({
      statusCode: 500,
      statusMessage: ptsError.message,
    });
  }

  const points = (pts ?? []) as TrackPointLite[];
  if (points.length < 2) {
    return {
      width: VIEWBOX_WIDTH,
      height: VIEWBOX_HEIGHT,
      d: '',
      has_track: false,
    };
  }

  // Bounding box on raw (lat, lon). Latitude is mapped to Y (inverted so
  // north is up); longitude maps to X. Aspect-preserving scale keeps the
  // path inside the viewBox even for tall/narrow routes.
  let minLat = points[0]!.lat;
  let maxLat = points[0]!.lat;
  let minLon = points[0]!.lon;
  let maxLon = points[0]!.lon;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  const lonSpan = Math.max(maxLon - minLon, 1e-9);
  const latSpan = Math.max(maxLat - minLat, 1e-9);

  const innerW = VIEWBOX_WIDTH - PADDING * 2;
  const innerH = VIEWBOX_HEIGHT - PADDING * 2;
  const scaleX = innerW / lonSpan;
  const scaleY = innerH / latSpan;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (innerW - lonSpan * scale) / 2 + PADDING;
  const offsetY = (innerH - latSpan * scale) / 2 + PADDING;

  let d = '';
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]!;
    const x = offsetX + (p.lon - minLon) * scale;
    const y = offsetY + (maxLat - p.lat) * scale;
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
  }

  return {
    width: VIEWBOX_WIDTH,
    height: VIEWBOX_HEIGHT,
    d,
    has_track: true,
  };
});