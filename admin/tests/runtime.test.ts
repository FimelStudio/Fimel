import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { makeWork, PART_SIZE, MAX_FILE_SIZE } from '../shared/model';
import type { Library, Upload, Asset } from '../shared/model';

let mf: Miniflare;
const origin='http://127.0.0.1:5174';
before(async()=>{const bundled=await build({entryPoints:['admin/worker/local.ts'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2023'});
  mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-10-12',r2Buckets:['PRIVATE','PUBLIC'],
    bindings:{ADMIN_ORIGIN:origin,ACCESS_AUD:'local-test',ACCESS_ISSUER:'https://local.invalid',ADMIN_EMAILS:'local-admin@example.invalid'}}));await mf.ready;});
after(async()=>{await mf?.dispose();});
async function req(path:string,method='GET',body?:unknown,headers:Record<string,string>={}){return mf.dispatchFetch(`http://127.0.0.1/api/${path}`,{method,headers:{Origin:origin,'X-Fimel-CSRF':'1','Content-Type':'application/json',Connection:'close',...headers},body:body===undefined?undefined:JSON.stringify(body)});}
async function state(){const r=await req('library');assert.equal(r.status,200);return {data:await r.json() as {library:Library;publicEtag:string;public:{projects:{slug:string}[]}},etag:r.headers.get('etag')!};}
function work(slug:string){const w=makeWork();w.project.slug=slug;w.project.title={zh:'测试 '+slug};w.markdown.description={zh:'# 测试作品\n\n<script>alert(1)</script>'};return w;}
async function add(slug:string){const s=await state();const w=work(slug);s.data.library.works.push(w);const r=await req('library','PUT',s.data.library,{'If-Match':s.etag});assert.equal(r.status,200,await r.text());return w;}
test('real R2 conditional writes and conflict detection',async()=>{await add('runtime-map');const s=await state();const r=await req('library','PUT',s.data.library,{'If-Match':'"old"'});assert.equal(r.status,409);assert.equal((await req('library','PUT',s.data.library)).status,428);const first=structuredClone(s.data.library),second=structuredClone(s.data.library);first.works[0].project.title='Editor A';second.works[0].project.title='Editor B';const writes=await Promise.all([req('library','PUT',first,{'If-Match':s.etag}),req('library','PUT',second,{'If-Match':s.etag})]);assert.deepEqual(writes.map(r=>r.status).sort(),[200,409]);});
test('anonymous and cross origin cannot read or write; unsupported methods fail',async()=>{assert.equal((await req('library','GET',undefined,{'x-local-test-anonymous':'1'})).status,401);assert.equal((await req('library','PUT',{}, {Origin:'https://evil.invalid'})).status,403);assert.equal((await req('library','DELETE')).status,405);assert.equal((await req('missing')).status,404);});
test('new draft is private; publish → public manifest → unpublish → republish',async()=>{const s=await state();const w=s.data.library.works[0];const pub=await mf.getR2Bucket('PUBLIC');assert.equal(await pub.get('data/works.json'),null);
  const result=await req(`publish/${w.id}`,'POST',{}, {'If-Match':s.etag,'X-Public-ETag':s.data.publicEtag});assert.equal(result.status,200,await result.text());
  const body=await (await pub.get('data/works.json'))!.text();assert.ok(body.includes('runtime-map'));assert.ok(!body.includes('privateKey'));assert.ok(!body.includes('legacy'));assert.ok(!body.includes('ADMIN_EMAILS'));
  const next=await state();assert.equal((await req(`unpublish/${w.id}`,'POST',{}, {'If-Match':next.etag,'X-Public-ETag':next.data.publicEtag})).status,200);
  const off=await state();assert.equal(off.data.public.projects.length,0);assert.equal((await req(`publish/${w.id}`,'POST',{}, {'If-Match':off.etag,'X-Public-ETag':off.data.publicEtag})).status,200);
});
test('private snapshots and restore create backup before update',async()=>{const history=await req('history');const items=await history.json() as {snapshots:{key:string}[]};const snapshot=items.snapshots.find(x=>x.key.startsWith('backups/library/'))!;assert.ok(snapshot);const s=await state();const [ ,kind,id ]=snapshot.key.split('/');const r=await req(`restore/${kind}/${id.replace('.json','')}`,'POST',{}, {'If-Match':s.etag});assert.equal(r.status,200,await r.text());});
test('upload validates limits, filename, extension and association',async()=>{const w=await add('upload-tests');for(const input of [{name:'a.svg',size:10,kind:'image'},{name:123,size:10,kind:'file'},{name:'a.png',displayName:'bad\u0000name.png',size:10,kind:'image'},{name:'../a.zip',size:10,kind:'file'},{name:'a.zip',size:MAX_FILE_SIZE+1,kind:'file'},{name:'a.zip',size:10,kind:'file'}]){assert.equal((await req('uploads','POST',{...input,workId:w.id})).status,422);}});

