begin;
-- One atomic, repeatable approval; an existing points entry is never awarded twice.
create or replace function public.approve_membership(p_request_id uuid,p_reviewer_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.membership_requests; p public.profiles; delta integer:=0; mat text;
begin
 perform private.require_admin(p_reviewer_id);
 select * into r from public.membership_requests where id=p_request_id for update;
 if r.id is null or r.status not in ('pending','approved') then raise exception 'Request missing or rejected';end if;
 if r.requested_role not in ('membre','benevole','volontaire') then raise exception 'Invalid requested role' using errcode='42501';end if;
 select * into p from public.profiles where id=r.user_id for update;
 if p.id is null or p.role in ('admin','super_admin') or p.status='suspended' then raise exception 'Ineligible account' using errcode='42501';end if;
 if r.status='approved' and p.status='approved' then return;end if;
 mat:=coalesce(p.matricule,public.generate_matricule(r.requested_role));
 insert into public.points_history(user_id,points,reason,awarded_by) values(r.user_id,50,'membership_approved',p_reviewer_id) on conflict do nothing;
 get diagnostics delta=row_count;
 update public.profiles set status='approved',role=r.requested_role,matricule=mat,points=points+50*delta where id=r.user_id;
 update public.membership_requests set status='approved',reviewed_by=p_reviewer_id,reviewed_at=coalesce(reviewed_at,now()) where id=r.id;
 perform private.queue_email(r.user_id,'membership_approved',jsonb_build_object('matricule',mat,'points',50),'approved:'||r.id);
end;$$;
-- Historical accounts do not have a membership_requests row. Keep them reviewable.
create or replace function public.approve_existing_member(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare p public.profiles; r uuid; requested text; delta integer:=0; mat text;
begin
 perform private.require_admin(auth.uid());
 select id into r from public.membership_requests where user_id=p_user_id and status in ('pending','approved') order by created_at desc limit 1;
 if r is not null then perform public.approve_membership(r,auth.uid());return;end if;
 select * into p from public.profiles where id=p_user_id for update;
 if p.id is null or p.role in ('admin','super_admin') or p.status in ('suspended','rejected') then raise exception 'Ineligible account' using errcode='42501';end if;
 if p.status='approved' then return;end if;
 select case when membership_type='benevole' then 'benevole' when role='volontaire' then 'volontaire' else 'membre' end into requested from public.members where user_id=p_user_id;
 requested:=coalesce(requested,'membre');
 mat:=coalesce(p.matricule,public.generate_matricule(requested));
 insert into public.points_history(user_id,points,reason,awarded_by) values(p_user_id,50,'membership_approved',auth.uid()) on conflict do nothing;
 get diagnostics delta=row_count;
 update public.profiles set status='approved',role=requested,matricule=mat,points=points+50*delta where id=p_user_id;
 perform private.queue_email(p_user_id,'membership_approved',jsonb_build_object('matricule',mat,'points',50),'legacy-approved:'||p_user_id);
end;$$;
revoke all on function public.approve_existing_member(uuid) from public,anon;
grant execute on function public.approve_existing_member(uuid) to authenticated;
-- Legacy screens must update the authoritative profile, not only members.
create or replace function private.admin_set_member_state(target_user_id uuid,new_membership_status text,new_payment_status text) returns public.members
language plpgsql security definer set search_path='' as $$
declare result public.members; p public.profiles;
begin
 perform private.require_admin(auth.uid());
 if new_membership_status not in ('pending','active','rejected','suspended') or new_payment_status not in ('unpaid','pending','paid','failed','refunded') then raise exception 'Invalid status';end if;
 select * into p from public.profiles where id=target_user_id for update;
 if p.id is null then raise exception 'Account missing';end if;
 if p.role in ('admin','super_admin') then raise exception 'Use protected role management' using errcode='42501';end if;
 if new_membership_status='active' then perform public.approve_existing_member(target_user_id);
 elsif new_membership_status in ('rejected','suspended') then
   update public.profiles set status=case when new_membership_status='rejected' then 'rejected' else 'suspended' end where id=target_user_id;
   update public.membership_requests set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),admin_comment='Décision administrative depuis la gestion historique' where user_id=target_user_id and status='pending' and new_membership_status='rejected';
 elsif p.status<>'pending' then raise exception 'Cannot undo approval through legacy status';end if;
 update public.members set payment_status=new_payment_status,paid_at=case when new_payment_status='paid' then coalesce(paid_at,now()) else null end where user_id=target_user_id returning * into result;
 return result;
end;$$;
create or replace function private.mirror_profile_membership() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.members set membership_status=case new.status when 'approved' then 'active' else new.status end,
 role=case new.role when 'membre' then 'member' else new.role end,
 member_number=coalesce(member_number,new.matricule),
 validated_at=case when new.status='approved' then coalesce(validated_at,now()) else validated_at end
 where user_id=new.id;
 return new;
end;$$;
revoke all on function private.mirror_profile_membership() from public,anon,authenticated;
create trigger profile_membership_mirror after update of status,role,matricule on public.profiles for each row
when(old.status is distinct from new.status or old.role is distinct from new.role or old.matricule is distinct from new.matricule)
execute function private.mirror_profile_membership();
-- Reconcile already validated historical accounts. Never grant an administrative role.
do $$ declare item record; mat text; delta integer; begin
 for item in select p.id,p.matricule,m.membership_type,m.role from public.profiles p join public.members m on m.user_id=p.id where p.status='pending' and p.role in ('membre','benevole','volontaire') and m.membership_status='active' and m.validated_at is not null loop
   mat:=item.matricule;
   if mat is null then mat:='ARDT-'||case when item.membership_type='benevole' then 'B' when item.role='volontaire' then 'V' else 'M' end||'-'||lpad(nextval('private.matricule_seq')::text,5,'0');end if;
   insert into public.points_history(user_id,points,reason) values(item.id,50,'membership_approved') on conflict do nothing;
   get diagnostics delta=row_count;
   update public.profiles set status='approved',role=case when item.membership_type='benevole' then 'benevole' when item.role='volontaire' then 'volontaire' else 'membre' end,matricule=mat,points=points+delta*50 where id=item.id;
 end loop;
end;$$;
-- Private profile photographs: signed reads, no anonymous exposure.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-photos','profile-photos',false,1048576,array['image/webp']),
('dues-receipts','dues-receipts',false,5242880,array['image/webp','image/jpeg','image/png','application/pdf']) on conflict(id) do nothing;
create policy profile_photo_upload on storage.objects for insert to authenticated with check(bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.profiles where id=auth.uid() and status in ('pending','approved')));
create policy profile_photo_read on storage.objects for select to authenticated using(bucket_id='profile-photos' and ((storage.foldername(name))[1]=auth.uid()::text or private.approved_actor()));
create policy dues_receipt_upload on storage.objects for insert to authenticated with check(bucket_id='dues-receipts' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.profiles where id=auth.uid() and status in ('pending','approved')));
create policy dues_receipt_read on storage.objects for select to authenticated using(bucket_id='dues-receipts' and ((storage.foldername(name))[1]=auth.uid()::text or private.is_admin()));
create or replace function private.validate_profile_photo() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.avatar_url is not null and (new.avatar_url !~ ('^'||new.id::text||'/[0-9a-f-]{36}\.webp$') or not exists(select 1 from storage.objects where bucket_id='profile-photos' and name=new.avatar_url)) then raise exception 'Invalid profile photo' using errcode='42501';end if;
 return new;
