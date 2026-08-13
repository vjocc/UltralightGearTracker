import { serverSupabaseClient } from '#supabase/server';
import type { Database } from '~/types/db';
import { tripGearUpdateSchema } from '~/server/utils/tripSchemas';

/**
 * PATCH /api/trips/:id/gear/:gearId
 * Updates the quantity column on a trip_gear row. The composite PK
 * (trip_id, gear_item_id) is the natural WHERE clause.
 *
 * RLS WITH CHECK on trip_gear_update_own re-validates the parent trip
 * ownership — a PATCH on a trip the caller doesn't own silently
 * affects 0 rows, which we surface as 404.
 */
export default defineEventHandler(async (event) => {
  const tripId = getRouterParam(event, 'id');
  const gearId = getRouterParam(event, 'gearId');
  if (!tripId || !gearId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing route params' });
  }

  const body = await readBody(event);
  const parsed = tripGearUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid trip_gear patch',
      data: parsed.error.flatten(),
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);
  const { data, error } = await supabase
    .from('trip_gear')
    .update(parsed.data)
    .eq('trip_id', tripId)
    .eq('gear_item_id', gearId)
    .select()
    .single();

  if (error) {
    throw createError({ statusCode: 404, statusMessage: 'Trip_gear row not found or not owned' });
  }
  return data;
});