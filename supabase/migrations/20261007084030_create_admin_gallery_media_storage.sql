begin;

create table if not exists public.gallery_media (
  id uuid primary key default gen_random_uuid(),
  media_type text not null check (media_type in ('image', 'video')),
  title_fr text not null check (length(trim(title_fr)) between 2 and 200),
  title_en text not null check (length(trim(title_en)) between 2 and 200),
  description_fr text not null default '' check (length(description_fr) <= 2000),
  description_en text not null default '' check (length(description_en) <= 2000),
  object_path text not null unique,
  poster_path text,
  published boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (object_path !~ '^/' and object_path !~ '\.\.')
);

alter table public.gallery_media enable row level security;
revoke all on public.gallery_media from public, anon, authenticated;
grant select on public.gallery_media to anon, authenticated;
grant insert, delete on public.gallery_media to authenticated;

drop policy if exists gallery_media_read on public.gallery_media;
create policy gallery_media_read on public.gallery_media
  for select to anon, authenticated
  using (published or private.is_admin());

drop policy if exists gallery_media_publish on public.gallery_media;
create policy gallery_media_publish on public.gallery_media
  for insert to authenticated
  with check (
    private.is_admin()
    and created_by = auth.uid()
    and published
    and split_part(object_path, '/', 1) = auth.uid()::text
    and (poster_path is null or split_part(poster_path, '/', 1) = auth.uid()::text)
  );

drop policy if exists gallery_media_delete on public.gallery_media;
create policy gallery_media_delete on public.gallery_media
  for delete to authenticated using (private.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery-media', 'gallery-media', true, 52428800,
        array['image/webp', 'video/webm', 'video/mp4'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists gallery_media_upload on storage.objects;
create policy gallery_media_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'gallery-media' and private.is_admin()
              and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists gallery_media_delete on storage.objects;
create policy gallery_media_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'gallery-media' and private.is_admin());

commit;
