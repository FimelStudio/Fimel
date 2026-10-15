import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
let mf:Miniflare;
before(async()=>{const bundle=await build({stdin:{contents:"import {collectWorkEvent} from './src/lib/work-event-worker';export default{fetch(request,env){return collectWorkEvent(request,env.PUBLIC,env.METRICS_LIMITER)}}",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-12',r2Buckets:['PUBLIC'],ratelimits:{METRICS_LIMITER:{namespace_id:'11002',simple:{limit:45,period:60}}}}));await mf.ready;await(await mf.getR2Bucket('PUBLIC')).put('data/works.json',JSON.stringify({projects:[{slug:'public-work',status:'released',downloadUrl:'https://download.studiofimel.com/works/tools/public-work/1/a.zip'},{slug:'developing',status:'development'}]}));});
after(async()=>{await mf?.dispose();});
function request(slug:string,kind:string,origin='https://studiofimel.com',ip='192.0.2.1'){return mf.dispatchFetch('http://localhost/api/work-events',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','cf-connecting-ip':ip},body:JSON.stringify({slug,kind})});}
test('聚合浏览与点击分别计数，兼容官网和 GitHub Pages，存储不包含身份或 IP',async()=>{
  const responses=await Promise.all([request('public-work','view'),request('public-work','download','https://fimelstudio.github.io'),request('developing','view')]);assert.deepEqual(responses.map(r=>r.status),[204,204,204]);
  const bucket=await mf.getR2Bucket('PUBLIC');const object=await bucket.get(`metrics/works/${new Date().toISOString().slice(0,10)}.json`);const raw=await object!.text();const day=JSON.parse(raw);assert.deepEqual(day.works['public-work'],{views:1,downloadClicks:1});assert.equal(day.works.developing.views,1);assert.ok(!raw.includes('192.0.2'));assert.ok(!raw.includes('@'));
  assert.equal((await request('public-work','view','https://evil.invalid')).status,403);assert.equal((await request('private-draft','view')).status,404);assert.equal((await request('developing','download')).status,404);assert.equal((await request('public-work','unknown')).status,422);
});
test('采集使用真实本地限流，失败不写入计数',async()=>{let limited=false;for(let n=0;n<50;n++){const r=await request('public-work','view','https://studiofimel.com','192.0.2.45');await r.text();if(r.status===429){limited=true;break;}}assert.ok(limited);});
