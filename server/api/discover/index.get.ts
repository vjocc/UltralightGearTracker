import { getServiceRoleClient } from '~/server/utils/publicShareClient';
import type { DiscoverResponse, DiscoverTripRow } from '~/shared/discoverSchemas';

/**
 * GET /api/discover
 *
 * Public, ANONYMOUS endpoint that lists every trip where
 * `visibility = 'public'`. Used by the public /discover page
 * ("Felfedezés a régióban", Sprint 5 P1).
 *
 * v2 §0 alignment:
 *   1. elv (no snapshot): SELECT reads the live `trips` table at request
 *      time. Edits to a trip's visibility / region are visible
 *      immediately. No denormalised copy.
 *   2. elv (anonymous): NO JWT required. The service-role client bypasses
 *      trips RLS — which is owner-scoped — because the public projection
 *      is the entire point. The factory-filter `visibility = 'public'`
 *      is the ONLY read gate; private trips cannot leak.
 *   4. elv (minimal scope): the SELECT list is explicit
 *      (`id, name, description, start_date, end_date, region,
 *      region_source, gpx_metadata`). NO `user_id`, NO `email`, NO
 *      `created_at` / `updated_at` / `completed_at`. The DiscoverTripRow
 *      zod schema enforces the absence of owner-identifier keys at
 *      parse time as a defense-in-depth layer.
 *   5. elv (Trip ≠ My Gear): the endpoint reads ONLY the trips table,
 *      never gear_items.
 *
 * Region grouping (§11.2 B opció, "Régiónkénti ABC"):
 *   * regions ABC-sorrendben (locale-aware compare a magyar ékezetes
 *     nevekhez — Intl.Collator 'hu').
 *   * region-en belüli trippek ABC-sorrendben `name` szerint.
 *   * A NULL region egy "Egyéb / Nincs megadva" blokkba kerül, a lista
 *     végén.
 *
 * Error semantics: 500 ha a DB hívás nem sikerül (a Supabase service-role
 * kliens szolgáltatás-kiesését szokás szerint 500-zal jelezzük). Az
 * "üres lista" NEM hiba — a /discover page friendly empty state-et mutat.
 */

const OTHER_BUCKET = 'Egyéb / Nincs megadva';

const collator = new Intl.Collator('hu', {
  sensitivity: 'base',
  numeric: true,
});

type RawTripRow = {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  region: string | null;
  region_source: 'manual' | 'gpx_derived' | null;
  gpx_metadata:
    | {
        total_distance_km?: number | null;
        elevation_gain_m?: number | null;
      }
    | null;
};

export default defineEventHandler(async (event): Promise<DiscoverResponse> => {
  const supabase = getServiceRoleClient();

  // Sprint 5 P1.x defense-in-depth: the public projection goes through
  // the `discover_public_trips()` SECURITY DEFINER RPC (see
  // supabase/migrations/20260818000000_discover_public_trips_rpc.sql).
  // The function hard-codes WHERE visibility = 'public' AND a 9-column
  // privacy-first SELECT list (no user_id, no email, no timestamps, no
  // gpx_metadata.trackpoints). ORDER BY t.name asc is built into the
  // function body too.
  const { data, error } = await supabase.rpc('discover_public_trips');

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Discover query failed: ${error.message}`,
    });
  }

  const rawRows = (data ?? []) as unknown as RawTripRow[];

  // Bucket trips by region. NULL region → OTHER_BUCKET. We accumulate
  // first, then sort buckets + trips.
  const bucketMap = new Map<string, DiscoverTripRow[]>();
  for (const r of rawRows) {
    const bucketKey = (r.region ?? '').trim() ? r.region!.trim() : OTHER_BUCKET;
    const projected: DiscoverTripRow = {
      id: r.id,
      name: r.name,
      description: r.description,
      start_date: r.start_date,
      end_date: r.end_date,
      region: r.region,
      region_source: r.region_source,
      distance_km: r.gpx_metadata?.total_distance_km ?? null,
      elevation_gain_m: r.gpx_metadata?.elevation_gain_m ?? null,
    };
    const bucket = bucketMap.get(bucketKey);
    if (bucket) {
      bucket.push(projected);
    } else {
      bucketMap.set(bucketKey, [projected]);
    }
  }

  // Sort region buckets: name ABC, except OTHER_BUCKET which always
  // lands at the very end (so "régió nélküli" trippek nem keverednek
  // a magyar ABC-be a "Egyéb" kulccsal).
  const sortedKeys = Array.from(bucketMap.keys()).sort((a, b) => {
    if (a === OTHER_BUCKET) return 1;
    if (b === OTHER_BUCKET) return -1;
    return collator.compare(a, b);
  });

  return {
    regions: sortedKeys.map((region) => ({
      region,
      trips: (bucketMap.get(region) ?? []).sort((a, b) =>
        collator.compare(a.name, b.name),
      ),
    })),
  };
});