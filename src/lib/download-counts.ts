import { supabase, isSupabaseConfigured } from './supabase';
// Activation is coordinated with the reviewed D1 migration. No service credentials in the browser.
const endpoint:string=import.meta.env.VITE_ANALYTICS_URL??'';
export const countsConfigured=!!endpoint||isSupabaseConfigured;
async function publicRequest(path:string,options:RequestInit={}){
  if(!/^https:\/\/[a-z0-9.-]+\/api\/download-counts$/.test(endpoint))throw new Error('Invalid statistics endpoint');
  const response=await fetch(`${endpoint}${path}`,{...options,cache:'no-store',signal:AbortSignal.timeout(10_000)});
  if(!response.ok)throw new Error(`Statistics HTTP ${response.status}`);return response.json();
}
export async function readDownloadCounts(slugs:string[]):Promise<Record<string,number>>{
  if(endpoint){const data=await publicRequest(`?slugs=${encodeURIComponent(slugs.join(','))}`) as {counts:Record<string,number>};return data.counts;}
  if(!supabase)return {};
  const {data,error}=await supabase.from('work_downloads').select('slug, download_count').in('slug',slugs);
  if(error)throw new Error(error.message);return Object.fromEntries((data??[]).map(row=>[row.slug,Number(row.download_count)]));
}
export async function incrementDownloadCount(slug:string):Promise<number>{
  if(endpoint){const data=await publicRequest('',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug})}) as {count:number};return data.count;}
  if(!supabase)return 0;const {data,error}=await supabase.rpc('increment_work_download',{p_slug:slug});if(error)throw new Error(error.message);return Number(data);
}
