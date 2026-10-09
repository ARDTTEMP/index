-- Promotion and durable invitation are one transaction. Auth creation stays in Edge.
create or replace function public.create_admin_with_invitation(
  p_user_id uuid, p_token_hash text, p_origin text, p_locale text default 'fr'
) returns void language plpgsql security definer set search_path='' as $$
declare p public.profiles; invitation_url text;
begin
  perform private.require_admin(auth.uid());
  if not private.is_super_admin() then
    raise exception 'Super Admin required' using errcode='42501';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid invitation token';
  end if;
  if p_origin is null or p_origin !~ '^https://(www\.ardttemp\.org|ardttemp\.org|ardttemp-[a-z0-9-]+-ardttemp-1081\.vercel\.app)$' then
    raise exception 'Invalid application origin';
  end if;
  if p_locale is null or p_locale not in ('fr','en') then raise exception 'Invalid locale'; end if;
  perform public.create_admin_account(p_user_id);
  select * into strict p from public.profiles where id=p_user_id;
  invitation_url := p_origin || '/auth/callback?token_hash=' || p_token_hash || '&type=invite&next=%2Freset-password';
  perform public.enqueue_system_email(p.email,'admin_invitation',
    jsonb_build_object('admin_name',p.full_name,'matricule',p.matricule,'invitation_url',invitation_url),
    p_locale,'admin-invitation:'||p_user_id::text);
end;
$$;
revoke all on function public.create_admin_with_invitation(uuid,text,text,text) from public,anon;
grant execute on function public.create_admin_with_invitation(uuid,text,text,text) to authenticated;
