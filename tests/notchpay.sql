begin;
-- Fixtures and worker credential override are rolled back; no real charge or email.
update private.worker_config set secret_hash=encode(extensions.digest('notch-test-worker','sha256'),'hex');
insert into auth.users(id,email,raw_user_meta_data) values('20000000-0000-4000-8000-000000000001','notch-test@example.invalid','{"full_name":"Notch Test","phone":"+237600000001","city":"Yaoundé","region":"Centre","requested_role":"membre","motivation":"Temporary payment verification fixture"}');
insert into public.membership_payments(id,user_id,period,amount) values('20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','notch-test',5000);
do $$declare a jsonb; repeat_a jsonb; d uuid;begin
 begin perform public.notchpay_payment(null,'lookup','{}');raise exception 'FAILED: missing worker secret accepted';exception when insufficient_privilege then null;end;
 begin perform public.notchpay_payment('notch-test-worker','prepare','{"kind":"dues","target":"20000000-0000-4000-8000-000000000002","user_id":"20000000-0000-4000-8000-000000000099","sandbox":false}');raise exception 'FAILED: wrong owner accepted';exception when insufficient_privilege then null;end;
 a:=public.notchpay_payment('notch-test-worker','prepare','{"kind":"dues","target":"20000000-0000-4000-8000-000000000002","user_id":"20000000-0000-4000-8000-000000000001","sandbox":true}');
 perform public.notchpay_payment('notch-test-worker','attach',jsonb_build_object('id',a->>'id','reference','trx.notch_test','url','https://pay.notchpay.co/pay_test'));
 perform public.notchpay_payment('notch-test-worker','settle',jsonb_build_object('id',a->>'id','reference','trx.notch_test','amount',5000,'currency','XAF','sandbox',true,'status','complete'));
 if (select status from public.membership_payments where id='20000000-0000-4000-8000-000000000002')<>'pending' or (select points from public.profiles where id='20000000-0000-4000-8000-000000000001')<>0 then raise exception 'FAILED: sandbox awarded points or confirmed dues';end if;
 a:=public.notchpay_payment('notch-test-worker','prepare','{"kind":"dues","target":"20000000-0000-4000-8000-000000000002","user_id":"20000000-0000-4000-8000-000000000001","sandbox":false}');
 repeat_a:=public.notchpay_payment('notch-test-worker','prepare','{"kind":"dues","target":"20000000-0000-4000-8000-000000000002","user_id":"20000000-0000-4000-8000-000000000001","sandbox":false}');
 if repeat_a->>'id'<>a->>'id' or repeat_a ? 'new' then raise exception 'FAILED: duplicate checkout';end if;
 perform public.notchpay_payment('notch-test-worker','attach',jsonb_build_object('id',a->>'id','reference','trx.notch_live','url','https://pay.notchpay.co/pay_live'));
 begin
  perform public.notchpay_payment('notch-test-worker','settle',jsonb_build_object('id',a->>'id','reference','trx.notch_live','amount',100,'currency','XAF','sandbox',false,'status','complete'));
  raise exception 'FAILED: wrong amount accepted';
 exception when raise_exception then if sqlerrm='FAILED: wrong amount accepted' then raise;end if;end;
 perform public.notchpay_payment('notch-test-worker','settle',jsonb_build_object('id',a->>'id','reference','trx.notch_live','amount',5000,'currency','XAF','sandbox',false,'status','processing'));
 if (select points from public.profiles where id='20000000-0000-4000-8000-000000000001')<>0 then raise exception 'FAILED: pending awarded points';end if;
 perform public.notchpay_payment('notch-test-worker','settle',jsonb_build_object('id',a->>'id','reference','trx.notch_live','amount',5000,'currency','XAF','sandbox',false,'status','complete'));
 perform public.notchpay_payment('notch-test-worker','settle',jsonb_build_object('id',a->>'id','reference','trx.notch_live','amount',5000,'currency','XAF','sandbox',false,'status','complete'));
 if (select points from public.profiles where id='20000000-0000-4000-8000-000000000001')<>200 then raise exception 'FAILED: expected exactly 200 points';end if;
 if (select count(*) from private.email_outbox where dedupe_key='dues-paid:20000000-0000-4000-8000-000000000002')<>1 then raise exception 'FAILED: duplicate receipt';end if;
 repeat_a:=public.notchpay_payment('notch-test-worker','settle',jsonb_build_object('id',a->>'id','reference','trx.notch_live','amount',5000,'currency','XAF','sandbox',false,'status','refunded'));
 if repeat_a->>'status'<>'refunded' or (select points from public.profiles where id='20000000-0000-4000-8000-000000000001')<>200 then raise exception 'FAILED: refund reconciliation status or points changed';end if;
 d:=public.submit_donation('notch-test-worker','{"amount":1000,"donor_name":"Notch Test","donor_email":"notch-test@example.invalid","donor_phone":"+237600000001","message":"Fixture","is_monthly":false,"payment_method":"mobile_money","locale":"fr"}');
 a:=public.notchpay_payment('notch-test-worker','prepare',jsonb_build_object('kind','donation','target',d,'sandbox',false));
 perform public.notchpay_payment('notch-test-worker','attach',jsonb_build_object('id',a->>'id','reference','trx.notch_donation','url','https://pay.notchpay.co/pay_donation'));
 perform public.notchpay_payment('notch-test-worker','settle',jsonb_build_object('id',a->>'id','reference','trx.notch_donation','amount',1000,'currency','XAF','sandbox',false,'status','complete'));
 if (select status from public.donations where id=d)<>'completed' then raise exception 'FAILED: donation not completed';end if;
 d:=public.submit_notchpay_donation('notch-test-worker','20000000-0000-4000-8000-000000000010','{"amount":1000,"donor_name":"Retry Test","donor_email":"retry@example.invalid","donor_phone":"+237600000001","message":"Fixture","is_monthly":false,"payment_method":"mobile_money","locale":"fr"}');
 if d<>public.submit_notchpay_donation('notch-test-worker','20000000-0000-4000-8000-000000000010','{"amount":1000,"donor_name":"Retry Test","donor_email":"retry@example.invalid","donor_phone":"+237600000001","message":"Fixture","is_monthly":false,"payment_method":"mobile_money","locale":"fr"}') then raise exception 'FAILED: duplicate donation after retry';end if;
 delete from public.membership_payments where id='20000000-0000-4000-8000-000000000002';
 if exists(select 1 from private.notchpay_payments where provider_reference='trx.notch_live' and dues_id is not null) then raise exception 'FAILED: payment deletion did not detach ledger';end if;

end$$;
select 'PASS: worker authorization, ownership, sandbox isolation, amount matching, duplicate checkout prevention, 200 points once, receipt once and donation confirmation' as result;
rollback;
