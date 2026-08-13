import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database, TripRecapRow } from '~/types/db';
import { recapPatchSchema } from '~/server/utils/recapSchemas';

/**
 * PATCH /api/trips/:id/recap
 *
 * Owner-only. Partial update of body / rating_out_of_10 / public. The row
 * must already exist (recap must have been created via POST) — 404 otherwise.
 * RLS UPDATE policy on trip_recaps is owner-only so a non-owner caller
 * silently affects 0 rows and we surface 404.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Bejelentkezés szükséges' });
  }

  const tripId = getRouterParam(event, 'id');
  if (!tripId) {
    throw createError({ statusCode: 400, statusMessage: 'Hiányzó túra azonosító' });
  }

  const body = await readBody(event);
  const parsed = recapPatchSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Érvénytelen recap payload',
      data: parsed.error.flatten(),
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);

  const { data, error } = await supabase
    .from('trip_recaps')
    .update({
      ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
      ...(parsed.data.rating_out_of_10 !== undefined
        ? { rating_out_of_10: parsed.data.rating_out_of_10 }
        : {}),
      ...(parsed.data.public !== undefined ? { public: parsed.data.public } : {}),
    })
    .eq('trip_id', tripId)
    .select()
    .single();

  if (error || !data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'A beszámoló nem található vagy nem a tiéd',
    });
  }

  return data as TripRecapRow;
});