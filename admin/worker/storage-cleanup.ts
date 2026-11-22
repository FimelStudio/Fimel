import type { Asset, Library, Upload, Work } from '../shared/model';
import { PUBLIC_ORIGIN } from '../shared/model';
import type { DocsLibrary } from '../shared/docs';
import { DEFAULT_STORAGE_POLICY, storageId, storageKind, storagePolicyErrors } from '../shared/storage';
import type { StorageBucket, StorageItem, StoragePolicy, StorageScan } from '../shared/storage';
import { ApiError, EMPTY_ETAG, expectMatch, json, putJson, readJson } from './http';
import { actorKey } from './audit';
import { readStorageGate, withStorageCleaner } from './storage-gate';
import { storageRecovery } from './storage-recovery';
import { validateLibrary } from '../shared/validation';
import { docsLibraryErrors } from '../shared/docs';
import { docsMarkdownImages, parseDocsManifest } from '../../src/content/docs';
import { parseCatalogue } from '../../src/content/projects';
import { siteContentErrors } from '../../src/content/site-content';

type StorageEnv = { PRIVATE: R2Bucket; PUBLIC: R2Bucket; ASSETS: Fetcher };
const POLICY = 'maintenance/policy.json';
const LATEST = 'maintenance/latest-scan.json';
const AUTO = 'maintenance/automatic.json';
const ROOTS: [StorageBucket, string][] = [['private','state/library.json'],['private','state/docs.json'],['private','state/site.json'],['public','data/works.json'],['public','data/docs.json']];
const DAY = 86_400_000;
const idPattern = /^[a-zA-Z0-9-]{1,80}$/;
const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const managedAsset = new RegExp(`^(?:uploads/verified/${uuid}/|docs/uploads/[^/]+/${uuid}/|docs/images/[^/]+/${uuid}/|images/[^/]+/[^/]+/${uuid}/|works/[^/]+/[^/]+/[^/]+-${uuid}/)`);
const bucket = (env: StorageEnv, name: StorageBucket) => name === 'private' ? env.PRIVATE : env.PUBLIC;
const scanKey = (id: string) => `maintenance/scans/${id}.json`;
const pageKey = (id:string, page:number) => `maintenance/pages/${id}/${String(page).padStart(6,'0')}.json`;
const historyGroup = (item:StorageItem) => storageId(item.bucket,item.key.startsWith('snapshots/')&&!item.key.startsWith('snapshots/docs/')?'snapshots/works':item.key.split('/').slice(0,2).join('/'));
function recentHistory(items:StorageItem[]) {
  const groups=new Map<string,StorageItem[]>();
  for(const item of items){const group=historyGroup(item),list=groups.get(group)??[];list.push(item);groups.set(group,list);}
  return [...groups.values()].flatMap(items=>items.sort((a,b)=>b.uploaded.localeCompare(a.uploaded)||a.key.localeCompare(b.key)).slice(0,10));
}
function pinReport(scan:StorageScan,id:string){protect(scan,'private',scanKey(id));scan.refs.push(`prefix:private:maintenance/pages/${id}/`);}
function summary(scan:StorageScan):StorageScan {
  if(scan.format===2)return {...scan,listedRefs:[],refs:[],queue:[],recentHistory:[],revisions:{},referenceCount:scan.queue.length};
  // Old unpaged reports remain readable, but cannot resume or authorize deletion.
  return {...scan,objectCount:scan.items.length,totals:{private:{objects:scan.items.filter(i=>i.bucket==='private').length,bytes:scan.items.filter(i=>i.bucket==='private').reduce((n,i)=>n+i.size,0)},public:{objects:scan.items.filter(i=>i.bucket==='public').length,bytes:scan.items.filter(i=>i.bucket==='public').reduce((n,i)=>n+i.size,0)}},items:[],refs:[],queue:[]};
}
async function loadPage(env:StorageEnv,scan:StorageScan,page:number){
  if(scan.format!==2||!Number.isInteger(page)||page<0||page>=(scan.pageCount??0))throw new ApiError(422,'扫描分页无效，请重新扫描。');
  const stored=await record<StorageItem[]>(env.PRIVATE,pageKey(scan.id,page));
  if(!stored||!Array.isArray(stored.value)||stored.value.length>50||stored.value.some(item=>item.page!==page))throw new ApiError(503,'扫描分页不完整，请重新扫描；未执行删除。');
  return stored;
}

