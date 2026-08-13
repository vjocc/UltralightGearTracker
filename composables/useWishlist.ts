/**
 * Composable wrapper around /api/wishlist/*.
 * Shares a reactive items list via useState so multiple components stay
 * in sync, plus loading + error flags.
 *
 * Own-rows-only is enforced server-side by Supabase RLS; the client
 * never sends user_id. All write functions surface server errors into
 * `state.error` so the UI can show ErrorBanner without per-call try/catch.
 *
 * `lastRefreshAt` is a global ref (per session) so any component on the
 * /wishlist page (Refresh button, list header) can render the last
 * successful refresh timestamp.
 */
import type {
  WishlistItemRow,
  WishlistItemInsert,
  WishlistItemUpdate,
} from '~/types/db';

export interface WishlistState {
  items: WishlistItemRow[];
  loading: boolean;
  error: string | null;
}

export interface WishlistRefreshSummary {
  total: number;
  updated: number;
  failed: number;
  alert_count: number;
  refreshed_at: string;
}

interface RefreshResponse extends WishlistRefreshSummary {
  results?: Array<{ id: string; ok: boolean; error?: string }>;
}

export function useWishlist() {
  const state = useState<WishlistState>('wishlist', () => ({
    items: [],
    loading: false,
    error: null,
  }));

  const lastRefreshAt = useState<string | null>('wishlist:lastRefreshAt', () => null);

  const setError = (e: unknown) => {
    const err = e as { statusMessage?: string; message?: string };
    state.value.error = err?.statusMessage ?? err?.message ?? 'Unexpected error';
  };

  const list = async () => {
    state.value.loading = true;
    state.value.error = null;
    try {
      const rows = await $fetch<WishlistItemRow[]>('/api/wishlist');
      state.value.items = rows ?? [];
    } catch (e) {
      setError(e);
    } finally {
      state.value.loading = false;
    }
  };

  const create = async (input: WishlistItemInsert) => {
    state.value.error = null;
    try {
      const row = await $fetch<WishlistItemRow>('/api/wishlist', {
        method: 'POST',
        body: input,
      });
      state.value.items = [row, ...state.value.items];
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  const update = async (id: string, patch: WishlistItemUpdate) => {
    state.value.error = null;
    try {
      const row = await $fetch<WishlistItemRow>(`/api/wishlist/${id}`, {
        method: 'PATCH',
        body: patch,
      });
      state.value.items = state.value.items.map((it) => (it.id === id ? row : it));
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  const remove = async (id: string) => {
    state.value.error = null;
    try {
      await $fetch(`/api/wishlist/${id}`, { method: 'DELETE' });
      state.value.items = state.value.items.filter((it) => it.id !== id);
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /**
   * Triggers the server-side price refresh for every owned row.
   * On success: state.items is reloaded (cheap, RLS-scoped) and
   * lastRefreshAt is updated so the UI can render "Last checked …".
   */
  const refreshAll = async (): Promise<WishlistRefreshSummary> => {
    state.value.error = null;
    try {
      const res = await $fetch<RefreshResponse>('/api/wishlist/refresh', {
        method: 'POST',
      });
      lastRefreshAt.value = res.refreshed_at;
      // Reload to capture refreshed current_price + last_checked_at values.
      await list();
      return {
        total: res.total,
        updated: res.updated,
        failed: res.failed,
        alert_count: res.alert_count,
        refreshed_at: res.refreshed_at,
      };
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  const resetError = () => {
    state.value.error = null;
  };

  return {
    state,
    lastRefreshAt,
    list,
    create,
    update,
    remove,
    refreshAll,
    resetError,
  };
}
