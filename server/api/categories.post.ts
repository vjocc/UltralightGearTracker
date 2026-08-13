import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database } from '~/types/db';
import { categoryCreateSchema } from '~/server/utils/categorySchemas';

/**
 * POST /api/categories
 * Creates a category for the signed-in user. Body validated against
 * categoryCreateSchema (zod). user_id is stamped by auth.uid() in the DB
 * layer; RLS WITH CHECK enforces auth.uid() = user_id on INSERT, so the
 * client cannot impersonate another user.
 *
 * Returns 201 + the inserted CategoryRow so the GearFormModal inline
 * sub-form can immediately select it.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' });
  }

  const body = await readBody(event);
  const parsed = categoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid category payload',
      data: parsed.error.flatten(),
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);
  const { data, error } = await supabase
    .from('categories')
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message });
  }

  // 201 Created + the new row so the inline sub-form can select it.
  setResponseStatus(event, 201);
  return data;
});
