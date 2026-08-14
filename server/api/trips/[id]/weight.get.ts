// Re-deploy trigger (2026-08-14 19:50): empty cache
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database } from '~/types/db';
import { getUserId } from '~/server/utils/auth';

/**
 * GET /api/trips/:id/weight
 *
 * Aggregates one trip's `Σ(gear_items.weight_g × trip_gear.quantity)`
 * over owned, non-excluded gear. Response shape (mirrors the design
 * comment, section A):
 *
 *   {
 *     total_grams: number,
 *     item_count: number,
 *     per_category: Array<{ category_id, category_name, grams, item_count }>
 *   }
 *
 * Implementation:
 *   - Totals + count come from the `trip_weight_summary` view (see
 *     migration 20260813090000_trip_weight_summary.sql). The view is
 *     created with `security_invoker = true`, so the trips / trip_gear
 *     / gear_items RLS policies all apply — cross-user reads return no
 *     row and we surface 404.
 *   - Per-category breakdown comes from a second query that joins
 *     trip_gear with the gear_base_weights_view for the current trip
 *     and aggregates in JS. The supabase-js client doesn't expose SQL
 *     FILTER clauses, but a per-trip join stays inside one round-trip
 *     and the per-user dataset is small (tens-to-hundreds of items).
 *   - If the per_category query fails (e.g. transient), we still
 *     return totals and an empty per_category list rather than 500 —
 *     the panel handles the empty list via v-if (acceptance #1, "Panel
 *     renders even when per-cat is empty").
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' });
  }

  // Auth guard — P4.2 Delta #2
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' });
  }
  const userId = getUserId(user);
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' });
  }

  const supabase = await serverSupabaseClient<Database>(event);

  // 1) Totals + count via the dedicated view. RLS scopes the row to
  //    the caller's own trips; a missing row is either "trip not
  //    found" or "not owned" — both surface as 404.
  const { data: summary, error: summaryError } = await supabase
    .from('trip_weight_summary')
    .select('trip_id, total_grams, item_count')
    .eq('trip_id', id)
    .maybeSingle();

  if (summaryError) {
    throw createError({ statusCode: 500, statusMessage: summaryError.message });
  }

  if (!summary) {
    throw createError({ statusCode: 404, statusMessage: 'Trip not found' });
  }

  // 2) Per-category breakdown. Pull the trip's trip_gear rows + the
  //    corresponding non-excluded gear items (with category info) in
  //    two small selects and aggregate in JS. Categories without a
  //    resolved row are dropped (orphan after category delete).
  const { data: tripGearRows, error: tgError } = await supabase
    .from('trip_gear')
    .select('gear_item_id, quantity')
    .eq('trip_id', id);

  if (tgError) {
    throw createError({ statusCode: 500, statusMessage: tgError.message });
  }

  let per_category: Array<{
    category_id: string;
    category_name: string | null;
    grams: number;
    item_count: number;
  }> = [];

  if (tripGearRows && tripGearRows.length > 0) {
    const gearIds = tripGearRows.map((tg) => tg.gear_item_id);
    const qtyByGear = new Map<string, number>();
    for (const tg of tripGearRows) {
      qtyByGear.set(tg.gear_item_id, tg.quantity);
    }

    const { data: gearRows, error: gearError } = await supabase
      .from('gear_base_weights_view')
      .select('gear_item_id, category_id, category_name, grams, excluded_from_base')
      .in('gear_item_id', gearIds)
      .eq('excluded_from_base', false);

    if (gearError) {
      // Non-fatal: keep the totals, surface empty per_category.
      per_category = [];
    } else {
      const bucket = new Map<
        string,
        {
          category_id: string;
          category_name: string | null;
          grams: number;
          item_count: number;
        }
      >();
      for (const row of gearRows ?? []) {
        if (!row.category_id) continue;
        const qty = qtyByGear.get(row.gear_item_id) ?? 1;
        const existing = bucket.get(row.category_id);
        if (existing) {
          existing.grams += row.grams * qty;
          existing.item_count += 1;
        } else {
          bucket.set(row.category_id, {
            category_id: row.category_id,
            category_name: row.category_name,
            grams: row.grams * qty,
            item_count: 1,
          });
        }
      }
      per_category = Array.from(bucket.values()).sort(
        (a, b) => b.grams - a.grams
      );
    }
  }

  return {
    total_grams: summary.total_grams,
    item_count: summary.item_count,
    per_category,
  };
});