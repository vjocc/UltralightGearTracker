/**
 * Shared auth helpers for server endpoints.
 *
 * `serverSupabaseUser(event)` in this codebase returns the payload from
 * Supabase auth-js's `getClaims()` (or `getUser()`), which is a "user"
 * object whose primary identifier is `sub` (the JWT subject / auth.users
 * uuid). It does NOT expose that id as `id`, so any code that did
 * `user.id` was reading `undefined` and falling through every owner /
 * invitee / authorship check.
 *
 * Use `getUserId(user)` everywhere a server handler needs the caller's
 * auth-users uuid. It also accepts the legacy `id` field so tests / older
 * callers that mocked with `{ id }` keep working.
 */
export function getUserId(user: unknown): string {
  if (!user || typeof user !== 'object') return '';
  const u = user as { sub?: unknown; id?: unknown };
  const sub = typeof u.sub === 'string' ? u.sub : '';
  const id = typeof u.id === 'string' ? u.id : '';
  return sub || id;
}
