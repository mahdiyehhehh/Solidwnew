-- ==========================================================================
-- SolidW — Storage Buckets & Policies
-- Run AFTER 01_tables.sql (and ideally after 04_functions.sql for is_admin()).
-- Bucket names must exactly match assets/js/config.js BUCKETS.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- Create buckets (public read, since logos/covers/gallery images are shown
-- on the public booking page with no auth). Writes are locked down below.
-- --------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('logos', 'logos', true),
  ('covers', 'covers', true),
  ('gallery', 'gallery', true)
on conflict (id) do nothing;

-- --------------------------------------------------------------------------
-- Path convention enforced by every policy below: {user_id}/{filename}
-- e.g. logos/3fa85f64-5717-4562-b3fc-2c963f66afa6/logo.png
-- This lets us check ownership using (storage.foldername(name))[1] = auth.uid()
-- without needing to join back to the businesses table.
-- --------------------------------------------------------------------------

-- ---------- logos bucket ----------
create policy "logos_public_read" on storage.objects
  for select
  using (bucket_id = 'logos');

create policy "logos_owner_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "logos_owner_update" on storage.objects
  for update
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "logos_owner_delete" on storage.objects
  for delete
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------- covers bucket ----------
create policy "covers_public_read" on storage.objects
  for select
  using (bucket_id = 'covers');

create policy "covers_owner_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "covers_owner_update" on storage.objects
  for update
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "covers_owner_delete" on storage.objects
  for delete
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------- gallery bucket ----------
create policy "gallery_public_read" on storage.objects
  for select
  using (bucket_id = 'gallery');

create policy "gallery_owner_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'gallery'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "gallery_owner_update" on storage.objects
  for update
  using (
    bucket_id = 'gallery'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "gallery_owner_delete" on storage.objects
  for delete
  using (
    bucket_id = 'gallery'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- --------------------------------------------------------------------------
-- Admin override — allows admin to delete any file in any bucket
-- (used by admin/businesses.js when force-removing a suspended business).
-- --------------------------------------------------------------------------
create policy "admin_delete_any_object" on storage.objects
  for delete
  using (is_admin());