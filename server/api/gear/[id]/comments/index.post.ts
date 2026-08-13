import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database, GearCommentRow } from '~/types/db';
import { commentCreateSchema } from '~/server/utils/commentSchemas';
import { getUserId } from '~/server/utils/auth';

/**
 * POST /api/gear/:id/comments
 *
 * Adds a comment to a gear item. The RLS INSERT policy enforces that the
 * parent gear_item is visible to the caller (gear owner OR an accepted
 * friend of the gear owner) — so a stranger hitting this endpoint will
 * see the row rejected at the DB layer. To return a clearer error than
 * "0 rows inserted", we run an explicit `gear_visible_to(id)` RPC up-front
 * and throw 403 when it returns false.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' });
  }

  const gearItemId = getRouterParam(event, 'id');
  if (!gearItemId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing gear_item_id' });
  }

  const body = await readBody(event);
  const parsed = commentCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid comment payload',
      data: parsed.error.flatten(),
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);

  // Up-front visibility check so we can distinguish "gear not visible" (403)
  // from "RLS denied the insert" (which manifests as a PostgREST error).
  const { data: visible, error: visErr } = await supabase.rpc(
    'gear_visible_to' as never,
    { p_gear_item_id: gearItemId } as never,
  );
  if (visErr) {
    throw createError({ statusCode: 500, statusMessage: visErr.message });
  }
  if (!visible) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You cannot comment on this gear item',
    });
  }

  const { data, error } = await supabase
    .from('gear_comments')
    .insert({ gear_item_id: gearItemId, body: parsed.data.body })
    .select('id, gear_item_id, user_id, body, created_at, updated_at')
    .single();

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message });
  }
  return data as GearCommentRow;
});