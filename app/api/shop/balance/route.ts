import {NextResponse} from 'next/server';
import {supabase} from '@/lib/supabase';
export async function GET(){const db=await supabase();const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});const {data,error}=await db.rpc('shop_balance');if(error)return NextResponse.json({error:'Solde indisponible / Balance unavailable'},{status:error.code==='42501'?403:503});return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});}
