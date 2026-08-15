import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type {
  Database,
  GearComfort,
  LoadoutRecommendationItem,
  LoadoutRecommendationReason,
  LoadoutReadiness,
  LoadoutRecommendationsResponse,
  UUID,
} from '~/types/db';
import { getUserId } from '~/server/utils/auth';

/**
 * GET /api/trips/:id/loadout-recommendations
 *
 * P7 / v2 #22 — Trip-aware loadout. Rule-based recommender, NEM ML:
 *   recommendation_score = (comfort_score - 1) / 4 × 0.6
 *                         + (1 - excess_rate) × 0.4
 *
 * Adatforrások (mind RLS-aware, mind owner-only effective a Phase 5–6
 * sémákon):
 *   1. trips + trip_gear      → meglévő trip-gear kapcsolat
 *   2. gear_items (user-szintű) + comfort JSONB
 *   3. trip_debriefs (user-szintű, JOIN trips.user_id) excess_items
 *
 * N+1 NEM — 3 db SELECT, user-szinten kicsi a dataset
 * (max néhány száz gear, max néhány tucat trip).
 *
 * Auth: 401 anonymous. Owner-only: a trip `user_id === auth.uid()`
 * a szerver-oldali trips SELECT-tel ellenőrzött; RLS-denied trip →
 * 404 (RLS denial surface, ugyanaz a pattern mint debrief.post.ts).
 *
 * Read-only: NEM ír a `gear_items` táblába. Csak jelzi az ajánlást
 * (v2 §0 #5 szigorúan: Trip ≠ My Gear).
 */
