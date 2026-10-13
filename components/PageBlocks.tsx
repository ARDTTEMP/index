import type { PageBlock } from '@/lib/page-editor';
import type { Locale } from '@/lib/domain';
import ExternalVideo from './ExternalVideo';
export default function PageBlocks({blocks,l}:{blocks:PageBlock[];l:Locale}){return <div className="cms-content">{blocks.map((b,i)=>{const value=b[l];const style={textAlign:b.align,fontFamily:b.font==='times'?'"Times New Roman",Times,serif':'"Century Gothic",Arial,sans-serif',fontSize:`clamp(16px,4vw,${b.size}px)`,color:b.color,fontWeight:b.bold?700:400,fontStyle:b.italic?'italic':'normal',textDecoration:b.underline?'underline':'none'} as const;
 if(b.type==='image'&&b.path){const ratio={auto:undefined,square:'1 / 1',wide:'16 / 9',portrait:'3 / 4'}[b.crop];return <figure key={i} className={`cms-photo cms-${b.align}`} style={{width:b.width+'%',padding:b.margin+'px'}}><img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/page-photos/${b.path}`} alt={b[l==='fr'?'alt_fr':'alt_en']||''} loading="lazy" decoding="async" style={{width:'100%',aspectRatio:ratio,objectFit:'cover',objectPosition:b.position,borderRadius:b.radius+'px'}}/><figcaption style={style}>{value}</figcaption></figure>;}
 if(b.type==='video'&&b.provider&&b.video_id)return <figure key={i} className="cms-clear"><ExternalVideo provider={b.provider} id={b.video_id} title={value} label={l==='fr'?'Lire la vidéo':'Play video'}/></figure>;
 if(b.type==='heading')return i===0?<h1 key={i} style={style}>{value}</h1>:<h2 key={i} style={style}>{value}</h2>;
 if(b.type==='list')return <ul key={i} style={style}>{value.split('\n').filter(Boolean).map((line,n)=><li key={n}>{line}</li>)}</ul>;
 if(b.type==='link')return <p key={i} style={style}><a href={b.href} target="_blank" rel="noopener noreferrer">{value}</a></p>;
 return <p key={i} style={{...style,whiteSpace:'pre-wrap'}}>{value}</p>;})}<div className="cms-clear"/></div>;}
