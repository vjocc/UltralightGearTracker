import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database } from '~/types/db';
import { tripCreateSchema } from '~/server/utils/tripSchemas';

/**
 * POST /api/trips
 * Body validated against tripCreateSchema (zod). user_id defaults to
 * auth.uid() at the DB layer; RLS WITH CHECK enforces the same on INSERT.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' });
  }

  const body = await readBody(event);
  const parsed = tripCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid trip payload',
      data: parsed.error.flatten(),
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);
  const { data, error } = await supabase
    .from('trips')
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message });
  }
  return data;
});