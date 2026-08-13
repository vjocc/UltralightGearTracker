-- ============================================================================
-- Friend relationships — schema + RLS for the Friend relationships card.
-- Architect-approved (comment id 6a7d03a025498ad120cb8e1a).
-- Forward-only migration.
--
-- Adds:
--   * public.friendships  — reciprocal friend connection between two users,
--                           stored in canonical (user_a, user_b) order so a
--                           single row represents a pair regardless of which
--                           side initiated the request.
--   * public.friend_search_users(email) — SECURITY DEFINER helper that
--                           looks up a user_id by exact email match. The
--                           function is the only sanctioned way to query
--                           auth.users from the application code.
--
-- All RLS policies are keyed on auth.uid() = user_a OR auth.uid() = user_b,
-- so non-members cannot read or write any friendship row. The
-- `requested_by` column records who initiated the request, so the receiver
-- can be distinguished from the sender in UI badges. The `(user_a < user_b)`
-- CHECK + UNIQUE on (user_a, user_b) prevents self-friend-requests and
-- duplicate pair rows; concurrent sends from both sides collapse onto the
-- same canonical row, idempotently.
-- ============================================================================

-- ----- 1) friendships -------------------------------------------------------
create table public.friendships (
  id            uuid primary key default gen_random_uuid(),
  user_a        uuid not null references auth.users(id) on delete cascade,
  user_b        uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'pending'
                  check (status in ('pending', 'accepted', 'blocked')),
  requested_by  uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  -- Canonical ordering: user_a is the lexicographically smaller uuid. The
  -- CHECK forces the ordering on the DB layer (defence-in-depth); the
  -- server endpoint also enforces it via least()/greatest() so a misbehaving
  -- client cannot smuggle a reversed pair past the API.
  unique (user_a, user_b),
  check (user_a < user_b)
);
create index friendships_user_a_idx on public.friendships (user_a);
create index friendships_user_b_idx on public.friendships (user_b);

-- ----- 2) RLS enable + per-verb policies -----------------------------------
alter table public.friendships enable row level security;

-- SELECT — both members of the pair can read the row.
create policy friendships_select_members on public.friendships
  for select using (auth.uid() = user_a or auth.uid() = user_b);

-- INSERT — only the requester may create a row, and they must be one of the
-- two participants. The default status is 'pending' (the DB column default
-- covers new rows; we re-state it in the WITH CHECK for clarity).
create policy friendships_insert_requester on public.friendships
  for insert with check (
    auth.uid() = requested_by
    and auth.uid() in (user_a, user_b)
    and status = 'pending'
  );

-- UPDATE — both members can update the row, but only the non-requester
-- side may move status off 'pending' (i.e. accept / decline). This stops
-- the requester from re-writing an already-accepted row.
create policy friendships_update_accepter on public.friendships
  for update using (
    (auth.uid() = user_a or auth.uid() = user_b)
    and auth.uid() <> requested_by
  ) with check (
    (auth.uid() = user_a or auth.uid() = user_b)
    and status in ('accepted', 'blocked')
    and accepted_at is not null
  );

-- DELETE — both members may drop the row (used by both the "decline" and
-- the "remove" UI flows). The decline vs. delete routes share the same
-- underlying SQL; the split is purely cosmetic for the UI layer.
create policy friendships_delete_members on public.friendships
  for delete using (auth.uid() = user_a or auth.uid() = user_b);

-- ----- 3) friend_search_users(email) — SECURITY DEFINER --------------------
-- The only sanctioned way for app code to look up a user by email.
-- Returns user_id + email (no other auth.users columns), and only ever
-- matches a single row via exact, case-insensitive equality.
create or replace function public.friend_search_users(p_email text)
  returns table (user_id uuid, email text)
  language sql
  security definer
  set search_path = public, auth
as $$
  select id, email
    from auth.users
   where lower(email) = lower(p_email)
   limit 1;
$$;

-- Lock the function down to authenticated callers only. The PostgREST
-- "public" role and the anonymous role are revoked; `authenticated` is
-- granted. The /api/friends/search endpoint runs under the caller's JWT,
-- which is the `authenticated` role in PostgREST terms.
revoke execute on function public.friend_search_users(text) from public;
grant execute on function public.friend_search_users(text) to authenticated;

-- ----- 4) friend_lookup_emails(uuids uuid[]) — SECURITY DEFINER --------------
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
  select u.id, u.email
    from auth.users u
   where u.id = any(p_user_ids)
     and exists (
       select 1
         from public.friendships f
        where (f.user_a = auth.uid() and f.user_b = u.id)
           or (f.user_b = auth.uid() and f.user_a = u.id)
     );
$$;

revoke execute on function public.friend_lookup_emails(uuid[]) from public;
grant execute on function public.friend_lookup_emails(uuid[]) to authenticated;

-- Realtime intentionally NOT enabled (consistent with the project's
-- standing convention). Opt-in later if a "friend request received"
-- realtime notification is added.