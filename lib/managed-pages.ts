import 'server-only';
import { supabase } from './supabase';
import { pageDocument } from './page-editor';
export async function managedPage(path:string){const db=await supabase();const {data}=await db.from('managed_pages').select('live_document').eq('path',path).maybeSingle();if(!data?.live_document)return null;const parsed=pageDocument.safeParse(data.live_document);return parsed.success?parsed.data:null;}
