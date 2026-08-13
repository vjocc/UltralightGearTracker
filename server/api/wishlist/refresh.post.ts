import { serverSupabaseUser } from '#supabase/server';
import { refreshWishlistPrices } from '~/server/utils/refreshPrices';

/**
 * POST /api/wishlist/refresh
 * Manual trigger that re-checks every wishlist row owned by the caller.
 * Under the hood this calls the dummy price-refresh strategy defined
 * in server/utils/refreshPrices.ts. The handler's job is just auth-gate
 * + delegate — no business logic here so a live scraper can replace the
 * util without touching the API surface.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' });
  }

  const summary = await refreshWishlistPrices(event);
  return {
    refreshed_at: new Date().toISOString(),
    ...summary,
  };
});
