begin;

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
  -- Never derive effective authority or state from user-editable metadata.
  insert into public.profiles(id,email,full_name,phone,city,region,locale,role,status)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(m->>'full_name',''), split_part(new.email,'@',1)),
    m->>'phone',
    m->>'city',
    nullif(m->>'region',''),
    case when m->>'locale'='en' then 'en' else 'fr' end,
    'membre',
    'pending'
  );

  -- This reserved identity is elevated only after email ownership is verified.
  if exists (
    select 1 from private.super_admin_bootstrap_emails
    where email=lower(new.email) and claimed_user is null
  ) then
    return new;
  end if;

  -- Server-issued Auth invitations (e.g. the Admin invite API) do not enter
  -- the public membership application workflow.
  if new.invited_at is not null then return new; end if;

  r := m->>'requested_role';
  if r is null or r not in ('membre','benevole','volontaire') then
    raise exception 'Invalid requested_role' using errcode='22023';
  end if;

  insert into public.membership_requests(user_id,requested_role,motivation,city,region,phone)
  values (new.id,r,m->>'motivation',m->>'city',m->>'region',m->>'phone');
  perform private.queue_email(new.id,'registration_received','{}','registration:'||new.id);
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.create_admin_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.profiles;
begin
  perform private.require_admin(auth.uid());
  if not private.is_super_admin() then
    raise exception 'Super Admin required' using errcode='42501';
  end if;
  if p_user_id=auth.uid() then
    raise exception 'Cannot create an Admin account for yourself' using errcode='42501';
  end if;
  select * into p from public.profiles where id=p_user_id for update;
  if p.id is null then raise exception 'Auth account profile not found'; end if;
  if exists (select 1 from private.super_admin_bootstrap_emails where email=lower(p.email)) then
    raise exception 'Reserved Super Admin identity';
  end if;
  if p.status <> 'pending' or p.matricule is not null
     or p.role not in ('membre','benevole','volontaire') then
    raise exception 'Admin creation requires a new pending account';
  end if;
  update public.profiles
  set role='admin', status='approved',
      matricule='ARDT-A-'||lpad(nextval('private.matricule_seq')::text,5,'0'),
      points=0, updated_at=now()
  where id=p_user_id;
end;
$$;
revoke all on function public.create_admin_account(uuid) from public, anon;
grant execute on function public.create_admin_account(uuid) to authenticated;

commit;
