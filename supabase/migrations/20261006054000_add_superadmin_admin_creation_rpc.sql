begin;

-- This operation assigns the Admin role to an Auth identity created through
-- the server-side invitation flow. Role and status are fixed here; callers
-- cannot provide either value.
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
