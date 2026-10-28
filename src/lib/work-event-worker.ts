import type { R2Bucket, RateLimit } from '@cloudflare/workers-types';
import type { PublicWorkDownloads, WorkEventDay } from '../content/work-events';
import { sumWorkEvents, workEventKey } from '../content/work-events';
import { decodeHistoryCursor, encodeHistoryCursor, HISTORY_CURSOR_PATTERN } from './work-download-cursor';
import { DOWNLOAD_CORRECTIONS_KEY, parseDownloadCorrections, type DownloadCorrection } from '../content/download-corrections';
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
type HistoryListing = {objects:{key:string;size:number}[]} & ({truncated:true;cursor:string}|{truncated:false;cursor?:string});
/** Structural read surface works with both generated Admin and website bindings. */
type WorkDownloadHistoryBucket = {
  get(key:string):Promise<{size:number;etag:string;json<T>():Promise<T>}|null>;
  list(options:{prefix:string;limit:number;cursor?:string}):Promise<HistoryListing>;
};
const slugPattern=/^[a-z0-9-]{1,80}$/;

const revisionPattern=/^[a-zA-Z0-9._-]{1,128}$/;
function eventDate(key:string) {
  const match=/^metrics\/works\/((?!0000)\d{4}-\d{2}-\d{2})\.json$/.exec(key);
  if(!match)return undefined;
  const timestamp=Date.parse(`${match[1]}T00:00:00.000Z`);
  return Number.isFinite(timestamp)&&new Date(timestamp).toISOString().slice(0,10)===match[1]?match[1]:undefined;
}

function historyContinuation(request:Request) {
  const params=new URL(request.url).searchParams;
  const cursor=params.get('cursor'),revision=params.get('revision');
  if([...params.keys()].some(key=>!['cursor','revision'].includes(key))||new Set(params.keys()).size!==params.size||
    [...params.keys()].length>2||params.size!==0&&(!cursor||!revision||!HISTORY_CURSOR_PATTERN.test(cursor)||!revisionPattern.test(revision)))return undefined;
  return {cursor,revision};
}

const historyHeaders={'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'};
const historyResponse=(body:unknown,status:number)=>new Response(JSON.stringify(body),{status,headers:historyHeaders});

async function correctionRevision(manifestEtag:string,correctionEtag:string) {
  const bytes=new TextEncoder().encode(JSON.stringify([manifestEtag,correctionEtag]));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return `corrected-${Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('')}`;
}

