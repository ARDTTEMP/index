begin;
-- Immutable monetary snapshots: product edits/deletion must not rewrite past sales.
create table public.shop_orders (
 id uuid primary key default gen_random_uuid(), request_key uuid not null unique,
 buyer_id uuid not null references public.profiles(id), seller_id uuid not null references public.profiles(id),
 product_id uuid references public.shop_products(id) on delete set null,
 product_title text not null, association_product boolean not null,
 quantity integer not null check(quantity between 1 and 20), amount integer not null check(amount between 100 and 100000000),
 commission integer not null, seller_amount integer not null,
 delivery_address text not null check(length(delivery_address) between 10 and 600),
 phone text not null check(length(phone) between 6 and 40),
 payment_status text not null default 'unpaid' check(payment_status in ('unpaid','paid','refunded','review')),
 fulfillment text not null default 'awaiting_payment' check(fulfillment in ('awaiting_payment','preparing','shipped','delivered','canceled')),
 stock_released boolean not null default false,
 paid_at timestamptz, delivered_at timestamptz, delivered_by uuid references public.profiles(id),
 payout_reference text, paid_out_at timestamptz, paid_out_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 check(commission=case when association_product then amount else round(amount::numeric*.07)::integer end),
 check(seller_amount=amount-commission),
 check(paid_out_at is null or (payout_reference is not null and delivered_at is not null))
);
create index shop_orders_seller on public.shop_orders(seller_id,created_at desc);
create index shop_orders_buyer on public.shop_orders(buyer_id,created_at desc);
alter table public.shop_orders enable row level security;
revoke all on public.shop_orders from public,anon,authenticated;
grant select on public.shop_orders to authenticated;
create policy shop_orders_read on public.shop_orders for select to authenticated using(
 exists(select 1 from public.profiles where id=(select auth.uid()) and status in ('pending','approved')) and
 (buyer_id=(select auth.uid()) or (seller_id=(select auth.uid()) and payment_status<>'unpaid') or private.is_admin())
);
create table private.shop_checkouts (
 id uuid primary key references public.shop_orders(id), amount integer not null, sandbox boolean not null,
 provider_reference text unique, checkout_url text, status text not null default 'creating', updated_at timestamptz not null default now()
);
alter table private.shop_checkouts enable row level security;
revoke all on private.shop_checkouts from public,anon,authenticated;