export default defineEventHandler(
  async (event): Promise<LoadoutRecommendationsResponse> => {
    const user = await serverSupabaseUser(event);
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Bejelentkezés szükséges',
      });
    }
    const userId = getUserId(user);
    if (!userId) {
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

    // (A) Trip ownership + meglévő trip_gear. RLS a trips + trip_gear
    // táblákon owner-only effective (trips.user_id = auth.uid());
    // a `.maybeSingle()` null-t ad vissza, ha RLS-denied → 404-et
    // dobunk.
    const { data: tripRow, error: tripErr } = await supabase
      .from('trips')
      .select('id, user_id, trip_gear(gear_item_id, quantity)')
      .eq('id', tripId)
      .maybeSingle();

    if (tripErr || !tripRow) {
      throw createError({
        statusCode: 404,
        statusMessage: 'A túra nem található vagy nem a tiéd',
      });
    }
    if (tripRow.user_id !== userId) {
      // defense-in-depth: RLS már átengedte, de a SELECT-et a konkrét
      // user_id filter miatt kaptuk meg; ez a második sor a védelmi
      // réteg (RLS-misconfig vagy az RLS-t kikerülő, de a trip
      // táblához hozzáférő szerepkör esetén).
      throw createError({
        statusCode: 404,
        statusMessage: 'A túra nem található vagy nem a tiéd',
      });
    }

    const tripGearIds = new Set<string>(
      (
        (tripRow as unknown as {
          trip_gear?: Array<{ gear_item_id: string }>;
        }).trip_gear ?? []
      ).map((tg) => tg.gear_item_id),
    );

    // (B) User teljes gear-listája + comfort. Defense-in-depth: a
    // .eq('user_id', user.id) szűrő itt a duplán-véd; a supabase-js
    // RLS-policy amúgy is owner-only a gear_items táblán.
    const { data: gearRows, error: gearErr } = await supabase
      .from('gear_items')
      .select('id, name, weight_g, category_id, comfort')
      .eq('user_id', userId);
    if (gearErr) {
      throw createError({
        statusCode: 500,
        statusMessage: gearErr.message,
      });
    }

    // (C) User összes túrájának debrief text[]-je (excess_items). A
    // SELECT tartalmazza a `trips!inner(user_id)` join-szűrőt, így az
    // RLS + a kliens-oldali szűrő együtt garantálja, hogy CSAK a
    // saját debrief-row-jaidat látjuk (a Phase 5 SELECT policy
    // trip_visible_to-t is megenged, de a kliens `eq()`-je a
    // sajátunkra szűkíti).
    const { data: debriefRows, error: debriefErr } = await supabase
      .from('trip_debriefs')
      .select('excess_items, trip_id, trips!inner(user_id)')
      .eq('trips.user_id', userId);
    if (debriefErr) {
      throw createError({
        statusCode: 500,
        statusMessage: debriefErr.message,
      });
    }

    // (D) Aggregáció + scoring — lásd §2.4 + §2.5 a specifikációban.

    const userTripCount = await countUserTrips(supabase, userId);
    const userDebriefCount = (debriefRows ?? []).length;

    // excess_appearances: normalizált kis- és nagybetű-mentes
    // halmaz. A user gear listájának neveit itt hash-eljük, és a
    // debrief text[]-tel való match-nél normalizálunk.
    type GearRowLite = {
      id: string;
      name: string;
      weight_g: number;
      category_id: string | null;
      comfort: GearComfort | null;
    };
    const gearByLowerName = new Map<string, GearRowLite>();
    let comfortItemsCount = 0;
    for (const raw of gearRows ?? []) {
      const g = raw as unknown as GearRowLite;
      const name = (g.name ?? '').trim();
      if (name) {
        gearByLowerName.set(name.toLowerCase(), g);
      }
      if (g.comfort) {
        const c = g.comfort;
        if (
          typeof c.sleep === 'number' ||
          typeof c.cold === 'number' ||
          typeof c.weight === 'number'
        ) {
          comfortItemsCount += 1;
        }
      }
    }

    // excess_appearances: minden match-elt gear item növeli a számot.
    const excessCountByLowerName = new Map<string, number>();
    for (const row of debriefRows ?? []) {
      const items = (row as unknown as { excess_items?: string[] })
        .excess_items;
      if (!items) continue;
      for (const raw of items) {
        const k = (raw ?? '').trim().toLowerCase();
        if (!k) continue;
        excessCountByLowerName.set(
          k,
          (excessCountByLowerName.get(k) ?? 0) + 1,
        );
      }
    }

    // Az item, ami a user gear-listáján is rajta van ÉS szerepel a
    // saját excess_items listájában: excess_appearances számít.
    // Több user-gear-nevet ugyanaz a lower-name-re normalizálunk,
    // így egy item egyszer számít (a `gearByLowerName` Map
    // first-write-wins a duplikált nevek esetén — ha két item neve
    // azonos, az elsőt tekintjük referenciának).
    const excessAppearancesByGearId = new Map<string, number>();
    for (const [lowerName, count] of excessCountByLowerName.entries()) {
      const matched = gearByLowerName.get(lowerName);
      if (matched) {
        excessAppearancesByGearId.set(
          matched.id,
          (excessAppearancesByGearId.get(matched.id) ?? 0) + count,
        );
      }
    }

    // Comfort_score kiszámítása item-enként.
    const comfortScoreByGearId = new Map<string, number>();
    for (const raw of gearRows ?? []) {
      const g = raw as unknown as GearRowLite;
      const score = computeComfortScore(g.comfort);
      if (score !== null) {
        comfortScoreByGearId.set(g.id, score);
      }
    }

    // Scoring — minden user-szintű gear item-re, akinek van comfort
    // VAGY excess adata (különben a recommendation_score nem lenne
    // értelmezhető).
    const allScored: LoadoutRecommendationItem[] = [];
    for (const raw of gearRows ?? []) {
      const g = raw as unknown as GearRowLite;
      const comfortScore =
        comfortScoreByGearId.get(g.id) ?? null;
      const excessAppearances =
        excessAppearancesByGearId.get(g.id) ?? 0;
      const excessRate =
        userTripCount > 0 ? excessAppearances / userTripCount : 0;

      const skipScoring =
        comfortScore === null && excessAppearances === 0;
      if (skipScoring) continue; // nincs adat → kimarad

      const alreadyOnTrip = tripGearIds.has(g.id);

      let score: number;
      let reason: LoadoutRecommendationReason;

      if (comfortScore === null) {
        // Csak excess adatunk van. NEM ajánljuk, ha volt már
        // excess-előfordulás (reason = null → kimarad a top-N-ből).
        // Ha NEM volt, "new_item" + score = (1 - excess_rate).
        if (excessAppearances > 0) {
          score = 1 - excessRate;
          reason = null;
        } else {
          score = 1 - excessRate;
          reason = 'new_item';
        }
      } else {
        score =
          ((comfortScore - 1) / 4) * 0.6 + (1 - excessRate) * 0.4;
        reason = computeReason(comfortScore, excessRate);
      }

      allScored.push({
        gear_item_id: g.id,
        name: g.name,
        category_id: g.category_id,
        weight_g: g.weight_g,
        comfort: (g.comfort as GearComfort | null) ?? null,
        comfort_score: comfortScore,
        excess_appearances: excessAppearances,
        excess_rate: excessRate,
        recommendation_score: clamp01(score),
        reason,
        already_on_trip: alreadyOnTrip,
      });
    }

    // add vs keep szétválogatás — score DESC, threshold >= 0.5,
    // top-N = 6 (az UI 3 + 3 kártyát mutat).
    const SCORE_THRESHOLD = 0.5;
    const TOP_N = 6;

    const addCandidates = allScored
      .filter(
        (r) =>
          !r.already_on_trip &&
          r.recommendation_score >= SCORE_THRESHOLD &&
          r.reason !== null,
      )
      .sort((a, b) => b.recommendation_score - a.recommendation_score)
      .slice(0, TOP_N);

    const keepCandidates = allScored
      .filter(
        (r) =>
          r.already_on_trip &&
          r.recommendation_score >= SCORE_THRESHOLD &&
          r.reason !== null,
      )
      .sort((a, b) => b.recommendation_score - a.recommendation_score)
      .slice(0, TOP_N);

    // Readiness — single source of truth, lásd §2.6.
    const readiness: LoadoutReadiness = computeReadiness({
      userTripCount,
      userDebriefCount,
      comfortItemsCount,
    });

    return {
      trip_id: tripId as UUID,
      add_candidates: addCandidates,
      keep_candidates: keepCandidates,
      meta: {
        user_trip_count: userTripCount,
        user_debrief_count: userDebriefCount,
        user_comfort_items_count: comfortItemsCount,
        scored_items_count: allScored.length,
        readiness,
      },
    };
  },
);