end;$$;
revoke all on function private.validate_profile_photo() from public,anon,authenticated;
create trigger validate_profile_photo before insert or update of avatar_url on public.profiles for each row execute function private.validate_profile_photo();
-- Dues are separate from donations. Only the Super Admin sets the fee.
create table public.dues_settings(id boolean primary key default true check(id),amount integer check(amount between 100 and 100000000),period text not null default extract(year from now())::text check(length(period) between 1 and 64),instructions_fr text not null default '',instructions_en text not null default '',checkout_url text check(checkout_url is null or checkout_url ~ '^https://[^[:space:]]+$'),updated_at timestamptz not null default now());
insert into public.dues_settings(id) values(true);
alter table public.dues_settings enable row level security;
grant select on public.dues_settings to authenticated;
grant update(amount,period,instructions_fr,instructions_en,checkout_url,updated_at) on public.dues_settings to authenticated;
create policy dues_settings_read on public.dues_settings for select to authenticated using(true);
create policy dues_settings_super on public.dues_settings for update to authenticated using(private.is_super_admin()) with check(private.is_super_admin());
create table public.membership_payments(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,period text not null,amount integer not null check(amount between 100 and 100000000),currency text not null default 'XAF' check(currency='XAF'),status text not null default 'pending' check(status in ('pending','submitted','paid','rejected')),method text check(method in ('mobile_money','bank_transfer','cash','online')),reference text,receipt_path text,admin_comment text,reviewed_by uuid references public.profiles(id) on delete set null,reviewed_at timestamptz,paid_at timestamptz,created_at timestamptz not null default now(),unique(user_id,period));
alter table public.membership_payments enable row level security;
grant select on public.membership_payments to authenticated;
create policy dues_payments_read on public.membership_payments for select to authenticated using(user_id=auth.uid() or private.is_admin());
create index dues_payments_status on public.membership_payments(status,created_at desc);
create or replace function public.create_dues_payment() returns uuid language plpgsql security definer set search_path='' as $$
declare p public.profiles;s public.dues_settings; payment_id uuid;
begin
 select * into p from public.profiles where id=auth.uid();
 if p.id is null or p.status not in ('pending','approved') or p.role not in ('membre','volontaire') then raise exception 'Account not eligible for dues' using errcode='42501';end if;
 select * into s from public.dues_settings where id=true for share;
 if s.amount is null or length(trim(s.instructions_fr))<10 then raise exception 'Dues payment instructions not configured';end if;
 insert into public.membership_payments(user_id,period,amount) values(p.id,s.period,s.amount) on conflict(user_id,period) do nothing;
 select id into payment_id from public.membership_payments where user_id=p.id and period=s.period;
 return payment_id;
