-- ============================================================================
-- Fix: re-deploy friend_search_users + friend_lookup_emails to production.
-- QA round 5 hit "Could not find the function public.friend_search_users
-- (p_email) in the schema cache" (PGRST202) when calling
-- POST /api/trips/{id}/invites — the migration
-- 20260813010000_friendships.sql is in the repo but not applied to the
-- remote Supabase DB yet.
--
-- Forward-only migration. Re-declares BOTH SECURITY DEFINER helpers with
-- create or replace so a fresh apply on the remote DB brings them online
-- idempotently (the function bodies match the canonical
-- 20260813010000_friendships.sql definitions; this file exists ONLY to
-- drive the remote apply on the user's project
-- alftlildbaezkackinqe).
-- ============================================================================

-- ----- 1) friend_search_users(email) ----------------------------------------
-- The only sanctioned way for app code to look up a user by email.
-- Returns user_id + email (no other auth.users columns), and only ever
-- matches a single row via exact, case-insensitive equality.
create or replace function public.friend_search_users(p_email text)
  returns table (user_id uuid, email text)
  language sql
  security definer
  set search_path = public, auth
as $$
  select id, email from auth.users where lower(email) = lower(p_email) limit 1;
$$;
revoke execute on function public.friend_search_users(text) from public;
grant execute on function public.friend_search_users(text) to authenticated;

-- ----- 2) friend_lookup_emails(uuids uuid[]) ---------------------------------
-- Companion to friend_search_users: resolves uuid → email for a batch of
-- user ids so the list endpoint can render a "friend_email" column for
-- each FriendshipRow. Only returns (uuid, email) — never other auth.users
-- columns. Only resolves uuids that the caller already has a friendship
-- with (enforced via WHERE EXISTS on public.friendships), so a caller
-- cannot probe arbitrary users' emails by passing random uuids.
create or replace function public.friend_lookup_emails(p_user_ids uuid[])
  returns table (user_id uuid, email text)
  language sql
  security definer
  set search_path = public, auth
as $$
  select u.id, u.email from auth.users u
    where u.id = any(p_user_ids)
      and exists (
        select 1 from public.friendships f
         where (f.user_a = auth.uid() and f.user_b = u.id)
            or (f.user_b = auth.uid() and f.user_a = u.id)
      );
$$;
revoke execute on function public.friend_lookup_emails(uuid[]) from public;
grant execute on function public.friend_lookup_emails(uuid[]) to authenticated;

-- After applying, run `NOTIFY pgrst, 'reload schema';` so PostgREST picks
-- up the new functions without a manual restart.