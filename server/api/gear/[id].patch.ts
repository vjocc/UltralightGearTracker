import { serverSupabaseClient } from '#supabase/server';
import type { Database } from '~/types/db';
import { gearUpdateSchema } from '~/server/utils/gearSchemas';

/**
 * PATCH /api/gear/:id
 * Partial update. RLS USING + WITH CHECK guarantee the target row is
 * owned by the caller — UPDATE on someone else's row silently affects 0.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' });
  }

  const body = await readBody(event);
  const parsed = gearUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid gear patch',
      data: parsed.error.flatten(),
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);
  const { data, error } = await supabase
    .from('gear_items')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    // .single() throws when no row matched — that means RLS blocked or the id is wrong.
    throw createError({ statusCode: 404, statusMessage: 'Not found or not owned' });
  }
  return data;
});