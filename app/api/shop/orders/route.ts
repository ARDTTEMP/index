import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {supabase} from '@/lib/supabase';
import {notchConfigured,startNotchPayment} from '@/lib/notchpay';
import {rateLimit} from '@/lib/security';
export async function GET(){
 const db=await supabase();const {data:{user}}=await db.auth.getUser();
 if(!user)return NextResponse.json({error:'Connexion requise / Sign in required'},{status:401});
 const {data,error}=await db.from('shop_orders').select('id,buyer_id,seller_id,product_title,quantity,amount,seller_amount,commission,delivery_address,phone,payment_status,fulfillment,paid_out_at,created_at').order('created_at',{ascending:false}).limit(100);
 if(error)return NextResponse.json({error:'Commandes indisponibles / Orders unavailable'},{status:503});
 const {data:p}=await db.from('profiles').select('role').eq('id',user.id).single();
 return NextResponse.json({orders:data,viewer:{id:user.id,role:p?.role||''}},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(req:NextRequest){
 const origin=req.headers.get('origin');if(!origin||new URL(origin).host!==req.headers.get('host'))return NextResponse.json({error:'Forbidden origin'},{status:403});
 const db=await supabase();const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:'Connectez-vous pour commander / Sign in to order'},{status:401});
 try{
  const body=await req.json();const op=z.enum(['checkout','retry_payment','shipped','delivered','record_payout']).parse(body.op);
  if(op==='checkout'||op==='retry_payment'){
   if(!notchConfigured())return NextResponse.json({error:'Paiement temporairement indisponible / Payment temporarily unavailable'},{status:503});
   await rateLimit(user.id,'shop_checkout');let id:string;
   if(op==='checkout'){
    const data=z.object({request_key:z.string().uuid(),product_id:z.string().uuid(),quantity:z.number().int().min(1).max(20),delivery_address:z.string().trim().min(10).max(600),phone:z.string().trim().min(6).max(40)}).parse(body.data);
    const r=await db.rpc('shop_order_action',{p_action:'create',p_data:data});if(r.error)return NextResponse.json({error:r.error.message},{status:r.error.code==='42501'?403:400});id=r.data.id;
   }else{
    id=z.string().uuid().parse(body.data?.id);
    const {data:o}=await db.from('shop_orders').select('buyer_id').eq('id',id).single();if(o?.buyer_id!==user.id)return NextResponse.json({error:'Forbidden'},{status:403});
   }
   try{return NextResponse.json(await startNotchPayment('shop',id,user.id));}
   catch{return NextResponse.json({error:'Initialisation du paiement en attente de vérification. Retrouvez votre commande ci-dessous. / Payment initialization needs verification. Find your order below.',order_id:id},{status:503});}
  }
  const data=op==='record_payout'?z.object({id:z.string().uuid(),reference:z.string().trim().min(5).max(200)}).parse(body.data):z.object({id:z.string().uuid()}).parse(body.data);
  const {data:result,error}=await db.rpc('shop_order_action',{p_action:op,p_data:data});
  if(error)return NextResponse.json({error:error.message},{status:error.code==='42501'?403:400});
  return NextResponse.json(result);
 }catch{return NextResponse.json({error:'Vérifiez les champs / Check the fields'},{status:400});}
}
