import { serverSupabaseClient } from '#supabase/server';
import type { Database } from '~/types/db';
import { tripUpdateSchema } from '~/server/utils/tripSchemas';

/**
 * PATCH /api/trips/:id
 * Partial update. RLS USING + WITH CHECK guarantee the target row is
 * owned by the caller — UPDATE on someone else's row silently affects 0.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' });
  }

  const body = await readBody(event);
  const parsed = tripUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid trip patch',
      data: parsed.error.flatten(),
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);
  const { data, error } = await supabase
    .from('trips')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    // .single() throws when no row matched — RLS blocked or id is wrong.
    throw createError({ statusCode: 404, statusMessage: 'Not found or not owned' });
  }
  return data;
});