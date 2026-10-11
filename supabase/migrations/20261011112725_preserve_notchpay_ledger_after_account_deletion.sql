begin;
alter table private.notchpay_payments drop constraint notchpay_payments_check;
alter table private.notchpay_payments add constraint notchpay_payments_check check((kind='dues' and donation_id is null) or (kind='donation' and dues_id is null));
alter table private.notchpay_payments drop constraint notchpay_payments_dues_id_fkey;
alter table private.notchpay_payments add constraint notchpay_payments_dues_id_fkey foreign key(dues_id) references public.membership_payments(id) on delete set null;
alter table private.notchpay_payments drop constraint notchpay_payments_donation_id_fkey;
alter table private.notchpay_payments add constraint notchpay_payments_donation_id_fkey foreign key(donation_id) references public.donations(id) on delete set null;
-- Independent random submission keys distinguish intentional repeat donations from retries.
create table private.notchpay_donation_submissions(id uuid primary key,donation_id uuid references public.donations(id) on delete set null,payload_hash text not null,created_at timestamptz not null default now());
alter table private.notchpay_donation_submissions enable row level security;
revoke all on private.notchpay_donation_submissions from public,anon,authenticated;
create function public.submit_notchpay_donation(p_secret text,p_key uuid,p_data jsonb,p_user uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare previous private.notchpay_donation_submissions; target uuid; fingerprint text;
begin
 perform private.require_worker(p_secret);
 if p_key is null then raise exception 'Submission key required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('notch-donation:'||p_key,0));
 fingerprint:=encode(extensions.digest((p_data||jsonb_build_object('user_id',p_user))::text,'sha256'),'hex');
 select * into previous from private.notchpay_donation_submissions where id=p_key;
 if previous.id is not null then
  if previous.payload_hash<>fingerprint or previous.donation_id is null then raise exception 'Donation submission changed';end if;
  return previous.donation_id;
 end if;
 target:=public.submit_donation(p_secret,p_data,p_user);
 insert into private.notchpay_donation_submissions(id,donation_id,payload_hash) values(p_key,target,fingerprint);
 return target;
end;$$;
revoke all on function public.submit_notchpay_donation(text,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.submit_notchpay_donation(text,uuid,jsonb,uuid) to anon;
create function public.create_notchpay_dues() returns uuid language plpgsql security definer set search_path='' as $$
declare p public.profiles;s public.dues_settings; target uuid;
begin
 select * into p from public.profiles where id=auth.uid();
 if p.id is null or p.status not in ('pending','approved') or p.role not in ('membre','volontaire') then raise exception 'Account not eligible for dues' using errcode='42501';end if;
 select * into s from public.dues_settings where id=true for share;
 if s.amount is null then raise exception 'Dues amount not configured';end if;
 insert into public.membership_payments(user_id,period,amount) values(p.id,s.period,s.amount) on conflict(user_id,period) do nothing;
 select id into target from public.membership_payments where user_id=p.id and period=s.period;
 return target;
end;$$;
revoke all on function public.create_notchpay_dues() from public,anon;
grant execute on function public.create_notchpay_dues() to authenticated;
create or replace function public.notchpay_payment(p_secret text,p_operation text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a private.notchpay_payments; d public.donations; m public.membership_payments; p public.profiles; result jsonb; target uuid;
begin
 perform private.require_worker(p_secret);
 if p_operation='prepare' then
  target:=(p_data->>'target')::uuid;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('notch-target:'||target,0));
  if p_data->>'kind'='dues' then
   select * into m from public.membership_payments where id=target for update;
   select * into p from public.profiles where id=m.user_id;
   if m.id is null or m.user_id is distinct from (p_data->>'user_id')::uuid or p.status not in ('pending','approved') or p.role not in ('membre','volontaire') then raise exception 'Forbidden' using errcode='42501';end if;
   if m.status='paid' then raise exception 'Payment already confirmed';end if;
   select * into a from private.notchpay_payments where dues_id=m.id and sandbox=(p_data->>'sandbox')::boolean and status in ('creating','pending','processing','incomplete','complete');
   if a.id is null then
    insert into private.notchpay_payments(kind,dues_id,amount,sandbox) values('dues',m.id,m.amount,(p_data->>'sandbox')::boolean) returning * into a;
    result:=jsonb_build_object('new',true);
   end if;
   result:=coalesce(result,'{}'::jsonb)||jsonb_build_object('email',p.email,'name',p.full_name,'phone',p.phone);
  elsif p_data->>'kind'='donation' then
   select * into d from public.donations where id=target for update;
   if d.id is null or d.status<>'pending' then raise exception 'Donation unavailable';end if;
   select * into a from private.notchpay_payments where donation_id=d.id and sandbox=(p_data->>'sandbox')::boolean and status in ('creating','pending','processing','incomplete','complete');
   if a.id is null then
    insert into private.notchpay_payments(kind,donation_id,amount,sandbox) values('donation',d.id,d.amount,(p_data->>'sandbox')::boolean) returning * into a;
    result:=jsonb_build_object('new',true);
   end if;
   result:=coalesce(result,'{}'::jsonb)||jsonb_build_object('email',d.donor_email,'name',d.donor_name,'phone',d.donor_phone);
  else raise exception 'Invalid payment kind';end if;
  return result||to_jsonb(a);
 elsif p_operation='lookup' then
  select * into a from private.notchpay_payments where (p_data ? 'id' and id=(p_data->>'id')::uuid) or (p_data ? 'reference' and provider_reference=p_data->>'reference');
  return to_jsonb(a);
 end if;
 select * into a from private.notchpay_payments where id=(p_data->>'id')::uuid;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('notch-target:'||coalesce(a.dues_id,a.donation_id,a.id),0));
 select * into a from private.notchpay_payments where id=(p_data->>'id')::uuid for update;
 if a.id is null then raise exception 'Payment missing';end if;
 if p_operation='attach' then
  if a.provider_reference is not null and a.provider_reference<>p_data->>'reference' then raise exception 'Reference already bound';end if;
  if coalesce(p_data->>'reference','') !~ '^trx[._][A-Za-z0-9_-]+$' or coalesce(p_data->>'url','') !~ '^https://pay\.notchpay\.co/' then raise exception 'Invalid provider response';end if;
  update private.notchpay_payments set provider_reference=p_data->>'reference',checkout_url=p_data->>'url',status='pending',updated_at=now() where id=a.id;
  return jsonb_build_object('ok',true);
 elsif p_operation='settle' then
  if a.provider_reference is distinct from p_data->>'reference' or a.amount is distinct from (p_data->>'amount')::integer or p_data->>'currency' is distinct from 'XAF' or a.sandbox is distinct from (p_data->>'sandbox')::boolean then raise exception 'Payment verification mismatch';end if;
  if a.status='complete' then return jsonb_build_object('status','complete','kind',a.kind,'sandbox',a.sandbox);end if;
  if p_data->>'status' not in ('pending','processing','incomplete','complete','canceled','failed','rejected','abandoned','expired','refunded','partialy-refunded') then raise exception 'Unknown payment status';end if;
  update private.notchpay_payments set status=p_data->>'status',updated_at=now() where id=a.id;
  -- Sandbox receipts must never mark real dues/donations paid or award points.
  if p_data->>'status'='complete' and not a.sandbox then
   if a.kind='dues' then
    select * into m from public.membership_payments where id=a.dues_id for update;
    if m.id is null then raise exception 'Payment account removed';end if;
    if m.amount<>a.amount then raise exception 'Dues amount changed';end if;
    if m.status<>'paid' then
     update public.membership_payments set status='paid',method='online',reference=a.provider_reference,reviewed_by=null,reviewed_at=now(),paid_at=now(),admin_comment='Paiement confirmé auprès de Notch Pay' where id=m.id;
     perform private.queue_email(m.user_id,'dues_confirmed',jsonb_build_object('amount',m.amount,'period',m.period,'reference',a.provider_reference),'dues-paid:'||m.id);
    end if;
   else
    select * into d from public.donations where id=a.donation_id for update;
    if d.id is null then raise exception 'Donation removed';end if;
    if d.amount<>a.amount or d.currency<>'XAF' then raise exception 'Donation amount changed';end if;
    if d.status='pending' then update public.donations set status='completed',payment_provider='notchpay',payment_reference=a.provider_reference,provider_transaction_id=a.provider_reference,paid_at=now() where id=d.id;end if;
   end if;
  end if;
  return jsonb_build_object('status',p_data->>'status','kind',a.kind,'sandbox',a.sandbox);
 end if;
 raise exception 'Invalid operation';
end;$$;
commit;