async function record<T>(store: R2Bucket, key: string): Promise<{ value: T; etag: string; metadata?:Record<string,string> } | null> {
  const object = await store.get(key); if (!object) return null;
  if (object.size > 12_000_000) { await object.body.cancel(); throw new ApiError(503, '引用记录超过扫描上限，已停止清理。'); }
  try { return { value: await object.json<T>(), etag: object.httpEtag, metadata:object.customMetadata }; }
  catch { throw new ApiError(503, '引用或维护记录损坏，已停止清理。'); }
}
async function policy(env: StorageEnv) {
  const stored = await record<StoragePolicy>(env.PRIVATE, POLICY);
  if (stored && storagePolicyErrors(stored.value)) throw new ApiError(503, '清理策略损坏，未执行删除。');
  return { value: stored?.value ?? { ...DEFAULT_STORAGE_POLICY }, etag: stored?.etag ?? EMPTY_ETAG };
}
function parseReference(value:unknown,parse:(value:unknown)=>unknown){
  try{parse(value);}catch{throw new ApiError(503,'引用目录格式无效，已停止清理。',{retryable:false});}
}
async function referenceJson<T>(object:R2ObjectBody):Promise<T>{
  try{return await object.json<T>();}catch(error){if(error instanceof SyntaxError)throw new ApiError(503,'历史引用记录的 JSON 损坏，已停止清理。',{retryable:false});throw error;}
}
function protect(scan: StorageScan, name: StorageBucket, key: string) {
  const indexed=scan as StorageScan&{_refs?:Set<string>;_queue?:Set<string>};
  // Request-local indexes are non-enumerable and never persisted in job JSON.
  if(!indexed._refs)Object.defineProperties(indexed,{_refs:{value:new Set(scan.refs)},_queue:{value:new Set(scan.queue)}});
  const refs=indexed._refs!,queue=indexed._queue!,id=storageId(name,key);
  if(!refs.has(id)){refs.add(id);scan.refs.push(id);}
  if (name === 'public' && key.startsWith('content/') && key.endsWith('.md') && !queue.has(id)){queue.add(id);scan.queue.push(id);}
  const match = /^uploads\/verified\/([^/]+)\//.exec(key);
  if (name === 'private' && match) { const session = storageId('private',`uploads/sessions/${match[1]}.json`); if (!refs.has(session)){refs.add(session);scan.refs.push(session);} }
  if (scan.refs.length > 40_000 || scan.queue.length > 20_000) throw new ApiError(503, '引用数量超过本轮扫描上限，未执行删除。');
}
function references(scan: StorageScan, value: unknown, depth = 0): void {
  if (depth > 40) throw new ApiError(503, '引用层级异常，已停止清理。');
  if (typeof value === 'string') {
    if (/^(uploads\/verified\/|docs\/uploads\/)/.test(value)) protect(scan,'private',value);
    if(!value.includes(PUBLIC_ORIGIN+'/'))return;
    const indexed=scan as StorageScan&{_urls?:Set<string>};
    if(!indexed._urls)Object.defineProperty(indexed,'_urls',{value:new Set<string>()});
    for (const match of value.matchAll(/https:\/\/download\.studiofimel\.com\/[^\s<>"')\]\\]+/g)) {
      const raw=match[0];if(indexed._urls!.has(raw))continue;indexed._urls!.add(raw);
      try { const url = new URL(raw); if (url.origin === PUBLIC_ORIGIN) protect(scan,'public',decodeURIComponent(url.pathname.slice(1))); }
      catch { throw new ApiError(503, '资源引用地址异常，已停止清理。'); }
    }
  } else if (Array.isArray(value)) for (const item of value) references(scan,item,depth+1);
  else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) references(scan,item,depth+1);
    // Also reserve deterministic publication destinations for all saved assets,
    // including drafts and archived entries that may be restored or republished.
    const library = value as Partial<Library>;
    if (Array.isArray(library.works)) for (const work of library.works) {
      if (!work?.project?.slug || !Array.isArray(work.gallery) || !Array.isArray(work.versions)) throw new ApiError(503,'作品引用记录异常，已停止清理。');
      for (const asset of work.gallery) protectAsset(scan,work,asset);
      for (const release of work.versions) for (const asset of release.files) protectAsset(scan,work,asset,release.label);
    }
    const docs = value as Partial<DocsLibrary>;
    if (Array.isArray(docs.documents)) for (const doc of docs.documents) if (Array.isArray(doc.images)) for (const asset of doc.images) protect(scan,'public',`docs/images/${doc.slug}/${asset.id}/${asset.name}`);
  }
}
function protectAsset(scan: StorageScan, work: Work, asset: Asset, label?: string) {
  if (asset.privateKey) protect(scan,'private',asset.privateKey);
  protect(scan,'public',`${label === undefined?'images':'works'}/${work.project.type}/${work.project.slug}/${label === undefined?asset.id:label+'-'+asset.id}/${asset.name}`);
}
async function rootStep(env:StorageEnv,scan:StorageScan){
  const index=scan.rootRead??0;
  if(index<ROOTS.length){
    const [name,key]=ROOTS[index];
    const stored = await record<unknown>(bucket(env,name),key); scan.revisions[storageId(name,key)] = stored?.etag ?? EMPTY_ETAG;
    if (stored) {
      if (!stored.value || typeof stored.value !== 'object') throw new ApiError(503,'当前目录格式异常，已停止清理。');
      if(key==='state/library.json'&&validateLibrary(stored.value).length||key==='state/docs.json'&&docsLibraryErrors(stored.value).length)throw new ApiError(503,'当前草稿库无效，已停止清理。');
      if(key==='data/works.json')parseReference(stored.value,parseCatalogue);
      if(key==='data/docs.json')parseReference(stored.value,parseDocsManifest);
      if(key==='state/site.json'&&siteContentErrors((stored.value as {site?:unknown}).site).length)throw new ApiError(503,'网站草稿格式无效，已停止清理。');
      references(scan,stored.value);
    }

  }else{
    if(scan.revisions['private:state/library.json']===EMPTY_ETAG||scan.revisions['public:data/works.json']===EMPTY_ETAG)throw new ApiError(503,'缺少当前作品库或公开目录，无法安全判断引用，已停止清理。');
    const source=await env.ASSETS.fetch(new Request('https://storage.invalid/migration/library.json'));
    if(!source.ok)throw new ApiError(503,'无法核对官网原始资源清单，已停止清理。');
    const original=await source.json<Library>();if(!Array.isArray(original.works))throw new ApiError(503,'官网原始资源清单无效。');
    references(scan,original);pinReport(scan,scan.id);
    const automatic=await record<{id:string}>(env.PRIVATE,AUTO);if(automatic)pinReport(scan,automatic.value.id);
    scan.status='inventory';
  }
  scan.rootRead=index+1;
}
function historicalReferences(scan: StorageScan, key: string, value: unknown) {
  const wrapper=value as {value?:unknown};
  const body=key.startsWith('backups/')?wrapper?.value:value;
  // The first publication legitimately backs up a missing public manifest.
  if(key.startsWith('backups/')&&body===null&&wrapper&&Object.hasOwn(wrapper,'value'))return;
  if(!body||typeof body!=='object')throw new ApiError(503,'历史恢复记录不完整，已停止清理。');
  if(key.startsWith('backups/library/')&&validateLibrary(body).length||key.startsWith('backups/docs/')&&docsLibraryErrors(body).length)throw new ApiError(503,'历史恢复记录校验失败，已停止清理。');
  if(/^(backups\/public\/|snapshots\/(?!docs\/)|data\/snapshots\/)/.test(key))parseReference(body,parseCatalogue);
  if(/^(backups\/docs-public\/|snapshots\/docs\/|data\/docs-snapshots\/)/.test(key))parseReference(body,parseDocsManifest);
  if(key.startsWith('backups/site/')&&siteContentErrors((body as {site?:unknown}).site).length)throw new ApiError(503,'网站历史记录无效，已停止清理。');
  references(scan,body);
}
async function startScan(env: StorageEnv, restart=false) {
  const settings = await policy(env);
  const previous=await record<{id:string}>(env.PRIVATE,LATEST);
  if(previous&&!restart){
    const active=await record<StorageScan>(env.PRIVATE,scanKey(previous.value.id));
    if(active?.value.algorithm===3&&active.value.status!=='ready'&&Date.now()-Date.parse(active.value.createdAt)<DAY&&active.value.revisions.policy===settings.etag)return {scan:active.value,etag:active.etag};
  }
  const scan: StorageScan = { id: crypto.randomUUID(), createdAt: new Date(Date.now()).toISOString(), status: 'roots', algorithm:3, listedRefs:[], warnings:[], format:2, rootRead:0, pageCount:0, classifyPage:0, objectCount:0, recentHistory:[], candidatePages:[], totals:{private:{objects:0,bytes:0},public:{objects:0,bytes:0}}, bucket: 'private', items: [], refs: [], queue: [], read: 0, revisions: {}, policy: settings.value, deleted: [], skipped: [] };
  scan.revisions['policy'] = settings.etag;
  const saved = await putJson(env.PRIVATE,scanKey(scan.id),scan);
  try{await putJson(env.PRIVATE,LATEST,{ id: scan.id },previous?.etag??EMPTY_ETAG);}
  catch(error){
    if(!(error instanceof ApiError)||error.status!==409)throw error;
    const pointer=await record<{id:string}>(env.PRIVATE,LATEST),winner=pointer?await record<StorageScan>(env.PRIVATE,scanKey(pointer.value.id)):null;
    if(winner?.value.algorithm!==3)throw error;
    return {scan:winner.value,etag:winner.etag};
  }
  return { scan, etag: saved.httpEtag };
}
function age(item: StorageItem, now: number) { return (now-Date.parse(item.uploaded))/DAY; }
function classify(scan: StorageScan,items:StorageItem[]) {
  const refs=new Set(scan.refs),prefixes=scan.refs.filter(ref=>ref.startsWith('prefix:')).map(ref=>ref.slice(7)),now=Date.now();
  const recent=new Set((scan.recentHistory??[]).map(item=>storageId(item.bucket,item.key)));
  for (const item of items) {
    const id=storageId(item.bucket,item.key); item.eligible=false;
    const active=prefixes.some(prefix=>id.startsWith(prefix));
    if (refs.has(id) || active) { item.reason='被草稿、公开内容、素材库或历史记录引用';continue; }
    if (item.kind==='system') { item.reason='系统数据、统计、审计或非托管文件，保留';continue; }
    if (item.kind==='asset'&&!managedAsset.test(item.key)) { item.reason='历史或人工上传文件，保留待人工核对';continue; }
    if (recent.has(id)) { item.reason='每类最近 10 份历史记录，保留';continue; }
    const days=item.kind==='temporary'?scan.policy.temporaryDays:item.kind==='history'?scan.policy.historyDays:item.bucket==='public'?scan.policy.publicDays:scan.policy.privateDays;
    if (age(item,now)<days) { item.reason=`处于 ${days} 天保留期`;continue; }
    item.eligible=true;
    item.reason=item.kind==='temporary'?'过期且无活动会话的临时上传':item.kind==='history'?'超过保留期的历史记录（引用资源本轮仍保留）':item.kind==='receipt'?'不再使用的上传会话或分片凭证':'未被任何已保存内容和现存历史记录引用';
  }
}
async function stepScan(env: StorageEnv, scan: StorageScan) {
  if(scan.format!==2||scan.algorithm!==3)throw new ApiError(409,'扫描算法已更新，请重新扫描；文件未被删除。',{retryable:false});
  if(scan.status==='roots'){await rootStep(env,scan);}
  else if (scan.status==='inventory') {
    const page=scan.pageCount??0;
    const cached=await record<StorageItem[]>(env.PRIVATE,pageKey(scan.id,page));
    let items:StorageItem[],cursor:string|undefined;
    if(cached){
      if(cached.metadata?.bucket!==scan.bucket||cached.metadata?.start!==(scan.cursor??'')||!Array.isArray(cached.value))throw new ApiError(409,'分页游标不一致，请重新扫描。');
      items=cached.value;cursor=cached.metadata.cursor||undefined;
    }else{
      const listed=await bucket(env,scan.bucket).list({cursor:scan.cursor,limit:50});cursor=listed.truncated?listed.cursor:undefined;
      items=listed.objects.map(item=>({bucket:scan.bucket,key:item.key,etag:item.httpEtag,size:item.size,uploaded:item.uploaded.toISOString(),kind:storageKind(scan.bucket,item.key),eligible:false,reason:'扫描中',page}));
      if(items.length){
        const saved=await env.PRIVATE.put(pageKey(scan.id,page),JSON.stringify(items),{onlyIf:{etagDoesNotMatch:'*'},customMetadata:{bucket:scan.bucket,start:scan.cursor??'',cursor:cursor??''},httpMetadata:{contentType:'application/json',cacheControl:'no-store'}});
        if(!saved)throw new ApiError(409,'其他窗口已保存此页，请重新读取进度。');
      }
    }
    for(const item of items){
      if(scan.revisions['private:state/docs.json']===EMPTY_ETAG&&item.bucket==='private'&&item.key.startsWith('docs/uploads/'))throw new ApiError(503,'存在文档图片但缺少文档草稿库，已停止清理。');
      const history=/^(backups\/|snapshots\/|data\/snapshots\/|data\/docs-snapshots\/)/.test(item.key)&&item.key.endsWith('.json');
      const session=scan.bucket==='private'&&/^uploads\/sessions\/[^/]+\.json$/.test(item.key);
      const report=scan.bucket==='private'&&/^maintenance\/scans\/[^/]+\.json$/.test(item.key);
      const id=storageId(scan.bucket,item.key);if((history||session||report)&&!scan.queue.includes(id))scan.queue.push(id);
      if((history||session||report||scan.bucket==='public'&&item.key.startsWith('content/')&&item.key.endsWith('.md'))&&!scan.listedRefs!.includes(id))scan.listedRefs!.push(id);
    }
    if((scan.objectCount??0)+items.length>20_000)throw new ApiError(503,'对象超过 20000 个扫描上限，未删除文件。');
    if(items.length){
      scan.pageCount=page+1;scan.objectCount=(scan.objectCount??0)+items.length;
      const total=scan.totals![scan.bucket];total.objects+=items.length;total.bytes+=items.reduce((n,item)=>n+item.size,0);
      scan.recentHistory=recentHistory([...(scan.recentHistory??[]),...items.filter(item=>item.kind==='history')]);
    }
    if(cursor)scan.cursor=cursor;
    else if(scan.bucket==='private'){scan.bucket='public';delete scan.cursor;}
    else{scan.status='references';delete scan.cursor;}
  } else if (scan.status==='references') {
    for(let count=0;count<1&&scan.read<scan.queue.length;count++){
      const id=scan.queue[scan.read++],separator=id.indexOf(':'),name=id.slice(0,separator) as StorageBucket,key=id.slice(separator+1);
      const object=await bucket(env,name).get(key);
      if(!object){
        if(name==='public'&&key.startsWith('content/')&&key.endsWith('.md')&&!scan.listedRefs!.includes(id)){
          if(scan.warnings!.length>=1000)throw new ApiError(503,'失效正文链接超过扫描上限，已停止清理。');
          scan.warnings!.push({bucket:name,key,message:'正文链接的目标文件不存在，已记录；没有跳过任何现存文件的引用校验。'});
          continue;
        }
        throw new ApiError(409,`扫描期间引用记录消失：${key}。请重新扫描。`,{retryable:false});
      }
      if(name==='private'&&key.startsWith('maintenance/scans/')){
        // Scan reports do not own business references. Pin their sibling pages
        // from the immutable key, without buffering old megabyte-sized reports.
        await object.body.cancel();const reportId=key.slice('maintenance/scans/'.length,-'.json'.length);
        if(!idPattern.test(reportId))throw new ApiError(503,'历史扫描报告路径无效，已停止清理。');
        const prefix=`prefix:private:maintenance/pages/${reportId}/`;if(!scan.refs.includes(prefix))scan.refs.push(prefix);
        continue;
      }
      if(object.size>8_000_000){await object.body.cancel();throw new ApiError(503,'引用记录过大，未执行清理。');}
      if(key.endsWith('.md')){
        const text=await object.text();references(scan,text);
        const targets=[...docsMarkdownImages(text).map(image=>image.url),...Array.from(text.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g),match=>match[1]),...Array.from(text.matchAll(/^ {0,3}\[[^\]]+\]:\s*<?([^\s>]+)>?/gm),match=>match[1]),...Array.from(text.matchAll(/\b(?:src|href)=["']([^"']+)["']/g),match=>match[1])];
        for(const target of targets){try{const url=new URL(target,PUBLIC_ORIGIN+'/'+key);if(url.origin===PUBLIC_ORIGIN)protect(scan,'public',decodeURIComponent(url.pathname.slice(1)));}catch{throw new ApiError(503,'正文相对资源地址异常，已停止清理。');}}
      }
      else if(key.startsWith('uploads/sessions/')){
        const session=await referenceJson<Upload>(object);
        if(!session?.id||!idPattern.test(session.id)||key!==`uploads/sessions/${session.id}.json`||typeof session.name!=='string'||!session.name||session.name.includes('/')||session.key!==`uploads/temporary/${session.id}/${session.name}`||!['uploading','verifying','complete','cancelled'].includes(session.status)||!Number.isFinite(Date.parse(session.expiresAt)))throw new ApiError(503,'上传会话记录无效，已停止清理。');
        if(session.status==='complete'&&(!session.asset||session.asset.id!==session.id||session.asset.privateKey!==`uploads/verified/${session.id}/${session.name}`||session.asset.size!==session.size||!/^[a-f0-9]{64}$/.test(session.asset.sha256)))throw new ApiError(503,'完成上传的校验凭证无效，已停止清理。');
        const live=session.status==='verifying'||session.status==='uploading'&&Date.parse(session.expiresAt)>Date.now();
        if(live){scan.refs.push(`prefix:private:uploads/temporary/${session.id}/`,`prefix:private:uploads/receipts/${session.id}/`);protect(scan,'private',key);protect(scan,'private',`uploads/active/${session.id}.json`);protect(scan,'private',`uploads/verified/${session.id}/${session.name}`);}
        if(session.status==='complete'&&Date.now()-object.uploaded.getTime()<scan.policy.privateDays*DAY){references(scan,session.asset);protect(scan,'private',key);}
      } else { historicalReferences(scan,key,await referenceJson(object)); }
    }
    if(scan.read===scan.queue.length)scan.status='classification';
  }else if(scan.status==='classification'){
    const page=scan.classifyPage??0;
    if(page<(scan.pageCount??0)){
      const stored=await loadPage(env,scan,page);classify(scan,stored.value);
      await putJson(env.PRIVATE,pageKey(scan.id,page),stored.value,stored.etag);
      if(stored.value.some(item=>item.eligible)&&!scan.candidatePages!.includes(page))scan.candidatePages!.push(page);
      scan.classifyPage=page+1;
    }
    if(scan.classifyPage===scan.pageCount){scan.status='ready';scan.readyAt=new Date(Date.now()).toISOString();}
  }
  return scan.status==='ready';
}
async function saveScan(env:StorageEnv,scan:StorageScan,etag:string){
  const encoded=JSON.stringify(scan);
  const object=await env.PRIVATE.put(scanKey(scan.id),encoded,{onlyIf:{etagMatches:etag.replaceAll('"','')},httpMetadata:{contentType:'application/json; charset=utf-8',cacheControl:'no-store'}});
  if(!object)throw new ApiError(409,'扫描报告已被其他窗口推进，请重新读取进度。');
  return json({scan:summary(scan)},200,object.httpEtag);
}
async function unchanged(env: StorageEnv, scan: StorageScan) {
  const {gate}=await readStorageGate(env.PRIVATE);
  if(gate.recovered&&Date.parse(scan.createdAt)<=Date.parse(gate.recovered.time))throw new ApiError(409,'维护锁已恢复，请重新扫描后再清理。');
  for(const [name,key] of ROOTS)if(((await bucket(env,name).head(key))?.httpEtag??EMPTY_ETAG)!==scan.revisions[storageId(name,key)])throw new ApiError(409,'作品、文档或公开目录已改变，请重新扫描后再清理。');
  if((await policy(env)).etag!==scan.revisions.policy)throw new ApiError(409,'清理策略已改变，请重新扫描。');
  if(Date.now()-Date.parse(scan.readyAt??scan.createdAt)>DAY)throw new ApiError(409,'扫描结果已超过 24 小时，请重新扫描。');
}
async function cleanup(env: StorageEnv, id: string, selected: string[], pages:number[], actor: string) {
  return withStorageCleaner(env.PRIVATE,async()=>{
    const saved=await record<StorageScan>(env.PRIVATE,scanKey(id));if(!saved||saved.value.status!=='ready'||saved.value.format!==2||saved.value.algorithm!==3)throw new ApiError(409,'请先完成新版扫描预览。');
    const scan=saved.value;await unchanged(env,scan);
    for(const pointer of [LATEST,AUTO]){const active=await record<{id:string}>(env.PRIVATE,pointer);if(active)pinReport(scan,active.value.id);}
    const wanted=new Set(selected);if(wanted.size!==selected.length||wanted.size>20||new Set(pages).size!==pages.length||pages.length>20)throw new ApiError(422,'每次最多清理 20 个不同对象。');
    const loaded=await Promise.all(pages.map(async page=>({page,...await loadPage(env,scan,page)})));
    const items=loaded.flatMap(page=>page.value).filter(item=>wanted.has(storageId(item.bucket,item.key)));
    for(const item of items)item.kind=storageKind(item.bucket,item.key);
    classify(scan,items);
    if(items.length!==wanted.size||items.some(item=>!item.eligible))throw new ApiError(422,'选择中包含受保护或不属于本次扫描的文件。');
    const eventId=crypto.randomUUID(),time=new Date().toISOString(),eventKey=`audit/${time.slice(0,10)}/${time.replaceAll(':','-')}-${eventId}.json`;
    const event={schemaVersion:2,id:eventId,actorId:actor,operation:'cleanup-storage',time,status:'prepared',changes:[{workId:'storage',slug:'storage',title:'R2 存储清理',action:'removed',fields:items.map(item=>({name:item.bucket+' / '+item.key,before:item.size+' 字节',after:'请求删除；以最终结果为准'}))}],objects:items.map(({bucket,key,size})=>({bucket,key,size}))};
    const intent=await putJson(env.PRIVATE,eventKey,event);
    let bytes=0,removed=0;const removedKeys:string[]=[],skippedKeys:string[]=[];
    const persist=async()=>{for(const page of loaded){const object=await putJson(env.PRIVATE,pageKey(id,page.page),page.value,page.etag);page.etag=object.httpEtag;}};
    try{
      for(const item of items){
        const key=storageId(item.bucket,item.key);if(item.outcome)continue;
        const current=await bucket(env,item.bucket).head(item.key);
        if(!current||current.httpEtag!==item.etag||current.size!==item.size||current.uploaded.toISOString()!==item.uploaded){item.outcome='skipped';skippedKeys.push(key);continue;}
        // All Admin business writes are excluded by the gate. External R2 writers
        // must remain paused because delete has no ETag precondition.
        await bucket(env,item.bucket).delete(item.key);item.outcome='deleted';removedKeys.push(key);bytes+=item.size;removed++;
      }
      await persist();
      await putJson(env.PRIVATE,eventKey,{...event,status:'success',httpStatus:200,finishedAt:new Date().toISOString(),removed,bytes,removedKeys,skippedKeys},intent.httpEtag);
      return {removed,bytes,scan:{...summary(scan),deleted:removedKeys,skipped:skippedKeys}};
    }catch(error){await persist().catch(()=>{});await putJson(env.PRIVATE,eventKey,{...event,status:'failed',httpStatus:503,finishedAt:new Date().toISOString(),removed,bytes,removedKeys,skippedKeys},intent.httpEtag).catch(()=>{});throw error;}
  });
}
export async function storageRoute(request: Request, env: StorageEnv, path: string[], email: string) {
  if(path.length===1&&path[0]==='recovery'&&request.method==='POST')return storageRecovery(request,env,email);
  if(path.length===0&&request.method==='GET'){
    const settings=await policy(env),latest=await record<{id:string}>(env.PRIVATE,LATEST),saved=latest?await record<StorageScan>(env.PRIVATE,scanKey(latest.value.id)):null;
    const gate=await readStorageGate(env.PRIVATE);
    return json({policy:settings.value,scan:saved?summary(saved.value):null,scanEtag:saved?.etag??'',gate:gate.gate,gateEtag:gate.etag,serverTime:Date.now(),automatic:(await record(env.PRIVATE,AUTO))?.value??null},200,settings.etag);
  }
  if(path[0]==='items'&&path.length===3&&idPattern.test(path[1])&&/^\d{1,5}$/.test(path[2])&&request.method==='GET'){
    const saved=await record<StorageScan>(env.PRIVATE,scanKey(path[1]));
    if(!saved||saved.value.status!=='ready'||saved.value.format!==2||Number(path[2])>=(saved.value.pageCount??0))throw new ApiError(404,'扫描分页不可用，请完成扫描后重新读取。');
    const page=await env.PRIVATE.get(pageKey(path[1],Number(path[2])));if(!page)throw new ApiError(503,'扫描分页缺失，请重新扫描。');
    return new Response(page.body,{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  }
  if(path[0]==='policy'&&path.length===1&&request.method==='PUT'){
    const settings=await policy(env);expectMatch(request,settings.etag);const next=await readJson(request,4096);if(storagePolicyErrors(next))throw new ApiError(422,'清理策略不合法；不能缩短最低保留期。');
    return withStorageCleaner(env.PRIVATE,async()=>{const current=await policy(env);expectMatch(request,current.etag);const time=new Date().toISOString(),id=crypto.randomUUID();const event={schemaVersion:2,id,actorId:await actorKey(email),operation:'configure-storage',time,status:'prepared',changes:[{workId:'storage',slug:'storage',title:'存储清理策略',action:'updated',fields:[{name:'清理策略',before:JSON.stringify(current.value),after:JSON.stringify(next)}]}]};const key=`audit/${time.slice(0,10)}/${time.replaceAll(':','-')}-${id}.json`;const intent=await putJson(env.PRIVATE,key,event);const result=await putJson(env.PRIVATE,POLICY,next,current.etag);await putJson(env.PRIVATE,key,{...event,status:'success',httpStatus:200,finishedAt:new Date().toISOString()},intent.httpEtag);return json({policy:next},200,result.httpEtag);});
  }
  // Reports never change business references. New reports are within the history
  // grace period; expired reports cannot resume. They need no business write lease.
  if(path[0]==='scan'&&path.length===1&&request.method==='POST'){
    const input=await readJson(request,1024) as {restart?:boolean};
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>key!=='restart')||input.restart!==undefined&&typeof input.restart!=='boolean')throw new ApiError(422,'扫描参数无效。');
    const result=await startScan(env,input.restart===true);return json({scan:summary(result.scan)},200,result.etag);
  }
  if(path[0]==='scan'&&path.length===2&&idPattern.test(path[1])&&request.method==='POST'){
    const stored=await record<StorageScan>(env.PRIVATE,scanKey(path[1]));if(!stored)throw new ApiError(404,'扫描不存在。');
    if(Date.now()-Date.parse(stored.value.createdAt)>DAY)throw new ApiError(409,'扫描结果已超过 24 小时，请重新扫描。',{retryable:false});
    if(!request.headers.get('if-match'))throw new ApiError(428,'缺少版本条件，请重新读取进度。');
    const pointer=await record<{id:string}>(env.PRIVATE,LATEST);
    if(pointer&&pointer.value.id!==path[1]){
      const current=await record<StorageScan>(env.PRIVATE,scanKey(pointer.value.id));
      if(current?.value.algorithm===3&&Date.now()-Date.parse(current.value.createdAt)<DAY)return json({scan:summary(current.value)},200,current.etag);
    }
    if(request.headers.get('if-match')!==stored.etag)return json({scan:summary(stored.value)},200,stored.etag);
    try{await stepScan(env,stored.value);return await saveScan(env,stored.value,stored.etag);}
    catch(error){
      if(error instanceof ApiError&&error.status===409&&error.details?.retryable!==false){
        const latest=await record<StorageScan>(env.PRIVATE,scanKey(path[1]));
        if(latest&&latest.etag!==stored.etag)return json({scan:summary(latest.value)},200,latest.etag);
        throw new ApiError(409,'其他窗口正在推进扫描，正在恢复最新进度。',{retryable:true,kind:'scan-conflict'});
      }
      if(error instanceof ApiError&&error.status>=500)throw new ApiError(error.status,error.message,{retryable:false,kind:'scan-reference-invalid',phase:stored.value.status,reference:stored.value.status==='references'?stored.value.queue[Math.max(0,stored.value.read-1)]:undefined});
      throw error;
    }
  }
  if(path[0]==='delete'&&path.length===1&&request.method==='POST'){
    const input=await readJson(request,16_384) as {scanId?:string;keys?:string[];pages?:number[];confirm?:string};
    if(!idPattern.test(input?.scanId??'')||!Array.isArray(input.keys)||!input.keys.length||input.keys.length>20||input.keys.some(key=>typeof key!=='string')||!Array.isArray(input.pages)||input.pages.length>20||input.pages.some(page=>!Number.isInteger(page))||input.confirm!=='永久删除')throw new ApiError(422,'请核对删除清单并输入“永久删除”，每批 1 至 20 个对象。');
    return json(await cleanup(env,input.scanId!,input.keys,input.pages!,await actorKey(email)));
  }
  throw new ApiError(404,'存储管理接口不存在。');
}
export async function scheduledStorageCleanup(env: StorageEnv) {
  const settings=await policy(env);if(!settings.value.enabled)return;
  // Each scheduled invocation performs one bounded step and persists progress.
  // No queues, new credentials, public API, or browser session are required.
  const previous=await record<{id:string;finished?:boolean;finishedAt?:string}>(env.PRIVATE,AUTO);
  if(previous?.value.finished&&previous.value.finishedAt&&Date.now()-Date.parse(previous.value.finishedAt)<DAY)return;
  const saved=previous&&!previous.value.finished?await record<StorageScan>(env.PRIVATE,scanKey(previous.value.id)):null;
  if(!saved){const started=await startScan(env);await putJson(env.PRIVATE,AUTO,{id:started.scan.id},previous?.etag??EMPTY_ETAG);return;}
  if(saved.value.format!==2||saved.value.algorithm!==3){await putJson(env.PRIVATE,AUTO,{id:saved.value.id,finished:true},previous!.etag);return;}
  if(saved.value.status!=='ready'){
    await stepScan(env,saved.value);await putJson(env.PRIVATE,scanKey(saved.value.id),saved.value,saved.etag);return;
  }
  const scan=saved.value;
  const cursor=(previous!.value as {page?:number}).page??0,page=scan.candidatePages?.[cursor];
  if(page===undefined){await putJson(env.PRIVATE,AUTO,{id:scan.id,finished:true,finishedAt:new Date(Date.now()).toISOString()},previous!.etag);return;}
  const loaded=await loadPage(env,scan,page);
  const candidates=loaded.value.filter(item=>item.eligible&&!item.outcome&&(item.kind==='temporary'||item.kind==='history'||item.kind==='receipt'||settings.value.assets&&(item.bucket==='private'||settings.value.publicAssets)));
  if(!candidates.length){await putJson(env.PRIVATE,AUTO,{id:scan.id,page:cursor+1},previous!.etag);return;}
  let bytes=0;const selected=candidates.filter(item=>{if(bytes+item.size>2*1024**3)return false;bytes+=item.size;return true;}).slice(0,20);
  if(!selected.length)return;
  try{await cleanup(env,scan.id,selected.map(item=>storageId(item.bucket,item.key)),[page],await actorKey('automatic-storage-cleanup@system.invalid'));}
  catch(error){if(error instanceof ApiError&&error.status===409&&/目录已改变|策略已改变|24 小时|维护锁已恢复/.test(error.message))await putJson(env.PRIVATE,AUTO,{id:scan.id,finished:true,reason:error.message},previous!.etag);else throw error;}
}
