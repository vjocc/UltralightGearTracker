import { serverSupabaseClient } from '#supabase/server';
import { serverSupabaseUser } from '#supabase/server';
import type { Database } from '~/types/db';
import { gearCreateSchema } from '~/server/utils/gearSchemas';

/**
 * POST /api/gear
 * Body validated against gearCreateSchema (zod). user_id defaults to
 * auth.uid() at the DB layer; RLS WITH CHECK enforces the same on INSERT.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' });
  }

  const body = await readBody(event);
  const parsed = gearCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid gear payload',
      data: parsed.error.flatten(),
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);
  const { data, error } = await supabase
    .from('gear_items')
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message });
  }
  return data;
});