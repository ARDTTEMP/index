begin;
-- Public media files already have public download URLs. Only approved administrators
-- may list them to verify uploads before publication or management.
create policy gallery_media_admin_read on storage.objects
for select to authenticated
using (bucket_id = 'gallery-media' and private.is_admin());
commit;
