import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database, TripRecapRow } from '~/types/db';
import { recapUpsertSchema } from '~/server/utils/recapSchemas';
import { getUserId } from '~/server/utils/auth';

/**
 * POST /api/trips/:id/recap
 *
 * Owner-only upsert. If a recap row exists for this trip, UPDATE it; else
 * INSERT a fresh one. The DB enforces `unique (trip_id)` so we don't need a
 * `SELECT → if-null-then-insert` race-prone round-trip — the INSERT path
 * uses `on conflict (trip_id) do update` semantics via `.upsert()`.
 *
 * RLS INSERT/UPDATE policies gate on the parent trip's user_id — a non-owner
 * caller hits 404 (RLS denial surfaces as PostgREST error → 404).
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
  const parsed = recapUpsertSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Érvénytelen recap payload',
      data: parsed.error.flatten(),
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);
  const upsertPayload = {
    trip_id: tripId,
    ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
    ...(parsed.data.rating_out_of_10 !== undefined
      ? { rating_out_of_10: parsed.data.rating_out_of_10 }
      : {}),
    ...(parsed.data.public !== undefined ? { public: parsed.data.public } : {}),
  };

  const { data, error } = await supabase
    .from('trip_recaps')
    .upsert(upsertPayload, { onConflict: 'trip_id' })
    .select()
    .single();

  if (error || !data) {
    // RLS denial OR trip not owned → 404 hides the cause.
    throw createError({
      statusCode: 404,
      statusMessage: 'A túra nem található vagy nem a tiéd',
    });
  }

  return data as TripRecapRow;
});