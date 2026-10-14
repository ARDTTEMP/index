import {NextRequest,NextResponse} from 'next/server';
import {supabase} from '@/lib/supabase';
import {shopCovers} from '@/lib/shop-covers';
async function actor(){const db=await supabase();const {data:{user}}=await db.auth.getUser();if(!user)return null;const {data:p}=await db.from('profiles').select('id,role,status').eq('id',user.id).single();return p?.role==='super_admin'&&p.status==='approved'?{db,p}:null;}
export async function GET(){const a=await actor();if(!a)return NextResponse.json({error:'Super Admin requis / Super Admin required'},{status:403});const {data,error}=await a.db.from('shop_cover_settings').select('slides').eq('id',true).maybeSingle();if(error)return NextResponse.json({error:'Couvertures indisponibles / Covers unavailable'},{status:503});return NextResponse.json({slides:data?.slides||[]},{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:NextRequest){try{
 const origin=req.headers.get('origin');if(!origin||new URL(origin).host!==req.headers.get('host'))return NextResponse.json({error:'Forbidden origin'},{status:403});
 const a=await actor();if(!a)return NextResponse.json({error:'Super Admin requis / Super Admin required'},{status:403});
 if(req.headers.get('content-type')?.includes('multipart/form-data')){
 const file=(await req.formData()).get('file');if(!(file instanceof File)||!file.size||file.size>350*1024)throw Error('Image optimisée requise — 350 Ko maximum / Optimized image required — 350 KB maximum');
 const b=Buffer.from(await file.arrayBuffer());if(b.subarray(0,4).toString()!=='RIFF'||b.subarray(8,12).toString()!=='WEBP')throw Error('WebP requis / WebP required');
 const path=`${a.p.id}/${crypto.randomUUID()}.webp`;const {error}=await a.db.storage.from('shop-covers').upload(path,b,{contentType:'image/webp',cacheControl:'31536000',upsert:false});if(error)throw Error('Envoi impossible / Upload failed');return NextResponse.json({path});
 }
 const slides=shopCovers.parse((await req.json()).slides);const {error}=await a.db.rpc('save_shop_covers',{p_slides:slides});if(error)return NextResponse.json({error:error.message},{status:error.code==='42501'?403:400});return NextResponse.json({ok:true});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Vérifiez les trois images / Check all three images'},{status:400});}}
