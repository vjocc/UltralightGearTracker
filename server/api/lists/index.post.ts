import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database, PublicListRow } from '~/types/db';
import { publicListUpsertSchema } from '~/server/utils/publicListSchemas';
import { getUserId } from '~/server/utils/auth';

/**
 * POST /api/lists
 *
 * Idempotent upsert of the CALLING user's `public_lists` row.
 *
 * Why idempotent: the public-share UX is a single toggle on /gear —
 * "share on" / "share off". The frontend does NOT want to manage
 * "create if not exists, otherwise update" branching. UPSERT on the
 * UNIQUE(user_id) constraint makes the endpoint safe to call repeatedly
 * with the same body — second-and-later calls update, the first call
 * creates. `share_token` is generated server-side by the column DEFAULT
 * (`gen_random_uuid()`) on INSERT and NEVER regenerated — sharing the
 * URL twice must resolve to the same row (otherwise the user's existing
 * URL would 404 after they re-toggled the switch).
 *
 * Auth: USER JWT (serverSupabaseClient forwards it). RLS WITH CHECK
 * enforces user_id = auth.uid() on both INSERT and UPDATE — the
 * payload's user_id is therefore pinned to the caller, not trusted from
 * the request body.
 *
 * Privacy default (v2 §0 4. elv): the body's `is_public` flag is
 * REQUIRED. A user who has never called this endpoint has no row at
 * all, which is functionally equivalent to is_public = false — the GET
 * /api/lists/[id] two-key gate rejects those tokens. So the privacy
 * default is private, both at the schema level (column default false)
 * AND at the row-existence level (no row = no leak).
 */
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' });
  }

  // A serverSupabaseUser() JwtPayload-ot ad (sub = auth.users.uuid) — getUserId helper.
  const userId = getUserId(user);

  const body = await readBody(event);
  const parsed = publicListUpsertSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid public-list payload',
      data: parsed.error.flatten(),
    });
  }

  const supabase = await serverSupabaseClient<Database>(event);

  // ON CONFLICT (user_id) DO UPDATE — keeps the original share_token
  // alive across re-toggles. The user can copy the URL once and trust
  // it until they DELETE the row.
  const { data, error } = await supabase
    .from('public_lists')
    .upsert(
      {
        user_id: userId,
        is_public: parsed.data.is_public,
        label: parsed.data.label ?? null,
        expires_at: parsed.data.expires_at ?? null,
      },
      { onConflict: 'user_id' }
    )
    .select('*')
    .single();

  if (error) {
    throw createError({
      statusCode: 400,
      statusMessage: `Failed to update public list: ${error.message}`,
    });
  }

  // Return the FULL row so the client can read share_token + is_public
  // without a second GET. Cast through PublicListRow to keep the typed
  // surface honest.
  return data as unknown as PublicListRow;
});