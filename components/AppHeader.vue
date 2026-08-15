<script setup lang="ts">
/**
 * App header — site nav + auth state + incoming trip-invite badge.
 *
 * Two render modes driven by useSupabaseUser().value:
 *   - anonymous: "Belépés" + "Regisztráció" links
 *   - authenticated: lowercase email + invite badge + "Kijelentkezés" button
 *
 * The badge shows the count of pending invites where the caller is the
 * invitee (cross-trip, status='incoming'). Click → navigates to the
 * first pending invite's trip so the user can review and accept.
 *
 * Kijelentkezés uses useSignOut() which clears the Supabase session and
 * forces a hard reload to /signin so the middleware re-evaluates.
 */
import type { TripShareInviteRow } from '~/types/db';

const user = useSupabaseUser();
const signOut = useSignOut();
const route = useRoute();

const { listIncomingInvites } = useTrips();

// Cached list of pending incoming invites. Refreshed on mount, on
// auth change, and when the route changes (so accepting on /trips/:id
// bumps the count down when the user navigates back).
const incoming = ref<TripShareInviteRow[]>([]);
const badgeLoading = ref(false);

const refreshIncoming = async () => {
  if (!user.value) {
    incoming.value = [];
    return;
  }
  badgeLoading.value = true;
  try {
    incoming.value = await listIncomingInvites();
  } catch {
    // Don't surface badge failures globally — the rest of the header
    // still works.
    incoming.value = [];
  } finally {
    badgeLoading.value = false;
  }
};

onMounted(refreshIncoming);
watch(() => user.value?.id, refreshIncoming);
watch(() => route.fullPath, refreshIncoming);

const incomingCount = computed(() => incoming.value.length);
const firstIncomingTripId = computed(
  () => incoming.value[0]?.trip_id ?? null,
);

const handleBadgeClick = () => {
  if (!firstIncomingTripId.value) return;
  void navigateTo(`/trips/${firstIncomingTripId.value}`);
};

const handleSignOut = async () => {
  await signOut();
};
</script>

<template>
  <header class="border-b bg-white">
    <div
      class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8"
    >
      <NuxtLink
        to="/"
        class="text-lg font-semibold tracking-tight text-gray-900 hover:text-gray-700"
      >
        Ultralight Gear Tracker
      </NuxtLink>

      <nav class="flex items-center gap-3 text-sm">
        <template v-if="user">
          <NuxtLink
            to="/gear"
            class="rounded px-2 py-1 font-medium text-gray-700 hover:bg-gray-100"
          >
            Gear
          </NuxtLink>
          <NuxtLink
            to="/wishlist"
            class="rounded px-2 py-1 font-medium text-gray-700 hover:bg-gray-100"
          >
            Wishlist
          </NuxtLink>
          <NuxtLink
            to="/trips"
            class="rounded px-2 py-1 font-medium text-gray-700 hover:bg-gray-100"
          >
            Trips
          </NuxtLink>
          <NuxtLink
            to="/friends"
            class="rounded px-2 py-1 font-medium text-gray-700 hover:bg-gray-100"
          >
            Friends
          </NuxtLink>
          <NuxtLink
            to="/stats"
            class="rounded px-2 py-1 font-medium text-gray-700 hover:bg-gray-100"
          >
            Stats
          </NuxtLink>

          <!-- Bejövő meghívók badge: pending invites where the caller
               is the invitee. Click → first pending invite's trip. -->
          <button
            v-if="incomingCount > 0 || badgeLoading"
            type="button"
            :aria-label="badgeLoading ? 'Bejövő meghívók betöltése' : `Bejövő meghívók: ${incomingCount}`"
            :disabled="badgeLoading"
            class="relative inline-flex items-center rounded-card border border-espresso-200 bg-blushLight-50 px-2.5 py-1 text-xs font-medium text-espresso-900 hover:border-moss-500 hover:bg-moss-50 focus:outline-none focus:ring-2 focus:ring-moss-600 focus:ring-offset-2 disabled:cursor-wait disabled:hover:border-espresso-200 disabled:hover:bg-blushLight-50"
            @click="handleBadgeClick"
          >
            <span aria-hidden="true">📬</span>
            <span class="ml-1">Meghívók</span>
            <span
              class="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums"
              :class="badgeLoading ? 'bg-blushMid-100 text-espresso-300' : 'bg-blushLight-200 text-espresso-900'"
              aria-hidden="true"
            >
              {{ badgeLoading ? '•••' : incomingCount }}
            </span>
          </button>

          <span class="hidden text-gray-500 sm:inline">
            {{ user.email?.toLowerCase() }}
          </span>
          <button
            type="button"
            aria-label="Kijelentkezés"
            class="btn-danger px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 hover:border-red-300"
            @click="handleSignOut"
          >
            Kijelentkezés
          </button>
        </template>
        <template v-else>
          <NuxtLink
            to="/signin"
            class="btn-secondary px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 hover:bg-gray-50"
          >
            Belépés
          </NuxtLink>
          <NuxtLink
            to="/signup"
            class="btn-primary px-3 py-1.5"
          >
            Regisztráció
          </NuxtLink>
        </template>
      </nav>
    </div>
  </header>
</template>