create function public.shop_order_action(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles; item public.shop_products; o public.shop_orders; total bigint; fee integer; target uuid;
begin
 select * into p from public.profiles where id=auth.uid() for share;
 if p.id is null or p.status not in ('pending','approved') then raise exception 'Connexion requise / Sign in required' using errcode='42501'; end if;
 if p_action='create' then
  target:=(p_data->>'request_key')::uuid;
  if target is null then raise exception 'Clé de commande requise'; end if;
  perform pg_advisory_xact_lock(hashtextextended('shop-order:'||target,0));
  select * into o from public.shop_orders where request_key=target;
  if o.id is not null then
   if o.buyer_id<>p.id then raise exception 'Forbidden' using errcode='42501'; end if;
   return jsonb_build_object('id',o.id);
  end if;
  if (select count(*) from public.shop_orders where buyer_id=p.id and payment_status='unpaid' and fulfillment<>'canceled')>=3 then raise exception 'Terminez vos commandes en attente / Complete your pending orders'; end if;
  select * into item from public.shop_products where id=(p_data->>'product_id')::uuid for update;
  if item.id is null or item.status<>'published' or (not item.association_product and not private.shop_vendor_active(item.owner_id)) then raise exception 'Produit indisponible / Product unavailable'; end if;
  if item.owner_id=p.id then raise exception 'Vous ne pouvez pas acheter votre produit / You cannot buy your own product'; end if;
  if coalesce((p_data->>'quantity')::integer,0) not between 1 and least(20,item.stock) then raise exception 'Stock insuffisant / Insufficient stock'; end if;
  -- Delivery is charged per item, included in the displayed unit price.
  total:=(coalesce(item.promotion_price,item.price)::bigint+item.delivery)*(p_data->>'quantity')::integer;
  if total not between 100 and 100000000 then raise exception 'Montant invalide / Invalid amount'; end if;
  fee:=case when item.association_product then total::integer else round(total::numeric*.07)::integer end;
  insert into public.shop_orders(request_key,buyer_id,seller_id,product_id,product_title,association_product,quantity,amount,commission,seller_amount,delivery_address,phone)
  values(target,p.id,item.owner_id,item.id,item.title,item.association_product,(p_data->>'quantity')::integer,total,fee,total-fee,trim(p_data->>'delivery_address'),trim(p_data->>'phone')) returning * into o;
  update public.shop_products set stock=stock-o.quantity where id=item.id;
  return jsonb_build_object('id',o.id);
 end if;
 select * into o from public.shop_orders where id=(p_data->>'id')::uuid for update;
 if o.id is null then raise exception 'Commande introuvable / Order not found'; end if;
 if p_action='shipped' then
  if p.status<>'approved' or p.role not in ('admin','super_admin') or o.payment_status<>'paid' or o.fulfillment<>'preparing' then raise exception 'Forbidden' using errcode='42501'; end if;
  update public.shop_orders set fulfillment='shipped' where id=o.id;
 elsif p_action='delivered' then
  if (p.id<>o.buyer_id and not (p.status='approved' and p.role in ('admin','super_admin'))) or o.payment_status<>'paid' or o.fulfillment<>'shipped' then raise exception 'Forbidden' using errcode='42501'; end if;
  update public.shop_orders set fulfillment='delivered',delivered_at=now(),delivered_by=p.id where id=o.id;
 elsif p_action='record_payout' then
  -- Records a transfer already performed externally; never initiates a money transfer.
  if p.status<>'approved' or p.role<>'super_admin' or o.payment_status<>'paid' or o.fulfillment<>'delivered' or o.association_product or o.paid_out_at is not null then raise exception 'Forbidden' using errcode='42501'; end if;
  if length(trim(coalesce(p_data->>'reference',''))) not between 5 and 200 then raise exception 'Référence du reversement requise'; end if;
  update public.shop_orders set payout_reference=trim(p_data->>'reference'),paid_out_at=now(),paid_out_by=p.id where id=o.id;
 else raise exception 'Opération invalide'; end if;
 return jsonb_build_object('ok',true);
end;$$;
revoke all on function public.shop_order_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.shop_order_action(text,jsonb) to authenticated;

create function public.shop_balance() returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles; result jsonb;
begin
 select * into p from public.profiles where id=auth.uid();
 if p.id is null or p.status<>'approved' or p.role<>'membre' then raise exception 'Membre requis' using errcode='42501'; end if;
 -- A suspended vendor retains access to the ledger for reconciliation.
 if not exists(select 1 from public.shop_sellers where user_id=p.id and status in ('approved','suspended')) then raise exception 'Activation vendeur requise' using errcode='42501'; end if;
 select jsonb_build_object(
 'pending',coalesce(sum(seller_amount) filter(where payment_status='paid' and fulfillment<>'delivered' and paid_out_at is null),0),
 'available',coalesce(sum(seller_amount) filter(where payment_status='paid' and fulfillment='delivered' and paid_out_at is null),0),
 'paid_out',coalesce(sum(seller_amount) filter(where paid_out_at is not null),0),
 'sales_count',count(*) filter(where payment_status='paid'),
 'review_count',count(*) filter(where payment_status='review' or (payment_status='refunded' and paid_out_at is not null)),
 'currency','XAF') into result from public.shop_orders where seller_id=p.id and not association_product;
 return result;
end;$$;
revoke all on function public.shop_balance() from public,anon,authenticated;
grant execute on function public.shop_balance() to authenticated;

create function public.shop_notchpay(p_secret text,p_operation text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a private.shop_checkouts; o public.shop_orders; p public.profiles; fresh boolean:=false; next_status text;
begin
 perform private.require_worker(p_secret);
 if p_operation='lookup' then
  select * into a from private.shop_checkouts where (p_data ? 'id' and id=(p_data->>'id')::uuid) or (p_data ? 'reference' and provider_reference=p_data->>'reference');
  if a.id is null then return null; end if;
  return to_jsonb(a)||jsonb_build_object('kind','shop');
 end if;
 select * into o from public.shop_orders where id=coalesce(p_data->>'target',p_data->>'id')::uuid for update;
 if o.id is null then raise exception 'Commande introuvable'; end if;
 select * into a from private.shop_checkouts where id=o.id for update;
 if p_operation='prepare' then
  if o.buyer_id is distinct from (p_data->>'user_id')::uuid or o.payment_status<>'unpaid' or o.fulfillment='canceled' then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into p from public.profiles where id=o.buyer_id and status in ('pending','approved');
  if p.id is null then raise exception 'Forbidden' using errcode='42501'; end if;
  if a.id is null then
   insert into private.shop_checkouts(id,amount,sandbox) values(o.id,o.amount,(p_data->>'sandbox')::boolean) returning * into a; fresh:=true;
  end if;
  if a.sandbox is distinct from (p_data->>'sandbox')::boolean then raise exception 'Payment environment mismatch'; end if;
  return to_jsonb(a)||jsonb_build_object('new',fresh,'kind','shop','name',p.full_name,'email',p.email,'phone',o.phone);
 end if;
 if a.id is null then raise exception 'Payment missing'; end if;
 if p_operation='attach' then
  if (a.provider_reference is not null and a.provider_reference<>p_data->>'reference') or coalesce(p_data->>'reference','') !~ '^trx[._][A-Za-z0-9_-]+$' or coalesce(p_data->>'url','') !~ '^https://pay\.notchpay\.co/' then raise exception 'Invalid provider response'; end if;
  update private.shop_checkouts set provider_reference=p_data->>'reference',checkout_url=p_data->>'url',status='pending',updated_at=now() where id=a.id;
 elsif p_operation='settle' then
  if a.provider_reference is distinct from p_data->>'reference' or a.amount is distinct from (p_data->>'amount')::integer or p_data->>'currency' is distinct from 'XAF' or a.sandbox is distinct from (p_data->>'sandbox')::boolean then raise exception 'Payment verification mismatch'; end if;
  next_status:=p_data->>'status';
  if next_status is null or next_status not in ('pending','processing','incomplete','complete','canceled','failed','rejected','abandoned','expired','refunded','partialy-refunded') then raise exception 'Unknown payment status'; end if;
  -- Refunds are terminal. Repeated/stale callbacks cannot credit a sale again.
  if a.status in ('refunded','partialy-refunded') or (a.status='complete' and next_status not in ('refunded','partialy-refunded')) then
   return jsonb_build_object('kind','shop','status',a.status,'sandbox',a.sandbox);
  end if;
  update private.shop_checkouts set status=next_status,updated_at=now() where id=a.id;
  if next_status='complete' and not a.sandbox then
   if o.stock_released then
    -- Late success after a terminal failure needs staff reconciliation, not overselling.
    update public.shop_orders set payment_status='review' where id=o.id;
   else
    update public.shop_orders set payment_status='paid',fulfillment='preparing',paid_at=coalesce(paid_at,now()) where id=o.id and payment_status='unpaid';
   end if;
  elsif next_status in ('refunded','partialy-refunded') and not a.sandbox then
   update public.shop_orders set payment_status=case when next_status='refunded' then 'refunded' else 'review' end where id=o.id;
  end if;
  if (next_status in ('canceled','failed','rejected','abandoned','expired') or (a.sandbox and next_status='complete')) and o.payment_status='unpaid' and not o.stock_released then
   update public.shop_products set stock=stock+o.quantity where id=o.product_id;
   update public.shop_orders set stock_released=true,fulfillment='canceled' where id=o.id;
  end if;
 else raise exception 'Invalid operation'; end if;
 return jsonb_build_object('kind','shop','status',coalesce(next_status,a.status),'sandbox',a.sandbox);
end;$$;
revoke all on function public.shop_notchpay(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.shop_notchpay(text,text,jsonb) to anon;
commit;
