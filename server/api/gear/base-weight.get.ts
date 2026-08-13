import { serverSupabaseClient } from '#supabase/server';
import type { Database } from '~/types/db';

/**
 * GET /api/gear/base-weight
 *
 * Aggregates the signed-in user's gear into:
 *   - total_grams:     sum of grams for non-excluded items
 *   - per_category:    { category_id, category_name, grams, item_count }
 *                      per category, only including non-excluded items
 *                      (categories with 0 grams are dropped — see F.4)
 *   - excluded_grams:  sum of grams for excluded items
 *   - excluded_count:  count of excluded items
 *
 * Implementation:
 *   - Data source: public.gear_base_weights_view (security_invoker = true,
 *     so gear_items RLS — user_id = auth.uid() — applies automatically).
 *   - Two aggregate queries (totals + per-category), no N+1.
 *   - Pure aggregation; no client-side computation needed downstream.
 *
 * Why not client-side from useGear().list()?
 *   The list endpoint returns the caller's rows, but doing the
 *   SUM/CASE aggregation in JS would re-implement the SQL and miss
 *   categories that have items but none of them pass the
 *   excluded_from_base = false filter. The server route is the single
 *   source of truth.
 */
export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient<Database>(event);

  // 1) Totals across the whole user (counts + sums split by exclusion).
  const { data: totalsRows, error: totalsError } = await supabase
    .from('gear_base_weights_view')
    .select('grams, excluded_from_base');

  if (totalsError) {
    throw createError({ statusCode: 500, statusMessage: totalsError.message });
  }

  let total_grams = 0;
  let excluded_grams = 0;
  let excluded_count = 0;
  for (const row of totalsRows ?? []) {
    if (row.excluded_from_base) {
      excluded_grams += row.grams;
      excluded_count += 1;
    } else {
      total_grams += row.grams;
    }
  }

  // 2) Per-category breakdown — only non-excluded items, only categories
  //    that have at least one contributing item. We pull the columns we
  //    need and aggregate in JS because the supabase-js query builder
  //    doesn't expose FILTER clauses; the dataset per-user is small
  //    (tens-to-hundreds of items) so the JS pass is cheap and stays
  //    inside one round-trip.
  const { data: catRows, error: catError } = await supabase
    .from('gear_base_weights_view')
    .select('category_id, category_name, grams, excluded_from_base')
    .eq('excluded_from_base', false);

  if (catError) {
    throw createError({ statusCode: 500, statusMessage: catError.message });
  }

  const bucket = new Map<
    string,
    { category_id: string; category_name: string | null; grams: number; item_count: number }
  >();

  for (const row of catRows ?? []) {
    // Items without a resolved category (orphan after category delete) are
    // skipped from the per-category view but still counted in total_grams.
    if (!row.category_id) continue;
    const existing = bucket.get(row.category_id);
    if (existing) {
      existing.grams += row.grams;
      existing.item_count += 1;
    } else {
      bucket.set(row.category_id, {
        category_id: row.category_id,
        category_name: row.category_name,
        grams: row.grams,
        item_count: 1,
      });
    }
  }

  const per_category = Array.from(bucket.values()).sort(
    (a, b) => b.grams - a.grams
  );

  return {
    total_grams,
    per_category,
    excluded_grams,
    excluded_count,
  };
});