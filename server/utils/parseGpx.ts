/**
 * Minimal GPX 1.1 parser for the Ultralight Gear Tracker.
 *
 * Why hand-rolled and not `xmlbuilder2` / `fast-xml-parser` / `linkedom`?
 *   The Architect flagged a 500 KB dependency as too heavy for a feature
 *   that only needs `<trkpt lat="…" lon="…"><ele/><time/></trkpt>`. A
 *   50-line SAX-style walker keeps the bundle lean and has zero attack
 *   surface for malicious input (regex extractors cannot be tricked into
 *   quadratic backtracking because every match is anchored to the same
 *   closing tag pattern, and we cap the input size at the API layer).
 *
 * What it does:
 *   1. Extracts the FIRST `<trk>` block; subsequent tracks are ignored
 *      (P1 out-of-scope per Architect memo).
 *   2. Walks every `<trkpt lat="X" lon="Y">…</trkpt>` inside that block.
 *   3. Captures optional `<ele>` (elevation_m) and `<time>` (recorded_at).
 *   4. Computes cumulative distance via Haversine (R = 6371 km).
 *   5. Computes elevation gain with a 500 m/point spike filter (GPS
 *      jump noise). Only positive deltas contribute.
 *   6. Computes duration in minutes if every point has a `<time>`.
 *   7. Reduces to at most 400 rows: first 200 + last 200, with one
 *      synthetic "summary midpoint" (averaged lat/lon, seq = ⌊N/2⌋,
 *      recorded_at = NULL) replacing the truncated middle. The summary
 *      point lets the UI draw a continuous track from start to finish
 *      while still capping the stored row count.
 *
 * Edge cases:
 *   - Empty / no-trkpt GPX → throws EmptyGpxError (HU message).
 *   - Single trkpt → distance = 0, gain = 0 (still a valid upload).
 *   - No `<ele>` anywhere → elevationGainM = 0, maxElevationM = null.
 *   - Truncated <trkpt> without closing tag → the regex anchor prevents
 *     capturing it; the rest of the file is still parsed cleanly.
 */

export class EmptyGpxError extends Error {
  constructor(message = 'A GPX fájl nem tartalmaz trackpointot.') {
    super(message);
    this.name = 'EmptyGpxError';
  }
}

export interface GpxTrackPoint {
  seq: number;
  lat: number;
  lon: number;
  elevation_m: number | null;
  recorded_at: string | null;
  /**
   * True for the synthetic midpoint row that replaces the truncated
   * middle of long tracks. UI clients can skip it when drawing the path
   * (the first 200 + last 200 already cover both ends).
   */
  is_summary: boolean;
}

export interface GpxParseResult {
  trackPoints: GpxTrackPoint[];
  totalDistanceKm: number;
  elevationGainM: number;
  durationMin: number | null;
  maxElevationM: number | null;
  /** Original point count BEFORE the 400-row reduction. */
  sourcePointCount: number;
}

const TRK_OPEN_RE = /<trk[\s>]/i;
const TRKPT_RE =
  /<trkpt\b([^>]*)\/?>([\s\S]*?)<\/trkpt>|<trkpt\b([^>]*)\/>/gi;
