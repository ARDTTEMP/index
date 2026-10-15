begin;

alter table public.newsletter_subscribers
  add column if not exists locale text not null default 'fr',
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();
create unique index if not exists newsletter_subscribers_unsubscribe_token_key
  on public.newsletter_subscribers(unsubscribe_token);

create or replace function public.subscribe_newsletter(p_secret text,p_email text,p_locale text) returns void
language plpgsql security definer set search_path='' as $$
declare normalized_email text:=lower(trim(coalesce(p_email,''))); language_code text:=case when p_locale='en' then 'en' else 'fr' end; token uuid;
begin
  perform private.require_worker(p_secret);
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email'; end if;
  insert into public.newsletter_subscribers(email,source,status,locale)
  values(normalized_email,'ardttemp-platform','active',language_code)
  on conflict(email) do update set status='active',unsubscribed_at=null,locale=excluded.locale
  returning unsubscribe_token into token;
  insert into private.email_outbox(dedupe_key,recipient,event,payload,locale)
  values('newsletter:'||normalized_email,normalized_email,'newsletter_received',jsonb_build_object('unsubscribe_token',token),language_code)
  on conflict(dedupe_key) do nothing;
end;$$;

create or replace function private.newsletter_email_events() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' and new.status='active' then
    insert into private.email_outbox(dedupe_key,recipient,event,payload,locale)
    values('newsletter:'||lower(new.email),new.email,'newsletter_received',
      jsonb_build_object('subscriber_name',coalesce(new.first_name,'Abonné'),'unsubscribe_token',new.unsubscribe_token),
      case when new.locale in ('fr','en') then new.locale else 'fr' end)
    on conflict(dedupe_key) do nothing;
  elsif tg_op='UPDATE' and new.status is distinct from old.status and new.status='active' then
    insert into private.email_outbox(dedupe_key,recipient,event,payload,locale)
    values('newsletter-reactivated:'||new.id||':'||extract(epoch from now())::bigint,new.email,'newsletter_received',
      jsonb_build_object('subscriber_name',coalesce(new.first_name,'Abonné'),'unsubscribe_token',new.unsubscribe_token),
      case when new.locale in ('fr','en') then new.locale else 'fr' end)
    on conflict(dedupe_key) do nothing;
  end if;
  return new;
exception when others then raise warning 'newsletter_email_events failed: %',sqlerrm; return new;
end;$$;
revoke all on function private.newsletter_email_events() from public,anon,authenticated;

