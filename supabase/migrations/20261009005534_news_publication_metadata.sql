begin;
alter table public.news add column author_name text, add column published_at timestamptz;
update public.news n set author_name=p.full_name, published_at=case when n.published then n.created_at end from public.profiles p where p.id=n.author_id;
create or replace function private.stamp_news_publication() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not private.is_admin() then raise exception 'Admin approved required' using errcode='42501'; end if;
  if TG_OP='INSERT' then
    new.author_id=auth.uid();
    select full_name into new.author_name from public.profiles where id=auth.uid();
    new.created_at=now();
    new.published_at=case when new.published then now() else null end;
  else
    new.created_at=old.created_at;
    new.author_id=old.author_id;
    new.author_name=old.author_name;
    new.published_at=old.published_at;
    if new.published and old.published_at is null then
      new.author_id=auth.uid();
      select full_name into new.author_name from public.profiles where id=auth.uid();
      new.published_at=now();
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.stamp_news_publication() from public,anon,authenticated;
create trigger news_publication_stamp before insert or update on public.news for each row execute function private.stamp_news_publication();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('news-photos','news-photos',true,5242880,array['image/webp']) on conflict(id) do nothing;
create policy news_photos_upload on storage.objects for insert to authenticated
with check(bucket_id='news-photos' and private.is_admin() and (storage.foldername(name))[1]=auth.uid()::text);
create policy news_photos_admin_read on storage.objects for select to authenticated
using(bucket_id='news-photos' and private.is_admin());
create index news_publication_order on public.news(published,published_at desc,id);
commit;
