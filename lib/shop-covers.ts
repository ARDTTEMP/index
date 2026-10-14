import {z} from 'zod';
export const shopCover=z.object({path:z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i),alt_fr:z.string().trim().min(2).max(300),alt_en:z.string().trim().min(2).max(300),position:z.enum(['center','top','bottom'])});
export const shopCovers=z.array(shopCover).length(3).refine(s=>new Set(s.map(x=>x.path)).size===3);
export type ShopCover=z.infer<typeof shopCover>;
