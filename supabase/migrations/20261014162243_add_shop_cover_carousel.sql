begin;
create table public.shop_cover_settings (
 id boolean primary key default true check(id),
 slides jsonb not null check(jsonb_typeof(slides)='array' and jsonb_array_length(slides)=3),
 updated_by uuid references public.profiles(id) on delete set null,
 updated_at timestamptz not null default now()
);
alter table public.shop_cover_settings enable row level security;
revoke all on public.shop_cover_settings from public,anon,authenticated;
grant select on public.shop_cover_settings to anon,authenticated;
create policy shop_cover_read on public.shop_cover_settings for select to anon,authenticated using(true);
create function public.save_shop_covers(p_slides jsonb) returns void language plpgsql security definer set search_path='' as $$
declare p public.profiles; slide jsonb;
begin
 select * into p from public.profiles where id=auth.uid() for share;
 if p.id is null or p.role<>'super_admin' or p.status<>'approved' then raise exception 'Super Admin requis' using errcode='42501';end if;
 if p_slides is null or jsonb_typeof(p_slides)<>'array' or jsonb_array_length(p_slides)<>3 then raise exception 'Trois images requises';end if;
 for slide in select value from jsonb_array_elements(p_slides) loop
  if jsonb_typeof(slide)<>'object' or length(trim(coalesce(slide->>'alt_fr',''))) not between 2 and 300 or length(trim(coalesce(slide->>'alt_en',''))) not between 2 and 300 or coalesce(slide->>'position','') not in ('center','top','bottom') then raise exception 'Description française et anglaise requise';end if;
  if not exists(select 1 from storage.objects where bucket_id='shop-covers' and name=slide->>'path') then raise exception 'Image introuvable';end if;
 end loop;
 if (select count(distinct value->>'path') from jsonb_array_elements(p_slides))<>3 then raise exception 'Trois images différentes requises';end if;
 insert into public.shop_cover_settings(id,slides,updated_by) values(true,p_slides,p.id)
 on conflict(id) do update set slides=excluded.slides,updated_by=excluded.updated_by,updated_at=now();
end;$$;
revoke all on function public.save_shop_covers(jsonb) from public,anon,authenticated;
grant execute on function public.save_shop_covers(jsonb) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('shop-covers','shop-covers',true,358400,array['image/webp']);
create policy shop_cover_upload on storage.objects for insert to authenticated with check(
 bucket_id='shop-covers' and (storage.foldername(name))[1]=(select auth.uid())::text and
 exists(select 1 from public.profiles where id=(select auth.uid()) and role='super_admin' and status='approved')
);
commit;
