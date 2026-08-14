/**
 * Categories composable. Shares a reactive items list via useState so
 * multiple components stay in sync, plus loading + error flags.
 *
 * Categories are a global, system-defined taxonomy (Sprint 4 v2) — the
 * `categories` table has no `user_id` column and is not user-scoped, so
 * this composable is read-only (list + error surface) for the UI.
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

  // Use Nuxt Supabase client to read global categories (RLS = read-all on Migration #1)
  const list = async () => {
    state.value.loading = true;
    state.value.error = null;
    try {
      const client = useSupabaseClient();
      const { data, error } = await client
        .from('categories')
        .select('id, slug, name, description, display_order')
        .order('display_order', { ascending: true });
      if (error) {
        setError(error);
        state.value.items = [];
      } else {
        state.value.items = (data ?? []) as CategoryRow[];
      }
    } catch (e) {
      setError(e);
    } finally {
      state.value.loading = false;
    }
  };

  return { state, list };
}
