begin;
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
 requested:=coalesce(requested,p.role);
 mat:=coalesce(p.matricule,public.generate_matricule(requested));
 insert into public.points_history(user_id,points,reason,awarded_by) values(p_user_id,50,'membership_approved',auth.uid()) on conflict do nothing;
 get diagnostics delta=row_count;
 update public.profiles set status='approved',role=requested,matricule=mat,points=points+50*delta where id=p_user_id;
 perform private.queue_email(p_user_id,'membership_approved',jsonb_build_object('matricule',mat,'points',50),'legacy-approved:'||p_user_id);
end;$$;
create or replace function private.admin_set_member_state(target_user_id uuid,new_membership_status text,new_payment_status text) returns public.members
language plpgsql security definer set search_path='' as $$
declare result public.members; p public.profiles;
begin
 perform private.require_admin(auth.uid());
 if new_membership_status not in ('pending','active','rejected','suspended') or new_payment_status not in ('unpaid','pending','paid','failed','refunded') then raise exception 'Invalid status';end if;
 if new_membership_status='active' then
   perform public.approve_existing_member(target_user_id);
   update public.members set payment_status=new_payment_status,paid_at=case when new_payment_status='paid' then coalesce(paid_at,now()) else null end where user_id=target_user_id returning * into result;
   return result;
 end if;
 perform 1 from public.membership_requests where user_id=target_user_id for update;
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
create or replace function public.reject_existing_member(p_user_id uuid,p_comment text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin(auth.uid());
 if length(trim(coalesce(p_comment,'')))<3 then raise exception 'Comment required';end if;
 perform 1 from public.membership_requests where user_id=p_user_id for update;
 perform 1 from public.profiles where id=p_user_id for update;
 if not exists(select 1 from public.profiles where id=p_user_id and role in ('membre','benevole','volontaire') and status='pending') then raise exception 'Ineligible account' using errcode='42501';end if;
 update public.profiles set status='rejected' where id=p_user_id;
 update public.membership_requests set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),admin_comment=p_comment where user_id=p_user_id and status='pending';
 perform private.queue_email(p_user_id,'membership_rejected',jsonb_build_object('comment',p_comment),'legacy-rejected:'||p_user_id);
end;$$;
commit;
