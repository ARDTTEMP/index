begin;
alter table public.shop_products add column promotion_price integer;
alter table public.shop_products add constraint shop_promotion_price_valid check(promotion_price is null or (promotion_price>0 and promotion_price<price));
do $migration$
declare definition text;
begin
 select pg_get_functiondef('public.shop_action(text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'category,price,delivery,','category,price,promotion_price,delivery,');
 definition:=replace(definition,$needle$(p_data->>'price')::integer,(p_data->>'delivery')::integer$needle$,$replacement$(p_data->>'price')::integer,(p_data->>'promotion_price')::integer,(p_data->>'delivery')::integer$replacement$);
 definition:=replace(definition,$needle$elsif p_action='review_product' then$needle$,$replacement$elsif p_action='set_promotion' then
  if not is_staff then raise exception 'Admin requis' using errcode='42501';end if;
  select * into item from public.shop_products where id=(p_data->>'id')::uuid for update;
  if item.id is null then raise exception 'Produit introuvable';end if;
  if not (p_data ? 'promotion_price') then raise exception 'Prix promotionnel requis';end if;
  update public.shop_products set promotion_price=(p_data->>'promotion_price')::integer where id=item.id;
  return jsonb_build_object('ok',true);
 elsif p_action='review_product' then$replacement$);
 if definition not like '%set_promotion%' or definition not like '%category,price,promotion_price,delivery,%' then raise exception 'Structure Shop inattendue';end if;
 execute definition;
end;$migration$;
create function private.enforce_description_minimum() returns trigger language plpgsql set search_path='' as $$
declare fields text[];k text;minimum integer:=150;row_data jsonb:=to_jsonb(new);
begin
 case tg_table_name
 when 'reports' then fields:=array['description'];minimum:=1500;
 when 'groups' then fields:=array['description'];
 when 'shop_products' then fields:=array['description','description_en'];
 when 'gallery_media' then fields:=array['description_fr','description_en'];
 else raise exception 'Table non autorisée';
 end case;
 foreach k in array fields loop
  if tg_op='UPDATE' and row_data->k is not distinct from to_jsonb(old)->k then continue;end if;
  if char_length(btrim(coalesce(row_data->>k,'')))<minimum then raise exception '% : % caractères minimum',k,minimum using errcode='23514';end if;
 end loop;
 return new;
end;$$;
create trigger report_description_minimum before insert or update of description on public.reports for each row execute function private.enforce_description_minimum();
create trigger group_description_minimum before insert or update of description on public.groups for each row execute function private.enforce_description_minimum();
create trigger product_description_minimum before insert or update of description,description_en on public.shop_products for each row execute function private.enforce_description_minimum();
create trigger gallery_description_minimum before insert or update of description_fr,description_en on public.gallery_media for each row execute function private.enforce_description_minimum();
commit;