// --- Helpers -------------------------------------------------------------

async function countUserTrips(
  supabase: Awaited<
    ReturnType<typeof serverSupabaseClient<Database>>
  >,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('trips')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error || count === null) return 0;
  return count;
}

function computeComfortScore(comfort: unknown): number | null {
  if (!comfort || typeof comfort !== 'object') return null;
  const c = comfort as GearComfort;
  const dims: number[] = [];
  if (typeof c.sleep === 'number') dims.push(c.sleep);
  if (typeof c.cold === 'number') dims.push(c.cold);
  if (typeof c.weight === 'number') dims.push(c.weight);
  if (dims.length === 0) return null;
  const sum = dims.reduce((acc, x) => acc + x, 0);
  return sum / dims.length;
}

function computeReason(
  comfortScore: number,
  excessRate: number,
): LoadoutRecommendationReason {
  const HIGH_COMFORT = 4;
  const HIGH_EXCESS = 0.5;
  const LOW_EXCESS = 0.3;

  const isHighComfort = comfortScore >= HIGH_COMFORT;
  const isLowExcess = excessRate < LOW_EXCESS;
  const isMidExcess = excessRate < HIGH_EXCESS;

  if (isHighComfort && isMidExcess) return 'both';
  if (isHighComfort) return 'high_comfort';
  if (isLowExcess && excessRate >= 0) return 'low_excess';
  // comfortScore < 4, de excess-rate sem alacsony → "high_comfort"
  // sem teljesül, "low_excess" sem (0.3 küszöbnél). Ilyenkor a
  // legjobb leíró címke: "new_item" (commodity item, de comfort < 4
  // és az excess sem extrém). A spec a `reason = 'low_excess'`-t
  // csak az excessRate < 0.3 ágra írja; ezt az ágat a default
  // 'high_comfort' (mivel comfort >= 1 ÉS nincs kizáró ok) címkével
  // jelöljük, hogy a UI 3 kártyája ne legyen üres, ha van
  // pontozott item.
  return 'high_comfort';
}

function computeReadiness(args: {
  userTripCount: number;
  userDebriefCount: number;
  comfortItemsCount: number;
}): LoadoutReadiness {
  if (args.userTripCount === 0) return 'no_trips';
  if (args.userDebriefCount === 0) return 'no_debriefs';
  if (args.comfortItemsCount < 3) return 'no_comfort';
  return 'enough_data';
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
