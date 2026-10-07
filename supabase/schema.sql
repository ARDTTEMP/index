begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create sequence if not exists private.matricule_seq start 2 maxvalue 99999;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null, full_name text not null, phone text, city text, region text,
 role text not null default 'membre' check(role in ('super_admin','admin','membre','benevole','volontaire')),
 matricule text unique check(matricule ~ '^ARDT-[MBVAS]-[0-9]{5}$'), points integer not null default 0 check(points>=0),
 status text not null default 'pending' check(status in ('pending','approved','rejected','suspended')),
 avatar_url text,bio text,locale text not null default 'fr' check(locale in ('fr','en')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(region is null or region in ('Adamaoua','Centre','Est','Extrême-Nord','Littoral','Nord','Nord-Ouest','Ouest','Sud','Sud-Ouest'))
);
create table public.membership_requests (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles(id) on delete cascade,
 requested_role text not null check(requested_role in ('membre','benevole','volontaire')),
 motivation text not null check(length(motivation) between 10 and 5000),city text not null,region text not null,phone text not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_by uuid references profiles(id) on delete set null,reviewed_at timestamptz,admin_comment text,created_at timestamptz not null default now(),
 check(region in ('Adamaoua','Centre','Est','Extrême-Nord','Littoral','Nord','Nord-Ouest','Ouest','Sud','Sud-Ouest'))
);
create unique index one_pending_membership on membership_requests(user_id) where status='pending';
create table public.reports (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles(id) on delete cascade,
 title text not null check(length(title) between 3 and 200),description text not null check(length(description) between 10 and 10000),
 activity_date date not null,location text,photo_urls text[] not null default '{}',
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 points_awarded integer check(points_awarded in (5,10,15,20)), reviewed_by uuid references profiles(id) on delete set null,
 reviewed_at timestamptz,admin_comment text,created_at timestamptz not null default now(),check(cardinality(photo_urls)<=6)
);
create table public.news (
 id uuid primary key default gen_random_uuid(),title_fr text not null,title_en text not null,content_fr text not null,content_en text not null,
 cover_image text,published boolean not null default false,author_id uuid not null references profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.gallery_media (
 id uuid primary key default gen_random_uuid(),media_type text not null check(media_type in ('image','video')),
 title_fr text not null check(length(trim(title_fr)) between 2 and 200),title_en text not null check(length(trim(title_en)) between 2 and 200),
 description_fr text not null default '' check(length(description_fr)<=2000),description_en text not null default '' check(length(description_en)<=2000),
 object_path text not null unique,poster_path text,published boolean not null default true,
 created_by uuid not null references profiles(id) on delete restrict,created_at timestamptz not null default now(),
 check(object_path !~ '^/' and position('..' in object_path)=0 and (poster_path is null or (poster_path !~ '^/' and position('..' in poster_path)=0)))
);
-- Additive migration: existing donations and their identifiers remain intact.
alter table public.donations add column user_id uuid references profiles(id) on delete set null;
alter table public.donations add column is_monthly boolean not null default false;
alter table public.donations add column payment_method text check(payment_method in ('smobilpay','mobile_money','bank_transfer','cash','other'));
alter table public.donations add column payment_reference text;
alter table public.donations add column locale text not null default 'fr';
alter table public.donations drop constraint donations_status_check;
update public.donations set status='completed' where status='paid';
alter table public.donations add constraint donations_status_check check(status in ('pending','completed','failed','refunded','cancelled'));
update public.donations set donor_name=coalesce(donor_name,'Donateur anonyme');
alter table public.donations alter column donor_name set not null;
create unique index donations_payment_reference_key on donations(payment_reference) where payment_reference is not null;
create table public.groups (
 id uuid primary key default gen_random_uuid(),name text not null,description text,category text not null,
 filter_role text check(filter_role in ('membre','benevole','volontaire','all')),filter_city text,filter_region text,
 created_by uuid not null references profiles(id),invite_token text unique not null default encode(gen_random_bytes(16),'hex'),created_at timestamptz not null default now()
);
create table public.group_members (
 id uuid primary key default gen_random_uuid(),group_id uuid not null references groups(id) on delete cascade,
 user_id uuid not null references profiles(id) on delete cascade,joined_at timestamptz not null default now(),unique(group_id,user_id)
);
create table public.group_messages (
 id uuid primary key default gen_random_uuid(),group_id uuid not null references groups(id) on delete cascade,
 user_id uuid not null references profiles(id) on delete cascade,content text not null check(length(content) between 1 and 5000),attachment_url text,
 created_at timestamptz not null default now()
);
create table public.points_history (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles(id) on delete cascade,points integer not null,
 reason text not null,report_id uuid references reports(id) on delete set null,awarded_by uuid references profiles(id) on delete set null,created_at timestamptz not null default now()
);
create unique index report_points_once on points_history(report_id) where report_id is not null;
create unique index membership_points_once on points_history(user_id) where reason='membership_approved';
create table public.rewards (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles(id) on delete cascade,
 reward_type text not null check(reward_type in ('formation','voyage_ambassadeur','promotion')),
 status text not null default 'requested' check(status in ('requested','approved','fulfilled','rejected')),
 milestone integer not null default 1 check(milestone>0),threshold integer not null check(threshold in (1200,2500)),notes text,
 reviewed_by uuid references profiles(id) on delete set null,created_at timestamptz not null default now(),reviewed_at timestamptz
);
create unique index reward_once_per_milestone on rewards(user_id,milestone) where status <> 'rejected';
create table private.email_outbox (
 id uuid primary key default gen_random_uuid(),dedupe_key text unique not null,recipient text not null,event text not null,payload jsonb not null,
 locale text not null default 'fr',status text not null default 'pending',attempts integer not null default 0,available_at timestamptz not null default now(),
 last_error text,created_at timestamptz not null default now()
);
create table private.worker_config (id boolean primary key default true check(id),secret_hash text not null);
create table private.rate_limits (key text primary key,window_start timestamptz not null default now(),hits integer not null default 1);
create table private.reward_notifications(user_id uuid references profiles(id) on delete cascade,milestone integer,primary key(user_id,milestone));
create table private.super_admin_bootstrap_emails (
 email text primary key check(email=lower(email)),
 claimed_user uuid unique references auth.users(id) on delete set null,
 claimed_at timestamptz
);
insert into private.super_admin_bootstrap_emails(email) values('cyrille.kamto@ardttemp.org');
alter table private.email_outbox enable row level security;
alter table private.worker_config enable row level security;
alter table private.rate_limits enable row level security;
alter table private.reward_notifications enable row level security;
revoke all on private.super_admin_bootstrap_emails from public,anon,authenticated;
alter table private.super_admin_bootstrap_emails enable row level security;
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and status='approved' and role in ('admin','super_admin'));
$$;
create or replace function private.is_super_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and status='approved' and role='super_admin');
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$select private.is_admin()$$;
create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path='' as $$select private.is_super_admin()$$;
create or replace function private.approved_actor() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and status='approved');
$$;
create or replace function private.in_group(p_group uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.approved_actor() and exists(select 1 from public.group_members where group_id=p_group and user_id=auth.uid());
$$;
create or replace function private.require_admin(p_reviewer uuid) returns void language plpgsql security definer set search_path='' as $$
 begin if auth.uid() is null or auth.uid()<>p_reviewer or not private.is_admin() then raise exception 'Forbidden' using errcode='42501'; end if; end;
$$;
create or replace function private.queue_email(p_user uuid,p_event text,p_payload jsonb,p_key text) returns void language sql security definer set search_path='' as $$
 insert into private.email_outbox(dedupe_key,recipient,event,payload,locale)
 select p_key,email,p_event,p_payload,locale from public.profiles where id=p_user on conflict(dedupe_key) do nothing;
$$;
create or replace function private.reward_threshold(p_role text) returns integer language sql immutable set search_path='' as $$
 select case when p_role='membre' then 1200 when p_role in ('benevole','volontaire') then 2500 else null end;
$$;
create or replace function private.check_reward(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
 declare p public.profiles;t integer;n integer;a record;
 begin select * into p from public.profiles where id=p_user;t:=private.reward_threshold(p.role);
 if t is null or p.status<>'approved' or p.points<t then return;end if;
 n:=p.points/t;
 insert into private.reward_notifications values(p_user,n) on conflict do nothing;
 if found then
 perform private.queue_email(p_user,'reward_available',jsonb_build_object('points',p.points,'threshold',t,'milestone',n),'threshold:'||p_user||':'||n);
 for a in select id from public.profiles where role in ('admin','super_admin') and status='approved' loop
 perform private.queue_email(a.id,'admin_reward_available',jsonb_build_object('name',p.full_name,'threshold',t),'admin-threshold:'||p_user||':'||n||':'||a.id);
 end loop;end if;end;
$$;
create or replace function public.generate_matricule(p_role text) returns text language plpgsql security definer set search_path='' as $$
 declare letter text;
 begin if not private.is_admin() then raise exception 'Forbidden' using errcode='42501';end if;
 letter:=case p_role when 'membre' then 'M' when 'benevole' then 'B' when 'volontaire' then 'V' when 'admin' then 'A' when 'super_admin' then 'S' end;
 if letter is null then raise exception 'Invalid role';end if;
 return 'ARDT-'||letter||'-'||lpad(nextval('private.matricule_seq')::text,5,'0');end;
$$;
-- Registration metadata supplies content, never authorization.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
 declare m jsonb:=new.raw_user_meta_data;r text;
 begin
 insert into public.profiles(id,email,full_name,phone,city,region,locale,role,status)
 values(new.id,lower(new.email),coalesce(nullif(m->>'full_name',''),split_part(new.email,'@',1)),m->>'phone',m->>'city',nullif(m->>'region',''),case when m->>'locale'='en' then 'en' else 'fr' end,'membre','pending');
 if exists(select 1 from private.super_admin_bootstrap_emails where email=lower(new.email) and claimed_user is null) then return new;end if;
 -- Auth Admin invitations are server-created identities. The API later calls
 -- create_admin_account(), which verifies the Super Admin again in SQL.
 if new.invited_at is not null then return new;end if;
 r:=m->>'requested_role';
 if r is null or r not in ('membre','benevole','volontaire') then
  raise exception 'Invalid requested_role' using errcode='22023';
 end if;
 insert into public.membership_requests(user_id,requested_role,motivation,city,region,phone)
 values(new.id,r,m->>'motivation',m->>'city',m->>'region',m->>'phone');
 perform private.queue_email(new.id,'registration_received','{}','registration:'||new.id);
 return new;end;
$$;
-- Preserve the historical member trigger; this new trigger owns the new platform profile.
create trigger ardttemp_auth_profile after insert on auth.users for each row execute function public.handle_new_user();
create or replace function private.claim_second_super_admin() returns trigger language plpgsql security definer set search_path='' as $$
 declare reserved_email text;active_super_admins integer;
 begin
 if new.email_confirmed_at is null or old.email_confirmed_at is not null then return new;end if;
 select email into reserved_email from private.super_admin_bootstrap_emails where email=lower(new.email) and claimed_user is null for update;
 if reserved_email is null then return new;end if;
 select count(*) into active_super_admins from public.profiles where role='super_admin' and status='approved';
 if active_super_admins<>1 or not exists(select 1 from public.profiles where lower(email)='projets@ardttemp.org' and role='super_admin' and status='approved') then return new;end if;
 update public.profiles set role='super_admin',status='approved',matricule='ARDT-S-'||lpad(nextval('private.matricule_seq')::text,5,'0'),points=0,updated_at=now()
 where id=new.id and status='pending' and matricule is null;
 if not found then return new;end if;
 update private.super_admin_bootstrap_emails set claimed_user=new.id,claimed_at=now() where email=reserved_email and claimed_user is null;
 return new;end;
$$;
create trigger claim_second_super_admin_email after update of email_confirmed_at on auth.users for each row
 when(old.email_confirmed_at is distinct from new.email_confirmed_at) execute function private.claim_second_super_admin();
do $$declare second_user uuid;begin
 select id into second_user from auth.users where lower(email)='cyrille.kamto@ardttemp.org' and email_confirmed_at is not null;
 if second_user is not null
 and (select count(*) from public.profiles where role='super_admin' and status='approved')=1
 and exists(select 1 from public.profiles where lower(email)='projets@ardttemp.org' and role='super_admin' and status='approved') then
  update public.profiles set role='super_admin',status='approved',matricule=coalesce(matricule,'ARDT-S-'||lpad(nextval('private.matricule_seq')::text,5,'0')),points=0,updated_at=now() where id=second_user;
  update private.super_admin_bootstrap_emails set claimed_user=second_user,claimed_at=now() where email='cyrille.kamto@ardttemp.org' and claimed_user is null;
 end if;
end$$;
insert into public.profiles(id,email,full_name,phone,region,locale)
 select u.id,u.email,concat_ws(' ',m.first_name,m.last_name),m.phone,m.region,coalesce(m.preferred_language,'fr') from auth.users u left join public.members m on m.user_id=u.id;
create or replace function public.approve_membership(p_request_id uuid,p_reviewer_id uuid) returns void language plpgsql security definer set search_path='' as $$
 declare r public.membership_requests;p public.profiles;mat text;
 begin perform private.require_admin(p_reviewer_id);
 select * into r from public.membership_requests where id=p_request_id for update;
 if r.id is null or r.status<>'pending' then raise exception 'Request already reviewed or missing';end if;
 select * into p from public.profiles where id=r.user_id for update;
 if p.role in ('admin','super_admin') or p.status='approved' then raise exception 'Ineligible request';end if;
 mat:=coalesce(p.matricule,public.generate_matricule(r.requested_role));
 update public.profiles set status='approved',role=r.requested_role,matricule=mat,points=points+50 where id=r.user_id;
 update public.membership_requests set status='approved',reviewed_by=p_reviewer_id,reviewed_at=now() where id=r.id;
 insert into public.points_history(user_id,points,reason,awarded_by) values(r.user_id,50,'membership_approved',p_reviewer_id);
 perform private.queue_email(r.user_id,'membership_approved',jsonb_build_object('matricule',mat,'points',50),'approved:'||r.id);end;
$$;
create or replace function public.reject_membership(p_request_id uuid,p_reviewer_id uuid,p_comment text) returns void language plpgsql security definer set search_path='' as $$
 declare r public.membership_requests;
 begin perform private.require_admin(p_reviewer_id);if length(trim(coalesce(p_comment,'')))<3 then raise exception 'Comment required';end if;
 select * into r from public.membership_requests where id=p_request_id for update;
 if r.id is null or r.status<>'pending' then raise exception 'Request already reviewed or missing';end if;
 update public.membership_requests set status='rejected',admin_comment=p_comment,reviewed_by=p_reviewer_id,reviewed_at=now() where id=r.id;
 update public.profiles set status='rejected' where id=r.user_id and role not in ('admin','super_admin');
 perform private.queue_email(r.user_id,'membership_rejected',jsonb_build_object('comment',p_comment),'rejected:'||r.id);end;
$$;
create or replace function public.validate_report(p_report_id uuid,p_reviewer_id uuid,p_points integer,p_comment text default '') returns void language plpgsql security definer set search_path='' as $$
 declare r public.reports;p public.profiles;
 begin perform private.require_admin(p_reviewer_id);
 if p_points is null or p_points not in (5,10,15,20) then raise exception 'Points must be 5, 10, 15 or 20';end if;
 select * into r from public.reports where id=p_report_id for update;
 if r.id is null or r.status<>'pending' then raise exception 'Report already reviewed or missing';end if;
 select * into p from public.profiles where id=r.user_id for update;
 if p.status<>'approved' or p.role not in ('membre','benevole','volontaire') then raise exception 'Inactive report author';end if;
 update public.reports set status='approved',points_awarded=p_points,admin_comment=p_comment,reviewed_by=p_reviewer_id,reviewed_at=now() where id=r.id;
 update public.profiles set points=points+p_points where id=r.user_id;
 insert into public.points_history(user_id,points,reason,report_id,awarded_by) values(r.user_id,p_points,'report_approved',r.id,p_reviewer_id);
 perform private.queue_email(r.user_id,'report_approved',jsonb_build_object('title',r.title,'points',p_points),'report-approved:'||r.id);
 perform private.check_reward(r.user_id);end;
$$;
create or replace function public.reject_report(p_report_id uuid,p_reviewer_id uuid,p_comment text) returns void language plpgsql security definer set search_path='' as $$
 declare r public.reports;
 begin perform private.require_admin(p_reviewer_id);if length(trim(coalesce(p_comment,'')))<3 then raise exception 'Comment required';end if;
 select * into r from public.reports where id=p_report_id for update;
 if r.id is null or r.status<>'pending' then raise exception 'Report already reviewed or missing';end if;
 update public.reports set status='rejected',admin_comment=p_comment,reviewed_by=p_reviewer_id,reviewed_at=now() where id=r.id;
 perform private.queue_email(r.user_id,'report_rejected',jsonb_build_object('title',r.title,'comment',p_comment),'report-rejected:'||r.id);end;
$$;
create or replace function public.manage_member(p_user_id uuid,p_role text,p_status text) returns void language plpgsql security definer set search_path='' as $$
 declare p public.profiles;active_super_admins integer;
 begin perform private.require_admin(auth.uid());select * into p from public.profiles where id=p_user_id for update;
 if p.id is null then raise exception 'Missing account';end if;
 if p_user_id=auth.uid() then raise exception 'Cannot change own privileges' using errcode='42501';end if;
 if p_role not in ('admin','membre','benevole','volontaire') or p_status not in ('approved','suspended','rejected','pending') then raise exception 'Invalid values';end if;
 if not private.is_super_admin() and (p_role='admin' or p.role in ('admin','super_admin')) then raise exception 'Super Admin required' using errcode='42501';end if;
 if p.role='super_admin' and (p_role<>'super_admin' or p_status<>'approved') then
  select count(*) into active_super_admins from public.profiles where role='super_admin' and status='approved';
  if active_super_admins<=1 then raise exception 'At least one Super Admin must remain approved' using errcode='42501';end if;
 end if;
 if p_role='admin' and p.role<>'admin' and (p.status<>'approved' or p_status<>'approved' or p.role not in ('membre','benevole','volontaire')) then raise exception 'Only an approved member can be promoted to Admin';end if;
 if p_status='approved' and p.matricule is null then raise exception 'Approve membership request first';end if;
 update public.profiles set role=p_role,status=p_status where id=p_user_id;
 perform private.check_reward(p_user_id);end;
$$;
create or replace function public.create_admin_account(p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
 declare p public.profiles;
 begin
 perform private.require_admin(auth.uid());
 if not private.is_super_admin() then raise exception 'Super Admin required' using errcode='42501';end if;
 if p_user_id=auth.uid() then raise exception 'Cannot create an Admin account for yourself' using errcode='42501';end if;
 select * into p from public.profiles where id=p_user_id for update;
 if p.id is null then raise exception 'Auth account profile not found';end if;
 if exists(select 1 from private.super_admin_bootstrap_emails where email=lower(p.email)) then raise exception 'Reserved Super Admin identity';end if;
 if p.status<>'pending' or p.matricule is not null or p.role not in ('membre','benevole','volontaire') then raise exception 'Admin creation requires a new pending account';end if;
 update public.profiles set role='admin',status='approved',matricule='ARDT-A-'||lpad(nextval('private.matricule_seq')::text,5,'0'),points=0,updated_at=now() where id=p_user_id;
 end;
$$;
create or replace function public.delete_account(p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
 begin if not private.is_super_admin() or p_user_id=auth.uid() then raise exception 'Forbidden' using errcode='42501';end if;
 if exists(select 1 from public.profiles where id=p_user_id and role='super_admin') and (select count(*) from public.profiles where role='super_admin' and status='approved')<2 then raise exception 'Last Super Admin protected';end if;
 update public.news set author_id=auth.uid() where author_id=p_user_id;
 update public.groups set created_by=auth.uid() where created_by=p_user_id;
 delete from auth.sessions where user_id=p_user_id;
 delete from auth.users where id=p_user_id;
 end;
$$;
create or replace function public.create_group_from_filters(p_name text,p_description text,p_role text,p_city text,p_region text,p_invite boolean default false) returns text language plpgsql security definer set search_path='' as $$
 declare g public.groups;u record;
 begin perform private.require_admin(auth.uid());if length(trim(p_name))<3 then raise exception 'Name required';end if;
 insert into public.groups(name,description,category,filter_role,filter_city,filter_region,created_by)
 values(p_name,p_description,coalesce(p_role,'all')||'_'||lower(coalesce(nullif(p_city,''),nullif(p_region,''),'cameroun')),coalesce(p_role,'all'),nullif(trim(p_city),''),nullif(p_region,''),auth.uid()) returning * into g;
 for u in select * from public.profiles where status='approved' and role in ('membre','benevole','volontaire')
 and (g.filter_role='all' or role=g.filter_role) and (g.filter_city is null or lower(trim(city))=lower(g.filter_city)) and (g.filter_region is null or region=g.filter_region) loop
 insert into public.group_members(group_id,user_id) values(g.id,u.id);
 if p_invite then perform private.queue_email(u.id,'group_invitation',jsonb_build_object('name',g.name,'token',g.invite_token),'invite:'||g.id||':'||u.id);end if;
 end loop;return 'https://www.ardttemp.org/g/'||g.invite_token;end;
$$;
create or replace function public.join_group(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
 declare g public.groups;p public.profiles;
 begin select * into p from public.profiles where id=auth.uid();if p.id is null or p.status<>'approved' then raise exception 'Approved account required';end if;
 select * into g from public.groups where invite_token=p_token;
 if g.id is null then raise exception 'Invalid invitation';end if;
 if not private.is_admin() and not private.in_group(g.id) and not (
 (g.filter_role='all' or g.filter_role is null or g.filter_role=p.role) and (g.filter_city is null or lower(trim(p.city))=lower(g.filter_city)) and (g.filter_region is null or g.filter_region=p.region)) then raise exception 'This group is reserved for another category';end if;
 insert into public.group_members(group_id,user_id) values(g.id,p.id) on conflict do nothing;return g.id;end;
$$;
create or replace function public.add_group_member(p_group uuid,p_user uuid) returns void language plpgsql security definer set search_path='' as $$
 begin perform private.require_admin(auth.uid());if not exists(select 1 from public.profiles where id=p_user and status='approved') then raise exception 'Approved account required';end if;
 insert into public.group_members(group_id,user_id) values(p_group,p_user) on conflict do nothing;end;
$$;
create or replace function public.request_reward(p_type text) returns uuid language plpgsql security definer set search_path='' as $$
 declare p public.profiles;t integer;n integer;rid uuid;
 begin select * into p from public.profiles where id=auth.uid() for update;t:=private.reward_threshold(p.role);
 if p.id is null or p.status<>'approved' or t is null or p.points<t then raise exception 'Reward threshold not reached';end if;
 -- Each claimed milestone retains its original threshold when roles change.
 select coalesce(max(milestone),0)+1 into n from public.rewards where user_id=p.id and status<>'rejected';
 if p.points<t*n then raise exception 'Next reward threshold not reached';end if;
 insert into public.rewards(user_id,reward_type,milestone,threshold) values(p.id,p_type,n,t) returning id into rid;return rid;end;
$$;
create or replace function public.review_reward(p_id uuid,p_status text,p_notes text default '') returns void language plpgsql security definer set search_path='' as $$
 declare r public.rewards;
 begin perform private.require_admin(auth.uid());select * into r from public.rewards where id=p_id for update;
 if r.id is null or not ((r.status='requested' and p_status in ('approved','rejected')) or (r.status='approved' and p_status='fulfilled')) then raise exception 'Invalid transition';end if;
 update public.rewards set status=p_status,notes=p_notes,reviewed_by=auth.uid(),reviewed_at=now() where id=p_id;
 if p_status='approved' then perform private.queue_email(r.user_id,'reward_approved',jsonb_build_object('type',r.reward_type,'notes',p_notes),'reward-approved:'||r.id);end if;end;
$$;
create or replace function public.complete_donation(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
 declare d public.donations;
 begin perform private.require_admin(auth.uid());select * into d from public.donations where id=p_id for update;
 if d.id is null or d.status<>'pending' then raise exception 'Donation already processed';end if;
 update public.donations set status='completed',paid_at=now() where id=p_id;end;
$$;
create or replace function private.donation_email() returns trigger language plpgsql security definer set search_path='' as $$
 begin if new.status='completed' and old.status<>'completed' and new.donor_email is not null then
 insert into private.email_outbox(dedupe_key,recipient,event,payload,locale) values('donation:'||new.id,new.donor_email,'donation_received',jsonb_build_object('amount',new.amount,'reference',new.id),new.locale) on conflict do nothing;end if;return new;end;
$$;
create trigger donation_receipt after update on public.donations for each row execute function private.donation_email();
create or replace function private.updated_at() returns trigger language plpgsql set search_path='' as $$begin new.updated_at=now();return new;end$$;
create trigger profile_updated before update on public.profiles for each row execute function private.updated_at();
create trigger news_updated before update on public.news for each row execute function private.updated_at();
create or replace function private.owns_paths(p_paths text[]) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from unnest(p_paths) x where split_part(x,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='activity-photos' and name=x));
$$;
-- Remove historical donation policies before applying the strict new ones.
do $$declare r record;begin for r in select policyname from pg_policies where schemaname='public' and tablename='donations' loop execute format('drop policy %I on public.donations',r.policyname);end loop;end$$;
do $$declare t text;begin foreach t in array array['profiles','membership_requests','reports','news','gallery_media','donations','groups','group_members','group_messages','points_history','rewards'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);end loop;end$$;
grant usage on schema public,private to authenticated;
grant select on profiles,membership_requests,reports,news,gallery_media,donations,groups,group_members,group_messages,points_history,rewards to authenticated;
grant select on news to anon;
grant select on gallery_media to anon;
grant update(full_name,phone,city,region,bio,avatar_url,locale) on profiles to authenticated;
grant insert(user_id,requested_role,motivation,city,region,phone) on membership_requests to authenticated;
grant insert(user_id,title,description,activity_date,location,photo_urls) on reports to authenticated;
grant insert,update,delete on news to authenticated;
grant insert,delete on gallery_media to authenticated;
grant insert(user_id,amount,currency,donor_name,donor_email,donor_phone,message,is_monthly,payment_method,locale) on donations to anon,authenticated;
grant insert(group_id,user_id,content,attachment_url) on group_messages to authenticated;
create policy profiles_read on profiles for select to authenticated using(id=auth.uid() or private.approved_actor());
create policy profiles_edit on profiles for update to authenticated using(id=auth.uid() or private.is_admin()) with check(id=auth.uid() or private.is_admin());
create policy requests_read on membership_requests for select to authenticated using(user_id=auth.uid() or private.is_admin());
create policy requests_insert on membership_requests for insert to authenticated with check(user_id=auth.uid() and status='pending' and exists(select 1 from profiles where id=auth.uid() and status='pending'));
create policy reports_read on reports for select to authenticated using(user_id=auth.uid() or private.is_admin());
create policy reports_insert on reports for insert to authenticated with check(user_id=auth.uid() and status='pending' and points_awarded is null and reviewed_by is null and private.owns_paths(photo_urls) and exists(select 1 from profiles where id=auth.uid() and status='approved' and role in ('membre','benevole','volontaire')));
create policy news_read on news for select to anon,authenticated using(published or private.is_admin());
create policy news_admin on news for all to authenticated using(private.is_admin()) with check(private.is_admin());
create policy gallery_media_read on gallery_media for select to anon,authenticated using(published or private.is_admin());
create policy gallery_media_publish on gallery_media for insert to authenticated with check(private.is_admin() and created_by=auth.uid() and published and split_part(object_path,'/',1)=auth.uid()::text and (poster_path is null or split_part(poster_path,'/',1)=auth.uid()::text));
create policy gallery_media_delete on gallery_media for delete to authenticated using(private.is_admin());
create policy donations_insert on donations for insert to anon,authenticated with check(status='pending' and currency='XAF' and (user_id is null or user_id=auth.uid()) and amount between 100 and 100000000);
create policy donations_read on donations for select to authenticated using(user_id=auth.uid() or private.is_admin());
create policy groups_read on groups for select to authenticated using(private.in_group(id) or private.is_admin());
create policy members_read on group_members for select to authenticated using(private.in_group(group_id) or private.is_admin());
create policy messages_read on group_messages for select to authenticated using(private.in_group(group_id) or private.is_admin());
create policy messages_insert on group_messages for insert to authenticated with check(user_id=auth.uid() and private.approved_actor() and (private.in_group(group_id) or private.is_admin()) and (attachment_url is null or split_part(attachment_url,'/',2)=group_id::text and split_part(attachment_url,'/',3)=auth.uid()::text));
create policy points_read on points_history for select to authenticated using(user_id=auth.uid() or private.is_admin());
create policy rewards_read on rewards for select to authenticated using(user_id=auth.uid() or private.is_admin());
-- Private files: reports are visible only to their author and admins; group files only to the group.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('activity-photos','activity-photos',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('group-files','group-files',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf','text/plain']),
 ('gallery-media','gallery-media',true,52428800,array['image/webp','video/webm','video/mp4']) on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy activity_upload on storage.objects for insert to authenticated with check(bucket_id='activity-photos' and private.approved_actor() and (storage.foldername(name))[1]=auth.uid()::text);
create policy activity_read on storage.objects for select to authenticated using(bucket_id='activity-photos' and ((storage.foldername(name))[1]=auth.uid()::text or private.is_admin()));
create policy activity_delete on storage.objects for delete to authenticated using(bucket_id='activity-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy group_upload on storage.objects for insert to authenticated with check(bucket_id='group-files' and private.approved_actor() and (storage.foldername(name))[1]='groups' and (storage.foldername(name))[3]=auth.uid()::text and (private.in_group(((storage.foldername(name))[2])::uuid) or private.is_admin()));
create policy group_download on storage.objects for select to authenticated using(bucket_id='group-files' and (storage.foldername(name))[1]='groups' and (private.in_group(((storage.foldername(name))[2])::uuid) or private.is_admin()));
create policy gallery_media_upload on storage.objects for insert to authenticated with check(bucket_id='gallery-media' and private.is_admin() and (storage.foldername(name))[1]=auth.uid()::text);
create policy gallery_media_delete on storage.objects for delete to authenticated using(bucket_id='gallery-media' and private.is_admin());
create index profiles_filters on profiles(status,role,region,lower(city));
create index requests_user on membership_requests(user_id,created_at desc);
create index requests_pending on membership_requests(status,created_at);
create index reports_user on reports(user_id,created_at desc);
create index reports_pending on reports(status,created_at);
create index news_published on news(published,created_at desc);
create index donations_user on donations(user_id);
create index groups_creator on groups(created_by);
create index group_members_user on group_members(user_id,group_id);
create index messages_group on group_messages(group_id,created_at);
create index points_user on points_history(user_id,created_at desc);
create index rewards_user on rewards(user_id,created_at desc);
create index outbox_pending on private.email_outbox(status,available_at);
-- Worker RPCs accept a high-entropy server-only token, not a user role claim.
create or replace function private.require_worker(p_secret text) returns void language plpgsql security definer set search_path='' as $$
 begin if p_secret is null or not exists(select 1 from private.worker_config where secret_hash=encode(extensions.digest(p_secret,'sha256'),'hex')) then raise exception 'Forbidden' using errcode='42501';end if;end;
$$;
create or replace function public.claim_emails(p_secret text) returns setof private.email_outbox language plpgsql security definer set search_path='' as $$
 begin perform private.require_worker(p_secret);
 return query update private.email_outbox set status='sending',attempts=attempts+1,available_at=now()+interval '5 minutes'
 where id in(select id from private.email_outbox where (status='pending' or status='sending' and available_at<now()) and available_at<=now() and attempts<10 order by created_at limit 20 for update skip locked) returning *;end;
$$;
create or replace function public.finish_email(p_secret text,p_id uuid,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
 begin perform private.require_worker(p_secret);update private.email_outbox set status=case when p_error is null then 'sent' else 'pending' end,last_error=left(p_error,500),available_at=now()+interval '10 minutes' where id=p_id;end;
$$;
create or replace function public.check_rate_limit(p_secret text,p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql security definer set search_path='' as $$
 declare r private.rate_limits;
 begin perform private.require_worker(p_secret);
 insert into private.rate_limits(key) values(p_key) on conflict(key) do update set
 hits=case when private.rate_limits.window_start<now()-make_interval(secs=>p_seconds) then 1 else private.rate_limits.hits+1 end,
 window_start=case when private.rate_limits.window_start<now()-make_interval(secs=>p_seconds) then now() else private.rate_limits.window_start end returning * into r;
 delete from private.rate_limits where window_start<now()-interval '2 days';return r.hits<=p_limit;end;
$$;
create or replace function public.submit_contact(p_secret text,p_name text,p_email text,p_subject text,p_message text,p_locale text) returns void language plpgsql security definer set search_path='' as $$
 declare k text:=gen_random_uuid()::text;
 begin perform private.require_worker(p_secret);
 insert into private.email_outbox(dedupe_key,recipient,event,payload,locale) values
 ('contact:'||k,'partnership@ardttemp.org','contact_message',jsonb_build_object('name',p_name,'email',p_email,'subject',p_subject,'message',p_message),p_locale),
 ('contact-ack:'||k,p_email,'contact_received',jsonb_build_object('name',p_name,'subject',p_subject),p_locale);end;
$$;
create or replace function public.submit_donation(p_secret text,p_data jsonb,p_user uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
 declare d uuid;
 begin perform private.require_worker(p_secret);
 insert into public.donations(user_id,amount,currency,donor_name,donor_email,donor_phone,message,is_monthly,payment_method,locale)
 values(p_user,(p_data->>'amount')::numeric,'XAF',p_data->>'donor_name',nullif(p_data->>'donor_email',''),p_data->>'donor_phone',p_data->>'message',(p_data->>'is_monthly')::boolean,p_data->>'payment_method',p_data->>'locale') returning id into d;
 if nullif(p_data->>'donor_email','') is not null then insert into private.email_outbox(dedupe_key,recipient,event,payload,locale)
 values('donation-pending:'||d,p_data->>'donor_email','donation_pending',jsonb_build_object('amount',p_data->>'amount','reference',d,'monthly',p_data->>'is_monthly'),p_data->>'locale');end if;return d;end;
$$;
-- Revoke the default PUBLIC execute grant on every function introduced here.
do $$declare r record;begin for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' loop execute format('revoke all on function %s from public,anon,authenticated',r.sig);end loop;end$$;
grant execute on function private.is_admin(),private.is_super_admin(),private.approved_actor(),private.in_group(uuid),private.owns_paths(text[]) to authenticated;
grant usage on schema private to anon;
grant execute on function private.is_admin() to anon;
do $$declare f text;begin foreach f in array array['is_admin()','is_super_admin()','generate_matricule(text)','approve_membership(uuid,uuid)','reject_membership(uuid,uuid,text)','validate_report(uuid,uuid,integer,text)','reject_report(uuid,uuid,text)','manage_member(uuid,text,text)','create_admin_account(uuid)','delete_account(uuid)','create_group_from_filters(text,text,text,text,text,boolean)','join_group(text)','add_group_member(uuid,uuid)','request_reward(text)','review_reward(uuid,text,text)','complete_donation(uuid)'] loop
 execute 'revoke all on function public.'||f||' from public,anon';execute 'grant execute on function public.'||f||' to authenticated';end loop;end$$;
do $$declare f text;begin foreach f in array array['claim_emails(text)','finish_email(text,uuid,text)','check_rate_limit(text,text,integer,integer)','submit_contact(text,text,text,text,text,text)','submit_donation(text,jsonb,uuid)'] loop execute 'revoke all on function public.'||f||' from public';execute 'grant execute on function public.'||f||' to anon';end loop;end$$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
-- No fabricated production articles are seeded. Admin can publish the supplied bilingual drafts.
commit;
