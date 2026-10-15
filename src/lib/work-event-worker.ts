import type { R2Bucket, RateLimit } from '@cloudflare/workers-types';
import type { WorkEventDay } from '../content/work-events';
import { workEventKey } from '../content/work-events';
const origins=new Set(['https://studiofimel.com','https://www.studiofimel.com','https://fimelstudio.github.io']);
export async function collectWorkEvent(request:Request,bucket:R2Bucket|undefined,limiter:RateLimit|undefined) {
  const origin=request.headers.get('origin');
  const headers=new Headers({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'});
  if(!origin||!origins.has(origin))return new Response(null,{status:403,headers});
  headers.set('Access-Control-Allow-Origin',origin);headers.set('Access-Control-Allow-Methods','POST, OPTIONS');headers.set('Access-Control-Allow-Headers','Content-Type');
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return new Response(null,{status:405,headers});
  if(!bucket||!limiter)return new Response(null,{status:503,headers});
  if(!(await limiter.limit({key:`work-events:${request.headers.get('cf-connecting-ip')??'unknown'}`})).success)return new Response(null,{status:429,headers});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return new Response(null,{status:415,headers});
  const reader=request.body?.getReader();if(!reader)return new Response(null,{status:422,headers});
  let raw='';let size=0;const decoder=new TextDecoder();
  for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>512){await reader.cancel();return new Response(null,{status:413,headers});}raw+=decoder.decode(chunk.value,{stream:true});}raw+=decoder.decode();
  let input:unknown;try{input=JSON.parse(raw);}catch{return new Response(null,{status:422,headers});}
  if(!input||typeof input!=='object'||!('slug'in input)||typeof input.slug!=='string'||!/^[a-z0-9-]{1,80}$/.test(input.slug)||!('kind'in input)||!['view','download'].includes(String(input.kind))||Object.keys(input).some(k=>!['slug','kind'].includes(k)))return new Response(null,{status:422,headers});
  try{
    const manifest=await bucket.get('data/works.json');if(!manifest)return new Response(null,{status:503,headers});
    const catalogue=await manifest.json<{projects:{slug:string;status:string;downloadUrl?:string;download?:string;latestReleaseRepo?:string}[]}>();
    const slug=input.slug;const project=catalogue.projects.find(p=>p.slug===slug);
    if(!project||input.kind==='download'&&(project.status!=='released'||!project.downloadUrl&&!project.download&&!project.latestReleaseRepo))return new Response(null,{status:404,headers});
    const date=new Date().toISOString().slice(0,10),key=workEventKey(date);
    for(let retry=0;retry<5;retry++){
      const stored=await bucket.get(key);const day:WorkEventDay=stored?await stored.json():{date,works:{}};
      const counts=Object.hasOwn(day.works,slug)?day.works[slug]:{views:0,downloadClicks:0};if(input.kind==='view')counts.views++;else counts.downloadClicks++;day.works[slug]=counts;
      const saved=await bucket.put(key,JSON.stringify(day),{onlyIf:stored?{etagMatches:stored.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json',cacheControl:'no-store'}});
      if(saved)return new Response(null,{status:204,headers});
    }
    return new Response(null,{status:503,headers});
  }catch{return new Response(null,{status:503,headers});}
}