/** Read-only history projection shared by the public route and authenticated Admin. */
export async function workDownloadHistoryPage(request:Request,bucket:WorkDownloadHistoryBucket,context?:BackgroundContext,cache?:PublicMetricsCache):Promise<Response> {
  if(request.method!=='GET')return historyResponse({error:'Method not allowed.'},405);
  const continuation=historyContinuation(request);
  if(!continuation)return historyResponse({error:'Invalid history continuation.'},422);
  const {cursor,revision}=continuation;
  const external=(response:Response)=>{const result=new Response(response.body,response);result.headers.set('Cache-Control','no-store');return result;};
  try{
    const manifest=await bucket.get('data/works.json');
    if(!manifest||manifest.size>4*1024*1024)throw Error('Public manifest unavailable.');
    const catalogue=await manifest.json<{projects?:{slug?:unknown;type?:unknown}[]}>();
    if(!Array.isArray(catalogue.projects)||catalogue.projects.length>1000)throw Error('Invalid public manifest.');
    const slugs=new Set(catalogue.projects.map(project=>project.slug).filter((slug):slug is string=>typeof slug==='string'&&slugPattern.test(slug)));
    const correctionObject=await bucket.get(DOWNLOAD_CORRECTIONS_KEY);
    if(correctionObject&&correctionObject.size>1024*1024)throw Error('Oversized download corrections.');
    const registry=correctionObject?parseDownloadCorrections(await correctionObject.json()):undefined;
    const currentRevision=correctionObject?await correctionRevision(manifest.etag,correctionObject.etag):manifest.etag;
    const corrections=new Map<string,DownloadCorrection>();
    for(const project of catalogue.projects){
      if(typeof project.slug==='string'&&slugs.has(project.slug)&&project.type!=='bedrock'&&registry&&Object.hasOwn(registry.works,project.slug))corrections.set(project.slug,registry.works[project.slug]);
    }
    if(revision&&revision!==currentRevision)return historyResponse({error:'Public catalogue or download correction changed. Restart download statistics.'},409);
    // Every GET rechecks visibility and correction ETags before touching the cache.
    const cacheKey=new Request(`https://studiofimel.com/api/work-downloads?scope=all-time-corrections-v1&manifest=${encodeURIComponent(currentRevision)}&cursor=${encodeURIComponent(cursor??'')}`);
    try{
      const cached=await cache?.match(cacheKey);
      if(cached)return external(cached);
    }catch{/* A cache outage may fall back to a bounded R2 read. */}
    const rawCursor=cursor?await decodeHistoryCursor(cursor):undefined;
    if(cursor&&!rawCursor)return historyResponse({error:'Invalid history continuation.'},422);
    let listed:HistoryListing;
    try{listed=await bucket.list({prefix:'metrics/works/',limit:200,...(rawCursor?{cursor:rawCursor}:{})});}
    catch(error){if(cursor)return historyResponse({error:'Invalid history continuation.'},422);throw error;}
    if(listed.objects.length>200||listed.truncated&&listed.cursor===rawCursor)throw Error('Invalid history listing.');
    const nextCursor=listed.truncated?await encodeHistoryCursor(listed.cursor):undefined;
    const records=listed.objects.flatMap(object=>{const date=eventDate(object.key);return date?[{key:object.key,size:object.size,date}]:[];});
    const totals=new Map<string,number>();
    // The client adds segments. Seed the baseline exactly once, including when
    // no daily object exists yet for a newly published work.
    if(!cursor)for(const [slug,correction] of corrections)totals.set(slug,correction.value);
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
          const correction=corrections.get(slug);
          const clicks=!correction?counts.downloadClicks:day.date<correction.date?0:day.date===correction.date?Math.max(0,counts.downloadClicks-correction.anchorClicks):counts.downloadClicks;
          const total=(totals.get(slug)??0)+clicks;
          if(!Number.isSafeInteger(total))throw Error('Invalid event total.');
          totals.set(slug,total);
        }
      }
    }
    const data:PublicWorkDownloads={generatedAt:new Date().toISOString(),scope:'all-time',revision:currentRevision,
      segment:{objects:listed.objects.length,records:records.length,complete:!listed.truncated,...(nextCursor?{nextCursor}:{})},
      works:Object.fromEntries([...slugs].map(slug=>[slug,{downloadClicks:totals.get(slug)??null}]))};
    const response=new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'}});
    if(cache){const saved=cache.put(cacheKey,response.clone()).catch(()=>{});if(context)context.waitUntil(saved);else await saved;}
    return external(response);
  }catch{return historyResponse({error:'Download statistics unavailable.'},503);}
}

/** The public wrapper retains its origin, method and rate-limit boundary. */
export async function publicWorkDownloads(request:Request,bucket:R2Bucket|undefined,limiter:RateLimit|undefined,context:BackgroundContext,cache?:PublicMetricsCache) {
  const origin=request.headers.get('origin');
  const cors=(response:Response)=>{const result=new Response(response.body,response);result.headers.set('Vary','Origin');if(origin&&origins.has(origin))result.headers.set('Access-Control-Allow-Origin',origin);result.headers.set('Access-Control-Allow-Methods','GET, OPTIONS');return result;};
  if(origin&&!origins.has(origin))return cors(historyResponse({error:'Unsupported origin.'},403));
  if(request.method==='OPTIONS')return cors(new Response(null,{status:204,headers:historyHeaders}));
  if(request.method!=='GET'){const response=historyResponse({error:'Method not allowed.'},405);response.headers.set('Allow','GET, OPTIONS');return cors(response);}
  if(!historyContinuation(request))return cors(historyResponse({error:'Invalid history continuation.'},422));
  if(!bucket||!limiter)return cors(historyResponse({error:'Download statistics unavailable.'},503));
  try{
    if(!(await limiter.limit({key:`work-downloads:${request.headers.get('cf-connecting-ip')??'unknown'}`})).success)return cors(historyResponse({error:'Please try again later.'},429));
    return cors(await workDownloadHistoryPage(request,bucket,context,cache));
  }catch{return cors(historyResponse({error:'Download statistics unavailable.'},503));}
}
