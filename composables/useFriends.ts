/**
 * Composable wrapper around /api/friends/*.
 *
 * Mirrors the useGear / useTrips pattern:
 *   * shares reactive `accepted` / `pending` lists + last search hit
 *     via useState so multiple components stay in sync,
 *   * membership-only access is enforced server-side by Supabase RLS,
 *   * writes surface errors into state.error so the page can show
 *     ErrorBanner without per-call try/catch.
 *
 * The two lists are kept independently:
 *   * `accepted` — status='accepted' (Friends page, "Barátaim")
 *   * `pending`  — status='pending' (incoming + outgoing via the API)
 *
 * `state.search` holds the latest search hit (FriendSearchResult | null)
 * so the search form can show the result + existing relationship badge
 * without re-hitting /search.
 */
import type {
  FriendListEntry,
  FriendSearchResult,
  FriendshipRow,
} from '~/types/db';

export interface FriendSearchHit extends FriendSearchResult {
  is_self: boolean;
  existing_friendship: FriendListEntry | null;
}

export interface FriendState {
  accepted: FriendListEntry[];
  pending: FriendListEntry[];
  search: FriendSearchHit | null;
  loading: boolean;
  error: string | null;
}

export function useFriends() {
  const state = useState<FriendState>('friends', () => ({
    accepted: [],
    pending: [],
    search: null,
    loading: false,
    error: null,
  }));

  const setError = (e: unknown) => {
    const err = e as { statusMessage?: string; message?: string };
    state.value.error = err?.statusMessage ?? err?.message ?? 'Unexpected error';
  };

  /** GET /api/friends?status=accepted */
  const listAccepted = async () => {
    state.value.loading = true;
    state.value.error = null;
    try {
      const rows = await $fetch<FriendListEntry[]>('/api/friends', {
        params: { status: 'accepted' },
      });
      state.value.accepted = rows ?? [];
    } catch (e) {
      setError(e);
    } finally {
      state.value.loading = false;
    }
  };

  /**
   * GET /api/friends?status=pending — returns BOTH incoming and outgoing
   * pending rows in one call. The caller can filter direction client-side
   * if needed; the page currently shows both grouped by direction.
   */
  const listPending = async () => {
    state.value.loading = true;
    state.value.error = null;
    try {
      const rows = await $fetch<FriendListEntry[]>('/api/friends', {
        params: { status: 'pending' },
      });
      state.value.pending = rows ?? [];
    } catch (e) {
      setError(e);
    } finally {
      state.value.loading = false;
    }
  };

  /** GET /api/friends/search?email=… */
  const searchByEmail = async (email: string) => {
    state.value.error = null;
    try {
      const hit = await $fetch<FriendSearchHit>('/api/friends/search', {
        params: { email },
      });
      state.value.search = hit;
      return hit;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /** POST /api/friends/request { recipient_email } */
  const request = async (email: string) => {
    state.value.error = null;
    try {
      const row = await $fetch<FriendshipRow>('/api/friends/request', {
        method: 'POST',
        body: { recipient_email: email },
      });
      // New outgoing pending → push to the pending list so the UI
      // immediately reflects the sent request.
      const me = useSupabaseUser();
      const callerId = me.value?.id ?? '';
      const friend_id = row.user_a === callerId ? row.user_b : row.user_a;
      state.value.pending = [
        {
          id: row.id,
          status: row.status,
          friend_id,
          friend_email: email,
          requested_by: row.requested_by,
          accepted_at: row.accepted_at,
          created_at: row.created_at,
        },
        ...state.value.pending,
      ];
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /** POST /api/friends/:id/accept */
  const accept = async (id: string) => {
    state.value.error = null;
    try {
      const row = await $fetch<FriendshipRow>(`/api/friends/${id}/accept`, {
        method: 'POST',
      });
      // Move the row from pending → accepted.
      const me = useSupabaseUser();
      const callerId = me.value?.id ?? '';
      const friend_id = row.user_a === callerId ? row.user_b : row.user_a;
      const friend_email =
        state.value.pending.find((p) => p.id === id)?.friend_email ?? '';
      const acceptedEntry: FriendListEntry = {
        id: row.id,
        status: row.status,
        friend_id,
        friend_email,
        requested_by: row.requested_by,
        accepted_at: row.accepted_at,
        created_at: row.created_at,
      };
      state.value.pending = state.value.pending.filter((p) => p.id !== id);
      state.value.accepted = [acceptedEntry, ...state.value.accepted];
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /** POST /api/friends/:id/decline */
  const decline = async (id: string) => {
    state.value.error = null;
    try {
      await $fetch(`/api/friends/${id}/decline`, { method: 'POST' });
      state.value.pending = state.value.pending.filter((p) => p.id !== id);
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /** DELETE /api/friends/:id (any-member remove) */
  const remove = async (id: string) => {
    state.value.error = null;
    try {
      await $fetch(`/api/friends/${id}`, { method: 'DELETE' });
      state.value.accepted = state.value.accepted.filter((f) => f.id !== id);
      state.value.pending = state.value.pending.filter((p) => p.id !== id);
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
    listAccepted,
    listPending,
    searchByEmail,
    request,
    accept,
    decline,
    remove,
    resetError,
  };
}