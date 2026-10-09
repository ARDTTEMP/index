begin;
revoke all on public.dues_settings,public.membership_payments from anon,authenticated;
grant select on public.dues_settings,public.membership_payments to authenticated;
grant update(amount,period,instructions_fr,instructions_en,checkout_url,updated_at) on public.dues_settings to authenticated;
commit;
