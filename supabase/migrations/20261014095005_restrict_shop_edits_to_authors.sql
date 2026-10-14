begin;
CREATE OR REPLACE FUNCTION public.shop_action(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  insert into public.shop_products(owner_id,association_product,title,title_en,description,description_en,category,price,promotion_price,delivery,delivery_zone,delivery_zone_en,stock,photo_path,status,reviewed_by,reviewed_at)
  values(p.id,is_staff,trim(p_data->>'title'),trim(p_data->>'title_en'),trim(p_data->>'description'),trim(p_data->>'description_en'),p_data->>'category',(p_data->>'price')::integer,(p_data->>'promotion_price')::integer,(p_data->>'delivery')::integer,trim(p_data->>'delivery_zone'),trim(p_data->>'delivery_zone_en'),(p_data->>'stock')::integer,p_data->>'photo_path',case when is_staff then 'published' else 'pending' end,case when is_staff then p.id end,case when is_staff then now() end) returning id into new_id;
  return jsonb_build_object('id',new_id);
 elsif p_action in ('update_product','set_promotion') then
  select * into item from public.shop_products where id=(p_data->>'id')::uuid for update;
  if item.id is null then raise exception 'Produit introuvable';end if;
  if item.owner_id<>p.id then raise exception 'Seul l’auteur peut modifier ce produit' using errcode='42501';end if;
  if not is_staff and not private.shop_vendor_active(p.id) then raise exception 'Activation vendeur requise' using errcode='42501';end if;
  if p_action='set_promotion' then
   if not (p_data ? 'promotion_price') then raise exception 'Prix promotionnel requis';end if;
   update public.shop_products set promotion_price=(p_data->>'promotion_price')::integer,
    status=case when is_staff then status else 'pending' end,
    reviewed_by=case when is_staff then reviewed_by else null end,reviewed_at=case when is_staff then reviewed_at else null end where id=item.id;
  else
   if p_data->>'photo_path' not like p.id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='shop-photos' and name=p_data->>'photo_path') then raise exception 'Photo du produit invalide';end if;
   if char_length(trim(coalesce(p_data->>'title_en',''))) not between 2 and 120 or char_length(trim(coalesce(p_data->>'description_en',''))) not between 150 and 4000 then raise exception 'Contenu anglais invalide';end if;
   update public.shop_products set title=trim(p_data->>'title'),title_en=trim(p_data->>'title_en'),description=trim(p_data->>'description'),description_en=trim(p_data->>'description_en'),category=p_data->>'category',price=(p_data->>'price')::integer,promotion_price=(p_data->>'promotion_price')::integer,delivery=(p_data->>'delivery')::integer,delivery_zone=trim(p_data->>'delivery_zone'),delivery_zone_en=trim(p_data->>'delivery_zone_en'),stock=(p_data->>'stock')::integer,photo_path=p_data->>'photo_path',
    status=case when is_staff then item.status else 'pending' end,
    reviewed_by=case when is_staff then item.reviewed_by else null end,reviewed_at=case when is_staff then item.reviewed_at else null end where id=item.id;
  end if;
  return jsonb_build_object('ok',true);
 elsif p_action='delete_product' then
  if not is_staff then raise exception 'Admin requis' using errcode='42501';end if;
  delete from public.shop_products where id=(p_data->>'id')::uuid;
  if not found then raise exception 'Produit introuvable';end if;
  return jsonb_build_object('ok',true);
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
$function$
;
commit;
