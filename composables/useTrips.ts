/**
 * Composable wrapper around /api/trips/*.
 *
 * Mirrors the useGear / useWishlist pattern:
 *   * shares a reactive items list + current trip + loading/error flags
 *     via useState so multiple components stay in sync,
 *   * own-rows-only is enforced server-side by Supabase RLS,
 *   * writes surface errors into state.error so any page can show
 *     ErrorBanner without per-call try/catch.
 *
 * Nested gear mutations (`addGear` / `updateGearQty` / `removeGear`)
 * keep `state.current.trip_gear` in sync after the server returns, so
 * the TripGearPicker re-renders without a refetch.
 */
import type {
  TripRow,
  TripInsert,
  TripUpdate,
  TripWithGear,
  TripGearRow,
  GpxMetadata,
  TripShareInviteRow,
  TripCommentRow,
  TripCommentRowWithPending,
  EmailLookupResult,
} from '~/types/db';
import type {
  TripGearAddInput,
  TripGearUpdateInput,
} from '~/shared/tripSchemas';
import type { InviteCreateInput } from '~/shared/tripShareSchemas';

export interface TripState {
  items: TripRow[];
  current: TripWithGear | null;
  /** Per-trip invite lists, keyed by trip_id. Used by the page UI. */
  invitesByTripId: Record<string, TripShareInviteRow[]>;
  /** Per-trip comment lists, keyed by trip_id. */
  commentsByTripId: Record<string, TripCommentRowWithPending[]>;
  /** Resolved comment-author emails keyed by user_id (shared w/ useGearComments cache namespace is fine — keys are uuid). */
  emailById: Record<string, string>;
  loading: boolean;
  error: string | null;
}

/** Local-only id prefix so we can identify optimistic placeholders. */
const TRIP_COMMENT_PENDING_PREFIX = 'trip-pending-';

function genTripPendingId(): string {
  return `${TRIP_COMMENT_PENDING_PREFIX}${crypto.randomUUID()}`;
}

