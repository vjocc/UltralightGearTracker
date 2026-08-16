/**
 * Client+server shared zod schemas for the /discover public listing.
 *
 * Sprint 5 P1 — Community Routes ("Felfedezés a régióban").
 *
 * Mirrors the publicListSchemas pattern: the single source of truth lives
 * in shared/ and is re-exported by server-side callers via
 * server/utils/ if needed. The DiscoverResponse is what GET /api/discover
 * returns to the public page; the page does NOT need its own client-side
 * schema because the response is simple (regions: [{region, trips[]}]).
 *
 * Privacy rules baked into the schema (v2 §0 #4 minimal scope):
 *   * No owner_user_id, no user email, no UUID of the trip owner.
 *   * Only trip-level fields surfaced (name, description, dates, region,
 *     region_source, optional GPX distance/elevation).
 *   * The trips RLS is NOT widened — the public projection lives in the
 *     service-role endpoint, and the schema rejects any leak of owner
 *     identifiers at parse time.
 */
import { z } from 'zod';

export const discoverTripRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  region: z.string().nullable(),
  region_source: z.enum(['manual', 'gpx_derived']).nullable(),
  // GPX-derived totals (P1-ben opcionális, P3+ bővíthető a P1-et nem
  // érintve). A schema elfogadja a null-t, ha a trip-hez nincs GPX.
  distance_km: z.number().nullable(),
  elevation_gain_m: z.number().nullable(),
});

export type DiscoverTripRow = z.infer<typeof discoverTripRowSchema>;

/**
 * The /discover response. A backend szerver-oldali régiónkénti csoportosítást
 * végez (régió ABC, region belüli trip name ABC), így a kliens NEM dolgoz
 * újra a listán — ez a §11.2 B opció (régiónkénti ABC) implementációja.
 *
 * A NULL region az 'Egyéb / Nincs megadva' bucket-be kerül (a szerver-oldali
 * kód készíti, a kliens csak rendereli).
 */
export const discoverResponseSchema = z.object({
  regions: z.array(
    z.object({
      region: z.string(),
      trips: z.array(discoverTripRowSchema),
    }),
  ),
});

export type DiscoverResponse = z.infer<typeof discoverResponseSchema>;