create or replace function public.unsubscribe_newsletter(p_secret text,p_token uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform private.require_worker(p_secret);
  update public.newsletter_subscribers set status='unsubscribed',unsubscribed_at=now()
  where unsubscribe_token=p_token and status='active';
end;$$;
revoke all on function public.unsubscribe_newsletter(text,uuid) from public,anon,authenticated;
grant execute on function public.unsubscribe_newsletter(text,uuid) to service_role;

create or replace function private.queue_published_newsletter() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.published=true and (tg_op='INSERT' or old.published is distinct from true) then
    insert into private.email_outbox(dedupe_key,recipient,event,payload,locale)
    select 'newsletter-news:'||new.id||':'||s.id,s.email,'newsletter_published',
      jsonb_build_object('news_id',new.id,'title_fr',new.title_fr,'title_en',new.title_en,
        'excerpt_fr',left(coalesce(new.content_fr,''),420),'excerpt_en',left(coalesce(new.content_en,''),420),
        'author_name',coalesce(new.author_name,'ARDTTEMP'),'published_at',coalesce(new.published_at,now()),
        'unsubscribe_token',s.unsubscribe_token),
      case when s.locale in ('fr','en') then s.locale else 'fr' end
    from public.newsletter_subscribers s where s.status='active'
    on conflict(dedupe_key) do nothing;
  end if;
  return new;
exception when others then raise warning 'queue_published_newsletter failed: %',sqlerrm; return new;
end;$$;
revoke all on function private.queue_published_newsletter() from public,anon,authenticated;

create or replace function private.contact_email_events() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into private.email_outbox(dedupe_key,recipient,event,payload,locale)
  values('contact-admin:'||new.id,'contact@ardttemp.org','contact_message',
    jsonb_build_object('sender_name',new.name,'sender_email',new.email,
      'subject',coalesce(new.subject,'Message du site'),'message',new.message,'request_reference',new.id),'fr')
  on conflict(dedupe_key) do nothing;
  return new;
exception when others then raise warning 'contact_email_events failed: %',sqlerrm; return new;
end;$$;
revoke all on function private.contact_email_events() from public,anon,authenticated;

create or replace function private.member_email_events() returns trigger
language plpgsql security definer set search_path='' as $$
declare changed_to_ready boolean;
begin
  if tg_op='INSERT' then return new; end if;
  if new.membership_status is distinct from old.membership_status then
    if new.membership_status='active' then
      perform private.queue_email(new.user_id,'membership_approved','{}'::jsonb,'membership-approved:'||new.user_id);
    elsif new.membership_status='rejected' then
      perform private.queue_email(new.user_id,'membership_rejected','{}'::jsonb,
        'member-rejected:'||new.user_id||':'||extract(epoch from new.updated_at)::bigint);
    end if;
  end if;
  if new.payment_status is distinct from old.payment_status then
    if new.payment_status='paid' then
      perform private.queue_email(new.user_id,'payment_confirmed',jsonb_build_object(
        'amount',coalesce(new.last_payment_amount::text,'—'),'currency',coalesce(new.last_payment_currency,'XAF'),
        'payment_purpose','Cotisation','payment_date',coalesce(new.paid_at,now()),
        'payment_reference',coalesce(new.last_payment_reference,'Référence non renseignée'),'member_id',new.member_number),
        'payment-confirmed:'||new.user_id||':'||coalesce(new.last_payment_reference,coalesce(new.paid_at,now())::text));
    elsif new.payment_status='failed' then
      perform private.queue_email(new.user_id,'payment_failed',jsonb_build_object(
        'amount',coalesce(new.last_payment_amount::text,'—'),'currency',coalesce(new.last_payment_currency,'XAF')),
        'payment-failed:'||new.user_id||':'||extract(epoch from new.updated_at)::bigint);
    end if;
  end if;
  changed_to_ready:=new.membership_status='active' and new.payment_status='paid' and new.member_number is not null and
    (old.membership_status is distinct from new.membership_status or old.payment_status is distinct from new.payment_status or old.member_number is distinct from new.member_number);
  if changed_to_ready then
    perform private.queue_email(new.user_id,'welcome_member',jsonb_build_object(
      'member_id',new.member_number,'member_role',new.role,'join_date',coalesce(new.validated_at,new.created_at)),
      'welcome:'||new.user_id||':'||new.member_number);
  end if;
  if new.role is distinct from old.role then
    perform private.queue_email(new.user_id,'role_changed',jsonb_build_object('new_role',new.role,'member_id',new.member_number),
      'role-change-member:'||new.user_id||':'||new.role||':'||extract(epoch from new.updated_at)::bigint);
  end if;
  if new.membership_expires_at is distinct from old.membership_expires_at and old.membership_expires_at is not null
     and new.membership_expires_at is not null and new.membership_expires_at>old.membership_expires_at and new.payment_status='paid' then
    perform private.queue_email(new.user_id,'renewal_confirmed',jsonb_build_object(
      'new_expiry_date',new.membership_expires_at,'member_id',new.member_number),
      'renewal:'||new.user_id||':'||new.membership_expires_at);
  end if;
  return new;
exception when others then raise warning 'member_email_events failed: %',sqlerrm; return new;
end;$$;
revoke all on function private.member_email_events() from public,anon,authenticated;

create or replace function private.check_reward(p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare p public.profiles; t integer; n integer;
begin
  select * into p from public.profiles where id=p_user;
  t:=private.reward_threshold(p.role);
  if t is null or p.status<>'approved' or p.points<t then return; end if;
  n:=p.points/t;
  insert into private.reward_notifications values(p_user,n) on conflict do nothing;
  if found then
    perform private.queue_email(p_user,'reward_available',jsonb_build_object('points',p.points,'threshold',t),'threshold:'||p_user||':'||n);
  end if;
end;$$;
revoke all on function private.check_reward(uuid) from public,anon,authenticated;

drop trigger if exists trg_donation_pending_email on public.donations;

commit;
