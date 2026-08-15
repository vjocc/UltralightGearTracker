import { getServiceRoleClient } from '~/server/utils/publicShareClient';
import type { PublicListResponse } from '~/types/db';

/**
 * GET /api/lists/[id]
 *
 * Public, ANONYMOUS endpoint that resolves a share_token (the `[id]`
 * route param) to a minimal gear projection of the OWNER's current
 * `gear_items` rows.
 *
 * v2 §0 alignment:
 *   1. elv (no snapshot): SELECT reads the live `gear_items` table at
 *      request time. Edits made by the owner since publishing are visible
 *      immediately. No denormalised copy.
 *   2. elv (anonymous): no JWT is required. We use the SERVICE ROLE
 *      client (RLS bypass) because the alternative — serverSupabaseClient
 *      — forwards the (absent) auth.uid() and so cannot read gear rows.
 *      The two-key gate that justifies this bypass lives in the DB:
 *      `public_list_lookup(p_share_token)` returns the owner_user_id
 *      IFF the token exists AND is_public = true AND not expired.
 *   4. elv (schema-level is_public): the helper enforces it server-side.
 *   5. elv (My Gear projection): the public_lists row references
 *      user_id, not a trip_id — the URL exposes the OWNER's gear, never
 *      a Trip record's gear.
 *
 * Error semantics:
 *   404 when the token doesn't resolve (private, unknown, expired, or
 *   malformed). We deliberately do NOT distinguish 401/403/404 — the
 *   caller gets the same response for "private" and "missing" so a
 *   hostile probe cannot enumerate tokens.
 */
export default defineEventHandler(async (event): Promise<PublicListResponse> => {
  const rawId = getRouterParam(event, 'id') ?? '';

  // Validate shape: must be a UUID. Reject early so we never even hit
  // the DB for garbage tokens. (The DB helper would also reject, but
  // the early-out saves a round-trip and a 500 if someone URL-encodes
  // nonsense into /list/{id}.)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId)) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }

  const supabase = getServiceRoleClient();

  // Two-key gate: token + is_public + not-expired. The helper returns
  // 0..1 rows of (owner_user_id uuid); if it returns 0, the caller is
  // rejected with 404 regardless of WHY (private / unknown / expired).
  const { data: lookupRows, error: lookupError } = await supabase.rpc(
    'public_list_lookup',
    { p_share_token: rawId }
  );

  if (lookupError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Public share lookup failed',
    });
  }

  const ownerRow = (lookupRows as Array<{ owner_user_id: string }> | null)?.[0];
  if (!ownerRow?.owner_user_id) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' });
  }

  // JOIN the live `gear_items` table for the resolved owner. The service
  // role client bypasses gear_items.user_id RLS — exactly what we want
  // because we've already authorised the read via the two-key gate.
  // We select only the three columns the public page needs (v2 §0 4. elv:
  // minimal scope). `categories(name)` provides the category label;
  // categories are global (see migration 20260814100000_categories_globalize.sql)
  // so the owner doesn't need a join-back through their user_id.
  const { data: gear, error: gearError } = await supabase
    .from('gear_items')
    .select('id, name, weight_g, categories:category_id(name)')
    .eq('user_id', ownerRow.owner_user_id)
    .order('created_at', { ascending: false });

  if (gearError) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to load shared gear list',
    });
  }

  type JoinedRow = {
    id: string;
    name: string;
    weight_g: number;
    categories: { name: string } | { name: string }[] | null;
  };
  const rows = (gear ?? []) as unknown as JoinedRow[];

  // We also want the LIST's label (not the gear table's), so fetch it
  // through the same service-role path. We don't need the share_token
  // again — it's already in the URL — but the label IS editable
  // independently of gear, so it's worth a separate read.
  const { data: listRow } = await supabase
    .from('public_lists')
    .select('label')
    .eq('share_token', rawId)
    .maybeSingle();

  const label =
    (listRow as { label?: string | null } | null)?.label ?? null;

  return {
    owner_user_id: ownerRow.owner_user_id,
    label,
    gear: rows.map((g) => ({
      id: g.id,
      name: g.name,
      // PostgREST returns the embedded FK as object OR array depending on
      // cardinality; categories are 1:1 so we coerce defensively.
      category_name:
        Array.isArray(g.categories)
          ? g.categories[0]?.name ?? null
          : g.categories?.name ?? null,
      weight_g: g.weight_g,
    })),
  };
});