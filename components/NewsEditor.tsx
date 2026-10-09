"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "./PublicForm";
import { optimizeImage } from "./MediaManager";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { text, type Locale } from "@/lib/domain";
type Article = { id:string; title_fr:string; title_en:string; content_fr:string; content_en:string; published:boolean; cover_image:string|null; author_name:string; published_at:string|null; created_at:string };
export default function NewsEditor({ initialData, act, l }: {
  initialData:{articles:Article[];total:number;page:number}; act:(b:Record<string,unknown>)=>Promise<unknown>; l:Locale;
}) {
  const [data,setData]=useState(initialData);
  const [editing,setEditing]=useState<Article|null>(null);
  const [file,setFile]=useState<File|null>(null);
  const [preview,setPreview]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [progress,setProgress]=useState("");
  const t=(fr:string,en:string)=>text(l,fr,en);
  useEffect(()=>{setData(initialData)},[initialData]);
  useEffect(()=>{if(!file){setPreview("");return;} const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file]);
  async function page(number:number) {
    setBusy(true);setError("");
    try {const response=await fetch(`/api/platform?view=admin/news&page=${number}`,{cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error);setData(result.data)}
    catch(e){setError(e instanceof Error?e.message:"Error")}
    finally{setBusy(false)}
  }
  async function change(row:Article,published:boolean) {
    setBusy(true);setError("");
    try{await act({op:"save_news",id:row.id,title_fr:row.title_fr,title_en:row.title_en,content_fr:row.content_fr,content_en:row.content_en,published});await page(data.page)}
    catch(e){setError(e instanceof Error?e.message:"Error")}
    finally{setBusy(false)}
  }
  return <div className="news-management">
    <section className="card news-composer">
      <p className="eyebrow">{t("PUBLICATION","PUBLISHING")}</p>
      <h2>{editing?t("Modifier l’article","Edit article"):t("Racontez votre actualité","Share your news")}</h2>
      <p>{t("Une couverture, votre récit et votre signature. L’article apparaîtra dans les actualités du site après publication.","A cover, your story and your byline. Your article will appear in the website news after publication.")}</p>
      <form key={editing?.id||"new"} className="form" onSubmit={async event=>{
        event.preventDefault();const form=event.currentTarget;const fd=new FormData(form);setBusy(true);setError("");
        try {
          const body:Record<string,unknown>={op:"save_news",...(editing?{id:editing.id}:{}),title_fr:fd.get("title_fr"),title_en:fd.get("title_en"),content_fr:fd.get("content_fr"),content_en:fd.get("content_en"),published:fd.get("published")==="on"};
          if(file){setProgress(t("Optimisation de la photo…","Optimizing photo…"));const optimized=await optimizeImage(file);if(optimized.size>5*1024*1024)throw new Error(t("La photo optimisée dépasse 5 Mo.","Optimized photo exceeds 5 MB."));
            setProgress(t("Envoi de la couverture…","Uploading cover…"));const signed=await api({op:"create_news_upload"});
            const {error}=await supabaseBrowser().storage.from("news-photos").uploadToSignedUrl(signed.path,signed.token,optimized,{contentType:"image/webp",cacheControl:"31536000",upsert:false});if(error)throw new Error(error.message);body.cover_path=signed.path;
          }
          setProgress(t("Enregistrement de l’article…","Saving article…"));await act(body);setEditing(null);setFile(null);form.reset();await page(1);
        }catch(e){setError(e instanceof Error?e.message:"Error")}finally{setBusy(false);setProgress("")}
      }}>
        <fieldset disabled={busy} className="news-fields">
          <label className="news-cover-picker">{t("Photo de couverture","Cover photo")}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>setFile(event.target.files?.[0]||null)}/>
            <small>{t("La même photo sera visible dans les actualités et dans l’article. Compression WebP automatique.","The same photo appears in the news list and article. Automatic WebP compression.")}</small>
          </label>
          {(preview||editing?.cover_image)&&<img className="news-cover-preview" src={preview||editing!.cover_image!} alt={t("Aperçu de la couverture","Cover preview")}/>}
          <div className="form-grid"><label>{t("Titre en français","French title")}<input name="title_fr" required minLength={2} maxLength={200} defaultValue={editing?.title_fr||""}/></label><label>{t("Titre en anglais","English title")}<input name="title_en" required minLength={2} maxLength={200} defaultValue={editing?.title_en||""}/></label></div>
          <label>{t("Article en français","French article")}<textarea name="content_fr" rows={12} required minLength={10} maxLength={50000} defaultValue={editing?.content_fr||""}/></label>
          <label>{t("Article en anglais","English article")}<textarea name="content_en" rows={12} required minLength={10} maxLength={50000} defaultValue={editing?.content_en||""}/></label>
          <label className="check"><input name="published" type="checkbox" defaultChecked={editing?.published??true}/><span>{t("Publier sur le site public","Publish on public website")}</span></label>
          <p className="form-note">{t("L’auteur et l’heure de première publication sont enregistrés automatiquement. Décochez pour conserver un brouillon.","The author and first publication time are saved automatically. Uncheck to keep a draft.")}</p>
          <div className="actions"><button className="button" disabled={busy}>{busy?t("En cours…","Saving…"):t("Enregistrer l’article","Save article")}</button>{editing&&<button type="button" className="button outline" onClick={()=>{setEditing(null);setFile(null)}}>{t("Annuler","Cancel")}</button>}</div>
        </fieldset>
      </form>
      {progress&&<p role="status" className="notice">{progress}</p>}
      {error&&<p role="alert" className="notice error">{error}</p>}
    </section>
    <section aria-label={t("Articles enregistrés","Saved articles")}>
      <div className="section-head"><h2>{t("Vos actualités","Your news")}</h2><span>{data.total} {t("articles","articles")}</span></div>
      <div className="news-admin-list">{data.articles?.map(row=><article className="card news-admin-item" key={row.id}>
        {row.cover_image&&<img src={row.cover_image} alt="" loading="lazy" decoding="async"/>}
        <div><span className="badge">{row.published?t("Publié","Published"):t("Brouillon","Draft")}</span><h3>{l==="fr"?row.title_fr:row.title_en}</h3><p>{row.author_name||"ARDTTEMP"} · {new Date(row.published_at||row.created_at).toLocaleString(l,{timeZone:"Africa/Douala",dateStyle:"medium",timeStyle:"short"})}</p>
        <div className="actions"><button disabled={busy} className="button outline small" onClick={()=>{setEditing(row);setFile(null)}}>{t("Modifier","Edit")}</button><button disabled={busy} className="button outline small" onClick={()=>void change(row,!row.published)}>{row.published?t("Dépublier","Unpublish"):t("Publier","Publish")}</button>{row.published&&<Link className="link" href={"/news/"+row.id} target="_blank" rel="noopener noreferrer">{t("Voir l’article ↗","View article ↗")}</Link>}<button type="button" className="danger" disabled={busy} onClick={async()=>{if(!confirm(t("Supprimer cette actualité ?","Delete this article?")))return;setBusy(true);try{await act({op:"delete_news",id:row.id});await page(1)}catch(e){setError(e instanceof Error?e.message:"Error")}finally{setBusy(false)}}}>{t("Supprimer","Delete")}</button></div></div>
      </article>)}</div>
      {data.total>20&&<nav className="actions" aria-label={t("Pagination des articles","Article pagination")}><button className="button outline" disabled={busy||data.page<=1} onClick={()=>void page(data.page-1)}>{t("Précédent","Previous")}</button><span>{data.page} / {Math.ceil(data.total/20)}</span><button className="button outline" disabled={busy||data.page*20>=data.total} onClick={()=>void page(data.page+1)}>{t("Suivant","Next")}</button></nav>}
    </section>
  </div>
}
