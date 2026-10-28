import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {sumWorkEvents,workEventKey,workEventWindow} from '../../src/content/work-events';
import {readWorkDownloadTotals} from '../../src/lib/work-downloads';
import {encodeHistoryCursor} from '../../src/lib/work-download-cursor';

let mf:Miniflare;
let routed:Miniflare;
const today=new Date().toISOString().slice(0,10);
const dateAgo=(days:number)=>{const date=new Date(`${today}T00:00:00Z`);date.setUTCDate(date.getUTCDate()-days);return date.toISOString().slice(0,10);};
const manifest={projects:[{slug:'public-work',status:'released'},{slug:'view-only',status:'released'},{slug:'untouched',status:'development'}]};

before(async()=>{
  const bundle=await build({stdin:{contents:"import {publicWorkDownloads} from './src/lib/work-event-worker';export default{fetch(request,env,ctx){return publicWorkDownloads(request,env.PUBLIC,env.METRICS_LIMITER,ctx)}}",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
  mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-07-28',r2Buckets:['PUBLIC'],ratelimits:{METRICS_LIMITER:{namespace_id:'11002',simple:{limit:45,period:60}}}}));
  const workerBundle=await build({stdin:{contents:"import worker from './src/worker';export default{fetch(request,env,ctx){env.ASSETS={fetch:()=>new Response('static-asset')};return worker.fetch(request,env,ctx)}}",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
  routed=new Miniflare(convertV4MiniflareOptions({modules:true,script:workerBundle.outputFiles[0].text,compatibilityDate:'2026-07-28',r2Buckets:['PUBLIC'],ratelimits:{METRICS_LIMITER:{namespace_id:'11002',simple:{limit:45,period:60}}}}));
  await Promise.all([mf.ready,routed.ready]);
  for(const runtime of [mf,routed]){
    const bucket=await runtime.getR2Bucket('PUBLIC');
    await bucket.put('data/works.json',JSON.stringify(manifest));
    await bucket.put(workEventKey(today),JSON.stringify({date:today,works:{'public-work':{views:10,downloadClicks:7},'view-only':{views:1,downloadClicks:0},'private-draft':{views:500,downloadClicks:400}}}));
    await bucket.put(workEventKey(dateAgo(29)),JSON.stringify({date:dateAgo(29),works:{'public-work':{views:4,downloadClicks:4}}}));
    await bucket.put(workEventKey(dateAgo(30)),JSON.stringify({date:dateAgo(30),works:{'public-work':{views:99,downloadClicks:999}}}));
    await bucket.put(workEventKey(dateAgo(366)),JSON.stringify({date:dateAgo(366),works:{'public-work':{views:8,downloadClicks:5}}}));
    for(const key of ['metrics/works/notes.json','metrics/works/2026-02-31.json','metrics/works/archive/2020-01-01.json','private/metrics/works/2020-01-01.json'])await bucket.put(key,'not a daily event record');
  }
});
after(async()=>{await Promise.all([mf?.dispose(),routed?.dispose()]);});
const request=(path='/api/work-downloads',origin?:string,method='GET')=>mf.dispatchFetch(`http://localhost${path}`,{method,headers:origin?{Origin:origin}:{}});

test('Admin日期筛选仍使用原有UTC范围，跨月和跨年不受主机时区影响',()=>{
  assert.deepEqual(workEventWindow(30,new Date('2027-01-01T00:15:00+08:00')),{from:'2026-12-02T00:00:00.000Z',to:'2027-01-01T00:00:00.000Z',timeZone:'UTC'});
  assert.deepEqual(sumWorkEvents([{slug:'x',views:1,downloadClicks:2},{slug:'x',views:4,downloadClicks:3}]).get('x'),{views:5,downloadClicks:5});
});

test('只读累计包含30天之前及跨年历史，仅返回当前公开作品，区分零与无记录，忽略非日键',async()=>{
  const response=await request();assert.equal(response.status,200);
  const data=await response.json() as {scope:string;segment:{records:number;complete:boolean};works:Record<string,{downloadClicks:number|null}>};
  assert.equal(data.scope,'all-time');assert.equal(data.segment.records,4);assert.equal(data.segment.complete,true);
  assert.deepEqual(data.works,{'public-work':{downloadClicks:1015},'view-only':{downloadClicks:0},untouched:{downloadClicks:null}});
  assert.ok(!JSON.stringify(data).includes('private-draft'));assert.ok(!JSON.stringify(data).includes('views'));
  const day=await(await mf.getR2Bucket('PUBLIC')).get(workEventKey(today));
  assert.equal((await day!.json() as {works:Record<string,{downloadClicks:number}>}).works['public-work'].downloadClicks,7);
  assert.equal(response.headers.get('cache-control'),'no-store');
});

test('公共接口固定前缀、安全 CORS、方法及分页参数边界拒绝任意查询和坏cursor',async()=>{
  for(const origin of ['https://studiofimel.com','https://www.studiofimel.com','https://fimelstudio.github.io']){
    const response=await request('/api/work-downloads',origin);assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),origin);
  }
  const denied=await request('/api/work-downloads','https://evil.invalid');assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),null);
  assert.equal((await request('/api/work-downloads','https://studiofimel.com','OPTIONS')).status,204);
  assert.equal((await request('/api/work-downloads',undefined,'POST')).status,405);
  for(const query of ['?days=10000','?slug=private-draft','?from=2020-01-01','?cursor=abc','?revision=abc','?cursor=abc&revision=abc&cursor=def',`?cursor=${'a'.repeat(4097)}&revision=abc`,'?cursor=%0A&revision=abc'])assert.equal((await request(`/api/work-downloads${query}`)).status,422);
  const revision=(await(await mf.getR2Bucket('PUBLIC')).head('data/works.json'))!.etag;
  assert.equal((await request(`/api/work-downloads?cursor=not-a-real-cursor&revision=${revision}`)).status,422);
  const encoded=await encodeHistoryCursor('history-cursor'),tampered=encoded.slice(0,-1)+(encoded.endsWith('0')?'1':'0');
  assert.equal((await request(`/api/work-downloads?cursor=${tampered}&revision=${revision}`)).status,422);
});

test('Worker 路由返回 JSON，内部缓存命中避免重读日记录，外部禁缓存，普通静态路由仍交给 ASSETS',async()=>{
  const response=await routed.dispatchFetch('https://studiofimel.com/api/work-downloads');assert.equal(response.status,200);
  const original=await response.json();
  const bucket=await routed.getR2Bucket('PUBLIC');
  await bucket.put(workEventKey(today),JSON.stringify({date:today,works:{'public-work':{views:1,downloadClicks:9999}}}));
  const cached=await routed.dispatchFetch('https://studiofimel.com/api/work-downloads',{headers:{Origin:'https://fimelstudio.github.io'}});
  assert.deepEqual(await cached.json(),original);assert.equal(cached.headers.get('access-control-allow-origin'),'https://fimelstudio.github.io');
  assert.equal(cached.headers.get('cache-control'),'no-store');
  assert.equal(await(await routed.dispatchFetch('https://studiofimel.com/a-page')).text(),'static-asset');
});

test('预热缓存后立即下架作品，下一次 GET 不再返回旧slug或私有历史计数',async()=>{
  const bucket=await routed.getR2Bucket('PUBLIC');
  const warm=await routed.dispatchFetch('https://studiofimel.com/api/work-downloads');
  const warmData=await warm.json() as {revision:string;works:Record<string,unknown>};
  assert.ok(Object.hasOwn(warmData.works,'public-work'));
  await bucket.put('data/works.json',JSON.stringify({projects:manifest.projects.filter(project=>project.slug!=='public-work')}));
  const response=await routed.dispatchFetch('https://studiofimel.com/api/work-downloads');assert.equal(response.status,200);
  const data=await response.json() as {works:Record<string,unknown>};
  assert.deepEqual(Object.keys(data.works),['view-only','untouched']);
  assert.ok(!JSON.stringify(data).includes('public-work'));assert.ok(!JSON.stringify(data).includes('private-draft'));
  // The API has no PRIVATE binding and the historical public object remains untouched.
  const day=await bucket.get(workEventKey(today));assert.equal((await day!.json() as {works:Record<string,{downloadClicks:number}>}).works['public-work'].downloadClicks,9999);
  assert.equal((await routed.dispatchFetch(`https://studiofimel.com/api/work-downloads?cursor=${await encodeHistoryCursor('old-cursor')}&revision=${warmData.revision}`)).status,409);
  await bucket.delete('data/works.json');
  assert.equal((await routed.dispatchFetch('https://studiofimel.com/api/work-downloads')).status,503);
});

test('200条之后继续R2分页并累计所有日记录，不把第一段当成总数',async()=>{
  const bucket=await mf.getR2Bucket('PUBLIC');
  for(let offset=0;offset<201;offset+=20)await Promise.all(Array.from({length:Math.min(20,201-offset)},async(_,index)=>{
    const date=dateAgo(400+offset+index);await bucket.put(workEventKey(date),JSON.stringify({date,works:{'public-work':{views:0,downloadClicks:1}}}));
  }));
  let pages=0;
  const totals=await readWorkDownloadTotals('http://localhost/api/work-downloads',async input=>{
    pages++;const response=await mf.dispatchFetch(input);return {ok:response.ok,json:()=>response.json()};
  });
  assert.equal(pages,2);assert.equal(totals.scope,'all-time');assert.deepEqual(totals.works['public-work'],{downloadClicks:1216});
});

test('对象损坏或不存在时返回不可用状态，不返回伪造的零',async()=>{
  const bucket=await mf.getR2Bucket('PUBLIC');
  const date=dateAgo(600);await bucket.put(workEventKey(date),JSON.stringify({date,works:{'public-work':{views:1,downloadClicks:-1}}}));
  let response=await request();assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'Download statistics unavailable.'});assert.equal(response.headers.get('cache-control'),'no-store');
  await bucket.delete('data/works.json');response=await request();assert.equal(response.status,503);
});
