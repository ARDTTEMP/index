begin;
create table public.news_engagement (
 news_id uuid primary key references public.news(id) on delete cascade,
 views bigint not null default 0 check(views>=0), likes bigint not null default 0 check(likes>=0), shares bigint not null default 0 check(shares>=0)
);
alter table public.news_engagement enable row level security;
revoke all on public.news_engagement from public,anon,authenticated;
grant select on public.news_engagement to anon,authenticated;
create policy news_engagement_read on public.news_engagement for select to anon,authenticated using(exists(select 1 from public.news n where n.id=news_id and n.published));
create table private.news_engagement_visitors (
 news_id uuid not null references public.news(id) on delete cascade, visitor_key text not null check(visitor_key ~ '^[a-f0-9]{64}$'),
 kind text not null check(kind in ('view','like','share')), active boolean not null default true, counted_at timestamptz not null default now(), primary key(news_id,visitor_key,kind)
);
alter table private.news_engagement_visitors enable row level security;
revoke all on private.news_engagement_visitors from public,anon,authenticated;
create function public.record_news_engagement(p_secret text,p_news uuid,p_visitor text,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare totals public.news_engagement; entry private.news_engagement_visitors; liked boolean; affected integer;
begin
 perform private.require_worker(p_secret);
 if p_visitor is null or p_visitor !~ '^[a-f0-9]{64}$' or p_action is null or p_action not in ('read','view','like','unlike','share') then raise exception 'Invalid engagement';end if;
 perform 1 from public.news where id=p_news and published for share;
 if not found then raise exception 'Article indisponible' using errcode='P0002';end if;
 if p_action<>'read' then
  insert into public.news_engagement(news_id) values(p_news) on conflict do nothing;
  select * into totals from public.news_engagement where news_id=p_news for update;
  select * into entry from private.news_engagement_visitors where news_id=p_news and visitor_key=p_visitor and kind=case when p_action='unlike' then 'like' else p_action end;
  if p_action in ('view','share') and (entry.news_id is null or entry.counted_at<=now()-interval '24 hours') then
   insert into private.news_engagement_visitors(news_id,visitor_key,kind) values(p_news,p_visitor,p_action) on conflict(news_id,visitor_key,kind) do update set counted_at=now();
   update public.news_engagement set views=views+case when p_action='view' then 1 else 0 end,shares=shares+case when p_action='share' then 1 else 0 end where news_id=p_news;
  elsif p_action='like' and (entry.news_id is null or not entry.active) then
   insert into private.news_engagement_visitors(news_id,visitor_key,kind) values(p_news,p_visitor,'like') on conflict(news_id,visitor_key,kind) do update set active=true,counted_at=now();
   update public.news_engagement set likes=likes+1 where news_id=p_news;
  elsif p_action='unlike' and entry.active then
   update private.news_engagement_visitors set active=false where news_id=p_news and visitor_key=p_visitor and kind='like';
   update public.news_engagement set likes=greatest(0,likes-1) where news_id=p_news;
  end if;
 end if;
 select * into totals from public.news_engagement where news_id=p_news;
 select coalesce(bool_or(active),false) into liked from private.news_engagement_visitors where news_id=p_news and visitor_key=p_visitor and kind='like';
 return jsonb_build_object('views',coalesce(totals.views,0),'likes',coalesce(totals.likes,0),'shares',coalesce(totals.shares,0),'liked',liked);
end;$$;
revoke all on function public.record_news_engagement(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.record_news_engagement(text,uuid,text,text) to anon;
commit;
