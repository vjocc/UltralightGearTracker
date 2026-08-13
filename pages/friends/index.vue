<script setup lang="ts">
/**
 * Friends page. Three sections:
 *   1. Bejövő kérések (incoming pending) — Accept / Decline buttons.
 *   2. Barátaim (accepted) — Remove button.
 *   3. Keresés (search by email) — exact match + Send invite / existing
 *      relationship badge.
 *
 * Membership-only access is enforced server-side by Supabase RLS.
 * All mutations go through useFriends() so state stays in sync.
 *
 * UI states:
 *  - loading: small "Loading…" line (Designer can elevate to skeleton)
 *  - error: ErrorBanner above the lists
 *  - empty (no friends + no pending + no search hit): FriendsEmptyState
 *  - populated: list of FriendCard rows
 *
 * Designer pass: FriendCard styling + SearchBar polish. The CTA below
 * is functional-only — visual hierarchy / spacing is a Designer call.
 */
import type { FriendListEntry } from '~/types/db';
import type { FriendSearchHit } from '~/composables/useFriends';

definePageMeta({
  title: 'Friends',
});

const {
  state,
  listAccepted,
  listPending,
  searchByEmail,
  request,
  accept,
  decline,
  remove,
  resetError,
} = useFriends();
const user = useSessionUser();

// Gated by middleware; defensive guard for SSR pre-hydration.
if (import.meta.client && !user.value) {
  await navigateTo('/signin?next=/friends');
}

// Search form state.
const searchEmail = ref('');
const searchSubmitting = ref(false);
const searchError = ref<string | null>(null);

// Group pending by direction (incoming = other side sent it; outgoing = I did).
const me = computed(() => user.value?.id ?? '');
const incomingPending = computed(() =>
  state.value.pending.filter((p) => p.requested_by !== me.value)
);
const outgoingPending = computed(() =>
  state.value.pending.filter((p) => p.requested_by === me.value)
);

const handleSearch = async () => {
  searchError.value = null;
  const email = searchEmail.value.trim();
  if (!email) {
    searchError.value = 'Add an email first.';
    return;
  }
  searchSubmitting.value = true;
  try {
    await searchByEmail(email);
  } catch (e) {
    const err = e as { statusMessage?: string; message?: string };
    searchError.value = err?.statusMessage ?? err?.message ?? 'Search failed';
  } finally {
    searchSubmitting.value = false;
  }
};

const handleSendRequest = async () => {
  if (!state.value.search) return;
  try {
    await request(state.value.search.email);
    // Clear the search hit so the user sees the new pending entry.
    state.value.search = null;
    searchEmail.value = '';
  } catch {
    // surfaced via state.error
  }
};

const handleAccept = async (row: FriendListEntry) => {
  try {
    await accept(row.id);
  } catch {
    // surfaced via state.error
  }
};

const handleDecline = async (row: FriendListEntry) => {
  try {
    await decline(row.id);
  } catch {
    // surfaced via state.error
  }
};

const handleRemove = async (row: FriendListEntry) => {
  if (!confirm(`Remove "${row.friend_email}" from your friends?`)) return;
  try {
    await remove(row.id);
  } catch {
    // surfaced via state.error
  }
};

const searchStatus = (hit: FriendSearchHit): string => {
  if (hit.is_self) return 'Saját magad — nem küldhetsz magadnak kérést.';
  if (!hit.existing_friendship) return 'Még nincs kapcsolat.';
  const f = hit.existing_friendship;
  if (f.status === 'accepted') return 'Már barátok vagytok.';
  if (f.status === 'pending' && f.requested_by === me.value) {
    return 'Már küldtél neki kérést — várakozik.';
  }
  if (f.status === 'pending') return 'Ő küldött neked kérést — fogadd el fent.';
  return `Státusz: ${f.status}`;
};

onMounted(async () => {
  await Promise.all([listAccepted(), listPending()]);
});
</script>

