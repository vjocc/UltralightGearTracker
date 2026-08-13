/**
 * Thin re-export of @nuxtjs/supabase's useSupabaseUser(). Centralized so
 * page-level code reads `useSessionUser()` from one import path; the
 * underlying primitive stays a single source of truth.
 *
 * Per Architect design: pages await the session before calling
 * useGear().list() to avoid a flash of empty state.
 *
 * `useSignOut()` returns a helper that calls Supabase's `signOut()` and
 * forces a hard navigation to /signin so route-level middleware re-evaluates
 * cleanly (no stale useSupabaseUser() value left in the page tree).
 */
import type { User } from '@supabase/supabase-js';

export const useSessionUser = () => useSupabaseUser() as Ref<User | null>;

/**
 * Returns a `signOut()` helper that:
 *  1. calls supabase.auth.signOut() (clears server-side session + cookies)
 *  2. navigates to /signin via window.location so the Nuxt app fully
 *     re-bootstraps and middleware/auth.global.ts re-evaluates.
 *
 * We use window.location (not router.push) because the @nuxtjs/supabase
 * plugin's reactivity only resets when the page reloads; a soft nav would
 * leave useSupabaseUser() pointing at the stale user object.
 */
export const useSignOut = () => {
  const supabase = useSupabaseClient();
  return async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      // Hard reload — guarantees the auth.global middleware sees user.value === null
      if (import.meta.client) {
        window.location.href = '/signin';
      } else {
        await navigateTo('/signin');
      }
    }
  };
};