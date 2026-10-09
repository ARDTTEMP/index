begin;
revoke update on public.news from authenticated;
grant update(title_fr,title_en,content_fr,content_en,published,cover_image) on public.news to authenticated;
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
commit;
