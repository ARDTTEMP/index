begin;
-- New dues must use verified Notch Pay; preserve historical rows and admin review.
revoke execute on function public.create_dues_payment() from public,anon,authenticated;
revoke execute on function public.submit_dues_payment(uuid,text,text,text) from public,anon,authenticated;
commit;
