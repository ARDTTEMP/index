begin;
create table public.shop_sellers (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','approved','rejected','suspended')),
 motivation text not null check(length(motivation) between 10 and 2000),
 reviewed_by uuid references public.profiles(id) on delete set null,
 reviewed_at timestamptz, created_at timestamptz not null default now()
);
create table public.shop_products (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id),
 association_product boolean not null, title text not null check(length(title) between 2 and 120),
 description text not null check(length(description) between 10 and 4000),
 category text not null check(category in ('Maison et décoration','Aménagement','Accessoires','Sur mesure')),
 price integer not null check(price between 1 and 100000000), delivery integer not null check(delivery between 0 and 10000000),
 delivery_zone text not null check(length(delivery_zone) between 2 and 300),
 stock integer not null check(stock between 0 and 100000), photo_path text not null,
 status text not null check(status in ('pending','published','rejected','archived')),
 reviewed_by uuid references public.profiles(id) on delete set null, reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create index shop_products_catalog on public.shop_products(status,created_at desc);
alter table public.shop_sellers enable row level security;
alter table public.shop_products enable row level security;
revoke all on public.shop_sellers,public.shop_products from anon,authenticated;
grant select on public.shop_sellers to authenticated;
grant select on public.shop_products to anon,authenticated;
create policy shop_sellers_read on public.shop_sellers for select to authenticated using(user_id=auth.uid() or private.is_admin());
create or replace function private.shop_vendor_active(p_owner uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.shop_sellers s on s.user_id=p.id where p.id=p_owner and p.role='membre' and p.status='approved' and s.status='approved');
$$;
revoke all on function private.shop_vendor_active(uuid) from public,anon,authenticated;
grant execute on function private.shop_vendor_active(uuid) to anon,authenticated;
create policy shop_products_read on public.shop_products for select to anon,authenticated using(
 (status='published' and (association_product or private.shop_vendor_active(owner_id))) or owner_id=auth.uid() or private.is_admin()
);
create or replace function public.shop_action(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles; s public.shop_sellers; item public.shop_products; new_id uuid; is_staff boolean;
begin
 select * into p from public.profiles where id=auth.uid() for share;
 if p.id is null or p.status<>'approved' then raise exception 'Compte approuvé requis' using errcode='42501'; end if;
 is_staff:=p.role in ('admin','super_admin');
 if p_action='request_activation' then
  if p.role<>'membre' then raise exception 'Réservé aux Membres approuvés' using errcode='42501'; end if;
  if length(trim(coalesce(p_data->>'motivation',''))) not between 10 and 2000 then raise exception 'Présentez votre activité (10 à 2000 caractères)'; end if;
  insert into public.shop_sellers(user_id,motivation) values(p.id,trim(p_data->>'motivation'))
  on conflict(user_id) do nothing;
  return jsonb_build_object('ok',true);
 elsif p_action='review_seller' then
  if p.role<>'super_admin' then raise exception 'Seul le Super Admin peut activer un vendeur' using errcode='42501'; end if;
  if p_data->>'status' not in ('approved','rejected','suspended') then raise exception 'Statut invalide'; end if;
  select * into s from public.shop_sellers where user_id=(p_data->>'id')::uuid for update;
  if s.user_id is null then raise exception 'Demande introuvable'; end if;
  if p_data->>'status'='approved' and not exists(select 1 from public.profiles where id=s.user_id and role='membre' and status='approved') then raise exception 'Membre approuvé requis' using errcode='42501'; end if;
  update public.shop_sellers set status=p_data->>'status',reviewed_by=p.id,reviewed_at=now() where user_id=s.user_id;
  return jsonb_build_object('ok',true);
 elsif p_action='create_product' then
  if not is_staff and not private.shop_vendor_active(p.id) then raise exception 'Activation vendeur requise' using errcode='42501'; end if;
  if p_data->>'photo_path' not like p.id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='shop-photos' and name=p_data->>'photo_path') then raise exception 'Photo du produit invalide'; end if;
  insert into public.shop_products(owner_id,association_product,title,description,category,price,delivery,delivery_zone,stock,photo_path,status,reviewed_by,reviewed_at)
  values(p.id,is_staff,trim(p_data->>'title'),trim(p_data->>'description'),p_data->>'category',(p_data->>'price')::integer,(p_data->>'delivery')::integer,trim(p_data->>'delivery_zone'),(p_data->>'stock')::integer,p_data->>'photo_path',case when is_staff then 'published' else 'pending' end,case when is_staff then p.id end,case when is_staff then now() end) returning id into new_id;
  return jsonb_build_object('id',new_id);
 elsif p_action='review_product' then
  if not is_staff then raise exception 'Admin requis' using errcode='42501'; end if;
  if p_data->>'status' not in ('published','rejected','archived') then raise exception 'Statut invalide'; end if;
  select * into item from public.shop_products where id=(p_data->>'id')::uuid for update;
  if item.id is null then raise exception 'Produit introuvable'; end if;
  if not item.association_product and p_data->>'status'='published' and not private.shop_vendor_active(item.owner_id) then raise exception 'Vendeur inactif' using errcode='42501'; end if;
  update public.shop_products set status=p_data->>'status',reviewed_by=p.id,reviewed_at=now() where id=item.id;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Opération invalide';
end;
$$;
revoke all on function public.shop_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.shop_action(text,jsonb) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('shop-photos','shop-photos',true,4194304,array['image/webp','image/jpeg','image/png']);
create policy shop_photo_insert on storage.objects for insert to authenticated with check(bucket_id='shop-photos' and (storage.foldername(name))[1]=auth.uid()::text and (private.is_admin() or private.shop_vendor_active(auth.uid())));
commit;
