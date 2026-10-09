-- Applied after schema.sql. Owners may remove their own group attachments.
create policy group_delete on storage.objects for delete to authenticated using(bucket_id='group-files' and (storage.foldername(name))[1]='groups' and (storage.foldername(name))[3]=auth.uid()::text);
