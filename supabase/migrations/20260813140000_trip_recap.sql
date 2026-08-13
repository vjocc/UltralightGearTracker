-- ============================================================================
-- Trip recap + photos — schema + RLS for the P3 Túra-élménybeszámoló + fotók
-- card (Architect-approved, design comment 6a7dccab1dbffa34f07195e1).
-- Forward-only migration.
--
-- Adds:
--   * public.trip_recaps       — one row per trip. body + rating_out_of_10 +
--                          public privacy toggle. Unique (trip_id) so the
--                          POST endpoint can upsert by trip.
--   * public.trip_recap_photos — photo grid metadata. storage_path encodes
--                          {user_id}/{trip_id}/{recap_id}/{photo_id}.{ext}.
--                          `recap_id` + `trip_id` denormalised so the INSERT
--                          WITH CHECK policy can do a direct owner join.
--   * storage.objects RLS      — SELECT public-read on the `trip-photos`
--                          bucket; INSERT/DELETE owner-only keyed on the
--                          storage_path prefix matching auth.uid().
--
-- Visibility model: recap + photos are readable by owner + accepted invitee
-- + accepted friend (via the existing public.trip_visible_to(trip_id) helper
-- from the P2 migration), AND publicly when recap.public = true. Writes are
-- owner-only — confirmed by the SELECT EXISTS pattern on the parent trip.
--
-- Storage bucket creation:
--   The `trip-photos` bucket itself is created via the Supabase Dashboard
--   (Buckets → New bucket → name=`trip-photos`, Public ON, 5 MB, MIME:
--   jpeg/png/webp) — see Architect §B.1 and the P3 handoff Trello comment.
--   This migration inserts the storage.buckets row + RLS policies so the
--   server-side upload endpoint (`server/api/trips/[id]/recap/photos.post.ts`)
--   can write and clients can read with <img src>.
-- ============================================================================

-- ----- 1) trip_recaps ------------------------------------------------------
create table public.trip_recaps (
  id                uuid primary key default gen_random_uuid(),
  trip_id           uuid not null unique references public.trips(id) on delete cascade,
  body              text,
  rating_out_of_10  integer check (rating_out_of_10 between 0 and 10),
  public            boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index trip_recaps_trip_id_idx on public.trip_recaps (trip_id);
create trigger trip_recaps_set_updated_at
  before update on public.trip_recaps
  for each row execute function public.tg_set_updated_at();

-- ----- 2) trip_recap_photos ------------------------------------------------
create table public.trip_recap_photos (
  id              uuid primary key default gen_random_uuid(),
  trip_id         uuid not null references public.trips(id) on delete cascade,
  recap_id        uuid not null references public.trip_recaps(id) on delete cascade,
  storage_path    text not null,
  caption         text,
  display_order   integer not null default 0,
  created_at      timestamptz not null default now()
);
create index trip_recap_photos_recap_id_idx
  on public.trip_recap_photos (recap_id, display_order);
create index trip_recap_photos_trip_id_idx
  on public.trip_recap_photos (trip_id);

-- ----- 3) RLS on recap + photos tables -------------------------------------
alter table public.trip_recaps       enable row level security;
alter table public.trip_recap_photos enable row level security;

-- SELECT — owner OR (recap.public) OR trip_visible_to(trip_id).
-- Three-arm exists check mirrors gear_comments + trip_comments pattern.
create policy trip_recaps_select_visible
  on public.trip_recaps
  for select using (
    exists (
      select 1 from public.trips t
       where t.id = trip_recaps.trip_id and t.user_id = auth.uid()
    )
    or public = true
    or public.trip_visible_to(trip_id)
  );

-- INSERT — owner only (WITH CHECK joins on parent trip.user_id = auth.uid()).
-- The check on rating_out_of_10 is repeated so service-role writes also
-- respect the 0..10 bound.
create policy trip_recaps_insert_owner
  on public.trip_recaps
  for insert with check (
    exists (
      select 1 from public.trips t
       where t.id = trip_recaps.trip_id and t.user_id = auth.uid()
    )
    and (rating_out_of_10 is null or rating_out_of_10 between 0 and 10)
  );

-- UPDATE — owner only, same rating check on the new value.
create policy trip_recaps_update_owner
  on public.trip_recaps
  for update using (
    exists (
      select 1 from public.trips t
       where t.id = trip_recaps.trip_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trips t
       where t.id = trip_recaps.trip_id and t.user_id = auth.uid()
    )
    and (rating_out_of_10 is null or rating_out_of_10 between 0 and 10)
  );

-- DELETE — owner only (cascade removes trip_recap_photos automatically).
create policy trip_recaps_delete_owner
  on public.trip_recaps
  for delete using (
    exists (
      select 1 from public.trips t
       where t.id = trip_recaps.trip_id and t.user_id = auth.uid()
    )
  );

-- trip_recap_photos SELECT — visibility propagates through the parent recap.
create policy trip_recap_photos_select_visible
  on public.trip_recap_photos
  for select using (
    exists (
      select 1 from public.trips t
       where t.id = trip_recap_photos.trip_id and t.user_id = auth.uid()
    )
    or exists (
      select 1 from public.trip_recaps r
       where r.id = trip_recap_photos.recap_id
         and (r.public = true or public.trip_visible_to(r.trip_id))
    )
  );

-- trip_recap_photos INSERT — owner AND recap_id joins a trip owned by caller,
-- AND recap.trip_id matches photo.trip_id (defense-in-depth).
create policy trip_recap_photos_insert_owner
  on public.trip_recap_photos
  for insert with check (
    exists (
      select 1 from public.trips t
       where t.id = trip_recap_photos.trip_id and t.user_id = auth.uid()
    )
    and exists (
      select 1 from public.trip_recaps r
       where r.id = trip_recap_photos.recap_id
         and r.trip_id = trip_recap_photos.trip_id
    )
  );

-- trip_recap_photos DELETE — owner only.
create policy trip_recap_photos_delete_owner
  on public.trip_recap_photos
  for delete using (
    exists (
      select 1 from public.trips t
       where t.id = trip_recap_photos.trip_id and t.user_id = auth.uid()
    )
  );

-- trip_recap_photos UPDATE — intentionally NO policy.
-- Reorder + caption edits go through service-role from the PATCH endpoint,
-- so the row's existing SELECT policy gates visibility for that path.

-- ----- 4) Storage bucket + storage.objects RLS -----------------------------
-- The bucket itself: idempotent insert. If it already exists (the dashboard
-- setup script ran first), the conflict is silently absorbed.
insert into storage.buckets (id, name, public)
  values ('trip-photos', 'trip-photos', true)
  on conflict (id) do nothing;

-- storage.objects SELECT — public-read on the trip-photos bucket. The bucket
-- flag (public=true) already gates anonymous reads; this policy adds the
-- explicit authenticated row-level check so we can introspect later.
create policy trip_photos_objects_select_public
  on storage.objects
  for select using (bucket_id = 'trip-photos');

-- storage.objects INSERT — owner-only, keyed on storage_path starting with
-- the caller's auth.uid(). Server endpoints use serverSupabaseClient which
-- preserves auth.uid() in the storage upload path.
create policy trip_photos_objects_insert_owner
  on storage.objects
  for insert with check (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- storage.objects DELETE — owner-only, same auth.uid() prefix check.
create policy trip_photos_objects_delete_owner
  on storage.objects
  for delete using (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- storage.objects UPDATE — explicitly NO policy. Photo objects are immutable
-- (reorder / caption live on the trip_recap_photos row, not on the blob).