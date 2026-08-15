-- ============================================================================
-- Gear-list public share — schema + RLS for v2 #19 /list/{id}.
-- Architect-approved, Trello card 6a7fbca2009b0fb7fc32017b (comment
-- 6a7fbde367dc1051681468f4).
--
-- Adds:
--   * public.public_lists — one row per user. Carries the opaque share_token
--                          (uuid) + is_public flag (default false ⇒ privacy
--                          default: private). owner is identified by user_id
--                          with a UNIQUE constraint so the upsert in
--                          /api/lists (POST) is idempotent on user_id.
--   * public.public_list_lookup(uuid) — SECURITY DEFINER helper. Returns
--                          the owner_user_id of a share_token iff
--                          (a) the token exists AND
--                          (b) is_public = true AND
--                          (c) (expires_at IS NULL OR expires_at > now()).
--                          Anonymous callers reach this through the GET
--                          /api/lists/[id] service-role client.
--                          The two-key gate (token + is_public + not-expired)
--                          is enforced HERE — not in client code — so the
--                          server-side policy cannot be bypassed by tampering
--                          with the request body.
--
-- v2 §0 alignment:
--   1. elv (no snapshot): gear_items are JOINed live in /api/lists/[id],
--      the public_lists row stores NO gear denormalised.
--   2. elv (anonymous READ): public_list_lookup is the only path a
--      non-authenticated caller can reach gear data through.
--   4. elv (schema-level is_public): enforced by the helper's WHERE clause
--      + RLS on the public_lists table itself.
--   5. elv (My Gear kivetítés, NEM Trip): the public_lists.user_id is the
--      gear owner; trips are not involved at any layer.
-- ============================================================================

-- ----- 1) public_lists -----------------------------------------------------
create table public.public_lists (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references auth.users(id) on delete cascade,
  share_token  uuid not null unique default gen_random_uuid(),
  is_public    boolean not null default false,
  label        text,
  expires_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- expires_at must be strictly in the future when supplied (NULL = never).
  constraint public_lists_expires_at_future
    check (expires_at is null or expires_at > created_at)
);

create index public_lists_user_id_idx
  on public.public_lists (user_id);
-- share_token is already indexed implicitly by the UNIQUE constraint,
-- so no extra index needed for the lookup-by-token hot path.

create trigger public_lists_set_updated_at
  before update on public.public_lists
  for each row execute function public.tg_set_updated_at();

-- ----- 2) RLS on public_lists ----------------------------------------------
-- Owner can SELECT / INSERT / UPDATE / DELETE their own row.
-- Anonymous callers (auth.uid() IS NULL) are explicitly BLOCKED here —
-- the GET /api/lists/[id] endpoint bypasses RLS via the service-role
-- client AND additionally gates on is_public = true inside
-- public_list_lookup, so no policy ever leaks a private token.
alter table public.public_lists enable row level security;

create policy public_lists_owner_select
  on public.public_lists for select
  to authenticated
  using (user_id = auth.uid());

create policy public_lists_owner_insert
  on public.public_lists for insert
  to authenticated
  with check (user_id = auth.uid());

create policy public_lists_owner_update
  on public.public_lists for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy public_lists_owner_delete
  on public.public_lists for delete
  to authenticated
  using (user_id = auth.uid());

-- ----- 3) public_list_lookup(uuid) — SECURITY DEFINER --------------------
-- Two-key gate (token + is_public=true + not-expired). Returns the owner
-- user_id, or NULL when the gate rejects the lookup. The actual gear
-- read happens in /api/lists/[id].get.ts using this owner_user_id as
-- the WHERE clause on gear_items.user_id (which itself is RLS-gated by
-- the SERVICE ROLE bypass — see endpoint comment).
create or replace function public.public_list_lookup(p_share_token uuid)
  returns table(owner_user_id uuid)
  language sql
  stable
  security definer
  set search_path = public, auth
as $$
  select pl.user_id
    from public.public_lists pl
   where pl.share_token = p_share_token
     and pl.is_public = true
     and (pl.expires_at is null or pl.expires_at > now())
   limit 1;
$$;

revoke all on function public.public_list_lookup(uuid) from public;
grant execute on function public.public_list_lookup(uuid) to authenticated, anon;