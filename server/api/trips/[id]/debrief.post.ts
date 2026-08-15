import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database, TripDebriefRow } from '~/types/db';
import { debriefUpsertSchema } from '~/server/utils/debriefSchemas';

/**
 * POST /api/trips/:id/debrief
 *
 * Owner-only upsert. If a debrief row exists for this trip, UPDATE it; else
 * INSERT a fresh one. The DB enforces `unique (trip_id)` so we don't need a
 * `SELECT → if-null-then-insert` race-prone round-trip — the INSERT path
 * uses `on conflict (trip_id) do update` semantics via `.upsert()`.
 *
 * RLS INSERT/UPDATE policies gate on the parent trip's user_id — a
 * non-owner caller hits 404 (RLS denial surfaces as PostgREST error →
 * 404), matching the recap.post.ts convention.
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Bejelentkezés szükséges',
    });
  }

  const tripId = getRouterParam(event, 'id');
  if (!tripId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Hiányzó túra azonosító',
    });
  }

  const body = await readBody(event);
  const parsed = debriefUpsertSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Érvénytelen debrief payload',
      data: parsed.error.flatten(),
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);
  const upsertPayload = {
    trip_id: tripId,
    excess_items: parsed.data.excess_items,
    missing_items: parsed.data.missing_items,
    uncomfortable_items: parsed.data.uncomfortable_items,
  };

  const { data, error } = await supabase
    .from('trip_debriefs')
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

  return data as TripDebriefRow;
});