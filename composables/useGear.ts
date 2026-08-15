/**
 * Composable wrapper around /api/gear/*.
 * Shares a reactive items list via useState so multiple components stay
 * in sync, plus loading + error flags.
 *
 * Own-rows-only is enforced server-side by Supabase RLS; the client
 * never sends user_id. All write functions surface server errors into
 * `state.error` so the UI can show ErrorBanner without per-call try/catch.
 */
import type { GearItemRow, GearItemInsert, GearItemUpdate } from '~/types/db';

export interface GearState {
  items: GearItemRow[];
  loading: boolean;
  error: string | null;
}

export function useGear() {
  const state = useState<GearState>('gear', () => ({
    items: [],
    loading: false,
    error: null,
  }));

  const setError = (e: unknown) => {
    const err = e as { statusMessage?: string; message?: string };
    state.value.error = err?.statusMessage ?? err?.message ?? 'Unexpected error';
  };

  const list = async () => {
    state.value.loading = true;
    state.value.error = null;
    try {
      const rows = await $fetch<GearItemRow[]>('/api/gear');
      state.value.items = rows ?? [];
    } catch (e) {
      setError(e);
    } finally {
      state.value.loading = false;
    }
  };

  const create = async (input: GearItemInsert) => {
    state.value.error = null;
    try {
      const row = await $fetch<GearItemRow>('/api/gear', {
        method: 'POST',
        body: input,
      });
      state.value.items = [row, ...state.value.items];
      await refreshNuxtData('base-weight');
      // Sprint 5 P0.3 — activation funnel: first_gear_added (B opció: saját events tábla).
      // A first_* guard a useFunnelEvents belsejében (useState flag + server idempotens check).
      if (state.value.items.length === 1) {
        const { trackEvent } = useFunnelEvents();
        trackEvent('first_gear_added', { category_id: row.category_id ?? undefined });
      }
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  const update = async (id: string, patch: GearItemUpdate) => {
    state.value.error = null;
    try {
      const row = await $fetch<GearItemRow>(`/api/gear/${id}`, {
        method: 'PATCH',
        body: patch,
      });
      state.value.items = state.value.items.map((it) => (it.id === id ? row : it));
      await refreshNuxtData('base-weight');
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  const remove = async (id: string) => {
    state.value.error = null;
    try {
      await $fetch(`/api/gear/${id}`, { method: 'DELETE' });
      state.value.items = state.value.items.filter((it) => it.id !== id);
      await refreshNuxtData('base-weight');
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  const resetError = () => {
    state.value.error = null;
  };

  return { state, list, create, update, remove, resetError };
}