<template>
  <section>
    <div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h2 class="text-xl font-semibold text-gray-900">Friends</h2>
        <p class="text-sm text-gray-500">
          Barátok kezelése · Supabase RLS gated by auth.uid()
        </p>
      </div>
    </div>

    <ErrorBanner
      :message="state.error"
      dismissible
      @dismiss="resetError"
    />

    <p v-if="state.loading && state.accepted.length === 0 && state.pending.length === 0" class="text-sm text-gray-500">
      Loading…
    </p>

    <!-- ===== 1) Bejövő kérések ============================================ -->
    <section class="mb-6">
      <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
        Bejövő kérések
        <span v-if="incomingPending.length > 0" class="ml-1 rounded border border-orange-300 bg-orange-100 px-1.5 text-xs font-medium text-orange-900">
          {{ incomingPending.length }}
        </span>
      </h3>

      <p v-if="incomingPending.length === 0" class="text-sm text-gray-500">
        Nincs függőben lévő kérés.
      </p>

      <ul v-else class="space-y-2">
        <li v-for="row in incomingPending" :key="row.id">
          <article class="flex items-center justify-between gap-4 rounded border border-amber-200 bg-amber-50 p-4">
            <div class="min-w-0 flex-1">
              <h4 class="truncate text-sm font-semibold text-gray-900">
                {{ row.friend_email }}
              </h4>
              <p class="mt-1 text-xs text-gray-500">
                Új barátkérés · {{ new Date(row.created_at).toISOString().slice(0, 10) }}
              </p>
            </div>
            <div class="flex shrink-0 gap-2">
              <button
                type="button"
                class="btn-secondary px-3 py-1 text-xs"
                @click="handleAccept(row)"
              >
                Accept
              </button>
              <button
                type="button"
                class="btn-danger px-3 py-1 text-xs"
                @click="handleDecline(row)"
              >
                Decline
              </button>
            </div>
          </article>
        </li>
      </ul>
    </section>

    <!-- ===== 2) Barátaim =================================================== -->
    <section class="mb-6">
      <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
        Barátaim
        <span v-if="state.accepted.length > 0" class="ml-1 rounded bg-gray-200 px-1.5 text-xs font-medium text-gray-700">
          {{ state.accepted.length }}
        </span>
      </h3>

      <div
        v-if="!state.loading && state.accepted.length === 0 && incomingPending.length === 0 && outgoingPending.length === 0"
        class="mt-2"
      >
        <!-- Empty state — visible only when both lists are empty. -->
        <div class="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
          <h4 class="text-lg font-semibold text-gray-900">Még nincs barátod</h4>
          <p class="mt-1 text-sm text-gray-500">
            Keresés email alapján — pontos egyezés kell, a felhasználónak már regisztrálnia kell.
          </p>
        </div>
      </div>

      <ul v-if="state.accepted.length > 0" class="space-y-2">
        <li v-for="row in state.accepted" :key="row.id">
          <article class="flex items-center justify-between gap-4 rounded border border-gray-200 bg-white p-4 hover:bg-gray-50">
            <div
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold uppercase text-gray-700"
              aria-hidden="true"
            >
              {{ row.friend_email.charAt(0) }}
            </div>
            <div class="min-w-0 flex-1">
              <h4 class="truncate text-sm font-semibold text-gray-900">
                {{ row.friend_email }}
              </h4>
              <p class="mt-1 text-xs text-gray-500">
                Barátok
                <template v-if="row.accepted_at">
                  · {{ new Date(row.accepted_at).toISOString().slice(0, 10) }} óta
                </template>
              </p>
            </div>
            <div class="flex shrink-0 gap-2">
              <button
                type="button"
                class="btn-danger px-3 py-1 text-xs"
                @click="handleRemove(row)"
              >
                Remove
              </button>
            </div>
          </article>
        </li>
      </ul>
    </section>

    <!-- ===== 3) Keresés ==================================================== -->
    <section class="mb-6">
      <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
        Keresés email alapján
      </h3>

      <form
        class="flex flex-wrap items-center gap-2"
        @submit.prevent="handleSearch"
      >
        <input
          v-model="searchEmail"
          type="email"
          required
          placeholder="user@example.com"
          class="min-w-0 flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
        <button
          type="submit"
          class="btn-primary"
          :disabled="searchSubmitting"
        >
          {{ searchSubmitting ? 'Searching…' : 'Search' }}
        </button>
      </form>

      <p v-if="searchError" class="mt-2 text-sm text-red-700" role="alert">
        {{ searchError }}
      </p>

      <div
        v-if="state.search"
        class="mt-3 rounded border border-gray-200 bg-white p-4"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h4 class="text-sm font-semibold text-gray-900">
              {{ state.search.email }}
            </h4>
            <p class="mt-1 text-xs text-gray-500">
              {{ searchStatus(state.search) }}
            </p>
          </div>
          <button
            v-if="!state.search.is_self && !state.search.existing_friendship"
            type="button"
            class="btn-primary px-3 py-1 text-xs"
            @click="handleSendRequest"
          >
            Send invite
          </button>
        </div>
      </div>
    </section>

    <!-- Outgoing pending — collapsed under search so the "Bejövő" list stays focused on actionable items. -->
    <section v-if="outgoingPending.length > 0" class="mb-6">
      <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700">
        Kimenő kérések
        <span class="ml-1 rounded bg-gray-200 px-1.5 text-xs font-medium text-gray-700">
          {{ outgoingPending.length }}
        </span>
      </h3>
      <ul class="space-y-2">
        <li v-for="row in outgoingPending" :key="row.id">
          <article class="flex items-center justify-between gap-4 rounded border border-gray-200 bg-white p-4">
            <div class="min-w-0 flex-1">
              <h4 class="truncate text-sm font-semibold text-gray-900">
                {{ row.friend_email }}
              </h4>
              <p class="mt-1 text-xs text-gray-500">
                Elküldve · {{ new Date(row.created_at).toISOString().slice(0, 10) }}
              </p>
            </div>
            <button
              type="button"
              class="btn-secondary px-3 py-1 text-xs"
              @click="handleDecline(row)"
            >
              Mégse
            </button>
          </article>
        </li>
      </ul>
    </section>
  </section>
</template>