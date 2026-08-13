/**
 * Categories composable — read-only. The gear-crud card uses this to
 * populate the category <select> in GearFormModal. Categories don't yet
 * have their own CRUD card; only GET /api/categories exists for now.
 */
import type { CategoryRow } from '~/types/db';

interface CategoryState {
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

  const list = async () => {
    state.value.loading = true;
    state.value.error = null;
    try {
      const rows = await $fetch<CategoryRow[]>('/api/categories');
      state.value.items = rows ?? [];
    } catch (e: unknown) {
      const err = e as { statusMessage?: string; message?: string };
      state.value.error = err?.statusMessage ?? err?.message ?? 'Failed to load categories';
    } finally {
      state.value.loading = false;
    }
  };

  return { state, list };
}