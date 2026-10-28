import type { R2Bucket, R2Objects, RateLimit } from '@cloudflare/workers-types';
import type { PublicWorkDownloads, WorkEventDay } from '../content/work-events';
import { sumWorkEvents, workEventKey } from '../content/work-events';
import { decodeHistoryCursor, encodeHistoryCursor, HISTORY_CURSOR_PATTERN } from './work-download-cursor';
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
    const catalogue=await manifest.json<{projects:{slug:string;status:string;downloadUrl?:string;download?:string;latestReleaseRepo?:string;store?:string;releasePage?:string}[];releases?:Record<string,{status:string;files:unknown[]}[]>}>();
    const slug=input.slug;const project=catalogue.projects.find(p=>p.slug===slug);
    const publicFiles=catalogue.releases?.[slug]?.some(release=>release.status==='released'&&release.files?.length);
    if(!project||input.kind==='download'&&(project.status!=='released'||!project.downloadUrl&&!project.download&&!project.latestReleaseRepo&&!project.store&&!project.releasePage&&!publicFiles))return new Response(null,{status:404,headers});
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

type PublicMetricsCache = Pick<Cache, 'match' | 'put'>;
type BackgroundContext = {waitUntil(promise:Promise<unknown>):void};
const slugPattern=/^[a-z0-9-]{1,80}$/;

const revisionPattern=/^[a-zA-Z0-9._-]{1,128}$/;
function eventDate(key:string) {
  const match=/^metrics\/works\/((?!0000)\d{4}-\d{2}-\d{2})\.json$/.exec(key);
  if(!match)return undefined;
  const timestamp=Date.parse(`${match[1]}T00:00:00.000Z`);
  return Number.isFinite(timestamp)&&new Date(timestamp).toISOString().slice(0,10)===match[1]?match[1]:undefined;
}

/** Read-only, paged history projection. Only the client combines every completed segment. */
export async function publicWorkDownloads(request:Request,bucket:R2Bucket|undefined,limiter:RateLimit|undefined,context:BackgroundContext,cache?:PublicMetricsCache) {
  const headers=new Headers({'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Vary':'Origin'});
  const origin=request.headers.get('origin');
  const respond=(body:unknown,status:number)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!origins.has(origin))return respond({error:'Unsupported origin.'},403);
  if(origin)headers.set('Access-Control-Allow-Origin',origin);
  headers.set('Access-Control-Allow-Methods','GET, OPTIONS');
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='GET'){headers.set('Allow','GET, OPTIONS');return respond({error:'Method not allowed.'},405);}
  const params=new URL(request.url).searchParams;
  const cursor=params.get('cursor'),revision=params.get('revision');
  if([...params.keys()].some(key=>!['cursor','revision'].includes(key))||new Set(params.keys()).size!==params.size||
    [...params.keys()].length>2||params.size!==0&&(!cursor||!revision||!HISTORY_CURSOR_PATTERN.test(cursor)||!revisionPattern.test(revision)))return respond({error:'Invalid history continuation.'},422);
  if(!bucket||!limiter)return respond({error:'Download statistics unavailable.'},503);
  // Only our internal cache retains responses. Each external GET rechecks public visibility.
  const withCors=(response:Response)=>{const result=new Response(response.body,response);if(origin)result.headers.set('Access-Control-Allow-Origin',origin);result.headers.set('Vary','Origin');result.headers.set('Cache-Control','no-store');return result;};
  try{
    if(!(await limiter.limit({key:`work-downloads:${request.headers.get('cf-connecting-ip')??'unknown'}`})).success)return respond({error:'Please try again later.'},429);
    const manifest=await bucket.get('data/works.json');
    if(!manifest||manifest.size>4*1024*1024)throw Error('Public manifest unavailable.');
    const catalogue=await manifest.json<{projects?:{slug?:unknown}[]}>();
    if(!Array.isArray(catalogue.projects)||catalogue.projects.length>1000)throw Error('Invalid public manifest.');
    const slugs=new Set(catalogue.projects.map(project=>project.slug).filter((slug):slug is string=>typeof slug==='string'&&slugPattern.test(slug)));
    if(revision&&revision!==manifest.etag)return respond({error:'Public catalogue changed. Restart download statistics.'},409);
    // Publication/unpublication changes the ETag, so old cached slugs can never survive it.
    const cacheKey=new Request(`https://studiofimel.com/api/work-downloads?scope=all-time-v1&manifest=${encodeURIComponent(manifest.etag)}&cursor=${encodeURIComponent(cursor??'')}`);
    try{
      const cached=await cache?.match(cacheKey);
      if(cached)return withCors(cached);
    }catch{/* A cache outage may fall back to a bounded R2 read. */}
    const rawCursor=cursor?await decodeHistoryCursor(cursor):undefined;
    if(cursor&&!rawCursor)return respond({error:'Invalid history continuation.'},422);
    let listed:R2Objects;
    try{listed=await bucket.list({prefix:'metrics/works/',limit:200,...(rawCursor?{cursor:rawCursor}:{})});}
    catch(error){if(cursor)return respond({error:'Invalid history continuation.'},422);throw error;}
    if(listed.objects.length>200||listed.truncated&&listed.cursor===rawCursor)throw Error('Invalid history listing.');
    const nextCursor=listed.truncated?await encodeHistoryCursor(listed.cursor):undefined;
    const records=listed.objects.flatMap(object=>{const date=eventDate(object.key);return date?[{key:object.key,size:object.size,date}]:[];});
    const totals=new Map<string,number>();
    // At most 200 listed objects per invocation, five reads concurrently. The next
    // segment runs in a separate HTTP request, below Free's internal-subrequest cap.
    for(let offset=0;offset<records.length;offset+=5){
      const days=await Promise.all(records.slice(offset,offset+5).map(async record=>{
        if(record.size>1024*1024)throw Error('Oversized event record.');
        const object=await bucket.get(record.key);if(!object)throw Error('History changed during read.');
        if(object.size>1024*1024)throw Error('Oversized event record.');
        const day=await object.json<WorkEventDay>();
        if(day.date!==record.date||!day.works||typeof day.works!=='object'||Array.isArray(day.works)||Object.keys(day.works).length>1000)throw Error('Invalid event record.');
        return day;
      }));
      for(const day of days){
        const events=Object.entries(day.works).filter(([slug])=>slugs.has(slug)).map(([slug,counts])=>{
          if(!counts||![counts.views,counts.downloadClicks].every(count=>Number.isSafeInteger(count)&&count>=0))throw Error('Invalid event count.');
          return {slug,...counts};
        });
        for(const [slug,counts] of sumWorkEvents(events)){
          const total=(totals.get(slug)??0)+counts.downloadClicks;
          if(!Number.isSafeInteger(total))throw Error('Invalid event total.');
          totals.set(slug,total);
        }
      }
    }
    const data:PublicWorkDownloads={generatedAt:new Date().toISOString(),scope:'all-time',revision:manifest.etag,
      segment:{objects:listed.objects.length,records:records.length,complete:!listed.truncated,...(nextCursor?{nextCursor}:{})},
      works:Object.fromEntries([...slugs].map(slug=>[slug,{downloadClicks:totals.get(slug)??null}]))};
    const response=new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'}});
    if(cache)context.waitUntil(cache.put(cacheKey,response.clone()).catch(()=>{}));
    return withCors(response);
  }catch{return respond({error:'Download statistics unavailable.'},503);}
}
