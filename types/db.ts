/**
 * Hand-typed mirror of supabase/migrations/*.
 * Replace with `npx supabase gen types typescript --project-id <ref>`
 * once a real Supabase project is available.
 */

export type UUID = string;

export interface CategoryRow {
  id: UUID;
  user_id: UUID;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface GearItemRow {
  id: UUID;
  user_id: UUID;
  name: string;
  category_id: UUID;
  weight_g: number;
  price: number | null;
  excluded_from_base: boolean;
  created_at: string;
  updated_at: string;
}

export interface GearItemInsert {
  name: string;
  category_id: UUID;
  weight_g: number;
  price?: number | null;
  excluded_from_base?: boolean;
}

export interface GearItemUpdate {
  name?: string;
  category_id?: string;
  weight_g?: number;
  price?: number | null;
  excluded_from_base?: boolean;
}

export interface WishlistItemRow {
  id: UUID;
  user_id: UUID;
  name: string;
  category_id: UUID;
  retailer_url: string;
  current_price: number | null;
  /** Price alert threshold. NULL means "no alert". */
  target_price: number | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WishlistItemInsert {
  name: string;
  category_id: UUID;
  retailer_url: string;
  current_price?: number | null;
  target_price?: number | null;
}

export interface WishlistItemUpdate {
  name?: string;
  category_id?: string;
  retailer_url?: string;
  current_price?: number | null;
  target_price?: number | null;
}

/**
 * Trip row (see supabase/migrations/20260813000000_trips.sql).
 * Dates are stored as DATE in Postgres — surfaced as YYYY-MM-DD strings
 * by the typed client. user_id is set by auth.uid() at INSERT time.
 */
export interface TripRow {
  id: UUID;
  user_id: UUID;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripInsert {
  name: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface TripUpdate {
  name?: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

/**
 * GPX metadata (see supabase/migrations/20260813100000_gpx_import.sql).
 * Stored as a single JSONB blob on `trips.gpx_metadata` — the server-side
 * GPX parser fills this in after a successful upload and the page reads it
 * for the summary card. Shape is the in-memory mirror of what the parser
 * produces; the database column is `jsonb` so additional fields are tolerated.
 */
export interface GpxMetadata {
  total_distance_km: number;
  elevation_gain_m: number;
  duration_min: number | null;
  max_elevation_m: number | null;
  /** Original uploaded filename, surfaced in the UI for reference. */
  source: string;
  /** ISO timestamp of when the parser ran (server clock, UTC). */
  uploaded_at: string;
  /** Number of source trackpoints before the 400-point reduction. */
  point_count: number;
}

/**
 * Trip row including the new GPX-related columns.
 */
export interface TripRowWithGpx extends TripRow {
  gpx_metadata: GpxMetadata | null;
  target_date: string | null;
  planned_distance_km: number | null;
  planned_elevation_gain_m: number | null;
}

/**
 * Trackpoint row (see public.gpx_track_points). The server parser keeps at
 * most 400 rows per trip (first 200 + last 200 + 1 summary midpoint). The
 * `is_summary` flag marks the synthetic midpoint row so the UI can skip it
 * when drawing a continuous track.
 */
export interface GpxTrackPointRow {
  id: UUID;
  trip_id: UUID;
  seq: number;
  lat: number;
  lon: number;
  elevation_m: number | null;
  recorded_at: string | null;
  is_summary: boolean;
}

export interface GpxTrackPointInsert {
  trip_id: UUID;
  seq: number;
  lat: number;
  lon: number;
  elevation_m?: number | null;
  recorded_at?: string | null;
  is_summary?: boolean;
}

// Insert/Update payloads flow through the `TableShape.Insert` /
// `TableShape.Update` slots on the typed Database, both of which are
// constrained to `Record<string, unknown>`. Mirrors the GearItemInsert
// pattern documented above — widen at the type boundary so concrete
// shapes are still checked but the GenericTable constraint is satisfied.
export type GpxTrackPointInsertPayload = GpxTrackPointInsert &
  Record<string, unknown>;

/**
 * M:N switch table: trips ↔ gear_items.
 * The (trip_id, gear_item_id) pair is unique (composite PK). `quantity`
 * defaults to 1 at the DB layer and is CHECK-constrained to >= 1.
 */
export interface TripGearRow {
  trip_id: UUID;
  gear_item_id: UUID;
  quantity: number;
  added_at: string;
}

export interface TripGearInsert {
  trip_id: UUID;
  gear_item_id: UUID;
  quantity?: number;
}

export interface TripGearUpdate {
  quantity?: number;
}

/**
 * Detail-view shape: trip with its M:N switch rows inline + the GPX
 * columns introduced by the 20260813100000_gpx_import.sql migration.
 * The server endpoint uses PostgREST's `select(*, trip_gear(*))` to
 * hydrate this in a single round-trip.
 */
export type TripWithGear = TripRowWithGpx & {
  trip_gear: TripGearRow[];
};

/**
 * Friend relationships (see supabase/migrations/20260813010000_friendships.sql).
 * Rows are stored in canonical (user_a < user_b) order so a single row
 * represents the pair regardless of which side initiated the request.
 * `requested_by` records the initiator so the receiver side can be
 * distinguished in UI badges (incoming vs outgoing).
 */
export type FriendStatus = 'pending' | 'accepted' | 'blocked';

export interface FriendshipRow {
  id: UUID;
  user_a: UUID;
  user_b: UUID;
  status: FriendStatus;
  requested_by: UUID;
  created_at: string;
  accepted_at: string | null;
}

/**
 * UI-facing friend entry: the canonical FriendshipRow plus the resolved
 * `friend_id` (the other side of the pair) and the friend's email. The
 * server endpoint computes `friend_id` by comparing the caller's uuid to
 * the row's user_a / user_b and `friend_email` by looking up auth.users
 * via the SECURITY DEFINER `friend_search_users` helper.
 */
export interface FriendListEntry {
  id: UUID;
  status: FriendStatus;
  friend_id: UUID;
  friend_email: string;
  requested_by: UUID;
  accepted_at: string | null;
  created_at: string;
}

/**
 * Return shape of GET /api/friends?email=… — the raw lookup result from
 * `public.friend_search_users(email)`. Distinct from FriendListEntry so
 * the search endpoint does not have to invent a "no relationship yet"
 * shape.
 */
export interface FriendSearchResult {
  user_id: UUID;
  email: string;
}

/**
 * Gear comments (see supabase/migrations/20260813020000_gear_comments.sql).
 *
 * A flat comment thread per gear_items row. Visibility is gated by RLS:
 * the parent gear_item must be visible to the caller (gear owner OR an
 * accepted friend of the gear owner). The `pending` flag is a client-only
 * optimistic-insert marker — never persisted server-side — used by
 * useGearComments to flag rows that have not yet been confirmed by the
 * server response.
 */
export interface GearCommentRow {
  id: UUID;
  gear_item_id: UUID;
  user_id: UUID;
  body: string;
  created_at: string;
  updated_at: string;
}

/**
 * Client-side extension of GearCommentRow that adds the optimistic-insert
 * `pending` flag. Lives here (rather than inside the composable) so the
 * component prop type can reference it without an awkward
 * `ReturnType<typeof useGearComments>['state']` chain.
 */
export type GearCommentRowWithPending = GearCommentRow & {
  pending?: boolean;
};

export interface GearCommentInsert {
  body: string;
}

export interface GearCommentUpdate {
  body: string;
}

/**
 * Trip share invites (see supabase/migrations/20260813110000_trip_share.sql).
 *
 * Owner → email-based meghívás a túrára. `invitee_user_id` kitöltve, ha a
 * `friend_search_users` SECURITY DEFINER helper már regisztrált user-t
 * talált az email-re az INSERT pillanatában; ha nem, a meghívó "pending"
 * marad az accept kísérletig (az accept endpoint 400-at dob, ha a user
 * még nem regisztrált). A `responded_at` kitöltendő, amint a státusz
 * 'accepted' vagy 'declined' lesz.
 */
export type TripInviteStatus = 'pending' | 'accepted' | 'declined';

export interface TripShareInviteRow {
  id: UUID;
  trip_id: UUID;
  inviter_id: UUID;
  invitee_email: string;
  invitee_user_id: UUID | null;
  status: TripInviteStatus;
  created_at: string;
  responded_at: string | null;
}

/**
 * Trip comments (see supabase/migrations/20260813110000_trip_share.sql).
 *
 * Flat comment thread per trip. Visibility gated by trip_visible_to (owner
 * + accepted invitee + accepted friend). The `pending` flag is a
 * client-only optimistic-insert marker — never persisted server-side.
 */
export interface TripCommentRow {
  id: UUID;
  trip_id: UUID;
  user_id: UUID;
  body: string;
  created_at: string;
  updated_at: string;
}

export type TripCommentRowWithPending = TripCommentRow & {
  pending?: boolean;
};

export interface TripCommentInsert {
  body: string;
}

export interface TripCommentUpdate {
  body: string;
}

/**
 * Return shape of /api/auth/lookup-emails — (user_id, email) pairs
 * resolved by the `gear_comment_lookup_authors` SECURITY DEFINER helper.
 * Only uuids the caller can already see (comment authors on visible gear
 * items) are returned.
 */
export interface EmailLookupResult {
  user_id: UUID;
  email: string;
}

/**
 * Database shape consumed by @nuxtjs/supabase's typed client.
 *
 * Implementation note — `GenericTable` compatibility:
 * `@supabase/supabase-js` defines `GenericTable = {
 *   Row: Record<string, unknown>;
 *   Insert: Record<string, unknown>;
 *   Update: Record<string, unknown>;
 *   Relationships: GenericRelationship[];
 * }`. Under `vue-tsc`'s strict mode, a concrete `Row` interface (with
 * specific keys like `id`, `user_id`) is NOT considered a structural
 * subtype of `Record<string, unknown>` in object-literal position, even
 * though every concrete object IS assignable to `Record<string, unknown>`.
 * The fix is to widen the Row shape via intersection:
 *   `Row: GearItemRow & Record<string, unknown>`
 * which keeps the concrete fields for `.select()` return types AND
 * satisfies the `GenericTable.Row` constraint under strict checks.
 *
 * Narrower field-level validation for `.insert()` / `.update()` payloads
 * is enforced at the API edge by zod schemas in `server/utils/*Schemas.ts`.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type EmptyRelationships = [];

type TableShape<Row> = {
  Row: Row & Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: EmptyRelationships;
};

/**
 * Row shape of the gear_base_weights_view (see migration
 * 20260812090000_base_weight_view.sql). The view is created with
 * security_invoker = true, so RLS from gear_items is inherited.
 */
export interface GearBaseWeightRow {
  gear_item_id: UUID;
  user_id: UUID;
  category_id: UUID | null;
  category_name: string | null;
  grams: number;
  excluded_from_base: boolean;
}

/**
 * Row shape of the trip_weight_summary view (see migration
 * 20260813090000_trip_weight_summary.sql). The view is created with
 * security_invoker = true, so RLS from trips/trip_gear/gear_items is
 * inherited (owner-scoped on trips + parent-trip ownership join on
 * trip_gear + user_id = auth.uid() on gear_items).
 *
 * One row per trip; total_grams/item_count are coalesce(... , 0) so
 * empty trips still surface a row.
 */
export interface TripWeightRow {
  trip_id: UUID;
  user_id: UUID;
  total_grams: number;
  item_count: number;
}

type ViewShape<Row> = {
  Row: Row & Record<string, unknown>;
  Relationships: EmptyRelationships;
};

export interface Database {
  public: {
    Tables: {
      categories: TableShape<CategoryRow>;
      gear_items: TableShape<GearItemRow>;
      wishlist_items: TableShape<WishlistItemRow>;
      trips: TableShape<TripRow>;
      trip_gear: TableShape<TripGearRow>;
      friendships: TableShape<FriendshipRow>;
      gear_comments: TableShape<GearCommentRow>;
      gpx_track_points: TableShape<GpxTrackPointRow>;
      trip_share_invites: TableShape<TripShareInviteRow>;
      trip_comments: TableShape<TripCommentRow>;
    };
    Views: {
      gear_base_weights_view: ViewShape<GearBaseWeightRow>;
      trip_weight_summary: ViewShape<TripWeightRow>;
    };
    /**
     * SECURITY DEFINER RPC names exported from migrations. The shape is
     * intentionally empty — the typed client does not need the return
     * shape, and surfacing only the existence is enough to avoid
     * `Property 'rpc' does not exist` at the call site.
     */
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}