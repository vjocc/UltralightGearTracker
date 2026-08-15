import { serverSupabaseClient } from '#supabase/server';
import type { Database } from '~/types/db';

/**
 * GET /api/gear/base-weight
 *
 * Aggregates the signed-in user's gear into:
 *   - total_grams:     sum of grams for non-excluded items
 *   - per_category:    { category_id, category_name, grams, item_count,
 *                        percent, color_token }
 *                      per category, only including non-excluded items
 *                      (categories with 0 grams are dropped — see F.4).
 *                      Phase 4 (visual-weight): each entry also carries
 *                      `percent` (0-100, 1 decimal) and `color_token`
 *                      (MemoFox palette key — see MEMOFOX_CHART_PALETTE).
 *                      Both are computed server-side so SSR/CSR stay
 *                      hydration-consistent.
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

// MemoFox palette rotation for chart bars. Cyclic: index i uses
// MEMOFOX_CHART_PALETTE[i % palette.length]. Tailwind classes
// `bg-brand-500`, `bg-ember-500`, etc. resolve these tokens.
const MEMOFOX_CHART_PALETTE = ['brand', 'ember', 'moss', 'umber', 'espresso'] as const;

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

  // grams DESC, then decorate with percent + color_token (Phase 4).
  // percent is computed against total_grams; color_token cycles through
  // the MemoFox palette so the largest row gets `brand`, the next
  // `ember`, etc. — deterministic, server-side, hydration-safe.
  const per_category = Array.from(bucket.values())
    .sort((a, b) => b.grams - a.grams)
    .map((row, i) => ({
      ...row,
      percent:
        total_grams > 0
          ? Math.round((row.grams / total_grams) * 1000) / 10
          : 0,
      color_token: MEMOFOX_CHART_PALETTE[i % MEMOFOX_CHART_PALETTE.length],
    }));

  return {
    total_grams,
    per_category,
    excluded_grams,
    excluded_count,
  };
});