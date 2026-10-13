import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ShopWorkspace from '@/components/ShopWorkspace';
export default async function Page(){const db=await supabase();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');const {data:p}=await db.from('profiles').select('id,role,status').eq('id',user.id).single();if(!p||p.status!=='approved')redirect('/dashboard');if(!['membre','admin','super_admin'].includes(p.role))redirect('/dashboard');return <ShopWorkspace profile={p}/>;}
