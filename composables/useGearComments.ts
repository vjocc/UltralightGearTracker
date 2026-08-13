/**
 * Composable wrapper around /api/gear/:id/comments/* and
 * /api/auth/lookup-emails.
 *
 * Mirrors the useFriends/useGear pattern: shares per-gear lists via
 * useState so multiple components stay in sync, plus a per-uuid email
 * cache that backs the comment author rendering.
 *
 * Optimistic insert contract:
 *   `add(gearItemId, body)` immediately inserts a placeholder row with
 *   `id: 'pending-' + nanoid()` and `pending: true` at the top of the
 *   list, then awaits the server. On success, the placeholder is
 *   replaced by the canonical row from the server. On error, the
 *   placeholder is removed and the error is surfaced via state.error.
 *
 * `commentAuthorEmail(userId)` resolves the email through the cached
 * `state.emailById` map. Misses trigger a single batched call to
 * /api/auth/lookup-emails with all currently-unresolved author uuids
 * for the active gear item.
 */
import type {
  GearCommentRow,
  GearCommentRowWithPending,
  EmailLookupResult,
  UUID,
} from '~/types/db';

export interface GearCommentsState {
  /** Per-gear comment lists, keyed by gear_item_id. */
  byGearId: Record<UUID, GearCommentRowWithPending[]>;
  /** Resolved comment-author emails keyed by user_id. */
  emailById: Record<UUID, string>;
  loading: boolean;
  error: string | null;
}

/** Local-only id prefix so we can identify optimistic placeholders. */
const PENDING_PREFIX = 'pending-';

function isPendingId(id: string): boolean {
  return id.startsWith(PENDING_PREFIX);
}

function genPendingId(): string {
  // crypto.randomUUID exists in both browser and Node 19+ — gives us a
  // unique placeholder id without importing a uuid library.
  return `${PENDING_PREFIX}${crypto.randomUUID()}`;
}

export function useGearComments() {
  const state = useState<GearCommentsState>('gearComments', () => ({
    byGearId: {},
    emailById: {},
    loading: false,
    error: null,
  }));

  const setError = (e: unknown) => {
    const err = e as { statusMessage?: string; message?: string };
    state.value.error = err?.statusMessage ?? err?.message ?? 'Unexpected error';
  };

  /** Resolve a single gear's list (returns [] if not yet fetched). */
  const list = async (gearItemId: UUID) => {
    state.value.loading = true;
    state.value.error = null;
    try {
      const rows = await $fetch<GearCommentRow[]>(
        `/api/gear/${gearItemId}/comments`,
      );
      state.value.byGearId[gearItemId] = rows ?? [];
      // Kick off a batch email lookup for any author ids we don't yet have.
      await resolveEmailsForGear(gearItemId);
    } catch (e) {
      setError(e);
    } finally {
      state.value.loading = false;
    }
  };

  /**
   * Adds a comment to the given gear item. Optimistic insert: a
   * placeholder row is pushed onto the list immediately, then replaced
   * by the server's canonical row on success (or removed on error).
   */
  const add = async (gearItemId: UUID, body: string) => {
    state.value.error = null;

    const current = state.value.byGearId[gearItemId] ?? [];
    const me = useSupabaseUser();
    const callerId = me.value?.id ?? '';

    const placeholder: GearCommentRowWithPending = {
      id: genPendingId(),
      gear_item_id: gearItemId,
      user_id: callerId,
      body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      pending: true,
    };
    state.value.byGearId[gearItemId] = [placeholder, ...current];

    try {
      const row = await $fetch<GearCommentRow>(
        `/api/gear/${gearItemId}/comments`,
        { method: 'POST', body: { body } },
      );
      // Replace placeholder with the canonical server row.
      const next = state.value.byGearId[gearItemId] ?? [];
      state.value.byGearId[gearItemId] = next.map((c) =>
        c.id === placeholder.id ? row : c,
      );
      return row;
    } catch (e) {
      // Roll back the placeholder.
      const next = state.value.byGearId[gearItemId] ?? [];
      state.value.byGearId[gearItemId] = next.filter(
        (c) => c.id !== placeholder.id,
      );
      setError(e);
      throw e;
    }
  };

  const update = async (
    gearItemId: UUID,
    commentId: UUID,
    body: string,
  ) => {
    state.value.error = null;
    try {
      const row = await $fetch<GearCommentRow>(
        `/api/gear/${gearItemId}/comments/${commentId}`,
        { method: 'PATCH', body: { body } },
      );
      const next = state.value.byGearId[gearItemId] ?? [];
      state.value.byGearId[gearItemId] = next.map((c) =>
        c.id === commentId ? row : c,
      );
      return row;
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  const remove = async (gearItemId: UUID, commentId: UUID) => {
    state.value.error = null;
    try {
      await $fetch(`/api/gear/${gearItemId}/comments/${commentId}`, {
        method: 'DELETE',
      });
      const next = state.value.byGearId[gearItemId] ?? [];
      state.value.byGearId[gearItemId] = next.filter((c) => c.id !== commentId);
    } catch (e) {
      setError(e);
      throw e;
    }
  };

  /**
   * Batched email lookup for comment authors we don't yet have an email
   * for. Triggered by `list()` and on demand by the component when an
   * optimistic row is added by a user whose email is not in cache.
   */
  const resolveEmailsForGear = async (gearItemId: UUID) => {
    const rows = state.value.byGearId[gearItemId] ?? [];
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
      // thread still renders, just with the author uuid shown instead
      // of an email. The console warning is enough for debugging.
      // eslint-disable-next-line no-console
      console.warn('lookup-emails failed', e);
    }
  };

  /**
   * Returns the cached email for `userId`, or `null` if it has not yet
   * been resolved. The component renders the uuid's monogram as a
   * fallback while a lookup is in flight.
   */
  const commentAuthorEmail = (userId: UUID): string | null => {
    return state.value.emailById[userId] ?? null;
  };

  const resetError = () => {
    state.value.error = null;
  };

  return {
    state,
    list,
    add,
    update,
    remove,
    resolveEmailsForGear,
    commentAuthorEmail,
    isPendingId,
    resetError,
  };
}