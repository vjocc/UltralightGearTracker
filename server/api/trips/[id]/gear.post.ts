import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database } from '~/types/db';
import { tripGearAddSchema } from '~/server/utils/tripSchemas';

/**
 * POST /api/trips/:id/gear
 * Inserts one row into trip_gear (M:N switch). trip_id is taken from the
 * route param so the client never gets to spoof a different trip.
 *
 * RLS gates the INSERT through trip_gear_insert_own (WITH CHECK joins to
 * the parent trip and verifies owner). A foreign user trying to attach
 * their gear_item to someone else's trip will silently affect 0 rows
 * (PostgREST error path), which we surface as 404.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' });
  }

  const tripId = getRouterParam(event, 'id');
  if (!tripId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing trip id' });
  }

  const body = await readBody(event);
  const parsed = tripGearAddSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid trip_gear payload',
      data: parsed.error.flatten(),
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);
  const { data, error } = await supabase
    .from('trip_gear')
    .insert({
      trip_id: tripId,
      gear_item_id: parsed.data.gear_item_id,
      quantity: parsed.data.quantity,
    })
    .select()
    .single();

  if (error) {
    // RLS denial OR FK violation OR duplicate (PK) → 404 hides the cause.
    throw createError({ statusCode: 404, statusMessage: 'Trip not found or not owned' });
  }
  return data;
});