import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {makeWork} from '../shared/model';
import type {Library,Work,PublicManifest} from '../shared/model';
import {publicationFingerprint,mergeWork} from '../shared/revisions';
import {DEFAULT_SITE_CONTENT} from '../../src/content/site-content';
import {parseReleases,releaseProject,fileSize} from '../../src/content/releases';
let mf:Miniflare;
before(async()=>{const bundle=await build({entryPoints:['admin/worker/local.ts'],bundle:true,write:false,format:'esm',platform:'browser'});mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-12',r2Buckets:['PRIVATE','PUBLIC'],bindings:{ADMIN_ORIGIN:'http://127.0.0.1:5174',ACCESS_AUD:'local-test',ACCESS_ISSUER:'https://local.invalid',ADMIN_EMAILS:'local-admin@example.invalid'}}));await mf.ready;});
after(async()=>{await mf?.dispose();});
const request=(path:string,method='GET',body?:unknown,headers:Record<string,string>={})=>mf.dispatchFetch(`http://127.0.0.1/api/${path}`,{method,headers:{Origin:'http://127.0.0.1:5174','X-Fimel-CSRF':'1','Content-Type':'application/json',Connection:'close',...headers},body:body===undefined?undefined:JSON.stringify(body)});
const state=async()=>{const r=await request('library');assert.equal(r.status,200);return await r.json() as {library:Library;public:PublicManifest;etag:string;publicEtag:string};};
async function add(slug:string){const work=makeWork();work.project.slug=slug;work.project.title={zh:slug};work.markdown.description.zh='原始正文';const r=await request(`works/${work.id}`,'PUT',{base:null,work});assert.equal(r.status,200,await r.clone().text());return (await r.json()as{library:Library}).library.works.find(w=>w.id===work.id)!;}
async function save(base:Work,work:Work){return request(`works/${work.id}`,'PUT',{base,work});}
test('不同作品同时保存不会丢失修改，同一作品不重叠字段自动合并',async()=>{
  const a=await add('parallel-a'),b=await add('parallel-b');
  const writes=await Promise.all([save(a,{...a,project:{...a.project,title:'A 改名'}}),save(b,{...b,project:{...b.project,title:'B 改名'}})]);assert.deepEqual(writes.map(r=>r.status),[200,200]);
  const current=await state();assert.equal(current.library.works.find(w=>w.id===a.id)!.project.title,'A 改名');assert.equal(current.library.works.find(w=>w.id===b.id)!.project.title,'B 改名');
  const base=current.library.works.find(w=>w.id===a.id)!;
  const edits=await Promise.all([save(base,{...base,project:{...base.project,title:'同作品改名'}}),save(base,{...base,project:{...base.project,summary:'另一个管理员的介绍'}})]);assert.deepEqual(edits.map(r=>r.status),[200,200]);
  const result=(await state()).library.works.find(w=>w.id===a.id)!;assert.equal(result.project.title,'同作品改名');assert.equal(result.project.summary,'另一个管理员的介绍');
});
test('同字段冲突返回三方内容，不能覆盖且保留独立修改和稳定地址',async()=>{
  const base=await add('conflict-work');const a={...base,project:{...base.project,title:'甲'}};assert.equal((await save(base,a)).status,200);
  const b={...base,project:{...base.project,title:'乙',summary:'乙的独立介绍'}};const conflict=await save(base,b);assert.equal(conflict.status,409);const result=await conflict.json()as{conflict:{base:Work;current:Work;incoming:Work;paths:string[]}};
  assert.equal(result.conflict.incoming.project.title,'乙');assert.equal(result.conflict.current.project.title,'甲');assert.ok(result.conflict.paths.includes('project.title'));
  const merged=mergeWork(base,result.conflict.current,b);assert.equal(merged.work.project.summary,'乙的独立介绍');
  assert.equal((await save(result.conflict.current,merged.work)).status,200);
  const current=(await state()).library.works.find(w=>w.id===base.id)!;assert.equal((await save(current,{...current,project:{...current.project,slug:'changed-slug'}})).status,422);
  assert.equal((await request(`works/${base.id}`,'PUT',{base:current,work:current},{'x-local-test-anonymous':'1'})).status,401);
});
test('发布指纹区分草稿、公开内容与未使用候选，预览只读且读取实际公开正文',async()=>{
  const work=await add('publication-state');const s=await state();
  const response=await request(`publish/${work.id}`,'POST',{}, {'If-Match':s.etag,'X-Public-ETag':s.publicEtag});assert.equal(response.status,200,await response.text());
  const first=await state();const fingerprint=first.public.publicationStates![work.project.slug].fingerprint;
  assert.equal(fingerprint,await publicationFingerprint(work));const changed={...work,markdown:{...work.markdown,description:{zh:'新正文，尚未发布'}}};assert.notEqual(await publicationFingerprint(changed),fingerprint);
  assert.equal((await save(work,changed)).status,200);const preview=await request(`published/${work.id}`);assert.equal(preview.status,200);const body=await preview.json()as{markdown:Work['markdown']};assert.equal(body.markdown.description.zh,'原始正文');
  const after=await state();assert.equal(after.publicEtag,first.publicEtag);assert.equal((await request(`published/${work.id}`,'GET',undefined,{'x-local-test-anonymous':'1'})).status,401);
});
test('网站内容独立条件保存、独立发布并保留作品和发布记录，拒绝未知作品与危险链接',async()=>{
  const get=await request('site');const initial=await get.json()as{site:typeof DEFAULT_SITE_CONTENT;etag:string};const site={...initial.site,featured:{maps:[],released:[],development:[]},updates:[{id:'news-one',title:{zh:'真实更新'},summary:{zh:'本地验收'},date:'2026-10-16',workSlug:'publication-state'}]};
  const before=await state();const saved=await request('site','PUT',{site},{'If-Match':initial.etag});assert.equal(saved.status,200,await saved.clone().text());const draft=await saved.json()as{etag:string};assert.equal((await state()).publicEtag,before.publicEtag);
  assert.equal((await request('site','PUT',{site},{'If-Match':initial.etag})).status,409);
  const published=await request('site/publish','POST',{}, {'If-Match':draft.etag,'X-Public-ETag':before.publicEtag});assert.equal(published.status,200,await published.text());
  const after=await state();assert.deepEqual(after.public.projects,before.public.projects);assert.deepEqual(after.public.publicationStates,before.public.publicationStates);assert.equal(after.public.site!.updates[0].title&&typeof after.public.site!.updates[0].title,'object');
  assert.equal((await request('site','PUT',{site:{...site,contact:{...site.contact,x:'javascript:alert(1)'}}},{'If-Match':draft.etag})).status,422);
  const invalid=await request('site','PUT',{site:{...site,featured:{...site.featured,maps:['unknown-work']}}},{'If-Match':draft.etag});const invalidBody=await invalid.json()as{etag:string};
  assert.equal((await request('site/publish','POST',{}, {'If-Match':invalidBody.etag,'X-Public-ETag':after.publicEtag})).status,422);
  assert.equal((await state()).publicEtag,after.publicEtag);
});
test('下载版本解析拒绝草稿和私有地址，兼容无版本的旧目录',()=>{
  const project=makeWork().project;project.slug='release-test';const file={id:'f1',name:'a.zip',mime:'application/zip',size:42,sha256:'a'.repeat(64),publicUrl:'https://download.studiofimel.com/works/bedrock/release-test/1/a.zip'};
  const release={id:'r1',label:'1.0',date:'2026-10-16',status:'released',gameVersions:['1.21'],loaders:['Fabric'],platforms:['Windows'],files:[file]};
  assert.deepEqual(parseReleases({schemaVersion:1,projects:[project]},[project]),{});assert.equal(parseReleases({releases:{'release-test':[release]}},[project])['release-test'][0].files.length,1);
  for(const altered of [{...release,status:'draft'},{...release,files:[{...file,publicUrl:'https://evil.invalid/a.zip'}]},{...release,files:[{...file,privateKey:'secret'}]}])assert.throws(()=>parseReleases({releases:{'release-test':[altered]}},[project]));
});

test('未命名版本可保存和恢复并创建上传会话，发布只公开完成的发行版本',async()=>{
  const work=await add('unfinished-releases');
  const privateBucket=await mf.getR2Bucket('PRIVATE'),publicBucket=await mf.getR2Bucket('PUBLIC');
  const privateKey='uploads/verified/private-release/private.zip';
  await privateBucket.put(privateKey,'unfinished private file');
  const publicKey='works/bedrock/unfinished-releases/1.0/stable.zip';
  await publicBucket.put(publicKey,'stable file');
  const draft={label:'',date:'2026-10-26',gameVersions:[],status:'draft' as const,changelog:{zh:''},files:[]};
  const changed:Work={...work,project:{...work.project,status:'released'},versions:[
    {...draft,id:'unfinished',files:[{id:'private-release',name:'private.zip',size:23,mime:'application/zip',sha256:'a'.repeat(64),privateKey}]},
    {...draft,id:'another-unfinished'},
    {...draft,id:'stable',label:'1.0',status:'released',files:[{id:'stable-file',name:'stable.zip',size:11,mime:'application/zip',sha256:'b'.repeat(64),publicUrl:`https://download.studiofimel.com/${publicKey}`}]},
  ]};
  const saved=await save(work,changed);assert.equal(saved.status,200,await saved.text());
  const initial=await state();const stored=initial.library.works.find(w=>w.id===work.id)!;
  assert.deepEqual(stored.versions.map(v=>v.label),['','','1.0']);
  assert.equal(initial.public.projects.some(p=>p.slug===work.project.slug),false);
  const upload=await request('uploads','POST',{name:'second.zip',size:32,kind:'file',workId:work.id,versionId:'another-unfinished'});
  assert.equal(upload.status,201,await upload.clone().text());
  const uploadId=(await upload.json() as {upload:{id:string}}).upload.id;
  const savedAgain=await save(stored,{...stored,project:{...stored.project,summary:'只为创建恢复基线'}});
  assert.equal(savedAgain.status,200,await savedAgain.text());
  const snapshots=await privateBucket.list({prefix:'backups/library/'});let restoreId:string|undefined;
  for(const object of snapshots.objects){
    const snapshot=await(await privateBucket.get(object.key))!.json() as {value:Library};
    const candidate=snapshot.value.works.find(w=>w.id===work.id);
    if(candidate?.versions.length===3&&!candidate.project.summary){restoreId=object.key.split('/').at(-1)!.replace('.json','');break;}
  }
  assert.ok(restoreId);
  const beforeRestore=await state();const restored=await request(`restore/library/${restoreId}`,'POST',{}, {'If-Match':beforeRestore.etag});
  assert.equal(restored.status,200,await restored.text());
  const ready=await state();assert.deepEqual(ready.library.works.find(w=>w.id===work.id)!.versions.map(v=>v.label),['','','1.0']);
  const blocked=await request(`publish/${work.id}`,'POST',{}, {'If-Match':ready.etag,'X-Public-ETag':ready.publicEtag});
  assert.equal(blocked.status,409);assert.match(await blocked.text(),/仍有未完成上传/);
  assert.equal((await request(`uploads/${uploadId}`,'DELETE')).status,200);
  const published=await request(`publish/${work.id}`,'POST',{}, {'If-Match':ready.etag,'X-Public-ETag':ready.publicEtag});
  assert.equal(published.status,200,await published.text());
  const after=await state();assert.deepEqual(after.public.releases[work.project.slug].map(v=>v.label),['1.0']);
  const manifest=await(await publicBucket.get('data/works.json'))!.text();
  assert.ok(!manifest.includes('private-release'));assert.ok(!manifest.includes('privateKey'));assert.ok(!manifest.includes('another-unfinished'));
  assert.deepEqual((await publicBucket.list({prefix:'works/bedrock/unfinished-releases/'})).objects.map(o=>o.key),[publicKey]);
  assert.ok(await privateBucket.head(privateKey));
  const base=after.library.works.find(w=>w.id===work.id)!;const invalid=structuredClone(base);invalid.versions[0].status='released';
  const rejected=await save(base,invalid);assert.equal(rejected.status,422);assert.match(await rejected.text(),/第 1 个版本.*已发行版本必须填写版本号/);
  const unchanged=await state();assert.equal(unchanged.publicEtag,after.publicEtag);assert.equal(unchanged.library.works.find(w=>w.id===work.id)!.versions[0].status,'draft');
});

test('无文件的较新版本不会遮挡现有实际下载，主下载与官网版本选择一致',async()=>{
  const work=await add('available-release');const key='works/bedrock/available-release/1/archive.zip';const bucket=await mf.getR2Bucket('PUBLIC');await bucket.put(key,'test');
  const base={date:'2026-10-16',gameVersions:['1.21'],status:'released' as const,changelog:{zh:''}};
  const changed={...work,project:{...work.project,status:'released' as const},versions:[{...base,id:'empty-release',label:'2.0',files:[]},{...base,id:'available-release',label:'1.0',files:[{id:'archive-file',name:'archive.zip',size:4,mime:'application/zip',sha256:'a'.repeat(64),publicUrl:`https://download.studiofimel.com/${key}`}]}]};
  const saved=await save(work,changed);assert.equal(saved.status,200,await saved.text());const before=await state();const response=await request(`publish/${work.id}`,'POST',{}, {'If-Match':before.etag,'X-Public-ETag':before.publicEtag});assert.equal(response.status,200,await response.text());
  const published=(await state()).public.projects.find(p=>p.slug===work.project.slug)!;assert.equal(published.version,'1.0');assert.equal(published.downloadUrl,`https://download.studiofimel.com/${key}`);assert.equal(published.updated,new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'}));assert.equal(published.size,'1 KiB');
  const notes=await(await bucket.get(new URL(typeof published.content.versions==='object'?published.content.versions.zh!:published.content.versions!).pathname.slice(1)))!.text();assert.ok(!notes.includes('SHA-256'));assert.ok(!notes.includes('archive.zip'));
});

test('发行元数据修正旧时间和平台，浏览不会按当天更改时间',()=>{
  const project=makeWork().project;project.updated='2026-05-19';project.published='2026-05-16';const release={id:'v1',label:'v1.6.1',date:'2026-10-16',status:'released' as const,gameVersions:[],platforms:['Blockbench Desktop ≥ 5.2.0'],files:[{id:'f1',name:'a.zip',size:78929,mime:'application/zip',sha256:'a'.repeat(64),publicUrl:'https://download.studiofimel.com/works/bedrock/test/v1/a.zip'}]};
  const view=releaseProject(project,[release]);assert.equal(view.updated,'2026-10-16');assert.equal(view.published,'2026-05-16');assert.equal(view.size,fileSize(78929));assert.deepEqual(view.platform,release.platforms);assert.equal(releaseProject(project,[]).updated,'2026-05-19');assert.equal(releaseProject(project,[release],'2026-10-17').updated,'2026-10-17');assert.equal(project.updated,'2026-05-19');
});
