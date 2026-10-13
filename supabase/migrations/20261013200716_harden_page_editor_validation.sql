begin;
create or replace function public.save_managed_page(p_path text,p_document jsonb,p_publish boolean,p_expected_revision bigint) returns bigint language plpgsql security definer set search_path='' as $$
declare b jsonb; k text; r bigint;
begin
 if not private.is_admin() then raise exception 'Admin approuvé requis' using errcode='42501'; end if;
 if p_publish is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'Paramètres de publication requis';end if;
 if p_path is null or p_path not in ('/','/about','/activities','/contact','/join','/donate','/news','/gallery','/shop') then raise exception 'Page non autorisée';end if;
 if jsonb_typeof(p_document) is distinct from 'array' or jsonb_array_length(p_document)>40 then raise exception '40 blocs maximum';end if;
 if p_publish and jsonb_array_length(p_document)=0 then raise exception 'Ajoutez du contenu avant publication';end if;
 for b in select * from jsonb_array_elements(p_document) loop
  if coalesce(b->>'type','') not in ('heading','paragraph','list','image','video','link') then raise exception 'Bloc invalide';end if;
  if coalesce(b->>'align','') not in ('left','center','right') or coalesce(b->>'font','') not in ('century','times') or coalesce(b->>'size','') not in ('16','20','28','36','48') or coalesce(b->>'color','') not in ('#193529','#166534','#555555','#9a3412') then raise exception 'Mise en forme invalide';end if;
  if coalesce(b->>'width','') not in ('25','50','75','100') or coalesce(b->>'crop','') not in ('auto','square','wide','portrait') or coalesce(b->>'position','') not in ('center','top','bottom') then raise exception 'Format image invalide';end if;
  if coalesce(b->>'margin','16') not in ('0','8','16','24') or coalesce(b->>'radius','16') not in ('0','8','16','24') then raise exception 'Espacement invalide';end if;
  foreach k in array array['fr','en'] loop
   if jsonb_typeof(b->k) is distinct from 'string' or length(coalesce(b->>k,''))>10000 then raise exception 'Texte invalide';end if;
   if p_publish and length(trim(coalesce(b->>k,'')))<2 then raise exception 'Français et anglais obligatoires';end if;
  end loop;
  if b->>'type'='image' then
   if not exists(select 1 from storage.objects where bucket_id='page-photos' and name=b->>'path') then raise exception 'Photo non enregistrée';end if;
   if p_publish and (length(trim(coalesce(b->>'alt_fr','')))<2 or length(trim(coalesce(b->>'alt_en','')))<2) then raise exception 'Description photo FR/EN obligatoire';end if;
  elsif b->>'type'='video' then
   if coalesce(b->>'provider','') not in ('youtube','vimeo','dailymotion') or coalesce(b->>'video_id','') !~ '^[A-Za-z0-9_-]{1,40}$' then raise exception 'Vidéo externe invalide';end if;
  elsif b->>'type'='link' then
   if coalesce(b->>'href','') !~ '^https://[^[:space:]<>]+$' then raise exception 'Lien HTTPS requis';end if;
  end if;
 end loop;
 insert into public.managed_pages(path) values(p_path) on conflict do nothing;
 select revision into r from public.managed_pages where path=p_path for update;
 if r<>p_expected_revision then raise exception 'Cette page a été modifiée. Rechargez avant de sauvegarder.' using errcode='40001';end if;
 r:=r+1;
 update public.managed_pages set revision=r,updated_at=now(),live_document=case when p_publish then p_document else live_document end where path=p_path;
 insert into public.managed_page_versions(path,document,revision,published,author_id) values(p_path,p_document,r,p_publish,auth.uid());
 return r;
end;$$;
commit;
