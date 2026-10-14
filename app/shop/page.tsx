import {shopPricing} from "@/lib/shop-pricing";
import PageBlocks from "@/components/PageBlocks";
import {managedPage} from "@/lib/managed-pages";
import {locale} from "@/lib/supabase";
import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import ShopCatalog from '@/components/ShopCatalog';
export const metadata:Metadata={title:'Shop — Créations recyclées',description:'Découvrez les produits ARDTTEMP et les créations en plastique recyclé de fabricants certifiés.',alternates:{canonical:'/shop'}};
export default async function ShopPage(){const db=await supabase();const {data,error}=await db.from('shop_products').select('id,title,title_en,description,description_en,category,price,promotion_price,delivery,delivery_zone,delivery_zone_en,stock,photo_path,association_product').eq('status','published').order('created_at',{ascending:false}).limit(100);const blocks=await managedPage("/shop");return <>{blocks&&<div className="container"><PageBlocks blocks={blocks} l={await locale()}/></div>}<ShopCatalog l={await locale()} products={(data||[]).map(({delivery,promotion_price,price,...item})=>{const pricing=shopPricing(price,delivery,promotion_price);return {...item,price:pricing.total,original_price:pricing.original,reduction:pricing.reduction,promoted:pricing.promoted};})} unavailable={!!error} storageUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}/></>;}
