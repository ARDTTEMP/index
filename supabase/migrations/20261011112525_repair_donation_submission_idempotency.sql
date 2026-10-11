begin;
-- Preserve the existing submission behavior while coexisting with the email trigger.
create or replace function public.submit_donation(p_secret text,p_data jsonb,p_user uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
 declare d uuid;
 begin perform private.require_worker(p_secret);
 insert into public.donations(user_id,amount,currency,donor_name,donor_email,donor_phone,message,is_monthly,payment_method,locale)
 values(p_user,(p_data->>'amount')::numeric,'XAF',p_data->>'donor_name',nullif(p_data->>'donor_email',''),p_data->>'donor_phone',p_data->>'message',(p_data->>'is_monthly')::boolean,p_data->>'payment_method',p_data->>'locale') returning id into d;
 if nullif(p_data->>'donor_email','') is not null then insert into private.email_outbox(dedupe_key,recipient,event,payload,locale)
 values('donation-pending:'||d,p_data->>'donor_email','donation_pending',jsonb_build_object('amount',p_data->>'amount','reference',d,'monthly',p_data->>'is_monthly'),p_data->>'locale') on conflict(dedupe_key) do nothing;end if;return d;end;
$$;
commit;