end;$$;
create or replace function public.submit_dues_payment(p_id uuid,p_method text,p_reference text,p_receipt_path text default null) returns void language plpgsql security definer set search_path='' as $$
declare p public.membership_payments;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and status in ('pending','approved')) then raise exception 'Account not eligible' using errcode='42501';end if;
 select * into p from public.membership_payments where id=p_id for update;
 if p.id is null or p.user_id<>auth.uid() then raise exception 'Forbidden' using errcode='42501';end if;
 if p.status='paid' then raise exception 'Payment already confirmed';end if;
 if p_method not in ('mobile_money','bank_transfer','cash','online') or length(trim(coalesce(p_reference,''))) not between 3 and 200 then raise exception 'Invalid payment reference';end if;
 if p_receipt_path is not null and (split_part(p_receipt_path,'/',1)<>auth.uid()::text or p_receipt_path ~ '\.\.' or not exists(select 1 from storage.objects where bucket_id='dues-receipts' and name=p_receipt_path)) then raise exception 'Invalid receipt' using errcode='42501';end if;
 update public.membership_payments set method=p_method,reference=trim(p_reference),receipt_path=p_receipt_path,status='submitted',admin_comment=null,reviewed_by=null,reviewed_at=null where id=p_id;
end;$$;
create or replace function public.review_dues_payment(p_id uuid,p_approved boolean,p_comment text default null) returns void language plpgsql security definer set search_path='' as $$
declare p public.membership_payments;
begin
 perform private.require_admin(auth.uid());
 select * into p from public.membership_payments where id=p_id for update;
 if p.id is null then raise exception 'Payment missing';end if;
 if p.status='paid' and p_approved then return;end if;
 if p.status<>'submitted' then raise exception 'Payment must be submitted first';end if;
 if not p_approved and length(trim(coalesce(p_comment,'')))<3 then raise exception 'Rejection comment required';end if;
 update public.membership_payments set status=case when p_approved then 'paid' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=now(),paid_at=case when p_approved then now() else null end,admin_comment=p_comment where id=p_id;
 if p_approved then perform private.queue_email(p.user_id,'dues_confirmed',jsonb_build_object('amount',p.amount,'period',p.period,'reference',p.reference),'dues-paid:'||p.id);end if;
end;$$;
revoke all on function public.create_dues_payment(),public.submit_dues_payment(uuid,text,text,text),public.review_dues_payment(uuid,boolean,text) from public,anon;
grant execute on function public.create_dues_payment(),public.submit_dues_payment(uuid,text,text,text),public.review_dues_payment(uuid,boolean,text) to authenticated;
create or replace function public.reject_existing_member(p_user_id uuid,p_comment text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin(auth.uid());
 if length(trim(coalesce(p_comment,'')))<3 then raise exception 'Comment required';end if;
 if not exists(select 1 from public.profiles where id=p_user_id and role in ('membre','benevole','volontaire') and status='pending') then raise exception 'Ineligible account' using errcode='42501';end if;
 update public.profiles set status='rejected' where id=p_user_id;
 update public.membership_requests set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),admin_comment=p_comment where user_id=p_user_id and status='pending';
 perform private.queue_email(p_user_id,'membership_rejected',jsonb_build_object('comment',p_comment),'legacy-rejected:'||p_user_id);
end;$$;
revoke all on function public.reject_existing_member(uuid,text) from public,anon;
grant execute on function public.reject_existing_member(uuid,text) to authenticated;
commit;