export function useTrips() {
  const state = useState<TripState>('trips', () => ({
    items: [],
    current: null,
    invitesByTripId: {},
    commentsByTripId: {},
    emailById: {},
    loading: false,
    error: null,
  }));

  const setError = (e: unknown) => {
    const err = e as { statusMessage?: string; message?: string };
    state.value.error = err?.statusMessage ?? err?.message ?? 'Unexpected error';
  };

  const list = async () => {
    state.value.loading = true;
    state.value.error = null;
    try {
      const rows = await $fetch<TripRow[]>('/api/trips');
      state.value.items = rows ?? [];
    } catch (e) {
      setError(e);
    } finally {
      state.value.loading = false;
    }
  };

  const get = async (id: string) => {
    state.value.loading = true;
    state.value.error = null;
    try {
      const row = await $fetch<TripWithGear>(`/api/trips/${id}`);
      state.value.current = row;
      // Mirror the gear list into the cache so list views can show counts.
      const idx = state.value.items.findIndex((t) => t.id === id);
      if (idx >= 0) {
        // Keep the row reference but don't blow away the card-grid shape.
        state.value.items[idx] = { ...state.value.items[idx] };
      }
      return row;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      state.value.loading = false;
    }
  };

  const create = async (input: TripInsert) => {
    state.value.error = null;
    try {
      const row = await $fetch<TripRow>('/api/trips', {
        method: 'POST',
        body: input,
      });
      state.value.items = [row, ...state.value.items];
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  const update = async (id: string, patch: TripUpdate) => {
    state.value.error = null;
    try {
      const row = await $fetch<TripRow>(`/api/trips/${id}`, {
        method: 'PATCH',
        body: patch,
      });
      state.value.items = state.value.items.map((t) => (t.id === id ? row : t));
      if (state.value.current?.id === id) {
        state.value.current = { ...state.value.current, ...row };
      }
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  const remove = async (id: string) => {
    state.value.error = null;
    try {
      await $fetch(`/api/trips/${id}`, { method: 'DELETE' });
      state.value.items = state.value.items.filter((t) => t.id !== id);
      if (state.value.current?.id === id) {
        state.value.current = null;
      }
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /**
   * Attaches one gear_item to the trip. The `gearItemId` is the FK; the
   * trip id is the route param. `quantity` defaults to 1 on the server.
   * On success, the new row is merged into state.current.trip_gear.
   */
  const addGear = async (
    tripId: string,
    gearItemId: string,
    quantity: number = 1
  ) => {
    state.value.error = null;
    try {
      const payload: TripGearAddInput = { gear_item_id: gearItemId, quantity };
      const row = await $fetch<TripGearRow>(`/api/trips/${tripId}/gear`, {
        method: 'POST',
        body: payload,
      });
      if (state.value.current?.id === tripId) {
        const exists = state.value.current.trip_gear.some(
          (g) => g.gear_item_id === row.gear_item_id
        );
        state.value.current.trip_gear = exists
          ? state.value.current.trip_gear.map((g) =>
              g.gear_item_id === row.gear_item_id ? row : g
            )
          : [...state.value.current.trip_gear, row];
      }
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /**
   * Updates the quantity on an existing trip_gear row.
   */
  const updateGearQty = async (
    tripId: string,
    gearItemId: string,
    quantity: number
  ) => {
    state.value.error = null;
    try {
      const payload: TripGearUpdateInput = { quantity };
      const row = await $fetch<TripGearRow>(
        `/api/trips/${tripId}/gear/${gearItemId}`,
        { method: 'PATCH', body: payload }
      );
      if (state.value.current?.id === tripId) {
        state.value.current.trip_gear = state.value.current.trip_gear.map(
          (g) => (g.gear_item_id === gearItemId ? row : g)
        );
      }
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /**
   * Removes a gear_item from the trip. On success the row is filtered
   * out of state.current.trip_gear.
   */
  const removeGear = async (tripId: string, gearItemId: string) => {
    state.value.error = null;
    try {
      await $fetch(`/api/trips/${tripId}/gear/${gearItemId}`, {
        method: 'DELETE',
      });
      if (state.value.current?.id === tripId) {
        state.value.current.trip_gear = state.value.current.trip_gear.filter(
          (g) => g.gear_item_id !== gearItemId
        );
      }
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /**
   * Uploads a .gpx file for the given trip. Wraps the file in FormData
   * (along with an optional target_date) and POSTs to
   * `/api/trips/:id/gpx`. Server-side: parses → replaces trackpoints →
   * writes gpx_metadata + planned_* on the trips row.
   *
   * On success, the new metadata is mirrored into state.current so the
   * summary card re-renders without a refetch. Errors surface through
   * state.error AND are re-thrown so the upload button can show its own
   * spinner / disabled state.
   */
  const uploadGpx = async (
    tripId: string,
    file: File,
    opts?: { target_date?: string | null }
  ): Promise<{
    metadata: GpxMetadata;
    trackpoints: Array<{
      id: string;
      seq: number;
      lat: number;
      lon: number;
      elevation_m: number | null;
      recorded_at: string | null;
      is_summary: boolean;
    }>;
  }> => {
    state.value.error = null;
    const fd = new FormData();
    fd.append('file', file, file.name);
    if (opts?.target_date) {
      fd.append('target_date', opts.target_date);
    }
    try {
      const result = await $fetch<{
        metadata: GpxMetadata;
        target_date: string | null;
        planned_distance_km: number | null;
        planned_elevation_gain_m: number | null;
        trackpoints: Array<{
          id: string;
          seq: number;
          lat: number;
          lon: number;
          elevation_m: number | null;
          recorded_at: string | null;
          is_summary: boolean;
        }>;
      }>(`/api/trips/${tripId}/gpx`, {
        method: 'POST',
        body: fd,
      });
      if (state.value.current?.id === tripId) {
        state.value.current = {
          ...state.value.current,
          gpx_metadata: result.metadata,
          target_date: result.target_date,
          planned_distance_km: result.planned_distance_km,
          planned_elevation_gain_m: result.planned_elevation_gain_m,
        };
      }
      // Mirror the cache key for any other component that called
      // useFetch('trip-' + tripId, ...).
      await refreshNuxtData(`trip-${tripId}`).catch(() => undefined);
      return {
        metadata: result.metadata,
        trackpoints: result.trackpoints,
      };
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /**
   * Fetches the GPX metadata + stored trackpoints for a trip. Used by
   * the SVG preview component when the trip was loaded from the list
   * endpoint (which does not include gpx_metadata).
   */
  const getTrackPreview = async (
    tripId: string,
  ): Promise<{
    metadata: GpxMetadata | null;
    trackpoints: Array<{
      id: string;
      seq: number;
      lat: number;
      lon: number;
      elevation_m: number | null;
      recorded_at: string | null;
      is_summary: boolean;
    }>;
  }> => {
    state.value.error = null;
    try {
      const result = await $fetch<{
        metadata: GpxMetadata | null;
        trackpoints: Array<{
          id: string;
          seq: number;
          lat: number;
          lon: number;
          elevation_m: number | null;
          recorded_at: string | null;
          is_summary: boolean;
        }>;
      }>(`/api/trips/${tripId}/gpx`, { method: 'GET' });
      return {
        metadata: result.metadata,
        trackpoints: result.trackpoints,
      };
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  // -------------------------------------------------------------------------
  // P2 Social — invites + trip comments
  // -------------------------------------------------------------------------

  /**
   * Owner-only: invite a friend by email to the trip. Idempotent on
   * (trip_id, email) — the server returns the existing pending row
   * instead of throwing on a re-click.
   */
  const inviteByEmail = async (tripId: string, email: string) => {
    state.value.error = null;
    try {
      const payload: InviteCreateInput = { invitee_email: email.trim() };
      const row = await $fetch<TripShareInviteRow>(
        `/api/trips/${tripId}/invites`,
        { method: 'POST', body: payload },
      );
      const cur = state.value.invitesByTripId[tripId] ?? [];
      const filtered = cur.filter((r) => r.id !== row.id);
      state.value.invitesByTripId[tripId] = [row, ...filtered];
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /**
   * Owner-only: lists the trip's invites. status query is forwarded
   * (default 'pending') so the page can show pending vs accepted.
   */
  const listInvites = async (
    tripId: string,
    status: 'pending' | 'accepted' | 'declined' | 'incoming' = 'pending',
  ) => {
    state.value.error = null;
    try {
      const rows = await $fetch<TripShareInviteRow[]>(
        `/api/trips/${tripId}/invites`,
        { query: { status } },
      );
      state.value.invitesByTripId[tripId] = rows ?? [];
      return rows ?? [];
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /** Invitee accepts an invite by id. */
  const acceptInvite = async (tripId: string, inviteId: string) => {
    state.value.error = null;
    try {
      const row = await $fetch<TripShareInviteRow>(
        `/api/trips/${tripId}/invites/${inviteId}/accept`,
        { method: 'POST' },
      );
      const cur = state.value.invitesByTripId[tripId] ?? [];
      state.value.invitesByTripId[tripId] = cur.map((r) =>
        r.id === row.id ? row : r,
      );
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /** Invitee declines an invite by id. */
  const declineInvite = async (tripId: string, inviteId: string) => {
    state.value.error = null;
    try {
      const row = await $fetch<TripShareInviteRow>(
        `/api/trips/${tripId}/invites/${inviteId}/decline`,
        { method: 'POST' },
      );
      const cur = state.value.invitesByTripId[tripId] ?? [];
      state.value.invitesByTripId[tripId] = cur.map((r) =>
        r.id === row.id ? row : r,
      );
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /** Owner-only: hard-delete an invite row (vs decline which records responded_at). */
  const removeInvite = async (tripId: string, inviteId: string) => {
    state.value.error = null;
    try {
      await $fetch(`/api/trips/${tripId}/invites/${inviteId}`, {
        method: 'DELETE',
      });
      const cur = state.value.invitesByTripId[tripId] ?? [];
      state.value.invitesByTripId[tripId] = cur.filter((r) => r.id !== inviteId);
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /**
   * Fetches the trip's comment thread. Backed by RLS SELECT (visible
   * to owner / accepted invitee / accepted friend of the owner) so a
   * stranger gets an empty list (not a 404).
   */
  const listTripComments = async (tripId: string) => {
    state.value.error = null;
    try {
      const rows = await $fetch<TripCommentRow[]>(
        `/api/trips/${tripId}/comments`,
      );
      state.value.commentsByTripId[tripId] = (rows ?? []).map((r) => ({
        ...r,
        pending: false,
      }));
      await resolveEmailsForTrip(tripId);
      return rows ?? [];
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /**
   * Optimistic add: pushes a placeholder row, awaits the server, then
   * replaces with the canonical row on success (or removes on error).
   */
  const addTripComment = async (tripId: string, body: string) => {
    state.value.error = null;
    const me = useSupabaseUser();
    const callerId = me.value?.id ?? '';
    const cur = state.value.commentsByTripId[tripId] ?? [];
    const placeholder: TripCommentRowWithPending = {
      id: genTripPendingId(),
      trip_id: tripId,
      user_id: callerId,
      body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      pending: true,
    };
    state.value.commentsByTripId[tripId] = [placeholder, ...cur];

    try {
      const row = await $fetch<TripCommentRow>(
        `/api/trips/${tripId}/comments`,
        { method: 'POST', body: { body } },
      );
      const next = state.value.commentsByTripId[tripId] ?? [];
      state.value.commentsByTripId[tripId] = next.map((c) =>
        c.id === placeholder.id ? { ...row, pending: false } : c,
      );
      return row;
    } catch (e) {
      const next = state.value.commentsByTripId[tripId] ?? [];
      state.value.commentsByTripId[tripId] = next.filter(
        (c) => c.id !== placeholder.id,
      );
      setError(e);
      throw e;
    }
  };

  /** Edit a comment (author-only enforced server-side via RLS). */
  const updateTripComment = async (
    tripId: string,
    commentId: string,
    body: string,
  ) => {
    state.value.error = null;
    try {
      const row = await $fetch<TripCommentRow>(
        `/api/trips/${tripId}/comments/${commentId}`,
        { method: 'PATCH', body: { body } },
      );
      const next = state.value.commentsByTripId[tripId] ?? [];
      state.value.commentsByTripId[tripId] = next.map((c) =>
        c.id === commentId ? { ...row, pending: false } : c,
      );
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /** Delete a comment (author OR trip owner, enforced server-side via RLS). */
  const removeTripComment = async (tripId: string, commentId: string) => {
    state.value.error = null;
    try {
      await $fetch(`/api/trips/${tripId}/comments/${commentId}`, {
        method: 'DELETE',
      });
      const next = state.value.commentsByTripId[tripId] ?? [];
      state.value.commentsByTripId[tripId] = next.filter(
        (c) => c.id !== commentId,
      );
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /** Batched email lookup for comment authors we don't have an email for. */
  const resolveEmailsForTrip = async (tripId: string) => {
    const rows = state.value.commentsByTripId[tripId] ?? [];
    const missing = Array.from(
      new Set(
        rows
          .map((c) => c.user_id)
          .filter((id) => id && !state.value.emailById[id]),
      ),
    );
    if (missing.length === 0) return;
    try {
      const resolved = await $fetch<EmailLookupResult[]>(
        '/api/auth/lookup-emails',
        { method: 'POST', body: { ids: missing } },
      );
      for (const r of resolved ?? []) {
        state.value.emailById[r.user_id] = r.email;
      }
    } catch (e) {
      // Don't surface email-lookup failures as a global error — the
      // thread still renders, just with the author uuid shown.
      // eslint-disable-next-line no-console
      console.warn('lookup-emails failed', e);
    }
  };

  /** Cached email lookup for a comment author user_id. */
  const tripCommentAuthorEmail = (userId: string): string | null =>
    state.value.emailById[userId] ?? null;

  /**
   * Cross-trip badge feed: returns invites addressed to the current
   * user (status='pending') from any trip. Used by the AppHeader badge.
   */
  const listIncomingInvites = async () => {
    state.value.error = null;
    try {
      // The trip id in the URL is ignored when status='incoming' — we
      // still have to pass one to hit the endpoint, so use any trip the
      // user has access to (the trip id from state.current, or the
      // first cached trip, or '00000000-...'). The server's RLS scopes
      // the result to caller-visible rows so the placeholder trip id
      // is safe.
      const fallbackTripId =
        state.value.current?.id ??
        state.value.items[0]?.id ??
        '00000000-0000-0000-0000-000000000000';
      const rows = await $fetch<TripShareInviteRow[]>(
        `/api/trips/${fallbackTripId}/invites`,
        { query: { status: 'incoming' } },
      );
      return rows ?? [];
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  const resetError = () => {
    state.value.error = null;
  };

  return {
    state,
    list,
    get,
    create,
    update,
    remove,
    addGear,
    updateGearQty,
    removeGear,
    uploadGpx,
    getTrackPreview,
    inviteByEmail,
    listInvites,
    acceptInvite,
    declineInvite,
    removeInvite,
    listTripComments,
    addTripComment,
    updateTripComment,
    removeTripComment,
    resolveEmailsForTrip,
    tripCommentAuthorEmail,
    listIncomingInvites,
    resetError,
  };
}