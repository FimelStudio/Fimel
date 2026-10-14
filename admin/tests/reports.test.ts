import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { makeWork } from '../shared/model';
import type { Library } from '../shared/model';
import type { AuditFeed } from '../shared/audit';
import { actorKey, libraryChanges } from '../worker/audit';
import { metrics, parseMetrics } from '../worker/analytics';
let mf:Miniflare;
before(async()=>{const bundle=await build({entryPoints:['admin/worker/local.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2023'});mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-12',r2Buckets:['PRIVATE','PUBLIC'],bindings:{ADMIN_ORIGIN:'http://127.0.0.1:5174',ACCESS_AUD:'local-test',ACCESS_ISSUER:'https://local.invalid',ADMIN_EMAILS:'local-admin@example.invalid'}}));await mf.ready;});
after(async()=>{await mf?.dispose();});
const req=(path:string,method='GET',body?:unknown,headers:Record<string,string>={})=>mf.dispatchFetch(`http://127.0.0.1/api/${path}`,{method,headers:{Origin:'http://127.0.0.1:5174','X-Fimel-CSRF':'1','Content-Type':'application/json',Connection:'close',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
test('session displays the verified username without exposing the email or allowing anonymous identity reads',async()=>{
  const response=await req('session');assert.equal(response.status,200);
  const session=await response.json() as {username:string;actorId:string};assert.equal(session.username,'local-admin');assert.equal(session.actorId,await actorKey('local-admin@example.invalid'));
  assert.ok(!JSON.stringify(session).includes('@'));assert.equal((await req('session','GET',undefined,{'x-local-test-anonymous':'1'})).status,401);
});
test('verified administrator audit records creation, field edits, and failed conflicts without raw identity or body',async()=>{
  const work=makeWork();work.project.slug='audit-work';work.project.title='日志测试';work.markdown.description.zh='private-body-never-written-to-audit';
  const first=await req('library');const library:Library={schemaVersion:1,works:[work]};const saved=await req('library','PUT',library,{'If-Match':first.headers.get('etag')!});assert.equal(saved.status,200);assert.equal((await saved.clone().json()as{etag:string}).etag,saved.headers.get('etag'));
  work.project.title='修改后的名称';const edited=await req('library','PUT',library,{'If-Match':saved.headers.get('etag')!});assert.equal(edited.status,200);
  work.project.title='冲突中的名称';assert.equal((await req('library','PUT',library,{'If-Match':'"old"'})).status,409);
  const response=await req('audit');assert.equal(response.status,200);const feed=await response.json()as AuditFeed;const modern=feed.events.filter(e=>'schemaVersion'in e);assert.equal(modern.length,3);assert.equal(modern.filter(e=>e.status==='success').length,2);assert.equal(modern.filter(e=>e.status==='failed').length,1);assert.equal(modern[0].actorId,await actorKey('local-admin@example.invalid'));
  assert.ok(modern.some(e=>e.changes.some(c=>c.action==='created')));assert.ok(modern.some(e=>e.changes.some(c=>c.fields.some(f=>f.name==='作品名称'&&f.before==='日志测试'&&f.after==='修改后的名称'))));
  const bucket=await mf.getR2Bucket('PRIVATE');for(const object of (await bucket.list({prefix:'audit/'})).objects){const text=await(await bucket.get(object.key))!.text();assert.ok(!text.includes('local-admin@example.invalid'));assert.ok(!text.includes('private-body-never-written-to-audit'));}
  assert.equal((await req('audit?days=100')).status,422);assert.equal((await req('audit','GET',undefined,{'x-local-test-anonymous':'1'})).status,401);
});
test('audit strips URL query values, keeps field changes and does not invent historical identity',()=>{
  const before:Library={schemaVersion:1,works:[]};const work=makeWork();work.project.slug='redacted';work.project.title='作品';work.project.creators=[{name:'作者',url:'https://example.com/author?token=not-for-logs'}];
  const changes=libraryChanges(before,{schemaVersion:1,works:[work]});assert.ok(JSON.stringify(changes).includes('example.com/author'));assert.ok(!JSON.stringify(changes).includes('not-for-logs'));
});
test('audited saves reject invalid and oversized libraries without changing their revision',async()=>{
  const initial=await req('library');const state=await initial.json()as{library:Library;etag:string};
  for(const invalid of [null,{schemaVersion:1,works:[{id:'invalid'}]}])assert.equal((await req('library','PUT',invalid,{'If-Match':state.etag})).status,422);
  assert.equal((await req('library','PUT',{padding:'x'.repeat(4_000_001)},{'If-Match':state.etag})).status,413);
  const unchanged=await(await req('library')).json()as{library:Library;etag:string};assert.equal(unchanged.etag,state.etag);assert.deepEqual(unchanged.library,state.library);
});
test('audit detects changed Markdown with unchanged length and omits unchanged large bodies',()=>{
  const work=makeWork();work.project.slug='large-audit';work.project.title='Large audit';work.markdown.description.zh='a'.repeat(200_000);const before:Library={schemaVersion:1,works:[work]},after=structuredClone(before);
  assert.deepEqual(libraryChanges(before,after),[]);after.works[0].markdown.description.zh='b'.repeat(200_000);const changes=libraryChanges(before,after);assert.equal(changes.length,1);assert.ok(changes[0].fields.some(f=>f.name==='正文介绍 · zh'));assert.ok(JSON.stringify(changes).length<1000);
});
test('analytics never exposes a token; missing permissions and invalid ranges fail explicitly',async()=>{
  assert.equal((await req('analytics')).status,503);assert.equal((await req('analytics?days=99')).status,422);assert.equal((await req('analytics','GET',undefined,{'x-local-test-anonymous':'1'})).status,401);
  await assert.rejects(metrics(new Request('https://admin.invalid/api/analytics?days=7'),{}),/只读/);
});
test('statistics preserve real zero counts and separate whole-zone IPs, hostname traffic and Range requests',()=>{
  const data=parseMetrics({traffic:[{count:5,sum:{visits:2,edgeResponseBytes:30},dimensions:{date:'2026-10-14',clientRequestHTTPHost:'studiofimel.com:443'}}],downloads:[{count:3,sum:{edgeResponseBytes:40},dimensions:{date:'2026-10-14'}}],files:[{count:3,sum:{edgeResponseBytes:40},dimensions:{date:'2026-10-14',clientRequestPath:'/works/tools/example/v1/tool.zip'}}],visitors:[{dimensions:{date:'2026-10-14'},sum:{requests:9},uniq:{uniques:4}}]},'2026-10-14T00:00:00Z','2026-10-15T00:00:00Z');
  assert.equal(data.domains[0].host,'studiofimel.com');assert.equal(data.domains[0].visits,2);assert.equal(data.zoneVisitors[0].uniqueIPs,4);assert.equal(data.downloadDays[0].requests,3);assert.equal(data.files[0].slug,'example');assert.equal(data.timeZone,'UTC');
  assert.equal(parseMetrics({traffic:[],downloads:[],files:[],visitors:[]},data.from,data.to).domains.length,0);
});
