import {NextRequest,NextResponse} from 'next/server';
import {createHmac,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {workerClient} from '@/lib/supabase';
const cookie='ardttemp-reader';
export async function POST(req:NextRequest){
 try{
  const origin=req.headers.get('origin');if(!origin||new URL(origin).host!==req.headers.get('host'))return NextResponse.json({error:'Forbidden origin'},{status:403});
  const secret=process.env.EMAIL_WORKER_SECRET;if(!secret)throw Error('Unavailable');
  const input=z.object({id:z.string().uuid(),action:z.enum(['read','view','like','unlike','share'])}).parse(await req.json());
  const previous=req.cookies.get(cookie)?.value;const visitor=previous&&z.string().uuid().safeParse(previous).success?previous:randomUUID();
  const digest=(s:string)=>createHmac('sha256',secret).update(s).digest('hex');
  const db=workerClient();
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown';
  const limited=await db.rpc('check_rate_limit',{p_secret:secret,p_key:digest('news-rate:'+ip),p_limit:90,p_seconds:600});
  if(limited.error)throw Error('Unavailable');if(!limited.data)return NextResponse.json({error:'Veuillez patienter / Please try again later'},{status:429});
  // Known crawlers and link previews may read totals, but must not inflate them.
  const action=/(bot|crawler|spider|slurp|preview)/i.test(req.headers.get('user-agent')||'')?'read':input.action;
  const {data,error}=await db.rpc('record_news_engagement',{p_secret:secret,p_news:input.id,p_visitor:digest('news-reader:'+visitor),p_action:action});
  if(error)return NextResponse.json({error:'Article indisponible / Article unavailable'},{status:error.code==='P0002'?404:503});
  const result=NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
  if(visitor!==previous)result.cookies.set(cookie,visitor,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:31536000});
  return result;
 }catch{return NextResponse.json({error:'Compteurs temporairement indisponibles / Counters temporarily unavailable'},{status:503});}
}
