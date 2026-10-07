begin;
alter table public.gallery_media drop constraint if exists gallery_media_object_path_check;
alter table public.gallery_media add constraint gallery_media_paths_safe check (
  object_path !~ '^/'
  and position('..' in object_path) = 0
  and (poster_path is null or (poster_path !~ '^/' and position('..' in poster_path) = 0))
);
commit;
