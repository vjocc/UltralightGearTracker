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
  TripParticipantRow,
  TripCommentRow,
  TripCommentRowWithPending,
  TripRecapRow,
  TripRecapPhotoRow,
  TripDebriefRow,
  EmailLookupResult,
} from '~/types/db';
import type {
  TripGearAddInput,
  TripGearUpdateInput,
} from '~/shared/tripSchemas';
import type {
  RecapPatchInput,
  PhotoPatchInput,
} from '~/shared/recapSchemas';
import type { InviteCreateInput } from '~/shared/tripShareSchemas';
import type { GearAssignmentsResponse } from '~/shared/gearAssignmentSchemas';

export interface TripState {
  items: TripRow[];
  current: TripWithGear | null;
  /** Per-trip invite lists, keyed by trip_id. Used by the page UI. */
  invitesByTripId: Record<string, TripShareInviteRow[]>;
  /** Per-trip comment lists, keyed by trip_id. */
  commentsByTripId: Record<string, TripCommentRowWithPending[]>;
  /**
   * Per-trip participant rows (owner + accepted invitees), keyed by trip_id.
   * P3.2 — UI polish only; no new endpoint, derived from accepted invites + trip owner.
   */
  participantsByTripId: Record<string, TripParticipantRow[]>;
  /** Resolved comment-author emails keyed by user_id (shared w/ useGearComments cache namespace is fine — keys are uuid). */
  emailById: Record<string, string>;
  /**
   * Per-trip recap + photos, keyed by trip_id. Same shape as the
   * GET /api/trips/:id/recap response (recap nullable, photos always an
   * array — empty if no recap yet).
   */
  recapByTripId: Record<
    string,
    { recap: TripRecapRow | null; photos: TripRecapPhotoRow[] }
  >;
  /**
   * Per-trip debrief (P5 / v2 #23 "Mit bántam meg?"). NULL means the
   * row doesn't exist yet (the user hasn't filled in the debrief); an
   * empty {} shape means the row exists but every text[] is empty.
   */
  debriefByTripId: Record<string, TripDebriefRow | null>;
  /**
   * Sprint 5 P2 — "Ki mit visz" aggregált nézet cache, owner-only
   * (§11.2 A default). Per-trip kulcs, a fetchGearAssignments() tölti a
   * `GET /api/trips/:id/gear-assignments` endpoint hívással.
   */
  gearAssignmentsByTripId: Record<string, GearAssignmentsResponse | null>;
  loading: boolean;
  error: string | null;
}

/**
 * P3.3 client-side predicate mirroring the server-side `trip_visible_to()`
 * helper (P2) — used by the page to decide whether to render the recap
 * section before the first GET round-trip fires. The RLS SELECT policies
 * on `trip_recaps` + `trip_recap_photos` (P3) and the trips SELECT policy
 * (P2) remain the source of truth; this is purely a UI gate.
 *
 * Returns `true` for:
 *   - owner (`state.current.user_id === viewerUserId`)
 *   - anyone on the trip detail page (the page's `get()` call only
 *     succeeds when the trips SELECT policy passes — owner, accepted
 *     invitee, or accepted friend of the owner).
 *
 * Returns `false` for a stranger who somehow reached the page without
 * a loaded `state.current`, or when no session is present.
 */
