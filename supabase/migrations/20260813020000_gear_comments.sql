-- ============================================================================
-- Gear comments — schema + RLS for the Gear comment thread card.
-- Architect-approved (comment id 6a7d09761784f13f458ba824).
-- Forward-only migration.
--
-- Adds:
--   * public.gear_comments — flat comment thread per gear item.
--   * public.gear_visible_to(uuid) — SECURITY DEFINER helper that returns
--     TRUE iff the caller is the gear owner OR an accepted friend of the
--     gear owner. Used by both SELECT and INSERT RLS policies so the
--     "owner-or-friend" expression only appears once in the schema.
--   * public.gear_comment_lookup_authors(uuid[]) — SECURITY DEFINER helper
--     that resolves a batch of uuids → (uuid, email) for comment authors.
--     Only resolves uuids the caller can already see (i.e. authors of
--     comments on gear items visible to the caller), so callers cannot
--     probe arbitrary users' emails.
--
-- Visibility model: gear owner + accepted friends (status='accepted').
-- Public/anonymous reads are explicitly disabled by RLS — the policies
-- require auth.uid() to be present and visible.
-- ============================================================================

-- ----- 1) gear_comments -----------------------------------------------------
create table public.gear_comments (
  id           uuid primary key default gen_random_uuid(),
  gear_item_id uuid not null references public.gear_items(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index gear_comments_gear_item_id_idx on public.gear_comments (gear_item_id);
create index gear_comments_user_id_idx      on public.gear_comments (user_id);
create trigger gear_comments_set_updated_at
  before update on public.gear_comments
  for each row execute function public.tg_set_updated_at();

-- ----- 2) gear_visible_to(uuid) — SECURITY DEFINER --------------------------
-- Used by both SELECT and INSERT policies so the "gear owner OR an accepted
-- friend of the gear owner" expression is defined exactly once. SECURITY
-- DEFINER is needed because the function reads `auth.uid()` (a session-local
-- value) inside the function body — but the policy itself evaluates under
-- the caller's role, so wrapping the expression in a SECURITY DEFINER helper
-- is the architect-approved pattern that keeps RLS readable.
create or replace function public.gear_visible_to(p_gear_item_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, auth
as $$
  select exists (
    select 1 from public.gear_items g
     where g.id = p_gear_item_id
       and (
         g.user_id = auth.uid()
         or exists (
           select 1 from public.friendships f
            where f.status = 'accepted'
              and ((f.user_a = g.user_id and f.user_b = auth.uid())
                or (f.user_b = g.user_id and f.user_a = auth.uid()))
         )
       )
  );
$$;
revoke execute on function public.gear_visible_to(uuid) from public;
grant  execute on function public.gear_visible_to(uuid) to authenticated;

-- ----- 3) RLS enable + per-verb policies ------------------------------------
alter table public.gear_comments enable row level security;

-- SELECT — caller is the author OR the parent gear_item is visible to caller.
create policy gear_comments_select_visible on public.gear_comments
  for select using (
    auth.uid() = user_id
    or public.gear_visible_to(gear_item_id)
  );

-- INSERT — caller must be the author AND the parent gear_item must be
-- visible to the caller. Stops a stranger from commenting on a gear row
-- they otherwise cannot see.
create policy gear_comments_insert_visible on public.gear_comments
  for insert with check (
    auth.uid() = user_id
    and public.gear_visible_to(gear_item_id)
  );

-- UPDATE — only the author may edit their own comment. Body length is
-- re-checked on the policy level so a truncated patch cannot bypass it.
create policy gear_comments_update_author on public.gear_comments
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and char_length(body) between 1 and 2000
  );

-- DELETE — the comment author OR the gear owner (moderation). A stranger
-- who is not the comment author cannot delete someone else's comment.
create policy gear_comments_delete_author_or_gear_owner on public.gear_comments
  for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from public.gear_items g
       where g.id = gear_item_id and g.user_id = auth.uid()
    )
  );

-- ----- 4) gear_comment_lookup_authors(uuid[]) — SECURITY DEFINER ------------
-- Resolves uuid → (uuid, email) for a batch of user ids. Only returns rows
-- whose comment authors wrote a comment on a gear_item visible to the caller
-- (gated by public.gear_visible_to). This is stricter than friend_lookup_emails
-- because the gear-owner-self case is also visible to themselves.
create or replace function public.gear_comment_lookup_authors(p_user_ids uuid[])
  returns table (user_id uuid, email text)
  language sql
  security definer
  set search_path = public, auth
as $$
  select distinct u.id, u.email
    from auth.users u
   where u.id = any(p_user_ids)
     and exists (
       select 1
         from public.gear_comments c
         join public.gear_items g on g.id = c.gear_item_id
        where c.user_id = u.id
          and (
            g.user_id = auth.uid()
            or exists (
              select 1 from public.friendships f
               where f.status = 'accepted'
                 and ((f.user_a = g.user_id and f.user_b = auth.uid())
                   or (f.user_b = g.user_id and f.user_a = auth.uid()))
            )
          )
     );
$$;
revoke execute on function public.gear_comment_lookup_authors(uuid[]) from public;
grant  execute on function public.gear_comment_lookup_authors(uuid[]) to authenticated;

-- Realtime intentionally NOT enabled (project convention; opt-in later).