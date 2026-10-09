begin;

-- Reserve exactly one additional Super Admin identity. The reservation is
-- claimed only after Supabase Auth confirms ownership of the email address.
create table if not exists private.super_admin_bootstrap_emails (
  email text primary key check (email = lower(email)),
  claimed_user uuid unique references auth.users(id) on delete set null,
  claimed_at timestamptz
);
alter table private.super_admin_bootstrap_emails enable row level security;
revoke all on private.super_admin_bootstrap_emails from public, anon, authenticated;
insert into private.super_admin_bootstrap_emails(email)
values ('cyrille.kamto@ardttemp.org')
on conflict (email) do nothing;

-- Public sign-up remains limited to member, volunteer, and field volunteer.
-- The reserved Super Admin email does not create a membership request.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m jsonb := new.raw_user_meta_data;
  r text;
begin
  insert into public.profiles(id,email,full_name,phone,city,region,locale)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(m->>'full_name',''), split_part(new.email,'@',1)),
    m->>'phone',
    m->>'city',
    nullif(m->>'region',''),
    case when m->>'locale'='en' then 'en' else 'fr' end
  );

  if exists (
    select 1 from private.super_admin_bootstrap_emails
    where email = lower(new.email) and claimed_user is null
  ) then
    return new;
  end if;

  r := m->>'requested_role';
  if r in ('membre','benevole','volontaire') then
    insert into public.membership_requests(user_id,requested_role,motivation,city,region,phone)
    values (new.id,r,m->>'motivation',m->>'city',m->>'region',m->>'phone');
    perform private.queue_email(new.id,'registration_received','{}','registration:'||new.id);
  end if;
  return new;
end;
$$;

create or replace function private.claim_second_super_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reserved_email text;
  active_super_admins integer;
begin
  if new.email_confirmed_at is null or old.email_confirmed_at is not null then
    return new;
  end if;

  select email into reserved_email
  from private.super_admin_bootstrap_emails
  where email = lower(new.email) and claimed_user is null
  for update;
  if reserved_email is null then return new; end if;

  select count(*) into active_super_admins
  from public.profiles
  where role = 'super_admin' and status = 'approved';
  if active_super_admins <> 1 or not exists (
    select 1 from public.profiles
    where lower(email) = 'projets@ardttemp.org'
      and role = 'super_admin' and status = 'approved'
  ) then
    return new;
  end if;

  update public.profiles
  set role = 'super_admin',
      status = 'approved',
      matricule = 'ARDT-S-' || lpad(nextval('private.matricule_seq')::text,5,'0'),
      points = 0,
      updated_at = now()
  where id = new.id and status = 'pending' and matricule is null;
  if not found then return new; end if;

  update private.super_admin_bootstrap_emails
  set claimed_user = new.id, claimed_at = now()
  where email = reserved_email and claimed_user is null;
  return new;
end;
$$;

revoke all on function private.claim_second_super_admin() from public, anon, authenticated;
drop trigger if exists claim_second_super_admin_email on auth.users;
create trigger claim_second_super_admin_email
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is distinct from new.email_confirmed_at)
execute function private.claim_second_super_admin();

-- If Cyrille already registered and confirmed this address, claim the
-- reservation now under the same one-existing-Super-Admin condition.
do $$
declare
  second_user uuid;
begin
  select id into second_user from auth.users
  where lower(email) = 'cyrille.kamto@ardttemp.org'
    and email_confirmed_at is not null;
  if second_user is null then return; end if;

  if (select count(*) from public.profiles
      where role = 'super_admin' and status = 'approved') = 1
     and exists (select 1 from public.profiles
       where lower(email) = 'projets@ardttemp.org'
         and role = 'super_admin' and status = 'approved') then
    update public.profiles
    set role = 'super_admin', status = 'approved',
        matricule = coalesce(matricule, 'ARDT-S-' || lpad(nextval('private.matricule_seq')::text,5,'0')),
        points = 0, updated_at = now()
    where id = second_user;
    update private.super_admin_bootstrap_emails
    set claimed_user = second_user, claimed_at = now()
    where email = 'cyrille.kamto@ardttemp.org' and claimed_user is null;
  end if;
end;
$$;

-- Role and status transitions are enforced here even if a caller bypasses the
-- application UI or submits forged values directly to the Data API.
create or replace function public.manage_member(p_user_id uuid,p_role text,p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.profiles;
  active_super_admins integer;
begin
  perform private.require_admin(auth.uid());
  select * into p from public.profiles where id=p_user_id for update;
  if p.id is null then raise exception 'Missing account'; end if;
  if p_user_id=auth.uid() then
    raise exception 'Cannot change own privileges' using errcode='42501';
  end if;
  if p_role not in ('admin','membre','benevole','volontaire')
     or p_status not in ('approved','suspended','rejected','pending') then
    raise exception 'Invalid values';
  end if;

  if not private.is_super_admin()
     and (p_role='admin' or p.role in ('admin','super_admin')) then
    raise exception 'Super Admin required' using errcode='42501';
  end if;
  -- Super Admin status can only be granted by the confirmed, reserved-email
  -- bootstrap above. It cannot be assigned through this client-callable RPC.
  if p.role='super_admin'
     and (p_role <> 'super_admin' or p_status <> 'approved') then
    select count(*) into active_super_admins
    from public.profiles where role='super_admin' and status='approved';
    if active_super_admins <= 1 then
      raise exception 'At least one Super Admin must remain approved'
        using errcode='42501';
    end if;
  end if;
  if p_role='admin' and p.role <> 'admin'
     and (p.status <> 'approved' or p_status <> 'approved'
          or p.role not in ('membre','benevole','volontaire')) then
    raise exception 'Only an approved member can be promoted to Admin';
  end if;
  if p_status='approved' and p.matricule is null then
    raise exception 'Approve membership request first';
  end if;

  update public.profiles set role=p_role,status=p_status where id=p_user_id;
  perform private.check_reward(p_user_id);
end;
$$;

commit;
