/**
 * Global auth gate. The Supabase module already restores the user session,
 * so we only need to redirect anonymous visitors away from protected routes.
 *
 * Public routes (per Architect design — sign-up + magic link auth ticket):
 *   /, /signin, /signup, /auth/callback
 * Protected prefixes (everything else requires an authenticated user):
 *   /gear, /wishlist, /trips, /settings
 * The prefix check naturally catches /gear/new, /gear/<uuid>/edit, etc.
 */
export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser();
  const isProtected =
    to.path === '/gear' ||
    to.path.startsWith('/gear/') ||
    to.path.startsWith('/wishlist') ||
    to.path.startsWith('/trips') ||
    to.path.startsWith('/friends') ||
    to.path.startsWith('/settings');

  if (isProtected && !user.value) {
    return navigateTo(`/signin?next=${encodeURIComponent(to.fullPath)}`);
  }
});