import { serverSupabaseClient } from '#supabase/server';
import type { Database } from '~/types/db';

/**
 * GET /api/categories
 * Returns the current user's categories, alpha-sorted. RLS scopes the
 * rows to auth.uid() automatically.
 *
 * The gear CRUD UI uses this to populate the category <select> in
 * GearFormModal. Created as part of the gear-crud card — categories
 * don't yet have their own card.
 */
export default defineEventHandler(async (event) => {
  const supabase = await serverSupabaseClient<Database>(event);
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message });
  }
  return data ?? [];
});
