import { redirect } from 'next/navigation';
import { locale,supabase } from '@/lib/supabase';
import PageEditor from '@/components/PageEditor';
export default async function Page(){const db=await supabase();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');const {data:p}=await db.from('profiles').select('role,status').eq('id',user.id).single();if(p?.status!=='approved'||!['admin','super_admin'].includes(p.role))redirect('/dashboard');return <PageEditor l={await locale()}/>;}