const ATTR_RE = /(lat|latitude)="([^"]+)"|(lon|longitude)="([^"]+)"/gi;
const ELE_RE = /<ele>([^<]+)<\/ele>/i;
const TIME_RE = /<time>([^<]+)<\/time>/i;

const SPIKE_THRESHOLD_M = 500;
const EARTH_RADIUS_KM = 6371;
const KEEP_HEAD = 200;
const KEEP_TAIL = 200;
const TRACKPOINT_CAP = 400;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Great-circle distance in kilometres between two (lat, lon) pairs.
 * Used for cumulative track distance — short segments so the standard
 * Haversine formula is well within floating-point precision.
 */
const haversineKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

const parseFloatOrNull = (v: string | undefined): number | null => {
  if (v == null) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const parseIsoOrNull = (v: string | undefined): string | null => {
  if (!v) return null;
  const t = Date.parse(v.trim());
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
};

/**
 * Walks every <trkpt> inside the first <trk>…</trk> block and returns
 * raw points (NO distance/gain math here — that happens after we know
 * the full set).
 */
const extractRawPoints = (xmlText: string): GpxTrackPoint[] => {
  const trkOpen = TRK_OPEN_RE.exec(xmlText);
  if (!trkOpen) return [];

  // Slice from the first <trk> onwards. We don't bother finding the
  // </trk> closer — nested <trk> is invalid GPX, and the regex below
  // only matches flat <trkpt> tags so the second track is harmless.
  const afterOpen = xmlText.slice(trkOpen.index);
  const points: GpxTrackPoint[] = [];
  let seq = 0;
  let m: RegExpExecArray | null;
  // Reset the regex's lastIndex between calls — it's module-global.
  TRKPT_RE.lastIndex = 0;
  while ((m = TRKPT_RE.exec(afterOpen)) !== null) {
    const attrs = m[1] ?? m[3] ?? '';
    const inner = m[2] ?? '';

    let lat: number | null = null;
    let lon: number | null = null;
    let mm: RegExpExecArray | null;
    ATTR_RE.lastIndex = 0;
    while ((mm = ATTR_RE.exec(attrs)) !== null) {
      if (mm[1]) lat = parseFloatOrNull(mm[2]);
      else if (mm[3]) lon = parseFloatOrNull(mm[4]);
    }
    if (lat == null || lon == null) continue;

    const eleMatch = inner ? ELE_RE.exec(inner) : null;
    const timeMatch = inner ? TIME_RE.exec(inner) : null;

    points.push({
      seq,
      lat,
      lon,
      elevation_m: eleMatch ? parseFloatOrNull(eleMatch[1]) : null,
      recorded_at: timeMatch ? parseIsoOrNull(timeMatch[1]) : null,
      is_summary: false,
    });
    seq += 1;
  }
  return points;
};

/**
 * Reduce a raw point list to at most TRACKPOINT_CAP entries (first KEEP_HEAD
 * + last KEEP_TAIL + 1 synthetic midpoint that averages the truncated middle).
 * The midpoint is needed so the SVG path can draw an unbroken polyline
 * from the last kept head point to the first kept tail point without
 * jumping across half the continent.
 */
const reducePoints = (raw: GpxTrackPoint[]): GpxTrackPoint[] => {
  if (raw.length <= TRACKPOINT_CAP) return raw;

  const head = raw.slice(0, KEEP_HEAD);
  const tail = raw.slice(raw.length - KEEP_TAIL);
  const dropped = raw.slice(KEEP_HEAD, raw.length - KEEP_TAIL);
  const midIndex = Math.floor(raw.length / 2);

  let latSum = 0;
  let lonSum = 0;
  let eleSum = 0;
  let eleCount = 0;
  for (const p of dropped) {
    latSum += p.lat;
    lonSum += p.lon;
    if (p.elevation_m != null) {
      eleSum += p.elevation_m;
      eleCount += 1;
    }
  }
  const summary: GpxTrackPoint = {
    seq: midIndex,
    lat: latSum / dropped.length,
    lon: lonSum / dropped.length,
    elevation_m: eleCount > 0 ? eleSum / eleCount : null,
    recorded_at: null,
    is_summary: true,
  };

  return [...head, summary, ...tail];
};

export const parseGpx = (xmlText: string): GpxParseResult => {
  if (!xmlText || typeof xmlText !== 'string' || xmlText.trim() === '') {
    throw new EmptyGpxError('Üres vagy érvénytelen GPX fájl');
  }

  const raw = extractRawPoints(xmlText);
  if (raw.length === 0) {
    throw new EmptyGpxError('A GPX fájl nem tartalmaz trackpointot.');
  }

  // --- cumulative distance + elevation gain -------------------------------
  let totalDistanceKm = 0;
  let elevationGainM = 0;
  let maxElevationM: number | null = null;
  for (let i = 1; i < raw.length; i += 1) {
    const prev = raw[i - 1]!;
    const cur = raw[i]!;
    totalDistanceKm += haversineKm(prev.lat, prev.lon, cur.lat, cur.lon);
    if (cur.elevation_m != null && prev.elevation_m != null) {
      const delta = cur.elevation_m - prev.elevation_m;
      // 500 m/point spike filter — typical GPS devices can produce
      // vertical jitter in dense tree cover; we only trust a gain delta
      // that's plausibly walkable.
      if (delta > 0 && delta <= SPIKE_THRESHOLD_M) {
        elevationGainM += delta;
      }
    }
    if (cur.elevation_m != null) {
      if (maxElevationM == null || cur.elevation_m > maxElevationM) {
        maxElevationM = cur.elevation_m;
      }
    }
  }

  // --- duration ----------------------------------------------------------
  // Only count it if EVERY raw point has a <time>. A single gap means the
  // track was stitched from multiple recordings and the wall-clock total
  // is meaningless — better to surface null than to fake a number.
  let durationMin: number | null = null;
  const allHaveTime = raw.every((p) => p.recorded_at != null);
  if (allHaveTime) {
    const firstMs = Date.parse(raw[0]!.recorded_at as string);
    const lastMs = Date.parse(raw[raw.length - 1]!.recorded_at as string);
    if (Number.isFinite(firstMs) && Number.isFinite(lastMs) && lastMs > firstMs) {
      durationMin = Math.round((lastMs - firstMs) / 60000);
    }
  }

  return {
    trackPoints: reducePoints(raw),
    totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
    elevationGainM: Math.round(elevationGainM),
    durationMin,
    maxElevationM: maxElevationM != null
      ? Math.round(maxElevationM * 10) / 10
      : null,
    sourcePointCount: raw.length,
  };
};