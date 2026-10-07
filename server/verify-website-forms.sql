begin;
do $$
declare result jsonb; before_profiles bigint; payload jsonb:=jsonb_build_object('email','verification@example.org','firstname','TEST','lastname','ARDTTEMP','requested_role','benevole','terms','on','message','Verification technique sans compte');
begin
 select count(*) into before_profiles from public.profiles;
 result:=public.receive_website_submission('d9900000-0000-4000-8000-000000000001','membership','fr',payload,'verification');
 if result->>'status'<>'pending' then raise exception 'Pending check failed';end if;
 if (select count(*) from public.profiles)<>before_profiles then raise exception 'Profiles changed';end if;
 perform public.receive_website_submission('d9900000-0000-4000-8000-000000000001','membership','fr',payload,'verification');
 if (select count(*) from private.website_submissions where id='d9900000-0000-4000-8000-000000000001')<>1 then raise exception 'Duplicate request';end if;
 begin
 perform public.receive_website_submission(gen_random_uuid(),'membership','fr',payload||'{"requested_role":"admin"}'::jsonb,'verification');
 raise exception 'Admin role accepted';
 exception when sqlstate '22023' then null;end;
 begin
 perform public.receive_website_submission(gen_random_uuid(),'membership','fr',payload||'{"status":"approved"}'::jsonb,'verification');
 raise exception 'Client status accepted';
 exception when sqlstate '42501' then null;end;
end;$$;
select 'pending, no account creation, retry deduplication, Admin rejection, status rejection: PASS' as verification,
 has_function_privilege('anon','public.receive_website_submission(uuid,text,text,jsonb,text)','execute') as anon_execute,
 has_function_privilege('authenticated','public.receive_website_submission(uuid,text,text,jsonb,text)','execute') as authenticated_execute,
 has_function_privilege('service_role','public.receive_website_submission(uuid,text,text,jsonb,text)','execute') as server_execute,
 has_column_privilege('authenticated','public.profiles','role','update') as self_role_update,
 has_column_privilege('authenticated','public.profiles','status','update') as self_status_update;
rollback;
