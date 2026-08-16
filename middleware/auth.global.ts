/**
 * Global auth gate. The Supabase module already restores the user session,
 * so we only need to redirect anonymous visitors away from protected routes.
 *
 * Public routes (per Architect design — sign-up + magic link auth ticket):
 *   /, /signin, /signup, /auth/callback, /discover, /list/*
 * Protected prefixes (everything else requires an authenticated user):
 *   /gear, /wishlist, /trips, /settings, /friends, /stats
 * The prefix check naturally catches /gear/new, /gear/<uuid>/edit, etc.
 *
 * Sprint 5 P1 — /discover (Community Routes "Felfedezés a régióban")
 * is intentionally NOT protected. The page reads only public trips via
 * a service-role endpoint with a `visibility = 'public'` factory filter;
 * anonymous visitors see only those rows. The redirectOptions.exclude
 * in nuxt.config.ts also lists /discover so the @nuxtjs/supabase
 * middleware does not interfere.
 */
export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser();
  const isProtected =
    to.path === '/gear' ||
    to.path.startsWith('/gear/') ||
    to.path.startsWith('/wishlist') ||
    to.path.startsWith('/trips') ||
    to.path.startsWith('/friends') ||
    to.path.startsWith('/settings') ||
    to.path.startsWith('/stats');   // P6 / v2 #24

  if (isProtected && !user.value) {
    return navigateTo(`/signin?next=${encodeURIComponent(to.fullPath)}`);
  }
});