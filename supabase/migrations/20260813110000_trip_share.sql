-- ============================================================================
-- Trip share + comments — schema + RLS for the P2 Social túra-meghívás +
-- barát kommentek túra alatt card (Architect-approved, comment id
-- 6a7d7063c1a074177f2f9fc2).
-- Forward-only migration.
--
-- Adds:
--   * public.trip_share_invites — owner → email meghívás a túrára. Self-invite
--                          tiltva, idempotens (UNIQUE trip_id+email).
--   * public.trip_comments    — baráti szál a túra alatt. Szerző + owner + accepted
--                          invitee + accepted friend láthatja; UPDATE author-only,
--                          DELETE author OR owner.
--   * public.trip_visible_to(uuid) — SECURITY DEFINER helper that returns TRUE
--                          iff the caller is the trip owner OR an accepted
--                          invitee OR an accepted friend of the trip owner.
--                          Mirror of public.gear_visible_to for trips.
--   * public.trip_comment_lookup_authors(uuid[]) — SECURITY DEFINER helper
--                          that resolves uuids → (uuid, email) for comment
--                          authors, gated by trip_visible_to so callers cannot
--                          probe arbitrary users' emails.
--   * trips SELECT policy bővítés — owner OR trip_visible_to(id) so shared
--                          trips is listed in /api/trips for the invitee.
--
-- Visibility model: owner + accepted invitee + accepted friend. Public/
-- anonymous reads are explicitly disabled by RLS — the policies require
-- auth.uid() to be present and visible.
-- ============================================================================

-- ----- 1) trip_share_invites ---------------------------------------------
create table public.trip_share_invites (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references public.trips(id) on delete cascade,
  inviter_id       uuid not null references auth.users(id) on delete cascade,
  invitee_email    text not null,
  invitee_user_id  uuid references auth.users(id) on delete cascade,
  status           text not null default 'pending'
                     check (status in ('pending','accepted','declined')),
  created_at       timestamptz not null default now(),
  responded_at     timestamptz,
  unique (trip_id, invitee_email)
);
create index trip_share_invites_trip_id_idx
  on public.trip_share_invites (trip_id);
create index trip_share_invites_email_lower_idx
  on public.trip_share_invites (lower(invitee_email));
create index trip_share_invites_invitee_user_id_idx
  on public.trip_share_invites (invitee_user_id)
  where invitee_user_id is not null;

-- ----- 2) trip_comments ---------------------------------------------------
create table public.trip_comments (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index trip_comments_trip_id_idx on public.trip_comments (trip_id);
create index trip_comments_user_id_idx on public.trip_comments (user_id);
create trigger trip_comments_set_updated_at
  before update on public.trip_comments
  for each row execute function public.tg_set_updated_at();

-- ----- 3) trip_visible_to(uuid) — SECURITY DEFINER -----------------------
-- Used by both trip_comments SELECT/INSERT policies AND by the trips
-- SELECT policy so the "owner OR accepted invitee OR accepted friend"
-- expression is defined exactly once. Mirrors public.gear_visible_to
-- (the canonical pair the Architect referenced).
create or replace function public.trip_visible_to(p_trip_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, auth
as $$
  select exists (
    select 1 from public.trips t
     where t.id = p_trip_id
       and (
         t.user_id = auth.uid()
         or exists (
           select 1 from public.trip_share_invites i
            where i.trip_id = t.id
              and i.status = 'accepted'
              and i.invitee_user_id = auth.uid()
         )
         or exists (
           select 1 from public.friendships f
            where f.status = 'accepted'
              and ((f.user_a = t.user_id and f.user_b = auth.uid())
                or (f.user_b = t.user_id and f.user_a = auth.uid()))
         )
       )
  );
$$;
revoke execute on function public.trip_visible_to(uuid) from public;
grant  execute on function public.trip_visible_to(uuid) to authenticated;

-- ----- 4) trip_share_invites RLS + policies ------------------------------
alter table public.trip_share_invites enable row level security;

-- SELECT — invitee (matched by email OR by resolved user_id) OR trip owner.
create policy trip_share_invites_select_invitee_or_owner
  on public.trip_share_invites
  for select using (
    auth.uid() = inviter_id
    or auth.uid() = invitee_user_id
    or exists (
      select 1 from public.trips t
       where t.id = trip_id and t.user_id = auth.uid()
    )
  );

-- INSERT — owner only (auth.uid() = inviter_id AND EXISTS owner).
create policy trip_share_invites_insert_owner
  on public.trip_share_invites
  for insert with check (
    auth.uid() = inviter_id
    and exists (
      select 1 from public.trips t
       where t.id = trip_id and t.user_id = auth.uid()
    )
  );

-- UPDATE — invitee only. WITH CHECK mirrors the schema CHECK.
create policy trip_share_invites_update_invitee
  on public.trip_share_invites
  for update using (
    auth.uid() = invitee_user_id
    or exists (
      select 1 from public.trips t
       where t.id = trip_id and t.user_id = auth.uid()
    )
  )
  with check (
    status in ('pending','accepted','declined')
    and (
      status = 'pending'
      or responded_at is not null
    )
  );

-- DELETE — owner OR invitee.
create policy trip_share_invites_delete_owner_or_invitee
  on public.trip_share_invites
  for delete using (
    auth.uid() = inviter_id
    or auth.uid() = invitee_user_id
    or exists (
      select 1 from public.trips t
       where t.id = trip_id and t.user_id = auth.uid()
    )
  );

-- ----- 5) trip_comments RLS + policies (mirror gear_comments) ------------
alter table public.trip_comments enable row level security;

-- SELECT — author OR trip is visible to caller.
create policy trip_comments_select_visible
  on public.trip_comments
  for select using (
    auth.uid() = user_id
    or public.trip_visible_to(trip_id)
  );

-- INSERT — author AND trip visible to caller.
create policy trip_comments_insert_visible
  on public.trip_comments
  for insert with check (
    auth.uid() = user_id
    and public.trip_visible_to(trip_id)
  );

-- UPDATE — author only, body length re-checked.
create policy trip_comments_update_author
  on public.trip_comments
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and char_length(body) between 1 and 2000
  );

-- DELETE — author OR trip owner (moderation).
create policy trip_comments_delete_author_or_trip_owner
  on public.trip_comments
  for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from public.trips t
       where t.id = trip_id and t.user_id = auth.uid()
    )
  );

-- ----- 6) trip_comment_lookup_authors(uuid[]) — SECURITY DEFINER ---------
-- Mirror of public.gear_comment_lookup_authors but gated by trip_visible_to.
-- Only returns emails of comment authors on trips the caller can see.
create or replace function public.trip_comment_lookup_authors(p_user_ids uuid[])
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
         from public.trip_comments c
         join public.trips t on t.id = c.trip_id
        where c.user_id = u.id
          and public.trip_visible_to(t.id)
     );
$$;
revoke execute on function public.trip_comment_lookup_authors(uuid[]) from public;
grant  execute on function public.trip_comment_lookup_authors(uuid[]) to authenticated;

-- ----- 7) trips SELECT policy bővítés (Architect §F.1) ------------------
-- A meglévő trips SELECT policy owner-scoped; ezt bővítjük, hogy az
-- accepted invitee-k + accepted friend-ek is lássák a shared trip-et
-- a /api/trips listán.
drop policy trips_select_own on public.trips;
create policy trips_select_own_or_shared on public.trips
  for select using (
    auth.uid() = user_id
    or public.trip_visible_to(id)
  );

-- Realtime intentionally NOT enabled (project convention; opt-in later).
