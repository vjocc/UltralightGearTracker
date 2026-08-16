/**
 * Composable for the public /discover listing ("Felfedezés a régióban").
 *
 * The backend (GET /api/discover) already returns the response grouped by
 * region (régió ABC, region belüli trip name ABC — §11.2 B opció), so
 * the composable is a thin wrapper that:
 *   * loads the response on mount,
 *   * exposes loading / error / data refs,
 *   * does NOT re-group on the client.
 *
 * Auth is NOT required — this composable is called from the public page
 * (middleware/auth.global.ts → /discover → exclude).
 *
 * v2 §0 #4 minimal scope: the response has no owner_user_id / email /
 * created_at / completed_at fields. The composable returns whatever the
 * server gives — no client-side enrichment that would re-introduce PII.
 */
import type { DiscoverResponse } from '~/shared/discoverSchemas';

type DiscoverState = {
  loading: boolean;
  error: string | null;
  data: DiscoverResponse | null;
};

export const useDiscover = () => {
  const state = ref<DiscoverState>({
    loading: false,
    error: null,
    data: null,
  });

  const fetch = async () => {
    state.value = { loading: true, error: null, data: null };
    try {
      const data = await $fetch<DiscoverResponse>('/api/discover');
      state.value = { loading: false, error: null, data };
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : 'A felfedezés-oldal nem tölthető be.';
      state.value = { loading: false, error: msg, data: null };
      throw e;
    }
  };

  const resetError = () => {
    state.value.error = null;
  };

  return {
    state,
    fetch,
    resetError,
  };
};