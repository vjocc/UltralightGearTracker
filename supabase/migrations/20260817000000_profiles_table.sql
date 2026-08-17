-- ============================================================================
-- profiles table + display_name privacy-first — Bugfix: kötelező keresztnév
-- Architect-approved (Trello card 6a8322f24bea95bbdc205463, design-pass).
-- Forward-only migration. User-oldali futtatás: Supabase SQL Editor.
--
-- Adds:
--   1. public.profiles — id (uuid PK FK auth.users(id) ON DELETE CASCADE),
--      display_name (text NOT NULL, CHECK 1-50 char trim),
--      avatar_url, bio, created_at, updated_at + tg_set_updated_at trigger
--   2. on_auth_user_created AFTER INSERT trigger on auth.users → INSERT
--      INTO public.profiles (...) VALUES (NEW.id, 'Névtelen túrázó')
--      (a signup után automatikus placeholder)
--   3. Backfill migration: INSERT INTO public.profiles (id, display_name)
--      SELECT id, 'Névtelen túrázó' FROM auth.users
--      WHERE id NOT IN (SELECT id FROM public.profiles)
--      (a meglévő userek placeholder értéket kapnak)
--   4. trip_participant_lookup_profiles(p_user_ids uuid[], p_trip_id uuid)
--      SECURITY DEFINER function — privacy-first projection:
--      (user_id, display_name, avatar_url) a trip-résztvevőknek.
--      A függvény owner OR accepted_invitee feltételt ellenőriz
--      (a meglévő trip_visible_to() function-t hívja).
--
-- RLS Strict privacy-first:
--   * profiles_select_self: a user a saját profilját SELECT/UPDATE-olhatja
--   * profiles_update_self: a user a saját profilját UPDATE-olhatja
--     (display_name 1-50 char trim + avatar_url, bio)
--   * profiles_insert_self: a user a saját profilját INSERT-olhatja
--     (csak akkor, ha saját id-ját adja meg)
--   * NEM adunk SELECT policy-t 'public' role-ra — más user a
--     trip_participant_lookup_profiles() SECURITY DEFINER function-ön
--     keresztül olvashat (privacy-first: csak a trip-résztvevők számára)
--
-- Search-path defense (Phase 3 mintája): a SECURITY DEFINER function
-- set search_path = public, pg_temp (az auth táblát NEM query-zi runtime-ban,
-- csak DDL constraint-ben hivatkozik rá a profiles.id FK).
-- ============================================================================

-- ----- 1) profiles tábla ---------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 50),
  avatar_url  text,
  bio         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

create index if not exists profiles_display_name_idx
  on public.profiles (display_name);

comment on column public.profiles.display_name is
  'Keresztnév (1-50 char, trim whitespace). Placeholder: ''Névtelen túrázó'' a meglévő usereknél.';
comment on column public.profiles.avatar_url is
  'Profilkép URL (opcionális). NULL = nincs avatar feltöltve.';
comment on column public.profiles.bio is
  'Rövid bemutatkozó szöveg (opcionális, max 500 char — későbbi CHECK).';

-- ----- 2) auth.users INSERT trigger (signup → profile INSERT) ------------
-- A Supabase auth.users INSERT trigger-e: a signup során automatikusan
-- létrejön egy 'Névtelen túrázó' placeholder profil. A user a Profil
-- /Beállítások oldalon bármikor kitöltheti a valós nevet.
create or replace function public.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp, auth
as $$
declare
  v_display_name text;
begin
  -- A Supabase user_metadata->>'display_name' olvasása (a signup
  -- handler options.data.display_name PROPAGATES itt). Ha NULL vagy
  -- érvénytelen, a 'Névtelen túrázó' placeholder-et használjuk.
  v_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    'Névtelen túrázó'
  );
  insert into public.profiles (id, display_name)
  values (new.id, v_display_name)
  on conflict (id) do update set display_name = excluded.display_name;
  return new;
end;
$$;

-- A trigger a Supabase által kezelt auth.users táblán. Supabase a
-- dashboard-on engedélyezte a custom trigger-eket a Supabase-init által
-- használt role-okon (a P0 óta a trips hasonló trigger-eket futtat).
drop trigger if exists on_auth_user_created_trigger on auth.users;
create trigger on_auth_user_created_trigger
  after insert on auth.users
  for each row execute function public.on_auth_user_created();

-- ----- 3) Backfill migration: meglévő userek placeholder-rel --------------
-- A meglévő auth.users rekordok számára 'Névtelen túrázó' placeholder
-- profil jön létre. Ha a Supabase blokkolja a trigger-t, ez a backfill
-- akkor is gondoskodik a meglévő userekről.
insert into public.profiles (id, display_name)
select u.id, 'Névtelen túrázó'
  from auth.users u
  where u.id not in (select id from public.profiles)
on conflict (id) do nothing;

-- ----- 4) trip_participant_lookup_profiles SECURITY DEFINER function ----
-- A P2 „Ki mit visz" aggregált nézet privacy-safe projection-je: a
-- résztvevők user_id → display_name lookup. A függvény owner OR
-- accepted_invitee feltételt ellenőriz a meglévő trip_visible_to()
-- function-ön keresztül.
create or replace function public.trip_participant_lookup_profiles(
  p_user_ids uuid[],
  p_trip_id uuid
)
returns table (user_id uuid, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct p.id, p.display_name, p.avatar_url
    from public.profiles p
   where p.id = any(p_user_ids)
     and public.trip_visible_to(p_trip_id)
     and (p.id = (select user_id from public.trips where id = p_trip_id)
       or exists (
         select 1 from public.trip_share_invites i
          where i.trip_id = p_trip_id
            and i.invitee_user_id = p.id
            and i.status = 'accepted'
       )
     );
$$;

revoke execute on function public.trip_participant_lookup_profiles(uuid[], uuid) from public;
grant  execute on function public.trip_participant_lookup_profiles(uuid[], uuid) to authenticated;

comment on function public.trip_participant_lookup_profiles(uuid[], uuid) is
  'Sprint 5 P2.x bugfix: privacy-first display_name lookup. '
  'Returns (user_id, display_name, avatar_url) for trip participants. '
  'Uses trip_visible_to() SECURITY DEFINER for participation check.';

-- ----- 5) RLS policies ---------------------------------------------------
alter table public.profiles enable row level security;

-- SELECT-own: a user a saját profilját olvassa
create policy profiles_select_self on public.profiles
  for select using (auth.uid() = id);

-- UPDATE-self: a user a saját profilját frissítse
create policy profiles_update_self on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- INSERT-self: a user a saját profilját hozza létre (csak a saját id-jával)
create policy profiles_insert_self on public.profiles
  for insert with check (auth.uid() = id);

-- DELETE-self: a user a saját profilját törölje (ritka, de lehetséges)
create policy profiles_delete_self on public.profiles
  for delete using (auth.uid() = id);

-- NEM adunk SELECT policy-t 'public' role-ra — más user a
-- trip_participant_lookup_profiles() SECURITY DEFINER function-ön
-- keresztül olvashat (privacy-first: csak a trip-résztvevők számára).
-- A Phase 3 /discover PUBLIC visibility lista NEM tartalmazza a
-- display_name-t — a /discover endpoint 9-column projekciója
-- privacy-first (nincs user_id, nincs display_name).
