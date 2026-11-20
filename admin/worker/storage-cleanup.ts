import type { Asset, Library, Upload, Work } from '../shared/model';
import { PUBLIC_ORIGIN } from '../shared/model';
import type { DocsLibrary } from '../shared/docs';
import { DEFAULT_STORAGE_POLICY, storageId, storageKind, storagePolicyErrors } from '../shared/storage';
import type { StorageBucket, StorageItem, StoragePolicy, StorageScan } from '../shared/storage';
import { ApiError, EMPTY_ETAG, expectMatch, json, putJson, readJson } from './http';
import { actorKey } from './audit';
import { withStorageCleaner, withStorageWriter } from './storage-gate';
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

async function record<T>(store: R2Bucket, key: string): Promise<{ value: T; etag: string } | null> {
  const object = await store.get(key); if (!object) return null;
  if (object.size > 12_000_000) { await object.body.cancel(); throw new ApiError(503, '引用记录超过扫描上限，已停止清理。'); }
  try { return { value: await object.json<T>(), etag: object.httpEtag }; }
  catch { throw new ApiError(503, '引用或维护记录损坏，已停止清理。'); }
}
async function policy(env: StorageEnv) {
  const stored = await record<StoragePolicy>(env.PRIVATE, POLICY);
  if (stored && storagePolicyErrors(stored.value)) throw new ApiError(503, '清理策略损坏，未执行删除。');
  return { value: stored?.value ?? { ...DEFAULT_STORAGE_POLICY }, etag: stored?.etag ?? EMPTY_ETAG };
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
    for (const raw of [value, ...value.matchAll(/https:\/\/download\.studiofimel\.com\/[^\s<>"')\]\\]+/g)].map(v => typeof v === 'string' ? v : v[0])) {
      if (!raw.startsWith(PUBLIC_ORIGIN+'/')) continue;
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
async function roots(env: StorageEnv, scan: StorageScan) {
  for (const [name,key] of ROOTS) {
    const stored = await record<unknown>(bucket(env,name),key); scan.revisions[storageId(name,key)] = stored?.etag ?? EMPTY_ETAG;
    if (stored) {
      if (!stored.value || typeof stored.value !== 'object') throw new ApiError(503,'当前目录格式异常，已停止清理。');
      if(key==='state/library.json'&&validateLibrary(stored.value).length||key==='state/docs.json'&&docsLibraryErrors(stored.value).length)throw new ApiError(503,'当前草稿库无效，已停止清理。');
      if(key==='data/works.json')parseCatalogue(stored.value);
      if(key==='data/docs.json')parseDocsManifest(stored.value);
      if(key==='state/site.json'&&siteContentErrors((stored.value as {site?:unknown}).site).length)throw new ApiError(503,'网站草稿格式无效，已停止清理。');
      references(scan,stored.value);
    }
  }
  if(scan.revisions['private:state/library.json']===EMPTY_ETAG||scan.revisions['public:data/works.json']===EMPTY_ETAG)throw new ApiError(503,'缺少当前作品库或公开目录，无法安全判断引用，已停止清理。');
  // Original website assets can still be used by the static fallback catalogue.
  const source = await env.ASSETS.fetch(new Request('https://storage.invalid/migration/library.json'));
  if (!source.ok) throw new ApiError(503, '无法核对官网原始资源清单，已停止清理。');
  const original = await source.json<Library>();
  if (!Array.isArray(original.works)) throw new ApiError(503,'官网原始资源清单无效。');
  references(scan,original);
  protect(scan,'private',scanKey(scan.id));
  const automatic=await record<{id:string}>(env.PRIVATE,AUTO);if(automatic)protect(scan,'private',scanKey(automatic.value.id));
}
function historicalReferences(scan: StorageScan, key: string, value: unknown) {
  const wrapper=value as {value?:unknown};
  const body=key.startsWith('backups/')?wrapper?.value:value;
  // The first publication legitimately backs up a missing public manifest.
  if(key.startsWith('backups/')&&body===null&&wrapper&&Object.hasOwn(wrapper,'value'))return;
  if(!body||typeof body!=='object')throw new ApiError(503,'历史恢复记录不完整，已停止清理。');
  if(key.startsWith('backups/library/')&&validateLibrary(body).length||key.startsWith('backups/docs/')&&docsLibraryErrors(body).length)throw new ApiError(503,'历史恢复记录校验失败，已停止清理。');
  if(/^(backups\/public\/|snapshots\/(?!docs\/)|data\/snapshots\/)/.test(key))parseCatalogue(body);
  if(/^(backups\/docs-public\/|snapshots\/docs\/|data\/docs-snapshots\/)/.test(key))parseDocsManifest(body);
  if(key.startsWith('backups/site/')&&siteContentErrors((body as {site?:unknown}).site).length)throw new ApiError(503,'网站历史记录无效，已停止清理。');
  references(scan,body);
}
async function startScan(env: StorageEnv) {
  const settings = await policy(env);
  const scan: StorageScan = { id: crypto.randomUUID(), createdAt: new Date(Date.now()).toISOString(), status: 'inventory', bucket: 'private', items: [], refs: [], queue: [], read: 0, revisions: {}, policy: settings.value, deleted: [], skipped: [] };
  scan.revisions['policy'] = settings.etag;
  await roots(env,scan);
  const saved = await putJson(env.PRIVATE,scanKey(scan.id),scan);
  const old = await env.PRIVATE.head(LATEST); await putJson(env.PRIVATE,LATEST,{ id: scan.id },old?.httpEtag??EMPTY_ETAG);
  return { scan, etag: saved.httpEtag };
}
function age(item: StorageItem, now: number) { return (now-Date.parse(item.uploaded))/DAY; }
function classify(scan: StorageScan) {
  const refs = new Set(scan.refs), prefixes=scan.refs.filter(ref=>ref.startsWith('prefix:')).map(ref=>ref.slice(7)), now = Date.now();
  const history = new Map<string,StorageItem[]>();
  for (const item of scan.items.filter(item=>item.kind==='history')) { const prefix=item.key.startsWith('snapshots/')&&!item.key.startsWith('snapshots/docs/')?'snapshots/works':item.key.split('/').slice(0,2).join('/');const group=storageId(item.bucket,prefix); const list=history.get(group)??[];list.push(item);history.set(group,list); }
  const recent = new Set([...history.values()].flatMap(items=>items.sort((a,b)=>b.uploaded.localeCompare(a.uploaded)).slice(0,10)).map(item=>storageId(item.bucket,item.key)));
  for (const item of scan.items) {
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
  if (scan.status==='inventory') {
    const listed = await bucket(env,scan.bucket).list({ cursor: scan.cursor, limit: 100 });
    for (const item of listed.objects) {
      scan.items.push({ bucket: scan.bucket,key:item.key,etag:item.httpEtag,size:item.size,uploaded:item.uploaded.toISOString(),kind:storageKind(scan.bucket,item.key),eligible:false,reason:'扫描中' });
      const history=/^(backups\/|snapshots\/|data\/snapshots\/|data\/docs-snapshots\/)/.test(item.key)&&item.key.endsWith('.json');
      const session=scan.bucket==='private'&&/^uploads\/sessions\/[^/]+\.json$/.test(item.key);
      const id=storageId(scan.bucket,item.key); if ((history||session)&&!scan.queue.includes(id)) scan.queue.push(id);
    }
    if(scan.items.length>20_000)throw new ApiError(503,'对象超过 20000 个扫描上限，未删除文件，请联系维护者分桶核查。');
    if(listed.truncated)scan.cursor=listed.cursor;
    else if(scan.bucket==='private'){scan.bucket='public';delete scan.cursor;}
    else{scan.status='references';delete scan.cursor;}
  } else if (scan.status==='references') {
    for(let count=0;count<8&&scan.read<scan.queue.length;count++){
      const id=scan.queue[scan.read++],separator=id.indexOf(':'),name=id.slice(0,separator) as StorageBucket,key=id.slice(separator+1);
      const object=await bucket(env,name).get(key); if(!object)throw new ApiError(409,'引用记录在扫描时改变，请重新扫描。');
      if(object.size>8_000_000){await object.body.cancel();throw new ApiError(503,'引用记录过大，未执行清理。');}
      if(key.endsWith('.md')){
        const text=await object.text();references(scan,text);
        const targets=[...docsMarkdownImages(text).map(image=>image.url),...Array.from(text.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g),match=>match[1]),...Array.from(text.matchAll(/^ {0,3}\[[^\]]+\]:\s*<?([^\s>]+)>?/gm),match=>match[1]),...Array.from(text.matchAll(/\b(?:src|href)=["']([^"']+)["']/g),match=>match[1])];
        for(const target of targets){try{const url=new URL(target,PUBLIC_ORIGIN+'/'+key);if(url.origin===PUBLIC_ORIGIN)protect(scan,'public',decodeURIComponent(url.pathname.slice(1)));}catch{throw new ApiError(503,'正文相对资源地址异常，已停止清理。');}}
      }
      else if(key.startsWith('uploads/sessions/')){
        const session=await object.json<Upload>();
        if(!session?.id||!idPattern.test(session.id)||key!==`uploads/sessions/${session.id}.json`||typeof session.name!=='string'||!session.name||session.name.includes('/')||session.key!==`uploads/temporary/${session.id}/${session.name}`||!['uploading','verifying','complete','cancelled'].includes(session.status)||!Number.isFinite(Date.parse(session.expiresAt)))throw new ApiError(503,'上传会话记录无效，已停止清理。');
        if(session.status==='complete'&&(!session.asset||session.asset.id!==session.id||session.asset.privateKey!==`uploads/verified/${session.id}/${session.name}`||session.asset.size!==session.size||!/^[a-f0-9]{64}$/.test(session.asset.sha256)))throw new ApiError(503,'完成上传的校验凭证无效，已停止清理。');
        const live=session.status==='verifying'||session.status==='uploading'&&Date.parse(session.expiresAt)>Date.now();
        if(live){scan.refs.push(`prefix:private:uploads/temporary/${session.id}/`,`prefix:private:uploads/receipts/${session.id}/`);protect(scan,'private',key);protect(scan,'private',`uploads/active/${session.id}.json`);protect(scan,'private',`uploads/verified/${session.id}/${session.name}`);}
        if(session.status==='complete'&&Date.now()-object.uploaded.getTime()<scan.policy.privateDays*DAY){references(scan,session.asset);protect(scan,'private',key);}
      } else { historicalReferences(scan,key,await object.json()); }
    }
    if(scan.read===scan.queue.length){
      if(scan.revisions['private:state/docs.json']===EMPTY_ETAG&&scan.items.some(item=>item.bucket==='private'&&item.key.startsWith('docs/uploads/')))throw new ApiError(503,'存在文档图片但缺少文档草稿库，已停止清理。');
      scan.status='ready';classify(scan);
    }
  }
  return scan.status==='ready';
}
async function unchanged(env: StorageEnv, scan: StorageScan) {
  for(const [name,key] of ROOTS)if(((await bucket(env,name).head(key))?.httpEtag??EMPTY_ETAG)!==scan.revisions[storageId(name,key)])throw new ApiError(409,'作品、文档或公开目录已改变，请重新扫描后再清理。');
  if((await policy(env)).etag!==scan.revisions.policy)throw new ApiError(409,'清理策略已改变，请重新扫描。');
  if(Date.now()-Date.parse(scan.createdAt)>DAY)throw new ApiError(409,'扫描结果已超过 24 小时，请重新扫描。');
}
async function cleanup(env: StorageEnv, id: string, selected: string[], actor: string) {
  return withStorageCleaner(env.PRIVATE,async()=>{
    const saved=await record<StorageScan>(env.PRIVATE,scanKey(id));if(!saved||saved.value.status!=='ready')throw new ApiError(409,'请先完成扫描预览。');
    const scan=saved.value;await unchanged(env,scan);
    for(const pointer of [LATEST,AUTO]){const active=await record<{id:string}>(env.PRIVATE,pointer);if(active)protect(scan,'private',scanKey(active.value.id));}
    for(const item of scan.items)item.kind=storageKind(item.bucket,item.key);
    classify(scan);
    const wanted=new Set(selected);if(wanted.size!==selected.length||wanted.size>20)throw new ApiError(422,'每次最多清理 20 个不同对象。');
    const items=scan.items.filter(item=>wanted.has(storageId(item.bucket,item.key)));
    if(items.length!==wanted.size||items.some(item=>!item.eligible))throw new ApiError(422,'选择中包含受保护或不属于本次扫描的文件。');
    // Persist deletion intent before touching objects. Unknown outcomes remain
    // visible; a repeated step checks object existence instead of double counting.
    const eventId=crypto.randomUUID(),time=new Date().toISOString(),eventKey=`audit/${time.slice(0,10)}/${time.replaceAll(':','-')}-${eventId}.json`;
    const event={schemaVersion:2,id:eventId,actorId:actor,operation:'cleanup-storage',time,status:'prepared',changes:[{workId:'storage',slug:'storage',title:'R2 存储清理',action:'removed',fields:items.map(item=>({name:item.bucket+' / '+item.key,before:item.size+' 字节',after:'请求删除；以最终结果为准'}))}],objects:items.map(({bucket,key,size})=>({bucket,key,size}))};
    const intent=await putJson(env.PRIVATE,eventKey,event);
    let bytes=0,removed=0;const removedKeys:string[]=[],skippedKeys:string[]=[];
    try{
      for(const item of items){
        const key=storageId(item.bucket,item.key);if(scan.deleted.includes(key)||scan.skipped.includes(key))continue;
        const current=await bucket(env,item.bucket).head(item.key);
        if(!current){scan.skipped.push(key);skippedKeys.push(key);continue;}
        if(current.httpEtag!==item.etag||current.size!==item.size||current.uploaded.toISOString()!==item.uploaded){scan.skipped.push(key);skippedKeys.push(key);continue;}
        // R2 delete has no ETag precondition; all Admin business writes are
        // excluded by the gate, and out-of-band R2 writers must remain paused.
        await bucket(env,item.bucket).delete(item.key);scan.deleted.push(key);removedKeys.push(key);bytes+=item.size;removed++;
      }
      await putJson(env.PRIVATE,scanKey(id),scan,saved.etag);
      await putJson(env.PRIVATE,eventKey,{...event,status:'success',httpStatus:200,finishedAt:new Date().toISOString(),removed,bytes,removedKeys,skippedKeys},intent.httpEtag);
      return {removed,bytes,scan};
    }catch(error){await putJson(env.PRIVATE,eventKey,{...event,status:'failed',httpStatus:503,finishedAt:new Date().toISOString(),removed,bytes,removedKeys,skippedKeys},intent.httpEtag).catch(()=>{});throw error;}
  });
}
export async function storageRoute(request: Request, env: StorageEnv, path: string[], email: string) {
  if(path.length===0&&request.method==='GET'){
    const settings=await policy(env),latest=await record<{id:string}>(env.PRIVATE,LATEST),saved=latest?await record<StorageScan>(env.PRIVATE,scanKey(latest.value.id)):null;
    const gate=await record<{writers:Record<string,string>;cleaner?:string}>(env.PRIVATE,'maintenance/write-gate.json');
    return json({policy:settings.value,scan:saved?.value??null,scanEtag:saved?.etag??'',gate:gate?.value??{writers:{}},automatic:(await record(env.PRIVATE,AUTO))?.value??null},200,settings.etag);
  }
  if(path[0]==='policy'&&path.length===1&&request.method==='PUT'){
    const settings=await policy(env);expectMatch(request,settings.etag);const next=await readJson(request,4096);if(storagePolicyErrors(next))throw new ApiError(422,'清理策略不合法；不能缩短最低保留期。');
    return withStorageCleaner(env.PRIVATE,async()=>{const current=await policy(env);expectMatch(request,current.etag);const time=new Date().toISOString(),id=crypto.randomUUID();const event={schemaVersion:2,id,actorId:await actorKey(email),operation:'configure-storage',time,status:'prepared',changes:[{workId:'storage',slug:'storage',title:'存储清理策略',action:'updated',fields:[{name:'清理策略',before:JSON.stringify(current.value),after:JSON.stringify(next)}]}]};const key=`audit/${time.slice(0,10)}/${time.replaceAll(':','-')}-${id}.json`;const intent=await putJson(env.PRIVATE,key,event);const result=await putJson(env.PRIVATE,POLICY,next,current.etag);await putJson(env.PRIVATE,key,{...event,status:'success',httpStatus:200,finishedAt:new Date().toISOString()},intent.httpEtag);return json({policy:next},200,result.httpEtag);});
  }
  if(path[0]==='scan'&&path.length===1&&request.method==='POST')return withStorageWriter(env.PRIVATE,async()=>{const result=await startScan(env);return json(result,200,result.etag);});
  if(path[0]==='scan'&&path.length===2&&idPattern.test(path[1])&&request.method==='POST'){
    return withStorageWriter(env.PRIVATE,async()=>{const stored=await record<StorageScan>(env.PRIVATE,scanKey(path[1]));if(!stored)throw new ApiError(404,'扫描不存在。');expectMatch(request,stored.etag);
    await stepScan(env,stored.value);const saved=await putJson(env.PRIVATE,scanKey(path[1]),stored.value,stored.etag);return json({scan:stored.value},200,saved.httpEtag);});
  }
  if(path[0]==='delete'&&path.length===1&&request.method==='POST'){
    const input=await readJson(request,16_384) as {scanId?:string;keys?:string[];confirm?:string};
    if(!idPattern.test(input?.scanId??'')||!Array.isArray(input.keys)||!input.keys.length||input.keys.length>20||input.keys.some(key=>typeof key!=='string')||input.confirm!=='永久删除')throw new ApiError(422,'请核对删除清单并输入“永久删除”，每批 1 至 20 个对象。');
    return json(await cleanup(env,input.scanId!,input.keys,await actorKey(email)));
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
  if(!saved){await withStorageWriter(env.PRIVATE,async()=>{const started=await startScan(env);await putJson(env.PRIVATE,AUTO,{id:started.scan.id},previous?.etag??EMPTY_ETAG);});return;}
  if(saved.value.status!=='ready'){
    await withStorageWriter(env.PRIVATE,async()=>{const began=Date.now();for(let steps=0;steps<4;steps++){if(await stepScan(env,saved.value)||Date.now()-began>15_000)break;}
    await putJson(env.PRIVATE,scanKey(saved.value.id),saved.value,saved.etag);});return;
  }
  const scan=saved.value;
  const candidates=scan.items.filter(item=>item.eligible&&!scan.deleted.includes(storageId(item.bucket,item.key))&&!scan.skipped.includes(storageId(item.bucket,item.key))&&(item.kind==='temporary'||item.kind==='history'||item.kind==='receipt'||settings.value.assets&&(item.bucket==='private'||settings.value.publicAssets)));
  if(!candidates.length){await putJson(env.PRIVATE,AUTO,{id:scan.id,finished:true,finishedAt:new Date(Date.now()).toISOString()},previous!.etag);return;}
  let bytes=0;const selected=candidates.filter(item=>{if(bytes+item.size>2*1024**3)return false;bytes+=item.size;return true;}).slice(0,20);
  if(!selected.length)return;
  try{await cleanup(env,scan.id,selected.map(item=>storageId(item.bucket,item.key)),await actorKey('automatic-storage-cleanup@system.invalid'));}
  catch(error){if(error instanceof ApiError&&error.status===409&&/目录已改变|策略已改变|24 小时/.test(error.message))await putJson(env.PRIVATE,AUTO,{id:scan.id,finished:true,reason:error.message},previous!.etag);else throw error;}
}
