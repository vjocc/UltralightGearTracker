import type { H3Event } from 'h3';
import { serverSupabaseClient } from '#supabase/server';
import type { Database } from '~/types/db';

/**
 * Result of a single wishlist item price-refresh attempt.
 *   - ok=true  → row updated (current_price + last_checked_at)
 *   - ok=false → error captured; row left untouched
 */
export interface WishlistRefreshRowResult {
  id: string;
  ok: boolean;
  error?: string;
}

/**
 * Top-level summary returned to the API handler.
 */
export interface WishlistRefreshSummary {
  total: number;
  updated: number;
  failed: number;
  /** Items whose simulated drop pushed current_price ≤ target_price after refresh. */
  alert_count: number;
  results: WishlistRefreshRowResult[];
}

/**
 * Mock price-refresh strategy. For the MVP we simulate 30% of items
 * dropping ~5% from their previous current_price (or seeded from
 * target_price when no prior price is recorded). The remaining 70%
 * stay flat so the UI can show stable rows.
 *
 * TODO(integrations): swap for a live scraper (Amazon PA / Google
 * Shopping / retailer-direct JSON). The contract this fn returns is
 * what /api/wishlist/refresh surfaces to the client — keep stable.
 */
function simulateNewPrice(prev: number | null, target: number | null): number {
  const seed = prev ?? target ?? 100;
  const drop = Math.random() < 0.3;
  const next = drop ? seed * 0.95 : seed;
  // Keep two decimals to align with numeric(10,2) in the schema.
  return Math.round(next * 100) / 100;
}

/**
 * Refreshes current_price + last_checked_at for every wishlist row owned
 * by the caller. Errors are caught per item so a single bad row never
 * aborts the batch.
 *
 * RLS on wishlist_items (user_id = auth.uid()) scopes the read/write set
 * to the calling user; no explicit filter needed.
 */
export async function refreshWishlistPrices(
  event: H3Event
): Promise<WishlistRefreshSummary> {
  const supabase = await serverSupabaseClient<Database>(event);
  const { data: rows, error: readError } = await supabase
    .from('wishlist_items')
    .select('id, current_price, target_price');

  if (readError) {
    throw createError({ statusCode: 500, statusMessage: readError.message });
  }

  const summary: WishlistRefreshSummary = {
    total: rows?.length ?? 0,
    updated: 0,
    failed: 0,
    alert_count: 0,
    results: [],
  };

  for (const row of rows ?? []) {
    try {
      const newPrice = simulateNewPrice(row.current_price, row.target_price);
      const lastCheckedAt = new Date().toISOString();
      const { data: updated, error: updateError } = await supabase
        .from('wishlist_items')
        .update({
          current_price: newPrice,
          last_checked_at: lastCheckedAt,
        })
        .eq('id', row.id)
        .select()
        .single();

      if (updateError) throw updateError;

      summary.updated += 1;
      // Alert when refreshed price is at or below the user-set threshold.
      if (
        updated?.target_price != null &&
        updated.current_price != null &&
        updated.current_price <= updated.target_price
      ) {
        summary.alert_count += 1;
      }
      summary.results.push({ id: row.id, ok: true });
    } catch (e: unknown) {
      summary.failed += 1;
      const err = e as { statusMessage?: string; message?: string };
      summary.results.push({
        id: row.id,
        ok: false,
        error: err?.statusMessage ?? err?.message ?? 'unknown error',
      });
      // Continue with the next row — never abort the batch.
    }
  }

  return summary;
}
