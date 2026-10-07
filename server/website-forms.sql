begin;
create table if not exists private.website_submissions (
 id uuid primary key, operation text not null check(operation in ('contact','membership','newsletter','donation_interest')),
 locale text not null check(locale in ('fr','en')), data jsonb not null check(jsonb_typeof(data)='object'),
 status text not null default 'pending' check(status in ('pending','reviewed','rejected')),
 created_at timestamptz not null default now()
);
create table if not exists private.website_submission_limits (
 key text primary key, started_at timestamptz not null default now(), hits integer not null default 1
);
alter table private.website_submissions enable row level security;
alter table private.website_submission_limits enable row level security;
revoke all on private.website_submissions,private.website_submission_limits from public,anon,authenticated;
create or replace function public.receive_website_submission(p_id uuid,p_operation text,p_locale text,p_data jsonb,p_source text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare clean jsonb; prior private.website_submissions; r private.website_submission_limits; k text; email text;
begin
 if p_id is null or p_operation not in ('contact','membership','newsletter','donation_interest') or p_locale not in ('fr','en')
 or jsonb_typeof(p_data) is distinct from 'object' or octet_length(p_data::text)>16000 then
 raise exception 'Invalid request' using errcode='22023'; end if;
 if p_data ?| array['role','status','points','matricule','user_id','actor_role'] then
 raise exception 'Privileged fields forbidden' using errcode='42501'; end if;
 email:=lower(trim(p_data->>'email'));
 if email is null or length(email)>254 or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
 raise exception 'Invalid email' using errcode='22023'; end if;
 clean:=jsonb_build_object('email',email);
 if p_operation='contact' then
 if length(trim(coalesce(p_data->>'name',''))) not between 2 and 200
 or length(trim(coalesce(p_data->>'subject',''))) not between 2 and 200
 or length(trim(coalesce(p_data->>'message',''))) not between 1 and 5000 then raise exception 'Invalid contact' using errcode='22023';end if;
 clean:=clean||jsonb_build_object('name',trim(p_data->>'name'),'subject',trim(p_data->>'subject'),'message',trim(p_data->>'message'),'phone',left(coalesce(p_data->>'phone',''),50));
 elsif p_operation in ('membership','donation_interest') then
 if length(trim(coalesce(p_data->>'firstname',''))) not between 1 and 100 or length(trim(coalesce(p_data->>'lastname',''))) not between 1 and 100 then raise exception 'Invalid name' using errcode='22023';end if;
 clean:=clean||jsonb_build_object('firstname',trim(p_data->>'firstname'),'lastname',trim(p_data->>'lastname'),'phone',left(coalesce(p_data->>'phone',''),50));
 if p_operation='membership' then
 if coalesce(p_data->>'requested_role','') not in ('membre','benevole','volontaire') or coalesce(p_data->>'terms','') not in ('on','true')
 or length(coalesce(p_data->>'message',''))>5000 or length(coalesce(p_data->>'region',''))>100 then raise exception 'Invalid membership' using errcode='22023';end if;
 clean:=clean||jsonb_build_object('requested_role',p_data->>'requested_role','terms_accepted',true,'region',coalesce(p_data->>'region',''),'motivation',coalesce(p_data->>'message',''),'newsletter',coalesce(p_data->>'newsletter','')='on');
 else
 if coalesce(p_data->>'amount','') !~ '^[0-9]{1,9}$' then raise exception 'Invalid amount' using errcode='22023';end if;
 if (p_data->>'amount')::integer not between 500 and 100000000 or (p_data->>'amount')::integer%500<>0
 or coalesce(p_data->>'payment_method','') not in ('mobile-money','virement','especes','bank-transfer','cash') then raise exception 'Invalid donation interest' using errcode='22023';end if;
 clean:=clean||jsonb_build_object('amount',(p_data->>'amount')::integer,'currency','XAF','payment_method',p_data->>'payment_method','frequency',left(coalesce(p_data->>'frequency',''),30),'receipt',coalesce(p_data->>'receipt','')='on');
 end if;
 end if;
 -- Lock the request identifier so concurrent retries cannot insert twice.
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into prior from private.website_submissions where id=p_id;
 if found then
 if prior.operation<>p_operation or prior.locale<>p_locale or prior.data<>clean then raise exception 'Request identifier reused' using errcode='22023';end if;
 return jsonb_build_object('ok',true,'id',p_id,'status',prior.status);end if;
 foreach k in array array['email:'||email,'source:'||coalesce(p_source,'unknown')] loop
 k:=encode(extensions.digest(k,'sha256'),'hex');
 insert into private.website_submission_limits(key) values(k) on conflict(key) do update set
 hits=case when private.website_submission_limits.started_at<now()-interval '15 minutes' then 1 else private.website_submission_limits.hits+1 end,
 started_at=case when private.website_submission_limits.started_at<now()-interval '15 minutes' then now() else private.website_submission_limits.started_at end returning * into r;
 if r.hits>10 then return jsonb_build_object('ok',false,'status',429);end if;
 end loop;
 delete from private.website_submission_limits where started_at<now()-interval '2 days';
 insert into private.website_submissions(id,operation,locale,data) values(p_id,p_operation,p_locale,clean);
 return jsonb_build_object('ok',true,'id',p_id,'status','pending');
end;$$;
revoke all on function public.receive_website_submission(uuid,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.receive_website_submission(uuid,text,text,jsonb,text) to service_role;
commit;
