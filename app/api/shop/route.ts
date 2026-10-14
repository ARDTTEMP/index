import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
const product = z.object({title:z.string().trim().min(2).max(120),title_en:z.string().trim().min(2).max(120),description:z.string().trim().min(150).max(4000),description_en:z.string().trim().min(150).max(4000),price:z.number().int().min(1).max(100000000),promotion_price:z.number().int().min(1).max(100000000).nullable().optional(),delivery:z.number().int().min(0).max(10000000),delivery_zone:z.string().trim().min(2).max(300),delivery_zone_en:z.string().trim().min(2).max(300),stock:z.number().int().min(0).max(100000),photo_path:z.string().min(1).max(250)}).refine(p=>p.promotion_price==null||p.promotion_price<p.price);
async function actor(){const db=await supabase();const {data:{user}}=await db.auth.getUser();if(!user)return null;const {data:p}=await db.from('profiles').select('id,role,status').eq('id',user.id).single();if(!p||p.status!=='approved')return null;return {db,p};}
export async function GET(){const a=await actor();if(!a)return NextResponse.json({error:'Compte approuvé requis'},{status:403});const [s,p]=await Promise.all([a.db.from('shop_sellers').select('*, profiles!shop_sellers_user_id_fkey(full_name)').order('created_at',{ascending:false}).limit(200),a.db.from('shop_products').select('*').order('created_at',{ascending:false}).limit(200)]);if(s.error||p.error)return NextResponse.json({error:'Shop temporairement indisponible'},{status:503});const seller=s.data?.find((row:{user_id:string;status:string})=>row.user_id===a.p.id);
let balance=null;
if(a.p.role==='membre'&&seller&&['approved','suspended'].includes(seller.status)){
 const result=await a.db.rpc('shop_balance');if(result.error)return NextResponse.json({error:'Solde indisponible / Balance unavailable'},{status:503});balance=result.data;
}
return NextResponse.json({sellers:s.data,products:p.data,balance},{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:NextRequest){
 if(!req.headers.get('origin')||new URL(req.headers.get('origin')!).host!==req.headers.get('host'))return NextResponse.json({error:'Origine refusée'},{status:403});
 const a=await actor();if(!a)return NextResponse.json({error:'Compte approuvé requis'},{status:403});
 try{
 if(req.headers.get('content-type')?.includes('multipart/form-data')){
 const staff=['admin','super_admin'].includes(a.p.role);
 if(!staff){const {data:s}=await a.db.from('shop_sellers').select('status').eq('user_id',a.p.id).single();if(a.p.role!=='membre'||s?.status!=='approved')return NextResponse.json({error:'Activation vendeur requise'},{status:403});}
 const form=await req.formData();const file=form.get('file');if(!(file instanceof File)||file.size>250*1024||file.size===0)return NextResponse.json({error:'Photo invalide (250 Ko maximum)'},{status:400});
 const bytes=Buffer.from(await file.arrayBuffer());const webp=bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';if(!webp)return NextResponse.json({error:'Photo WebP optimisée requise'},{status:400});
 const path=`${a.p.id}/${crypto.randomUUID()}.webp`;const {error}=await a.db.storage.from('shop-photos').upload(path,bytes,{contentType:'image/webp',cacheControl:'31536000',upsert:false});if(error)return NextResponse.json({error:'Envoi de la photo impossible'},{status:400});return NextResponse.json({path});
 }
 const body=await req.json();const op=z.enum(['request_activation','review_seller','create_product','review_product','set_promotion','update_product','delete_product']).parse(body.op);let d;
 const staff=['admin','super_admin'].includes(a.p.role);
 if(op==='review_seller'&&a.p.role!=='super_admin'||['review_product','delete_product'].includes(op)&&!staff||op==='request_activation'&&a.p.role!=='membre')return NextResponse.json({error:'Autorisation insuffisante'},{status:403});
 if(['update_product','set_promotion'].includes(op)){const id=z.string().uuid().parse(body.data?.id);const {data:item}=await a.db.from('shop_products').select('owner_id').eq('id',id).single();if(!item||item.owner_id!==a.p.id)return NextResponse.json({error:'Seul l’auteur peut modifier ce produit'},{status:403});}
 if(op==='create_product'||op==='update_product'){
 if(!staff){const {data:s}=await a.db.from('shop_sellers').select('status').eq('user_id',a.p.id).single();if(a.p.role!=='membre'||s?.status!=='approved')return NextResponse.json({error:'Activation vendeur requise'},{status:403});}d={...product.parse(body.data),category:'Maison et décoration',...(op==='update_product'?{id:z.string().uuid().parse(body.data.id)}:{})};
 }else if(op==='set_promotion')d=z.object({id:z.string().uuid(),promotion_price:z.number().int().min(1).max(100000000).nullable()}).parse(body.data);
 else if(op==='delete_product')d=z.object({id:z.string().uuid()}).parse(body.data);
 else if(op==='request_activation')d=z.object({motivation:z.string().trim().min(10).max(2000)}).parse(body.data);
 else d=z.object({id:z.string().uuid(),status:z.enum(op==='review_seller'?['approved','rejected','suspended']:['published','rejected','archived'])}).parse(body.data);
 const {data,error}=await a.db.rpc('shop_action',{p_action:op,p_data:d});if(error)return NextResponse.json({error:error.message},{status:error.code==='42501'?403:400});return NextResponse.json(data);
 }catch{return NextResponse.json({error:'Vérifiez les champs du formulaire'},{status:400});}
}
