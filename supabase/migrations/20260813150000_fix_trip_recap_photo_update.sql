-- ============================================================================
-- Fix: enable UPDATE on trip_recap_photos so PATCH /photos/{id} works with the
-- caller-context client. Owner-only; the WITH CHECK mirrors the existing
-- INSERT policy (owner + recap-trip consistency).
-- ============================================================================
create policy trip_recap_photos_update_owner
  on public.trip_recap_photos
  for update using (
    exists (
      select 1 from public.trips t
       where t.id = trip_recap_photos.trip_id and t.user_id = auth.uid()
    )
  )
  with check (
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
