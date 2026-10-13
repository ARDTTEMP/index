begin;
create table public.managed_pages(path text primary key,live_document jsonb,revision bigint not null default 0,updated_at timestamptz not null default now());
create table public.managed_page_versions(id uuid primary key default gen_random_uuid(),path text not null references public.managed_pages(path),document jsonb not null,revision bigint not null,published boolean not null,author_id uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now(),unique(path,revision));
alter table public.managed_pages enable row level security;
alter table public.managed_page_versions enable row level security;
revoke all on public.managed_pages,public.managed_page_versions from anon,authenticated;
grant select on public.managed_pages to anon,authenticated;
grant select on public.managed_page_versions to authenticated;
create policy managed_pages_read on public.managed_pages for select to anon,authenticated using(live_document is not null or private.is_admin());
create policy managed_versions_staff on public.managed_page_versions for select to authenticated using(private.is_admin());
create or replace function public.save_managed_page(p_path text,p_document jsonb,p_publish boolean,p_expected_revision bigint) returns bigint language plpgsql security definer set search_path='' as $$
declare b jsonb; k text; r bigint;
begin
 if not private.is_admin() then raise exception 'Admin approuvé requis' using errcode='42501'; end if;
 if p_path not in ('/','/about','/activities','/contact','/join','/donate','/news','/gallery','/shop') then raise exception 'Page non autorisée';end if;
 if jsonb_typeof(p_document)<>'array' or jsonb_array_length(p_document)>40 then raise exception '40 blocs maximum';end if;
 if p_publish and jsonb_array_length(p_document)=0 then raise exception 'Ajoutez du contenu avant publication';end if;
 for b in select * from jsonb_array_elements(p_document) loop
  if coalesce(b->>'type','') not in ('heading','paragraph','list','image','video','link') then raise exception 'Bloc invalide';end if;
  if coalesce(b->>'align','') not in ('left','center','right') or coalesce(b->>'font','') not in ('century','times') or coalesce(b->>'size','') not in ('16','20','28','36','48') or coalesce(b->>'color','') not in ('#193529','#166534','#555555','#9a3412') then raise exception 'Mise en forme invalide';end if;
  if coalesce(b->>'width','') not in ('25','50','75','100') or coalesce(b->>'crop','') not in ('auto','square','wide','portrait') or coalesce(b->>'position','') not in ('center','top','bottom') then raise exception 'Format image invalide';end if;
  if coalesce(b->>'margin','16') not in ('0','8','16','24') or coalesce(b->>'radius','16') not in ('0','8','16','24') then raise exception 'Espacement invalide';end if;
  foreach k in array array['fr','en'] loop
   if jsonb_typeof(b->k)<>'string' or length(coalesce(b->>k,''))>10000 then raise exception 'Texte invalide';end if;
   if p_publish and length(trim(coalesce(b->>k,'')))<2 then raise exception 'Français et anglais obligatoires';end if;
  end loop;
  if b->>'type'='image' then
   if not exists(select 1 from storage.objects where bucket_id='page-photos' and name=b->>'path') then raise exception 'Photo non enregistrée';end if;
   if p_publish and (length(trim(coalesce(b->>'alt_fr','')))<2 or length(trim(coalesce(b->>'alt_en','')))<2) then raise exception 'Description photo FR/EN obligatoire';end if;
  elsif b->>'type'='video' then
   if coalesce(b->>'provider','') not in ('youtube','vimeo','dailymotion') or coalesce(b->>'video_id','') !~ '^[A-Za-z0-9_-]{1,40}$' then raise exception 'Vidéo externe invalide';end if;
  elsif b->>'type'='link' then
   if coalesce(b->>'href','') !~ '^https://[^[:space:]<>]+$' then raise exception 'Lien HTTPS requis';end if;
  end if;
 end loop;
 insert into public.managed_pages(path) values(p_path) on conflict do nothing;
 select revision into r from public.managed_pages where path=p_path for update;
 if r<>p_expected_revision then raise exception 'Cette page a été modifiée. Rechargez avant de sauvegarder.' using errcode='40001';end if;
 r:=r+1;
 update public.managed_pages set revision=r,updated_at=now(),live_document=case when p_publish then p_document else live_document end where path=p_path;
 insert into public.managed_page_versions(path,document,revision,published,author_id) values(p_path,p_document,r,p_publish,auth.uid());
 return r;
end;$$;
revoke all on function public.save_managed_page(text,jsonb,boolean,bigint) from public,anon,authenticated;
grant execute on function public.save_managed_page(text,jsonb,boolean,bigint) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('page-photos','page-photos',true,4194304,array['image/webp']);
create policy page_photos_admin_insert on storage.objects for insert to authenticated with check(bucket_id='page-photos' and private.is_admin() and (storage.foldername(name))[1]=auth.uid()::text);
create or replace function private.require_bilingual_publication() returns trigger language plpgsql set search_path='' as $$
begin
 if new.published and (length(trim(coalesce(new.title_fr,'')))<2 or length(trim(coalesce(new.title_en,'')))<2) then raise exception 'Titres français et anglais obligatoires';end if;
 if new.published and tg_table_name='news' then
  if length(trim(coalesce(to_jsonb(new)->>'content_fr','')))<10 or length(trim(coalesce(to_jsonb(new)->>'content_en','')))<10 then raise exception 'Contenus français et anglais obligatoires';end if;
 elsif new.published and tg_table_name='gallery_media' then
  if length(trim(coalesce(to_jsonb(new)->>'description_fr','')))<2 or length(trim(coalesce(to_jsonb(new)->>'description_en','')))<2 then raise exception 'Descriptions françaises et anglaises obligatoires';end if;
 end if;
 return new;
end;$$;
create trigger news_bilingual_required before insert or update on public.news for each row execute function private.require_bilingual_publication();
create trigger gallery_bilingual_required before insert or update on public.gallery_media for each row execute function private.require_bilingual_publication();
alter table public.shop_products add column title_en text,add column description_en text,add column delivery_zone_en text;
do $migration$
declare definition text;
begin
 select pg_get_functiondef('public.shop_action(text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'owner_id,association_product,title,description,category,price,delivery,delivery_zone,stock','owner_id,association_product,title,title_en,description,description_en,category,price,delivery,delivery_zone,delivery_zone_en,stock');
 definition:=replace(definition,$needle$p.id,is_staff,trim(p_data->>'title'),trim(p_data->>'description'),p_data->>'category'$needle$,$replace$p.id,is_staff,trim(p_data->>'title'),trim(p_data->>'title_en'),trim(p_data->>'description'),trim(p_data->>'description_en'),p_data->>'category'$replace$);
 definition:=replace(definition,$needle$trim(p_data->>'delivery_zone'),(p_data->>'stock')$needle$,$replace$trim(p_data->>'delivery_zone'),trim(p_data->>'delivery_zone_en'),(p_data->>'stock')$replace$);
 execute definition;
end;$migration$;
create function private.require_bilingual_product() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' or new.status='published' then
  if length(trim(coalesce(new.title_en,'')))<2 or length(trim(coalesce(new.description_en,'')))<10 or length(trim(coalesce(new.delivery_zone_en,'')))<2 then raise exception 'Produit : français et anglais obligatoires';end if;
 end if;
 return new;
end;$$;
create trigger shop_bilingual_required before insert or update on public.shop_products for each row execute function private.require_bilingual_product();
commit;
