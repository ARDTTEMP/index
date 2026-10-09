begin;
-- Owners can remove obsolete photos after replacing their profile picture.
create policy profile_photo_owner_delete on storage.objects
for delete to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text
and exists (select 1 from public.profiles where id = auth.uid() and status in ('pending', 'approved')));
commit;