test('scoped temporary cleanup preserves other sessions and every verified object',async()=>{
  const w=await add('cleanup-scope');const bucket=await mf.getR2Bucket('PRIVATE');const uploads:Upload[]=[];
  for(let n=0;n<3;n++){const r=await req('uploads','POST',{name:`scope-${n}.png`,size:10,kind:'image',workId:w.id});assert.equal(r.status,201);const{upload}=await r.json()as{upload:Upload};uploads.push(upload);await bucket.put(upload.key,'temporary');await bucket.put(`uploads/verified/${upload.id}/${upload.name}`,'verified');if(n<2)await bucket.put(`uploads/sessions/${upload.id}.json`,JSON.stringify({...upload,status:'complete'}));}
  assert.equal((await req('uploads/cleanup','POST',{sessionIds:['../escape']})).status,422);
  const cleaned=await req('uploads/cleanup','POST',{sessionIds:[uploads[0].id,uploads[2].id]});assert.equal(cleaned.status,200);assert.equal((await cleaned.json()as{cleaned:number}).cleaned,1);
  assert.equal(await bucket.head(uploads[0].key),null);assert.ok(await bucket.head(uploads[1].key));assert.ok(await bucket.head(uploads[2].key));for(const u of uploads)assert.ok(await bucket.head(`uploads/verified/${u.id}/${u.name}`));
});
async function upload(size:number, options:{wrongHash?:boolean;cancel?:boolean}={}) {
  const w=await add(`upload-${crypto.randomUUID()}`);w.project.status='released';w.versions=[{id:'v1',label:'1.0',date:'2026-10-14',gameVersions:['1.21'],status:'released',changelog:'测试',files:[]}];
  const s=await state();const lib=s.data.library;lib.works=lib.works.map(x=>x.id===w.id?w:x);assert.equal((await req('library','PUT',lib,{'If-Match':s.etag})).status,200);
  const created=await req('uploads','POST',{name:'test.zip',size,kind:'file',workId:w.id,versionId:'v1'});assert.equal(created.status,201,await created.clone().text());const {upload}=await created.json() as {upload:Upload};
  const hasher=createHash('sha256');let firstReceipt:string|undefined;
  for(let n=1;n<=Math.ceil(size/PART_SIZE);n++) {
    const bytes=Buffer.alloc(Math.min(PART_SIZE,size-(n-1)*PART_SIZE),n%251);if(n===1)bytes.set([0x50,0x4b,3,4]);hasher.update(bytes);const hash=createHash('sha256').update(bytes).digest('hex');
    const headers={Origin:origin,'X-Fimel-CSRF':'1','Content-Type':'application/octet-stream','Content-Length':String(bytes.length),'X-Part-SHA256':hash};
    const r=await mf.dispatchFetch(`http://127.0.0.1/api/uploads/${upload.id}/parts/${n}`,{method:'PUT',headers,body:bytes});assert.equal(r.status,200,await r.clone().text());
    if(n===1){firstReceipt=await r.text();const retry=await mf.dispatchFetch(`http://127.0.0.1/api/uploads/${upload.id}/parts/1`,{method:'PUT',headers,body:bytes});assert.equal(retry.status,200);assert.equal(await retry.text(),firstReceipt);const resume=await req(`uploads/${upload.id}`);const data=await resume.json() as {parts:unknown[]};assert.equal(data.parts.length,1);}
    if(options.cancel){assert.equal((await req(`uploads/${upload.id}`,'DELETE')).status,200);assert.equal((await req(`uploads/${upload.id}/complete`,'POST',{sha256:hash})).status,409);return;}
  }
  const hash=hasher.digest('hex');
  const complete=await req(`uploads/${upload.id}/complete`,'POST',{sha256:options.wrongHash?'f'.repeat(64):hash});
  if(options.wrongHash){assert.equal(complete.status,422,await complete.text());return;}
  assert.equal(complete.status,200,await complete.clone().text());const {asset}=await complete.json() as {asset:Asset};
  assert.equal(asset.sha256,hash);assert.equal(asset.size,size);assert.equal((await req(`uploads/${upload.id}/complete`,'POST',{sha256:hash})).status,200);
  const priv=await mf.getR2Bucket('PRIVATE');const obj=await priv.head(asset.privateKey!);assert.equal(obj!.size,size);
  const current=await state();current.data.library.works.find(x=>x.id===w.id)!.versions[0].files=[{...asset,primary:true}];assert.equal((await req('library','PUT',current.data.library,{'If-Match':current.etag})).status,200);
  const ready=await state();const publish=await req(`publish/${w.id}`,'POST',{}, {'If-Match':ready.etag,'X-Public-ETag':ready.data.publicEtag});assert.equal(publish.status,200,await publish.text());
  const pub=await mf.getR2Bucket('PUBLIC');const manifest=await (await pub.get('data/works.json'))!.json() as {projects:{slug:string;downloadUrl:string}[]};const project=manifest.projects.find(p=>p.slug===w.project.slug)!;
  const downloaded=await pub.get(new URL(project.downloadUrl).pathname.slice(1));assert.equal(downloaded!.size,size);
  const full=createHash('sha256');for await(const bytes of downloaded!.body)full.update(bytes);assert.equal(full.digest('hex'),hash);
}
test('multipart completion checks SHA-256 in actual local R2',async()=>{await upload(1024);await upload(1024,{wrongHash:true});await upload(1024,{cancel:true});});
test('native R2 part verification rejects corrupted retries and cleans staging objects without touching verified files',async()=>{
  const w=await add('native-part-check');w.versions=[{id:'v1',label:'1.0',date:'2026-10-15',gameVersions:[],status:'draft',changelog:{zh:'checksum verification'},files:[]}];
  const current=await state();current.data.library.works=current.data.library.works.map(x=>x.id===w.id?w:x);assert.equal((await req('library','PUT',current.data.library,{'If-Match':current.etag})).status,200);
  const created=await req('uploads','POST',{name:'native.zip',size:32,kind:'file',workId:w.id,versionId:'v1'});assert.equal(created.status,201,await created.clone().text());const {upload:s}=await created.json()as{upload:Upload};
  const bytes=Buffer.alloc(32,7);bytes.set([0x50,0x4b,3,4]);const digest=createHash('sha256').update(bytes).digest('hex');
  const part=(body:Buffer,hash:string)=>mf.dispatchFetch(`http://127.0.0.1/api/uploads/${s.id}/parts/1`,{method:'PUT',headers:{Origin:origin,'X-Fimel-CSRF':'1','Content-Type':'application/octet-stream','Content-Length':String(body.length),'X-Part-SHA256':hash},body});
  assert.equal((await part(bytes,'0'.repeat(64))).status,422);const invalid=Buffer.alloc(32,7);assert.equal((await part(invalid,createHash('sha256').update(invalid).digest('hex'))).status,422);
  assert.equal((await part(bytes,digest)).status,200);const corrupted=Buffer.from(bytes);corrupted[10]++;assert.equal((await part(corrupted,digest)).status,422);assert.equal((await part(corrupted,createHash('sha256').update(corrupted).digest('hex'))).status,409);
  const bucket=await mf.getR2Bucket('PRIVATE');assert.equal((await bucket.list({prefix:`uploads/temporary/${s.id}/parts/`})).objects.length,0);
  assert.equal((await req(`uploads/${s.id}/complete`,'POST',{sha256:digest})).status,200);const confirmed=await req(`uploads/${s.id}`);const completed=(await confirmed.json()as{upload:Upload}).upload;
  await bucket.put(`uploads/temporary/${s.id}/parts/interrupted`,new Uint8Array([1]));assert.equal((await req('uploads/cleanup','POST',{sessionIds:[s.id]})).status,200);
  assert.equal((await bucket.list({prefix:`uploads/temporary/${s.id}/`})).objects.length,0);assert.ok(await bucket.head(completed.asset!.privateKey!));
});
test('100 MiB real multipart, retry, resume, publication and full reread', {timeout:180000},async()=>{await upload(100*1024**2);});
test('1 GiB real multipart, verification, stream copy and full reread', {timeout:600000},async()=>{await upload(MAX_FILE_SIZE);});
test('missing download aborts publication without replacing the public manifest',async()=>{const w=await add('missing-file');w.project.status='released';w.project.downloadUrl='https://download.studiofimel.com/works/bedrock/missing-file/1.0/not-uploaded.zip';const s=await state();s.data.library.works=s.data.library.works.map(x=>x.id===w.id?w:x);assert.equal((await req('library','PUT',s.data.library,{'If-Match':s.etag})).status,200);const ready=await state();const r=await req(`publish/${w.id}`,'POST',{}, {'If-Match':ready.etag,'X-Public-ETag':ready.data.publicEtag});assert.equal(r.status,422,await r.text());assert.equal((await state()).data.publicEtag,ready.data.publicEtag);});
