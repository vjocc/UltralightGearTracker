/**
 * Categories composable. Shares a reactive items list via useState so
 * multiple components stay in sync, plus loading + error flags.
 *
 * Own-rows-only is enforced server-side by Supabase RLS; the client never
 * sends user_id. All write functions surface server errors into
 * `state.error` so the UI can show ErrorBanner without per-call try/catch.
 */
import type { CategoryRow } from '~/types/db';

export interface CategoryState {
  items: CategoryRow[];
  loading: boolean;
  error: string | null;
}

export function useCategories() {
  const state = useState<CategoryState>('categories', () => ({
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
      const rows = await $fetch<CategoryRow[]>('/api/categories');
      state.value.items = rows ?? [];
    } catch (e) {
      setError(e);
    } finally {
      state.value.loading = false;
    }
  };

  /**
   * Create a category for the signed-in user. Name + slug validated
   * server-side; user_id stamped by auth.uid() at DB layer (RLS enforced).
   * On success, prepends the new row to state.items and returns it so the
   * caller (GearFormModal inline sub-form) can select it in the <select>.
   */
  const create = async (name: string, slug: string) => {
    state.value.error = null;
    try {
      const row = await $fetch<CategoryRow>('/api/categories', {
        method: 'POST',
        body: { name, slug },
      });
      state.value.items = [...state.value.items, row];
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  const resetError = () => {
    state.value.error = null;
  };

  return { state, list, create, resetError };
}
