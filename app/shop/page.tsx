import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import ShopCatalog from '@/components/ShopCatalog';
export const metadata:Metadata={title:'Shop — Créations recyclées',description:'Découvrez les produits ARDTTEMP et les créations en plastique recyclé de fabricants certifiés.',alternates:{canonical:'/shop'}};
export default async function ShopPage(){const db=await supabase();const {data,error}=await db.from('shop_products').select('id,title,description,category,price,delivery,delivery_zone,stock,photo_path,association_product').eq('status','published').order('created_at',{ascending:false}).limit(100);return <ShopCatalog products={data||[]} unavailable={!!error} storageUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}/>;}
