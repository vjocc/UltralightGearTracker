/**
 * useProfile — Sprint 5 P2.x bugfix: keresztnév kezelése.
 *
 * Dedikált composable a session user profiljához (display_name, avatar_url,
 * bio). A profile cache per-session useState névtérben él, hogy a
 * useTrips + useGearAssignments composable-ek frissíthessék a
 * display_name-t a kliens oldalon.
 *
 * A 'Névtelen túrázó' fallback a privacy-first helper-rel működik:
 * ha a profile.display_name === 'Névtelen túrázó', a UI ezt a
 * szöveget mutatja a user_id helyett.
 */
import type { ProfileSelf, ProfileUpdateInput } from '~/shared/profileSchemas';
import { PLACEHOLDER_DISPLAY_NAME, isPlaceholderDisplayName } from '~/shared/profileSchemas';

export interface ProfileState {
  profile: ProfileSelf | null;
  loading: boolean;
  error: string | null;
  /** Per-user-id cache (más user-ek display_name lookup-jához) */
  byUserId: Record<string, { display_name: string | null; avatar_url: string | null }>;
}

export function useProfile() {
  const state = useState<ProfileState>('profile', () => ({
    profile: null,
    loading: false,
    error: null,
    byUserId: {},
  }));

  const setError = (e: unknown) => {
    const err = e as { statusMessage?: string; message?: string };
    state.value.error = err?.statusMessage ?? err?.message ?? 'Unexpected error';
  };

  /**
   * Betölti a session user profilját a /api/profile endpoint-ról.
   * Ha a user-nek még nincs profil-rekordja, a fallback 'Névtelen túrázó'.
   */
  const load = async (): Promise<ProfileSelf> => {
    state.value.loading = true;
    state.value.error = null;
    try {
      const profile = await $fetch<ProfileSelf>('/api/profile');
      state.value.profile = profile;
      // Cache a byUserId-be (más user-ek lookup-jához)
      if (profile?.id) {
        state.value.byUserId[profile.id] = {
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
        };
      }
      return profile;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      state.value.loading = false;
    }
  };

  /**
   * Frissíti a session user profilját a /api/profile PATCH-en.
   * A cache (state.profile + state.byUserId[self.id]) is frissül.
   */
  const update = async (input: ProfileUpdateInput): Promise<ProfileSelf> => {
    state.value.loading = true;
    state.value.error = null;
    try {
      const profile = await $fetch<ProfileSelf>('/api/profile', {
        method: 'PATCH',
        body: input,
      });
      state.value.profile = profile;
      if (profile?.id) {
        state.value.byUserId[profile.id] = {
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
        };
      }
      return profile;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      state.value.loading = false;
    }
  };

  /**
   * Privacy-first helper: formázza a user_id-t display_name-re. Ha a
   * profile cache-ben van, a display_name-t adja vissza; ha placeholder
   * vagy nincs cache, a 'Névtelen túrázó' fallback-et.
   */
  const formatDisplayName = (
    userId: string,
    cachedDisplayName?: string | null,
  ): string => {
    // 1. Ha a caller átad explicit display_name-t (pl. a server-oldali
    //    trip_participant_lookup_profiles response-ból), használd azt
    if (cachedDisplayName !== undefined) {
      if (isPlaceholderDisplayName(cachedDisplayName)) {
        return PLACEHOLDER_DISPLAY_NAME;
      }
      return cachedDisplayName;
    }

    // 2. Ha a cache-ben van (saját session-ből), használd a cache-t
    const cached = state.value.byUserId[userId];
    if (cached?.display_name !== undefined) {
      if (isPlaceholderDisplayName(cached.display_name)) {
        return PLACEHOLDER_DISPLAY_NAME;
      }
      return cached.display_name;
    }

    // 3. Fallback: 'Névtelen túrázó' (privacy-first: NE mutassunk UUID-t)
    return PLACEHOLDER_DISPLAY_NAME;
  };

  /**
   * A profile placeholder-e? (display_name === 'Névtelen túrázó')
   */
  const isPlaceholderProfile = computed(() => {
    return isPlaceholderDisplayName(state.value.profile?.display_name ?? null);
  });

  /**
   * Reset a cache (signout esetén).
   */
  const reset = () => {
    state.value.profile = null;
    state.value.byUserId = {};
    state.value.error = null;
  };

  return {
    state: readonly(state),
    load,
    update,
    formatDisplayName,
    isPlaceholderProfile,
    reset,
  };
}
