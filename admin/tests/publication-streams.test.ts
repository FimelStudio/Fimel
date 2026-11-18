import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { makeWork } from '../shared/model';
import type { Work, Asset } from '../shared/model';

let runtime: Miniflare;
before(async()=>{
  // Exercise real R2 bindings, instrumenting only faults and private body reads.
  const script=`import {publishedWork} from './admin/worker/publication';
    export default {async fetch(request,env){
      const {work,mode}=await request.json();let reads=0,cancelled=0;
      const priv=new Proxy(env.PRIVATE,{get(bucket,name){
        if(name==='get')return async(...args)=>{
          reads++;if(mode==='forbid-read')throw new Error('existing assets must not open private bodies');
          const source=await bucket.get(...args);if(!source)return source;
          const cancel=source.body.cancel.bind(source.body);source.body.cancel=(reason)=>{cancelled++;return cancel(reason);};
          return mode==='source-changed'?new Proxy(source,{get(object,key){return key==='httpEtag'?'changed-after-head':Reflect.get(object,key);}}):source;
        };
        const value=Reflect.get(bucket,name);return typeof value==='function'?value.bind(bucket):value;
      }});
      const pub=new Proxy(env.PUBLIC,{get(bucket,name){
        if(name==='put'&&mode==='conditional-rejected')return async()=>null;
        const value=Reflect.get(bucket,name);return typeof value==='function'?value.bind(bucket):value;
      }});
      try{return Response.json({...await publishedWork(work,priv,pub,crypto.randomUUID()),reads,cancelled});}
      catch(error){return Response.json({error:error.message,reads,cancelled},{status:error.status??500});}
    }};`;
  const bundle=await build({stdin:{contents:script,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'browser'});
  runtime=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-14',r2Buckets:['PRIVATE','PUBLIC']}));await runtime.ready;
});
after(async()=>{await runtime?.dispose();});
const run=(work:Work,mode='normal')=>runtime.dispatchFetch('http://localhost/',{method:'POST',headers:{'Content-Type':'application/json',Connection:'close'},body:JSON.stringify({work,mode})});
const key=(work:Work,asset:Asset)=>{const release=work.versions.find(v=>v.files.some(f=>f.id===asset.id));return `${release?'works':'images'}/${work.project.type}/${work.project.slug}/${release?`${release.label}-${asset.id}`:asset.id}/${asset.name}`;};
async function fixture(images=1,files=0){
  const work=makeWork();work.project.slug=`streams-${work.id}`;work.project.status='released';work.markdown.description.zh='原始正文';
  const bucket=await runtime.getR2Bucket('PRIVATE');
  for(let i=0;i<images+files;i++){
    const image=i<images;const bytes=new Uint8Array(image?128:65536).fill(i+1);
    const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    const id=`asset-${i}`,name=image?`${i}.svg`:`${i}.zip`,privateKey=`uploads/verified/${work.id}/${id}/${name}`,versionId=image?'':`release-${i}`;
    const asset:Asset={id,name,privateKey,mime:image?'image/svg+xml':'application/zip',size:bytes.length,sha256};
    await bucket.put(privateKey,bytes,{httpMetadata:{contentType:asset.mime},customMetadata:{workId:work.id,assetId:id,sha256,versionId}});
    if(image){work.gallery.push(asset);work.markdown.description.zh+=`\n![图 ${i}](fimel-asset:${id})`;}
    else work.versions.push({id:versionId,label:`1.${i}`,date:'2026-11-18',status:'released',gameVersions:[],changelog:'发行说明',files:[asset]});
  }
  work.coverId=work.gallery[0].id;return work;
}

test('32 张图片与 4 个文件首次发布后，仅改文字不再读取私有文件流',async()=>{
  const work=await fixture(32,4);const first=await run(work);assert.equal(first.status,200,await first.clone().text());
  const initial=await first.json() as {reads:number;releases:{files:unknown[]}[]};assert.equal(initial.reads,36);assert.equal(initial.releases.length,4);
  const bucket=await runtime.getR2Bucket('PUBLIC');const objects=await bucket.list({prefix:`images/${work.project.type}/${work.project.slug}/`});const files=await bucket.list({prefix:`works/${work.project.type}/${work.project.slug}/`});
  const before=[...objects.objects,...files.objects].map(object=>[object.key,object.httpEtag]);
  work.markdown.description.zh+='\n只改了几行文字，图片与文件保持不变。';
  const second=await run(work,'forbid-read');assert.equal(second.status,200,await second.clone().text());
  const result=await second.json() as {reads:number;project:Work['project'];releases:unknown[]};assert.equal(result.reads,0);assert.equal(result.releases.length,4);
  const path=result.project.content.description as {zh:string};assert.match(await(await bucket.get(new URL(path.zh).pathname.slice(1)))!.text(),/只改了几行文字/);
  for(const [path,etag] of before)assert.equal((await bucket.head(path))!.httpEtag,etag);
});

test('存在公开副本仍验证私有资源归属，不允许借用其他作品',async()=>{
  const work=await fixture();assert.equal((await run(work)).status,200);
  const asset=work.gallery[0];const bucket=await runtime.getR2Bucket('PRIVATE');const source=await bucket.get(asset.privateKey!);const bytes=await source!.arrayBuffer();
  await bucket.put(asset.privateKey!,bytes,{httpMetadata:{contentType:asset.mime},customMetadata:{workId:'other-work',assetId:asset.id,sha256:asset.sha256,versionId:''}});
  const rejected=await run(work,'forbid-read');assert.equal(rejected.status,422);assert.equal((await rejected.json() as {reads:number}).reads,0);
});

test('公开文件元数据冲突拒绝覆盖，不打开私有文件流',async()=>{
  for(const mismatch of ['sha256','assetId','mime','size']){
    const work=await fixture();const asset=work.gallery[0],bucket=await runtime.getR2Bucket('PUBLIC');
    await bucket.put(key(work,asset),new Uint8Array(asset.size+(mismatch==='size'?1:0)),{httpMetadata:{contentType:mismatch==='mime'?'text/plain':asset.mime},customMetadata:{assetId:mismatch==='assetId'?'foreign':asset.id,sha256:mismatch==='sha256'?'b'.repeat(64):asset.sha256}});
    const before=await bucket.head(key(work,asset));const rejected=await run(work,'forbid-read');assert.equal(rejected.status,409);
    assert.equal((await rejected.json() as {reads:number}).reads,0);assert.equal((await bucket.head(key(work,asset)))!.httpEtag,before!.httpEtag);
  }
});

test('新增资源遇到源文件变化或条件写入拒绝时释放未读流',async()=>{
  for(const mode of ['source-changed','conditional-rejected']){
    const work=await fixture();const rejected=await run(work,mode);assert.equal(rejected.status,409,await rejected.clone().text());
    const result=await rejected.json() as {reads:number;cancelled:number};assert.equal(result.reads,1);assert.equal(result.cancelled,1);
    assert.equal(await(await runtime.getR2Bucket('PUBLIC')).head(key(work,work.gallery[0])),null);
  }
});
