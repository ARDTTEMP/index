-- Preserve the historical newsletter capability and route it through the same durable outbox.
create or replace function public.subscribe_newsletter(p_secret text,p_email text,p_locale text) returns void language plpgsql security definer set search_path='' as $$
 begin perform private.require_worker(p_secret);
 insert into public.newsletter_subscribers(email,source,status) values(lower(p_email),'ardttemp-platform','active') on conflict(email) do update set status='active',unsubscribed_at=null;
 insert into private.email_outbox(dedupe_key,recipient,event,payload,locale) values('newsletter:'||lower(p_email),p_email,'newsletter_received','{}',p_locale) on conflict(dedupe_key) do nothing;end;
$$;
revoke all on function public.subscribe_newsletter(text,text,text) from public,authenticated;
grant execute on function public.subscribe_newsletter(text,text,text) to anon;
-- Explicitly disable obsolete privileged endpoints; historical data remains accessible to its original policies.
revoke execute on function public.admin_set_member_state(uuid,text,text),public.super_admin_delete_member(uuid) from public,anon,authenticated;
