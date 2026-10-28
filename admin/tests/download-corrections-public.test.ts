import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {DOWNLOAD_CORRECTIONS_KEY,parseDownloadCorrections,type DownloadCorrection} from '../../src/content/download-corrections';
import {workEventKey,type PublicWorkDownloads} from '../../src/content/work-events';
import {readWorkDownloadTotals} from '../../src/lib/work-downloads';
import {encodeHistoryCursor} from '../../src/lib/work-download-cursor';

let mf:Miniflare;
const manifest={projects:[{slug:'work',type:'datapack',status:'released'},{slug:'new-work',type:'java',status:'released'},{slug:'store-map',type:'bedrock',status:'released'}]};
const correction=(value:number,anchorClicks=7):DownloadCorrection=>({value,anchorClicks,date:'2026-10-28',updatedAt:'2026-10-28T12:00:00.000Z',operationId:'89990224-a462-4525-9b2b-2369be54d674'});
before(async()=>{
  const bundle=await build({stdin:{contents:"import {publicWorkDownloads,workDownloadHistoryPage} from './src/lib/work-event-worker';export default{fetch(request,env,ctx){return new URL(request.url).pathname==='/admin-history'?workDownloadHistoryPage(request,env.PUBLIC):publicWorkDownloads(request,env.PUBLIC,env.METRICS_LIMITER,ctx,caches.default)}}",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
  mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-07-28',r2Buckets:['PUBLIC'],ratelimits:{METRICS_LIMITER:{namespace_id:'11002',simple:{limit:10000,period:60}}}}));
  await mf.ready;
});
after(async()=>{await mf?.dispose();});
async function reset(){
  const bucket=await mf.getR2Bucket('PUBLIC');
  let listed=await bucket.list();
  for(;;){await Promise.all(listed.objects.map(object=>bucket.delete(object.key)));if(!listed.truncated)break;listed=await bucket.list({cursor:listed.cursor});}
  await bucket.put('data/works.json',JSON.stringify(manifest));
  return bucket;
}
const get=(path='/api/work-downloads')=>mf.dispatchFetch(`https://studiofimel.com${path}`);
const registry=(works:Record<string,DownloadCorrection>)=>JSON.stringify({schemaVersion:1,works});
async function seedDay(date:string,clicks:number){const bucket=await mf.getR2Bucket('PUBLIC');await bucket.put(workEventKey(date),JSON.stringify({date,works:{work:{views:3,downloadClicks:clicks},'store-map':{views:0,downloadClicks:2},'private-draft':{views:0,downloadClicks:999}}}));}
async function readAll(onPage?:(page:number)=>Promise<void>){let pages=0;return readWorkDownloadTotals('https://studiofimel.com/api/work-downloads',async input=>{await onPage?.(++pages);const response=await mf.dispatchFetch(input);return {ok:response.ok,json:()=>response.json()};});}

test('校正契约校验日期、整数、UUID、字段与记录数量，损坏输入拒绝读取',()=>{
  const valid={schemaVersion:1,works:{work:correction(12)}};
  assert.deepEqual(parseDownloadCorrections(valid),valid);
  for(const value of [null,{},[],{schemaVersion:2,works:{}},{schemaVersion:1,works:[]},{...valid,extra:true},
    ...[-1,1.2,Number.MAX_SAFE_INTEGER+1,'4'].map(value=>({schemaVersion:1,works:{work:{...correction(1),value}}})),
    ...[{date:'2026-02-31'},{date:'0000-01-01'},{anchorClicks:-1},{updatedAt:'yesterday'},{updatedAt:'2026-02-31T12:00:00.000Z'},{operationId:'not-a-uuid'},{extra:1}].map(patch=>({schemaVersion:1,works:{work:{...correction(1),...patch}}})),
    {schemaVersion:1,works:{'private/work':correction(1)}},
    {schemaVersion:1,works:Object.fromEntries(Array.from({length:1001},(_,index)=>[`work-${index}`,correction(1)]))},
  ])assert.throws(()=>parseDownloadCorrections(value));
});

test('无校正记录时旧累计与manifest revision保持不变，复用入口无需伪造限流器',async()=>{
  const bucket=await reset();await seedDay('2025-01-01',100);await seedDay('2026-10-28',7);
  const data=await(await get('/admin-history')).json() as PublicWorkDownloads;
  assert.equal(data.revision,(await bucket.head('data/works.json'))!.etag);
  assert.deepEqual(data.works,{work:{downloadClicks:107},'new-work':{downloadClicks:null},'store-map':{downloadClicks:4}});
  assert.equal((await get('/admin-history?slug=work')).status,422);
  assert.equal((await mf.dispatchFetch('https://studiofimel.com/admin-history',{method:'POST'})).status,405);
});

test('向下校正后忽略旧日、同日仅加锚点后的点击、跨日继续累加，原始日文件保持原样',async()=>{
  const bucket=await reset();await seedDay('2025-01-01',1000);await seedDay('2026-10-28',9);await seedDay('2026-10-29',3);
  const before=await(await bucket.get(workEventKey('2026-10-28')))!.text();
  await bucket.put(DOWNLOAD_CORRECTIONS_KEY,registry({work:correction(12),'private-draft':correction(987),'store-map':correction(600)}));
  const totals=await readAll();assert.equal(totals.works.work.downloadClicks,17);
  assert.equal(totals.works['store-map'].downloadClicks,6);assert.equal(totals.works['private-draft'],undefined);
  assert.equal(JSON.stringify(totals).includes('operationId'),false);assert.equal(JSON.stringify(totals).includes('anchorClicks'),false);
  assert.equal(await(await bucket.get(workEventKey('2026-10-28')))!.text(),before);
});

test('校正为零有效且无日文件也能显示校正值，锚点大于原始记录时不产生负数',async()=>{
  const bucket=await reset();
  await bucket.put(DOWNLOAD_CORRECTIONS_KEY,registry({work:correction(0),'new-work':correction(42,0)}));
  let totals=await readAll();assert.equal(totals.works.work.downloadClicks,0);assert.equal(totals.works['new-work'].downloadClicks,42);
  await seedDay('2026-10-28',2);
  // Use the uncached authenticated projection to verify an event record changed
  // inside the normal five-minute public history cache window.
  const result=await(await get('/admin-history')).json() as PublicWorkDownloads;
  assert.equal(result.works.work.downloadClicks,0);assert.equal(result.works['new-work'].downloadClicks,42);
  totals=await readAll();assert.ok(totals);
});

test('预热缓存后改校正立即使用新值且旧revision续页409，下架后不泄露校正slug',async()=>{
  const bucket=await reset();await seedDay('2026-10-28',7);
  const original=await(await get()).json() as PublicWorkDownloads;
  await bucket.put(DOWNLOAD_CORRECTIONS_KEY,registry({work:correction(30)}));
  const first=await(await get()).json() as PublicWorkDownloads;assert.equal(first.works.work.downloadClicks,30);assert.notEqual(first.revision,original.revision);
  await bucket.put(DOWNLOAD_CORRECTIONS_KEY,registry({work:{...correction(0),operationId:'576d4484-4014-494a-b683-98ccb38b2faa'}}));
  const next=await(await get()).json() as PublicWorkDownloads;assert.equal(next.works.work.downloadClicks,0);assert.notEqual(next.revision,first.revision);
  assert.equal((await get(`/api/work-downloads?cursor=${await encodeHistoryCursor('continued-history')}&revision=${first.revision}`)).status,409);
  await bucket.put('data/works.json',JSON.stringify({projects:manifest.projects.filter(project=>project.slug!=='work')}));
  const hidden=await(await get()).json() as PublicWorkDownloads;assert.equal(hidden.works.work,undefined);
});

test('超过200日分页时只在第一页计入一次校正基数，续页校正变化拒绝整个客户端累计',async()=>{
  const bucket=await reset();
  for(let offset=0;offset<205;offset++){
    const date=new Date('2026-01-01T00:00:00.000Z');date.setUTCDate(date.getUTCDate()+offset);
    await seedDay(date.toISOString().slice(0,10),1);
  }
  await seedDay('2026-10-28',9);await seedDay('2026-10-29',4);
  await bucket.put(DOWNLOAD_CORRECTIONS_KEY,registry({work:correction(50)}));
  let pages=0;const totals=await readAll(async()=>{pages++;});
  assert.equal(pages,2);assert.equal(totals.works.work.downloadClicks,56);
  await assert.rejects(readAll(async page=>{if(page===2)await bucket.put(DOWNLOAD_CORRECTIONS_KEY,registry({work:correction(7)}));}));
});

test('校正文件超大、JSON损坏、契约非法或总数溢出时明确不可用，不回退历史伪总数',async()=>{
  const bucket=await reset();await seedDay('2026-10-28',8);
  for(const value of ['broken-json',registry({work:{...correction(4),anchorClicks:-1}}),' '.repeat(1024*1024+1),registry({work:correction(Number.MAX_SAFE_INTEGER)})]){
    await bucket.put(DOWNLOAD_CORRECTIONS_KEY,value);
    const response=await get();assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'Download statistics unavailable.'});
  }
});
