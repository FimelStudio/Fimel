import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { makeWork } from '../shared/model';
import type { Asset, Upload, Work } from '../shared/model';
import { makeDoc } from '../shared/docs';
import { DEFAULT_STORAGE_POLICY, storageId } from '../shared/storage';
import type { StorageScan } from '../shared/storage';

let runtime: Miniflare;
const origin='http://127.0.0.1:5174';
const manifest={schemaVersion:2,publicationId:'test',projects:[],releases:{}};
const id=()=>crypto.randomUUID();
const asset=():Asset=>{const value=id();return {id:value,name:'image.png',privateKey:`uploads/verified/${value}/image.png`,size:4,mime:'image/png',sha256:'a'.repeat(64)};};
const work=()=>{const value=makeWork();value.project.slug='test-work';value.project.title='测试作品';return value;};
before(async()=>{
  const bundled=await build({stdin:{contents:`import local from './admin/worker/local';
    import { scheduledStorageCleanup } from './admin/worker/storage-cleanup';
    import { withStorageWriter,withStorageCleaner } from './admin/worker/storage-gate';
    const originalNow=Date.now;let offset=366*86400000;Date.now=()=>originalNow()+offset;
    export default {async fetch(request,env,ctx){
      if(request.headers.has('x-test-days'))offset=Number(request.headers.get('x-test-days'))*86400000;
      const failure=request.headers.get('x-test-failure');
      let deletes=0;
      const privateBucket=new Proxy(env.PRIVATE,{get(bucket,key){
        if(key==='delete')return async(name)=>{if(failure==='delete-second'&&++deletes===2||failure==='temp-delete'&&name.startsWith('uploads/temporary/'))throw Error('injected deletion failure');return bucket.delete(name);};
        if(key==='put')return async(name,value,options)=>{if(failure==='audit-intent'&&name.startsWith('audit/')||failure==='scan-save'&&name.startsWith('maintenance/scans/')&&options?.onlyIf?.etagMatches)throw Error('injected persistence failure');return bucket.put(name,value,options);};
        const value=Reflect.get(bucket,key);return typeof value==='function'?value.bind(bucket):value;
      }});
      const assets={async fetch(){return Response.json({schemaVersion:1,works:[]});}};
      const bindings={...env,PRIVATE:privateBucket,ASSETS:assets};
      const path=new URL(request.url).pathname;
      if(path==='/test/scheduled'){try{await scheduledStorageCleanup(bindings);return new Response('ok');}catch{return new Response('failed',{status:503});}}
      if(path==='/test/overlap'){let results={};await withStorageWriter(env.PRIVATE,async()=>{try{await withStorageCleaner(env.PRIVATE,async()=>{});}catch(error){results.cleaner=error.status;}});await withStorageCleaner(env.PRIVATE,async()=>{try{await withStorageWriter(env.PRIVATE,async()=>{});}catch(error){results.writer=error.status;}});try{await withStorageCleaner(env.PRIVATE,async()=>{throw Error('test');});}catch{}return Response.json(results);}
      return local.fetch(request,bindings,ctx);
    }};`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
  runtime=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-10-12',r2Buckets:['PRIVATE','PUBLIC'],bindings:{ADMIN_ORIGIN:origin,ACCESS_AUD:'local-test',ACCESS_ISSUER:'https://local.invalid',ADMIN_EMAILS:'local-admin@example.invalid'}}));await runtime.ready;
});
after(async()=>{await runtime?.dispose();});
beforeEach(async()=>{
  for(const name of ['PRIVATE','PUBLIC']){const store=await runtime.getR2Bucket(name);let page;do{page=await store.list();if(page.objects.length)await store.delete(page.objects.map(object=>object.key));}while(page.truncated);}
  await put('private','state/library.json',{schemaVersion:1,works:[]});await put('public','data/works.json',manifest);
  await request('','GET',undefined,{'x-test-days':'366'});
});
const bucket=(name:'private'|'public')=>runtime.getR2Bucket(name==='private'?'PRIVATE':'PUBLIC');
async function put(name:'private'|'public',key:string,value:unknown){return (await bucket(name)).put(key,typeof value==='string'?value:JSON.stringify(value));}
function request(path='',method='GET',body?:unknown,headers:Record<string,string>={}){return runtime.dispatchFetch(`http://127.0.0.1/api/storage${path?'/'+path:''}`,{method,headers:{Origin:origin,'X-Fimel-CSRF':'1','Content-Type':'application/json',Connection:'close',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});}
async function scan(){let response=await request('scan','POST',{});assert.equal(response.status,200,await response.clone().text());let result=await response.json() as {scan:StorageScan;etag:string};for(let step=0;result.scan.status!=='ready'&&step<200;step++){response=await request('scan/'+result.scan.id,'POST',{}, {'If-Match':result.etag});assert.equal(response.status,200,await response.clone().text());result=await response.json() as typeof result;}assert.equal(result.scan.status,'ready');return result.scan;}
const find=(scan:StorageScan,key:string)=>scan.items.find(item=>item.key===key)!;
const remove=(scan:StorageScan,keys:string[],headers:Record<string,string>={})=>request('delete','POST',{scanId:scan.id,keys,confirm:'永久删除'},headers);
const scheduled=()=>runtime.dispatchFetch('http://127.0.0.1/test/scheduled',{headers:{Connection:'close'}});
async function configure(extra:Record<string,unknown>){const state=await request();assert.equal(state.status,200);const response=await request('policy','PUT',{...DEFAULT_STORAGE_POLICY,...extra},{'If-Match':state.headers.get('etag')!});assert.equal(response.status,200,await response.clone().text());}
async function saveWork(value:Work){await put('private','state/library.json',{schemaVersion:1,works:[value]});}
async function audits(){const store=await bucket('private');return Promise.all((await store.list({prefix:'audit/'})).objects.map(async object=>(await store.get(object.key))!.json() as Promise<{operation:string;status:string;removed:number;bytes:number}>));}

test('存储接口继承身份与 CSRF 保护，自动清理默认关闭且不创建任务',async()=>{
  assert.equal((await request('','GET',undefined,{'x-local-test-anonymous':'1'})).status,401);
  assert.equal((await request('scan','POST',{}, {Origin:'https://evil.invalid'})).status,403);
  assert.equal((await request('scan','POST',{}, {'X-Fimel-CSRF':''})).status,403);
  assert.equal((await scheduled()).status,200);
  assert.equal(await (await bucket('private')).get('maintenance/automatic.json'),null);
  assert.equal((await request('policy','PUT',DEFAULT_STORAGE_POLICY)).status,428);
  const state=await request();assert.equal((await request('policy','PUT',{...DEFAULT_STORAGE_POLICY,temporaryDays:0},{'If-Match':state.headers.get('etag')!})).status,422);
});
test('扫描包含两桶大小、分页与保留原因；仅托管且过保留期的资源成为候选',async()=>{
  const a=asset();await put('private',a.privateKey!,'file');await put('private','uploads/temporary/test/file.zip','temporary');
  await put('private','audit/old.json','audit');await put('private','unknown/orphan','manual');await put('public','images/manual.png','manual');
  for(let i=0;i<105;i++)await put('public',`content/test/${i}.md`,'orphan');
  const result=await scan();assert.ok(result.items.length>110);assert.equal(find(result,a.privateKey!).eligible,true);assert.equal(find(result,'uploads/temporary/test/file.zip').eligible,true);
  for(const key of ['audit/old.json','unknown/orphan','images/manual.png','data/works.json','state/library.json'])assert.equal(find(result,key).eligible,false,key);
  assert.equal(find(result,'content/test/104.md').eligible,true);
});
test('新资源保留期保护且无引用检测不等于立即删除',async()=>{
  const a=asset();await put('private',a.privateKey!,'new');await request('','GET',undefined,{'x-test-days':'1'});
  const result=await scan();assert.equal(find(result,a.privateKey!).eligible,false);assert.match(find(result,a.privateKey!).reason,/30 天/);
  assert.ok(await (await bucket('private')).head(a.privateKey!));
});
test('当前草稿、归档作品、发行文件与保存素材保护私有及未来公开路径',async()=>{
  const w=work(),image=asset(),file=asset();w.workflow='archived';w.gallery=[image];w.versions=[{id:id(),label:'v1.0',date:'2026-01-01',gameVersions:[],status:'draft',changelog:'',files:[file]}];await saveWork(w);
  const publicImage=`images/${w.project.type}/${w.project.slug}/${image.id}/${image.name}`,publicFile=`works/${w.project.type}/${w.project.slug}/v1.0-${file.id}/${file.name}`;
  for(const a of [image,file])await put('private',a.privateKey!,'data');for(const key of [publicImage,publicFile])await put('public',key,'data');
  const result=await scan();for(const key of [image.privateKey!,file.privateKey!,publicImage,publicFile])assert.equal(find(result,key).eligible,false,key);
});
test('文档保存素材以及公开正文中的相对图片、HTML和附件均保留',async()=>{
  const doc=makeDoc('');doc.slug='test-doc';doc.title='文档';const image=asset();image.privateKey=`docs/uploads/${doc.id}/${image.id}/${image.name}`;doc.images=[image];
  await put('private','state/docs.json',{schemaVersion:1,categories:[],documents:[doc]});await put('private',image.privateKey!,'image');
  const w=work();w.project.content.description='https://download.studiofimel.com/content/readme.md';await put('public','data/works.json',{...manifest,projects:[w.project]});
  await put('public','content/readme.md','![img](../docs/images/some/'+image.id+'/a.png)\n<img src="../content/diagram.svg">\n[file](../works/attachment.zip)');
  for(const key of [`docs/images/some/${image.id}/a.png`,'content/diagram.svg','works/attachment.zip'])await put('public',key,'data');
  const result=await scan();for(const key of [image.privateKey!,'content/readme.md',`docs/images/some/${image.id}/a.png`,'content/diagram.svg','works/attachment.zip'])assert.equal(find(result,key).eligible,false,key);
});
test('历史记录引用保护资源；清理旧备份后下一轮才可回收，最近十份保留',async()=>{
  const a=asset(),w=work();w.gallery=[a];await put('private',a.privateKey!,'old asset');
  await put('private','backups/library/old.json',{value:{schemaVersion:1,works:[w]}});
  for(let n=0;n<12;n++)await put('private',`backups/library/${n}.json`,{value:{schemaVersion:1,works:[]}});
  await put('private','backups/public/null.json',{value:null});
  const result=await scan();assert.equal(find(result,a.privateKey!).eligible,false);
  const histories=result.items.filter(item=>item.kind==='history'&&item.key.startsWith('backups/library/'));assert.equal(histories.filter(item=>!item.eligible).length,10);
  // Object timestamps may tie in local R2; remove the selected historic reference
  // only if it is outside the ten newest. Otherwise add newer backups and rescan.
  if(!find(result,'backups/library/old.json').eligible){await new Promise(resolve=>setTimeout(resolve,10));for(let n=12;n<25;n++)await put('private',`backups/library/${n}.json`,{value:{schemaVersion:1,works:[]}});}
  const next=await scan();assert.equal(find(next,'backups/library/old.json').eligible,true);
  assert.equal((await remove(next,['private:backups/library/old.json'])).status,200);assert.ok(await (await bucket('private')).head(a.privateKey!));
  assert.equal(find(await scan(),a.privateKey!).eligible,true);
});
test('活动上传与未完成校验受保护；完成会话的临时副本可清理且引用文件保留',async()=>{
  const w=work(),a=asset();w.gallery=[a];await saveWork(w);await put('private',a.privateKey!,'verified');
  const sessions:Upload[]=[{id:a.id,workId:w.id,kind:'image',name:a.name,size:4,mime:a.mime,key:`uploads/temporary/${a.id}/${a.name}`,uploadId:'test',expiresAt:'2020-01-01T00:00:00Z',status:'complete',asset:a},...['uploading','verifying'].map(status=>{const value=id();return {id:value,workId:w.id,kind:'file',name:'file.zip',size:4,mime:'application/zip',key:`uploads/temporary/${value}/file.zip`,uploadId:'test',expiresAt:status==='uploading'?'2099-01-01T00:00:00Z':'2020-01-01T00:00:00Z',status} as Upload;})];
  for(const s of sessions){await put('private',`uploads/sessions/${s.id}.json`,s);await put('private',s.key,'copy');await put('private',`uploads/receipts/${s.id}/001.json`,{});}
  const result=await scan();assert.equal(find(result,sessions[0].key).eligible,true);assert.equal(find(result,a.privateKey!).eligible,false);assert.equal(find(result,`uploads/sessions/${a.id}.json`).eligible,false);
  for(const s of sessions.slice(1))for(const key of [s.key,`uploads/sessions/${s.id}.json`,`uploads/receipts/${s.id}/001.json`])assert.equal(find(result,key).eligible,false,key);
});
test('缺失、损坏或异常引用记录使扫描关闭删除能力',async()=>{
  await (await bucket('private')).delete('state/library.json');assert.equal((await request('scan','POST',{})).status,503);
  await put('private','state/library.json',{schemaVersion:1,works:[]});await put('private','backups/library/broken.json','broken JSON');
  let r=await request('scan','POST',{}),data=await r.json() as {scan:StorageScan;etag:string};for(let n=0;n<8&&r.status===200;n++){r=await request('scan/'+data.scan.id,'POST',{}, {'If-Match':data.etag});if(r.ok)data=await r.json() as typeof data;}
  assert.equal(r.status,503);assert.notEqual(data.scan.status,'ready');
});
test('删除要求确认及扫描范围，根目录变化或过期扫描拒绝删除',async()=>{
  const a=asset();await put('private',a.privateKey!,'garbage');const result=await scan(),key='private:'+a.privateKey!;
  assert.equal((await request('delete','POST',{scanId:result.id,keys:[key]})).status,422);
  assert.equal((await remove(result,['private:state/library.json'])).status,422);assert.equal((await remove(result,['private:not-in-scan'])).status,422);assert.equal((await remove(result,[key,key])).status,422);
  await saveWork(work());assert.equal((await remove(result,[key])).status,409);assert.ok(await (await bucket('private')).head(a.privateKey!));
  const fresh=await scan();await request('','GET',undefined,{'x-test-days':'368'});assert.equal((await remove(fresh,[key])).status,409);
});
test('对象变化跳过，确实删除记录数量与字节，重复请求不重复计数',async()=>{
  const a=asset(),b=asset();await put('private',a.privateKey!,'first');await put('private',b.privateKey!,'second');const result=await scan();await put('private',a.privateKey!,'changed');
  const keys=[a,b].map(value=>storageId('private',value.privateKey!));let response=await remove(result,keys);assert.equal(response.status,200,await response.clone().text());const body=await response.json() as {removed:number;bytes:number;scan:StorageScan};assert.equal(body.removed,1);assert.equal(body.bytes,6);assert.deepEqual(body.scan.skipped,[keys[0]]);
  assert.ok(await (await bucket('private')).head(a.privateKey!));assert.equal(await (await bucket('private')).head(b.privateKey!),null);
  response=await remove(result,keys);assert.equal(response.status,200);assert.equal((await response.json() as {removed:number}).removed,0);
  assert.ok((await audits()).some(event=>event.operation==='cleanup-storage'&&event.status==='success'&&event.removed===1));
});
test('删除意图未落盘时不删除，部分删除失败有审计且清理锁释放',async()=>{
  const a=asset(),b=asset();for(const value of [a,b])await put('private',value.privateKey!,'data');const result=await scan();const keys=[a,b].map(value=>'private:'+value.privateKey!);
  assert.equal((await remove(result,keys,{'x-test-failure':'audit-intent'})).status,503);for(const value of [a,b])assert.ok(await (await bucket('private')).head(value.privateKey!));
  assert.equal((await remove(result,keys,{'x-test-failure':'delete-second'})).status,503);assert.ok((await audits()).some(event=>event.status==='failed'&&event.removed===1));
  const gate=await (await (await bucket('private')).get('maintenance/write-gate.json'))!.json() as {writers:object;cleaner?:string};assert.equal(gate.cleaner,undefined);assert.deepEqual(gate.writers,{});
  const retry=await remove(result,keys);assert.equal(retry.status,200);assert.equal((await retry.json() as {removed:number}).removed,1);
});
test('互斥门真实 CAS 阻止写入与删除交叉，异常也释放；未结束锁不超时强制解锁',async()=>{
  const response=await runtime.dispatchFetch('http://127.0.0.1/test/overlap',{headers:{Connection:'close'}});assert.deepEqual(await response.json(),{cleaner:409,writer:503});
  const a=asset();await put('private',a.privateKey!,'data');const result=await scan();await put('private','maintenance/write-gate.json',{writers:{old:'2000-01-01T00:00:00Z'}});assert.equal((await remove(result,['private:'+a.privateKey!])).status,409);
  await put('private','maintenance/write-gate.json',{writers:{},cleaner:'held'});assert.equal((await request('scan','POST',{})).status,200,'扫描只写年轻维护报告，不占用或清除业务锁');
  const library=await runtime.dispatchFetch('http://127.0.0.1/api/library',{method:'PUT',headers:{Origin:origin,'X-Fimel-CSRF':'1','Content-Type':'application/json','If-Match':'"empty"',Connection:'close'},body:JSON.stringify({schemaVersion:1,works:[]})});assert.equal(library.status,503);assert.ok(await (await bucket('private')).head(a.privateKey!));
});
test('自动任务分步持久化且默认仅临时文件；公开与私有孤立资源需要额外开启',async()=>{
  const a=asset();await put('private',a.privateKey!,'private');await put('private','uploads/temporary/expired/file.zip','temporary');await put('public','content/orphan.md','public');await configure({enabled:true});
  for(let n=0;n<6;n++)assert.equal((await scheduled()).status,200);
  assert.equal(await (await bucket('private')).head('uploads/temporary/expired/file.zip'),null);assert.ok(await (await bucket('private')).head(a.privateKey!));assert.ok(await (await bucket('public')).head('content/orphan.md'));
  await configure({enabled:true,assets:true,publicAssets:true});await request('','GET',undefined,{'x-test-days':'368'});for(let n=0;n<7;n++)assert.equal((await scheduled()).status,200);
  assert.equal(await (await bucket('private')).head(a.privateKey!),null);assert.equal(await (await bucket('public')).head('content/orphan.md'),null);
});
test('上传完成后临时副本删除失败不会丢失校验文件或伪报上传失败，重试返回同一资源',async()=>{
  const w=work();await saveWork(w);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1sAAAAASUVORK5CYII=','base64');
  const digest=Buffer.from(await crypto.subtle.digest('SHA-256',png)).toString('hex');
  const call=(path:string,body:unknown,headers:Record<string,string>={},method='POST')=>runtime.dispatchFetch('http://127.0.0.1/api/uploads'+path,{method,headers:{Origin:origin,'X-Fimel-CSRF':'1','Content-Type':'application/json',Connection:'close',...headers},body:Buffer.isBuffer(body)?new Uint8Array(body as Uint8Array).buffer:JSON.stringify(body)});
  let response=await call('',{workId:w.id,name:'test.png',kind:'image',size:png.length});assert.equal(response.status,201);const {upload}=await response.json() as {upload:Upload};
  response=await call('/'+upload.id+'/parts/1',png,{'Content-Type':'application/octet-stream','X-Part-SHA256':digest},'PUT');assert.equal(response.status,200,await response.clone().text());
  response=await call('/'+upload.id+'/complete',{sha256:digest},{'x-test-failure':'temp-delete'});assert.equal(response.status,200,await response.clone().text());const first=await response.json() as {asset:Asset};
  assert.ok(await (await bucket('private')).head(upload.key));assert.ok(await (await bucket('private')).head(first.asset.privateKey!));
  assert.equal((await (await (await bucket('private')).get(`uploads/sessions/${upload.id}.json`))!.json() as Upload).status,'complete');
  response=await call('/'+upload.id+'/complete',{sha256:digest});assert.equal(response.status,200);assert.deepEqual((await response.json() as {asset:Asset}).asset,first.asset);
});
test('三千多个对象扫描可分步完成，响应与持久化报告一致且不遗留业务写入锁',async()=>{
  const store=await bucket('public');for(let start=0;start<3200;start+=40)await Promise.all(Array.from({length:40},(_,offset)=>store.put(`content/stress/${start+offset}.md`,'fixture')));
  const result=await scan();assert.ok(result.items.length>=3200);assert.equal(result.status,'ready');
  const persisted=await (await (await bucket('private')).get(`maintenance/scans/${result.id}.json`))!.json();assert.deepEqual(persisted,result);
  assert.equal(await (await bucket('private')).get('maintenance/write-gate.json'),null,'纯扫描不会创建业务写入租约');
});