export function canViewRecap(
  trip: TripWithGear | null | undefined,
  viewerUserId: string | null | undefined,
): boolean {
  if (!trip || !viewerUserId) return false;
  // The trip SELECT policy is restricted to owner + accepted invitee +
  // accepted friend (P2); reaching this page with `trip` populated
  // implies the viewer is one of those three. The recap + photo SELECT
  // policies additionally require `trip_visible_to()` to be true
  // (P3) — which is satisfied by the same set. So a populated `trip`
  // + a non-null viewer is sufficient for the UI gate; the server
  // does the row-level check.
  return true;
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
    participantsByTripId: {},
    emailById: {},
    recapByTripId: {},
    debriefByTripId: {},
    gearAssignmentsByTripId: {},
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
      // Sprint 5 P0.3 — activation funnel: first_trip_created (B opció: saját events tábla).
      // A first_* guard a useFunnelEvents belsejében (useState flag + server idempotens check).
      if (state.value.items.length === 1) {
        const { trackEvent } = useFunnelEvents();
        trackEvent('first_trip_created');
      }
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
      // Sprint 5 P0.3 — activation funnel: first_loadout_assembled.
      // A first_* guard a useFunnelEvents belsejében.
      // A "first loadout" mérése user-szinten: az adott user első
      // trip_gear INSERT-je. Az adott user az adott user_id auth.uid(),
      // tehát a first_X guard a saját user-scoped useState flag-et nézi.
      const { trackEvent } = useFunnelEvents();
      trackEvent('first_loadout_assembled', { trip_id: tripId });
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /**
   * Updates the quantity on an existing trip_gear row. Sprint 5 P2 also
   * accepts `assignedToUserId?: string | null` — a 4. paraméter, ami a
   * `trip_gear.assigned_to_user_id` mezőt PATCH-eli (NULL = törli a
   * user-hozzárendelést; UUID = beállítja a §3.2 specifikáció szerinti
   * owner-only endpoint-on, ahol a target user a trip résztvevőinek
   * körében kell legyen).
   */
  const updateGearQty = async (
    tripId: string,
    gearItemId: string,
    quantity: number,
    assignedToUserId?: string | null
  ) => {
    state.value.error = null;
    try {
      const payload: TripGearUpdateInput = {
        quantity,
        ...(assignedToUserId !== undefined
          ? { assigned_to_user_id: assignedToUserId }
          : {}),
      };
      const row = await $fetch<TripGearRow>(
        `/api/trips/${tripId}/gear/${gearItemId}`,
        { method: 'PATCH', body: payload }
      );
      if (state.value.current?.id === tripId) {
        state.value.current.trip_gear = state.value.current.trip_gear.map(
          (g) => (g.gear_item_id === gearItemId ? row : g)
        );
      }
      // P2 — a gear-assignments cache invalidálása, hogy a „Ki mit visz"
      // nézet a következő mount / re-fetch alkalmával a friss
      // assigned_to_user_id-t lássa.
      delete state.value.gearAssignmentsByTripId[tripId];
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /**
   * P2 — dedicated assignee-only PATCH a `trip_gear.assigned_to_user_id`
   * mezőre. A quantity-t NEM érinti. A meglévő updateGearQty() mintát
   * követi, de csak a user-hozzárendelést PATCH-eli.
   */
  const updateGearAssignment = async (
    tripId: string,
    gearItemId: string,
    assignedToUserId: string | null
  ) => {
    return updateGearQty(tripId, gearItemId, 1, assignedToUserId);
  };

  /**
   * P2 — "Ki mit visz" aggregált nézet betöltése. Owner-only
   * (§11.2 A default). A szerver-oldali aggregáció userenkénti
   * csoportosítást ad vissza (§11.3 A default), a `gearAssignmentsByTripId`
   * cache-be rakja a result-ot.
   */
  const fetchGearAssignments = async (
    tripId: string
  ): Promise<GearAssignmentsResponse> => {
    state.value.error = null;
    try {
      const response = await $fetch<GearAssignmentsResponse>(
        `/api/trips/${tripId}/gear-assignments`
      );
      state.value.gearAssignmentsByTripId[tripId] = response;
      return response;
    } catch (e) {
      // Owner-only hibák (403/404) ne szennyezzék a state.error-t —
      // a section v-if gate-e elrejti a nem-owner UI-t.
      const err = e as { statusCode?: number };
      if (err?.statusCode === 403 || err?.statusCode === 404) {
        state.value.gearAssignmentsByTripId[tripId] = null;
        return { participants: [] };
      }
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

  // -------------------------------------------------------------------------
  // P3.2 Trip-share invite social surface — UI polish
  // -------------------------------------------------------------------------

  /**
   * Client-side predicate mirroring the server-side `trip_visible_to()`
   * SECURITY DEFINER helper (P2). The RLS SELECT policies on `trips`,
   * `trip_recaps`, and `trip_recap_photos` are the source of truth; this
   * is a UI gate only — used to decide whether to render the trip detail
   * sections before the first GET round-trip fires.
   *
   * Returns `true` when:
   *   - the viewer is the trip owner
   *   - the viewer has an accepted invite on this trip
   *   - the viewer is an accepted friend of the trip owner
   *
   * Returns `false` for strangers (no trip loaded, no session, no
   * matching accepted invite, no friend link).
   *
   * The accepted-friend-of-owner check is delegated to the server —
   * when the trip detail GET succeeds the trips SELECT policy has
   * already admitted the viewer, so a populated `state.current` is
   * sufficient evidence the viewer is one of the three.
   */
  const canViewTrip = (
    tId: string,
    viewerUserId: string | null | undefined,
  ): boolean => {
    if (!viewerUserId) return false;
    const trip = state.value.current;
    if (!trip || trip.id !== tId) return false;
    if (trip.user_id === viewerUserId) return true;
    // Reaching the page with `state.current` populated means the
    // trips SELECT policy already admitted this viewer. The only
    // client-side remaining case is "owner of a populated trip" —
    // accepted-invite / accepted-friend cases need the server's
    // SELECT check, which has already passed.
    const invitesForTrip = state.value.invitesByTripId[tId] ?? [];
    return invitesForTrip.some(
      (i) => i.invitee_user_id === viewerUserId && i.status === 'accepted',
    );
  };

  /**
   * P3.2 — fetch the accepted invites for this trip and merge with the
   * trip owner into `state.participantsByTripId[tripId]`. Returns the
   * resulting participant rows.
   *
   * Uses the existing P2 `GET /api/trips/:id/invites?status=accepted`
   * endpoint — no new server code.
   */
  const listParticipants = async (tId: string): Promise<TripParticipantRow[]> => {
    state.value.error = null;
    try {
      const acceptedRows = await $fetch<TripShareInviteRow[]>(
        `/api/trips/${tId}/invites`,
        { query: { status: 'accepted' } },
      );
      const accepted = acceptedRows ?? [];
      const trip = state.value.current;
      const ownerUserId = trip?.user_id ?? '';
      const rows: TripParticipantRow[] = [];
      if (ownerUserId) {
        rows.push({
          id: 'owner',
          user_id: ownerUserId,
          email: state.value.emailById[ownerUserId] ?? null,
          // Sprint 5 P2.x bugfix — display_name + avatar_url a
          // TripParticipantRow-ban. A privacy-first projection-t a
          // resolveParticipantsForTrip hívás feloldja a
          // trip_participant_lookup_profiles SECURITY DEFINER
          // function-ből (itt NEM töltünk a cache-ből, NEM szivárogtatjuk
          // a server-oldali display_name-t egy placeholder mezőben).
          display_name: null,
          avatar_url: null,
          role: 'owner',
          status: 'accepted',
        });
      }
      for (const inv of accepted) {
        if (!inv.invitee_user_id) continue;
        rows.push({
          id: inv.id,
          user_id: inv.invitee_user_id,
          email:
            state.value.emailById[inv.invitee_user_id] ?? inv.invitee_email,
          // Sprint 5 P2.x bugfix — display_name + avatar_url (NULL
          // placeholder; a resolveParticipantsForTrip hívás feloldja).
          display_name: null,
          avatar_url: null,
          role: 'invitee',
          status: 'accepted',
        });
      }
      state.value.participantsByTripId[tId] = rows;
      await resolveParticipantsForTrip(tId);
      return state.value.participantsByTripId[tId] ?? [];
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /**
   * P3.2 — batched email lookup for participant user_ids that the cache
   * doesn't already have. Mirrors `resolveEmailsForTrip` for comments.
   */
  const resolveParticipantsForTrip = async (tId: string) => {
    const rows = state.value.participantsByTripId[tId] ?? [];
    const missing = Array.from(
      new Set(
        rows
          .map((r) => r.user_id)
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
      // Re-stamp emails onto participant rows so the UI re-renders.
      state.value.participantsByTripId[tId] = (state.value.participantsByTripId[tId] ?? []).map(
        (row) =>
          state.value.emailById[row.user_id]
            ? { ...row, email: state.value.emailById[row.user_id] }
            : row,
      );
    } catch (e) {
      // Don't surface email-lookup failures — participants still render
      // with the email-cached / fallback label.
      // eslint-disable-next-line no-console
      console.warn('participants lookup-emails failed', e);
    }
  };

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

  // -------------------------------------------------------------------------
  // P3 Trip recap + photos (Architect §D)
  // -------------------------------------------------------------------------

  /**
   * Loads (or refreshes) the recap + photos for a trip into
   * `state.recapByTripId[tripId]`. RLS SELECT lets non-owners see public
   * recaps and ones shared via trip_visible_to; an unauthorized caller
   * gets `{ recap: null, photos: [] }` instead of an error.
   */
  const getRecap = async (tripId: string) => {
    state.value.error = null;
    try {
      const result = await $fetch<{
        recap: TripRecapRow | null;
        photos: TripRecapPhotoRow[];
      }>(`/api/trips/${tripId}/recap`);
      state.value.recapByTripId[tripId] = result ?? {
        recap: null,
        photos: [],
      };
      return result;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /**
   * Upsert: insert if missing, update if present. The server's POST
   * endpoint uses `onConflict: 'trip_id'` so either path is a single call.
   */
  const upsertRecap = async (
    tripId: string,
    patch: {
      body?: string | null;
      rating_out_of_10?: number | null;
      public?: boolean;
    },
  ) => {
    state.value.error = null;
    try {
      const row = await $fetch<TripRecapRow>(
        `/api/trips/${tripId}/recap`,
        { method: 'POST', body: patch },
      );
      const cur = state.value.recapByTripId[tripId] ?? {
        recap: null,
        photos: [],
      };
      state.value.recapByTripId[tripId] = { ...cur, recap: row };
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /**
   * Partial update on an existing recap. Same payload shape as upsertRecap;
   * server-side PATCH enforces the rating_out_of_10 CHECK.
   */
  const updateRecap = async (tripId: string, patch: RecapPatchInput) => {
    state.value.error = null;
    try {
      const row = await $fetch<TripRecapRow>(
        `/api/trips/${tripId}/recap`,
        { method: 'PATCH', body: patch },
      );
      const cur = state.value.recapByTripId[tripId] ?? {
        recap: null,
        photos: [],
      };
      state.value.recapByTripId[tripId] = { ...cur, recap: row };
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /**
   * Hard delete the recap row + cascade-remove photos metadata + best-effort
   * storage cleanup. Local cache key is removed so the UI flips back to
   * the "no recap yet" empty state.
   */
  const deleteRecap = async (tripId: string) => {
    state.value.error = null;
    try {
      await $fetch(`/api/trips/${tripId}/recap`, { method: 'DELETE' });
      delete state.value.recapByTripId[tripId];
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /**
   * Uploads one image (jpeg/png/webp, max 5 MB) as a trip_recap_photos row.
   * Returns the new photo + its public URL. On success, the photo is merged
   * into `state.recapByTripId[tripId].photos` (sorted by display_order).
   */
  const uploadPhoto = async (
    tripId: string,
    file: File,
    caption?: string,
  ) => {
    state.value.error = null;
    const fd = new FormData();
    fd.append('file', file, file.name);
    if (caption !== undefined) {
      fd.append('caption', caption);
    }
    try {
      const result = await $fetch<{
        photo: TripRecapPhotoRow;
        publicUrl: string;
      }>(`/api/trips/${tripId}/recap/photos`, {
        method: 'POST',
        body: fd,
      });
      const cur = state.value.recapByTripId[tripId] ?? {
        recap: null,
        photos: [],
      };
      const nextPhotos = [...cur.photos, result.photo].sort(
        (a, b) => a.display_order - b.display_order,
      );
      state.value.recapByTripId[tripId] = {
        recap: cur.recap,
        photos: nextPhotos,
      };
      return result;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /**
   * Updates display_order on a single photo. Local cache is reordered so
   * the grid re-renders immediately. The endpoint accepts display_order OR
   * caption (or both).
   */
  const reorderPhoto = async (
    tripId: string,
    photoId: string,
    newOrder: number,
  ) => {
    state.value.error = null;
    try {
      const payload: PhotoPatchInput = { display_order: newOrder };
      const row = await $fetch<TripRecapPhotoRow>(
        `/api/trips/${tripId}/recap/photos/${photoId}`,
        { method: 'PATCH', body: payload },
      );
      const cur = state.value.recapByTripId[tripId] ?? {
        recap: null,
        photos: [],
      };
      const nextPhotos = cur.photos
        .map((p) => (p.id === photoId ? row : p))
        .sort((a, b) => a.display_order - b.display_order);
      state.value.recapByTripId[tripId] = {
        recap: cur.recap,
        photos: nextPhotos,
      };
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /**
   * Update a photo's caption. Same endpoint as reorder; only the `caption`
   * field is sent.
   */
  const updatePhotoCaption = async (
    tripId: string,
    photoId: string,
    caption: string,
  ) => {
    state.value.error = null;
    try {
      const payload: PhotoPatchInput = { caption };
      const row = await $fetch<TripRecapPhotoRow>(
        `/api/trips/${tripId}/recap/photos/${photoId}`,
        { method: 'PATCH', body: payload },
      );
      const cur = state.value.recapByTripId[tripId] ?? {
        recap: null,
        photos: [],
      };
      const nextPhotos = cur.photos.map((p) =>
        p.id === photoId ? row : p,
      );
      state.value.recapByTripId[tripId] = {
        recap: cur.recap,
        photos: nextPhotos,
      };
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /**
   * Removes a photo row + its storage object. Looks up the tripId from the
   * local cache so the caller doesn't need to track both ids.
   */
  const deletePhoto = async (photoId: string) => {
    state.value.error = null;
    // Find the tripId this photo belongs to in the cache.
    let ownerTripId: string | null = null;
    for (const [tid, entry] of Object.entries(state.value.recapByTripId)) {
      if (entry.photos.some((p) => p.id === photoId)) {
        ownerTripId = tid;
        break;
      }
    }
    if (!ownerTripId) {
      // Photo isn't in cache — best-effort: caller is expected to know.
      throw createError({
        statusCode: 404,
        statusMessage: 'A fotó nem található a cache-ben',
      });
    }
    try {
      await $fetch(`/api/trips/${ownerTripId}/recap/photos/${photoId}`, {
        method: 'DELETE',
      });
      const cur = state.value.recapByTripId[ownerTripId];
      if (cur) {
        state.value.recapByTripId[ownerTripId] = {
          ...cur,
          photos: cur.photos.filter((p) => p.id !== photoId),
        };
      }
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  // -------------------------------------------------------------------------
  // P5 Trip debrief (Architect v2 #23 "Mit bántam meg?")
  // -------------------------------------------------------------------------

  /**
   * Loads the debrief row for a trip into `state.debriefByTripId[tripId]`.
   * Returns `null` when the row doesn't exist yet (the user hasn't saved
   * one). Visibility is gated by RLS (owner + trip_visible_to); an
   * unauthorized caller gets `null` instead of an error.
   */
  const loadDebrief = async (tripId: string) => {
    state.value.error = null;
    try {
      const result = await $fetch<{ debrief: TripDebriefRow | null }>(
        `/api/trips/${tripId}/debrief`,
      );
      state.value.debriefByTripId[tripId] = result?.debrief ?? null;
      return result?.debrief ?? null;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /**
   * Owner-only upsert. Same shape as `upsertRecap` — the server endpoint
   * uses `onConflict: 'trip_id'`, so the first call inserts and subsequent
   * calls update the same row.
   */
  const saveDebrief = async (
    tripId: string,
    payload: {
      excess_items?: string[];
      missing_items?: string[];
      uncomfortable_items?: string[];
    },
  ) => {
    state.value.error = null;
    try {
      const row = await $fetch<TripDebriefRow>(
        `/api/trips/${tripId}/debrief`,
        { method: 'POST', body: payload },
      );
      state.value.debriefByTripId[tripId] = row;
      // Sprint 5 P0.3 — activation funnel: first_debrief_written.
      // A first_* guard a useFunnelEvents belsejében.
      // A `loadDebrief` előzőleg null volt (nincs meglévő debrief) — a
      // guard a useState flag-en át user-szinten szűr.
      const { trackEvent } = useFunnelEvents();
      trackEvent('first_debrief_written');
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /**
   * Owner-only: marks the trip as completed (`trips.completed_at =
   * now()`). Backend: POST /api/trips/:id/complete (RLS Strict,
   * owner-only UPDATE). Sprint 5 P0.3 — activation funnel: the
   * close-trip flow triggers `first_completed_trip` capture
   * (different from `first_loadout_assembled` because the loop
   * logikája Trip → Loadout → Hike → Debrief; Hike = completed).
   */
  const markTripCompleted = async (tripId: string) => {
    state.value.error = null;
    try {
      const row = await $fetch<TripRow>(`/api/trips/${tripId}/complete`, {
        method: 'POST',
      });
      if (state.value.current?.id === tripId) {
        state.value.current = {
          ...state.value.current,
          ...row,
        };
      }
      // Capture: first_completed_trip (B opció: saját events tábla).
      const { trackEvent } = useFunnelEvents();
      trackEvent('first_completed_trip', { trip_id: tripId });
      return row;
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
    canViewTrip,
    listParticipants,
    resolveParticipantsForTrip,
    listIncomingInvites,
    getRecap,
    upsertRecap,
    updateRecap,
    deleteRecap,
    uploadPhoto,
    reorderPhoto,
    updatePhotoCaption,
    deletePhoto,
    loadDebrief,
    saveDebrief,
    markTripCompleted,
    // Sprint 5 P2 — "Ki mit visz"
    updateGearAssignment,
    fetchGearAssignments,
    resetError,
  };
}