begin;
alter table public.points_history add column membership_payment_id uuid references public.membership_payments(id) on delete set null;
create unique index dues_points_once on public.points_history(membership_payment_id) where membership_payment_id is not null;
create or replace function private.award_dues_points() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient public.profiles; awarded integer;
begin
 if new.status<>'paid' then return new;end if;
 select * into recipient from public.profiles where id=new.user_id for update;
 if recipient.role not in ('membre','benevole','volontaire') then return new;end if;
 insert into public.points_history(user_id,points,reason,awarded_by,membership_payment_id) values(new.user_id,200,'dues_confirmed',new.reviewed_by,new.id) on conflict do nothing;
 get diagnostics awarded=row_count;
 if awarded=1 then update public.profiles set points=points+200 where id=new.user_id;end if;
 return new;
end;$$;
revoke all on function private.award_dues_points() from public,anon,authenticated;
create trigger confirmed_dues_points after insert or update of status on public.membership_payments for each row when(new.status='paid') execute function private.award_dues_points();
with awarded as (
 insert into public.points_history(user_id,points,reason,awarded_by,membership_payment_id)
 select d.user_id,200,'dues_confirmed',d.reviewed_by,d.id from public.membership_payments d join public.profiles p on p.id=d.user_id where d.status='paid' and p.role in ('membre','benevole','volontaire') on conflict do nothing returning user_id
), totals as (select user_id,count(*)*200 as points from awarded group by user_id)
update public.profiles p set points=p.points+totals.points from totals where p.id=totals.user_id;
create or replace function private.exclude_super_admin_points() returns trigger language plpgsql set search_path='' as $$begin if new.role='super_admin' then new.points=0;end if;return new;end;$$;
revoke all on function private.exclude_super_admin_points() from public,anon,authenticated;
create trigger super_admin_no_points before insert or update of role,points on public.profiles for each row execute function private.exclude_super_admin_points();
update public.profiles set points=0 where role='super_admin' and points<>0;
commit;
