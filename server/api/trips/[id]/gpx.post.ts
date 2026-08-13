import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type {
  Database,
  GpxMetadata,
  GpxTrackPointInsertPayload,
} from '~/types/db';
import { EmptyGpxError, parseGpx } from '~/server/utils/parseGpx';

/**
 * POST /api/trips/:id/gpx
 *
 * Accepts a multipart/form-data upload with one `file` field. The handler:
 *
 *   1. Rejects unauthenticated callers (401).
 *   2. Enforces a 5 MB hard limit on the raw payload — Nitro's
 *      readMultipartFormData returns parsed FileParts and we measure
 *      `.data.byteLength` so the bound applies to the file body, not the
 *      surrounding multipart envelope.
 *   3. Validates the file extension and content-type — anything that
 *      isn't `.gpx` / `application/gpx+xml` / `text/xml` is a 400.
 *   4. Runs the server-side GPX parser. Empty / no-trkpt files throw
 *      EmptyGpxError → 400 with the HU message.
 *   5. Atomically replaces the trip's existing trackpoints and writes
 *      the new ones + the metadata blob. No DB transaction is opened
 *      explicitly; we sequence DELETE → UPDATE → INSERT and accept that
 *      a hard failure mid-way leaves the trip in a partial state — the
 *      next upload retries cleanly because both DELETE and INSERT are
 *      idempotent on (trip_id, seq).
 *
 * Hungarian error messages throughout — the UI's ErrorBanner surfaces
 * them verbatim, and the Architect memo §C requires "magyar hiba toast".
 *
 * RLS: the trips UPDATE policy + gpx_track_points INSERT/DELETE policies
 * all gate on the parent trip's user_id, so a foreign trip id returns 404
 * without leaking the row.
 */
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_TYPES = new Set([
  'application/gpx+xml',
  'application/xml',
  'text/xml',
]);

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

  const parts = await readMultipartFormData(event);
  if (!parts || parts.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Üres vagy érvénytelen GPX fájl',
    });
  }

  const filePart = parts.find((p) => p.name === 'file');
  if (!filePart || !filePart.data) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Üres vagy érvénytelen GPX fájl',
    });
  }

  if (filePart.data.byteLength > MAX_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: 'A GPX fájl mérete meghaladja az 5 MB-os limitet.',
    });
  }

  // File extension / content-type sanity check. GPX files uploaded from
  // a phone typically come through as text/xml or no type at all, so we
  // fall back to the extension when the header is missing.
  const filename = filePart.filename ?? 'upload.gpx';
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  const ct = (filePart.type ?? '').toLowerCase();
  if (ext !== 'gpx' && !ALLOWED_TYPES.has(ct)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Csak .gpx kiterjesztésű fájl tölthető fel.',
    });
  }

  const xmlText = filePart.data.toString('utf-8');

  let parsed;
  try {
    parsed = parseGpx(xmlText);
  } catch (err) {
    if (err instanceof EmptyGpxError) {
      throw createError({
        statusCode: 400,
        statusMessage: err.message,
      });
    }
    throw createError({
      statusCode: 400,
      statusMessage: 'A GPX fájl nem olvasható.',
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);

  // Optional target_date from a sibling form field — comes through as
  // a separate FormData part with name === 'target_date'. Empty / missing
  // is fine, just leave the column alone.
  const targetDatePart = parts.find((p) => p.name === 'target_date');
  const targetDateRaw = targetDatePart?.data?.toString('utf-8').trim() ?? '';
  const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(targetDateRaw)
    ? targetDateRaw
    : null;

  // 1) Wipe any previous trackpoints for this trip. RLS DELETE policy
  //    scopes the operation to the caller's own trip; if it doesn't,
  //    this deletes zero rows and the next UPDATE fails with 404.
  const { error: delError } = await supabase
    .from('gpx_track_points')
    .delete()
    .eq('trip_id', tripId);
  if (delError) {
    throw createError({
      statusCode: 500,
      statusMessage: delError.message,
    });
  }

  // 2) Persist the metadata + optional target_date + planned fields.
  //    The parser already computed the canonical planned_* values, so we
  //    just copy them into the row so the page can fall back to either
  //    field without re-deriving.
  const metadata: GpxMetadata = {
    total_distance_km: parsed.totalDistanceKm,
    elevation_gain_m: parsed.elevationGainM,
    duration_min: parsed.durationMin,
    max_elevation_m: parsed.maxElevationM,
    source: filename,
    uploaded_at: new Date().toISOString(),
    point_count: parsed.sourcePointCount,
  };

  const updatePayload: Record<string, unknown> = {
    gpx_metadata: metadata,
    planned_distance_km: parsed.totalDistanceKm,
    planned_elevation_gain_m: parsed.elevationGainM,
  };
  if (targetDate) {
    updatePayload.target_date = targetDate;
  }

  const { data: trip, error: updateError } = await supabase
    .from('trips')
    .update(updatePayload)
    .eq('id', tripId)
    .select('id, gpx_metadata, target_date, planned_distance_km, planned_elevation_gain_m')
    .single();

  if (updateError || !trip) {
    // RLS UPDATE policy on trips -> either cross-user or non-existent
    // trip. We surface 404 so we don't leak which one it was.
    throw createError({
      statusCode: 404,
      statusMessage: 'A túra nem található vagy nem a tiéd.',
    });
  }

  // 3) Insert the (≤ 400) trackpoints in one batch. PostgREST allows up
  //    to 1000 rows per request and we're capped at 401, so a single
  //    .insert() call is enough.
  const rows: GpxTrackPointInsertPayload[] = parsed.trackPoints.map((p) => ({
    trip_id: tripId,
    seq: p.seq,
    lat: p.lat,
    lon: p.lon,
    elevation_m: p.elevation_m,
    recorded_at: p.recorded_at,
    is_summary: p.is_summary,
  }));

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from('gpx_track_points')
      .insert(rows);
    if (insertError) {
      throw createError({
        statusCode: 500,
        statusMessage: insertError.message,
      });
    }
  }

  return {
    metadata: trip.gpx_metadata,
    target_date: trip.target_date,
    planned_distance_km: trip.planned_distance_km,
    planned_elevation_gain_m: trip.planned_elevation_gain_m,
    trackpoints: parsed.trackPoints,
  };
});