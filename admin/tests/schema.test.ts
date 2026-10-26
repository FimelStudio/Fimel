import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeWork } from '../shared/model';
import { validateLibrary } from '../shared/validation';
import { authenticate, protectWrite } from '../worker/auth';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import { referencedImages, imageMarkdown } from '../shared/markdown';
import { releaseLabelError } from '../shared/releases';

function fixture() { const work=makeWork(); work.project.slug='test-map'; work.project.title={zh:'测试地图',en:'Test Map',ja:'テスト'}; return {schemaVersion:1,works:[work]}; }
test('valid existing migration retains all 28 records',async()=>{const library=JSON.parse(await readFile('.artifacts/admin-migration/library.json','utf8'));assert.equal(library.works.length,28);assert.deepEqual(validateLibrary(library),[]);for(const work of library.works)assert.equal(work.legacy.slug,work.project.slug);});
test('schema rejects empty titles, duplicate IDs, invalid slug and unknown language',()=>{
  for(const change of [(x:ReturnType<typeof fixture>)=>x.works[0].project.title=' ',(x:ReturnType<typeof fixture>)=>x.works.push(x.works[0]),(x:ReturnType<typeof fixture>)=>x.works[0].project.slug='../escape',(x:ReturnType<typeof fixture>)=>Object.assign(x.works[0].project.title,{fr:'bad'})]){const x=fixture();change(x);assert.ok(validateLibrary(x).length);}
});
test('schema rejects executable links and arbitrary private object keys',()=>{const x=fixture();x.works[0].project.repository='javascript:alert(1)';assert.ok(validateLibrary(x).length);x.works[0].project.repository='https://example.com';x.works[0].gallery=[{id:'file',name:'test.png',size:1,mime:'image/png',sha256:'a'.repeat(64),privateKey:'backups/secret.json'}];assert.ok(validateLibrary(x).length);});
test('uploaded cover permits an empty fallback URL without relaxing legacy or missing-cover checks',()=>{
  const x=fixture();const w=x.works[0];w.project.image='';
  assert.match(validateLibrary(x).join('\n'),/请选择.*封面/);
  w.gallery=[{id:'cover',name:'cover.png',size:1,mime:'image/png',sha256:'a'.repeat(64),privateKey:'uploads/verified/cover/cover.png'}];w.coverId='cover';
  assert.deepEqual(validateLibrary(x),[]);
  w.coverId='missing';assert.ok(validateLibrary(x).length);w.coverId='cover';w.legacy={...w.project};assert.ok(validateLibrary(x).length);
});
test('only explicit references across languages and tabs select body images',()=>{
  const first={id:'first',name:'one.png',size:1,mime:'image/png',sha256:'a'.repeat(64)};const second={...first,id:'second',name:'two.png'};
  const body=`Intro\n\n${imageMarkdown(first)}\n${imageMarkdown(second)}\n\nOutro`;
  const w=fixture().works[0];w.gallery=[first,second];w.coverId=first.id;
  assert.deepEqual([...referencedImages(w.markdown)],[]);
  w.markdown.description.zh=body;assert.deepEqual([...referencedImages(w.markdown)],['first','second']);
  w.markdown.description.zh='Images removed';assert.deepEqual([...referencedImages(w.markdown)],[]);
  w.markdown.changelog.en=imageMarkdown(second);assert.deepEqual([...referencedImages(w.markdown)],['second']);
});
test('schema rejects duplicate versions and unpublished downloads',()=>{const x=fixture();const v={id:'v1',label:'1.0',date:'2026-10-14',gameVersions:[],status:'draft' as const,changelog:'',files:[]};x.works[0].versions=[v,v];assert.ok(validateLibrary(x).length);x.works[0].versions=[];x.works[0].project.downloadUrl='https://download.studiofimel.com/works/bedrock/test-map/1.0/test.zip';assert.ok(validateLibrary(x).length);});

test('未命名的私有版本可保存多个，已发行版本仍须安全版本号且报错能定位',()=>{
  const x=fixture();const base={label:'',date:'2026-10-26',gameVersions:[],status:'draft' as const,changelog:'',files:[]};
  x.works[0].versions=[{...base,id:'first'},{...base,id:'second'}];
  assert.deepEqual(validateLibrary(x),[]);
  assert.equal(releaseLabelError('', 'draft'),null);
  for(const label of ['v1.0','1.21.11-v1.0','1.0_beta+build.2'])assert.equal(releaseLabelError(label,'released'),null);
  for(const label of ['../escape','版本一','1.0/next',' v1.0','1.0?file','1.0%2Fbad','v'.repeat(81)]){
    x.works[0].versions[0].label=label;
    const errors=validateLibrary(x);
    assert.equal(errors.length,1);
    assert.match(errors[0],/测试地图.*test-map.*第 1 个版本.*版本号格式不正确/);
    assert.doesNotMatch(errors[0],/\/works\/|must match pattern|anyOf/);
  }
  x.works[0].versions[0].label='';
  x.works[0].versions[0].status='released';
  assert.match(validateLibrary(x).join('\n'),/第 1 个版本（未命名）.*已发行版本必须填写版本号/);
  x.works[0].versions[0].status='draft';
  x.works[0].versions[0].label='1.0';x.works[0].versions[1].label='1.0';
  assert.match(validateLibrary(x).join('\n'),/第 2 个版本.*版本号重复/);
  x.works[0].versions[0].label='';x.works[0].versions[1].label='';x.works[0].versions[1].id='first';
  assert.match(validateLibrary(x).join('\n'),/版本记录重复/);
});
const env={ACCESS_AUD:'test-aud',ACCESS_ISSUER:'https://team.cloudflareaccess.com',ADMIN_EMAILS:'test-admin@example.invalid'};
test('production auth rejects missing configuration, forged email and forged JWT',async()=>{
  await assert.rejects(authenticate(new Request('https://admin.studiofimel.com/api/library'),{},{}));
  await assert.rejects(authenticate(new Request('https://admin.studiofimel.com/api/library',{headers:{'Cf-Access-Authenticated-User-Email':'test-admin@example.invalid'}}),env,{}));
  await assert.rejects(authenticate(new Request('https://admin.studiofimel.com/api/library',{headers:{'Cf-Access-Jwt-Assertion':'forged'}}),env,{}));
});
test('production auth permits validated context only with AUD and whitelist',async()=>{
  assert.equal(await authenticate(new Request('https://admin.studiofimel.com'),env,{access:{aud:'test-aud',getIdentity:async()=>({email:'test-admin@example.invalid'})}}),'test-admin@example.invalid');
  await assert.rejects(authenticate(new Request('https://admin.studiofimel.com'),env,{access:{aud:'wrong',getIdentity:async()=>({email:'test-admin@example.invalid'})}}));
  await assert.rejects(authenticate(new Request('https://admin.studiofimel.com'),env,{access:{aud:'test-aud',getIdentity:async()=>({email:'other@example.invalid'})}}));
});
test('CSRF rejects external and absent Origin and accepts same origin',()=>{
  for(const origin of ['', 'https://evil.invalid'])assert.throws(()=>protectWrite(new Request('https://admin.studiofimel.com/api/library',{method:'PUT',headers:{Origin:origin,'X-Fimel-CSRF':'1'}}),'https://admin.studiofimel.com'));
  assert.doesNotThrow(()=>protectWrite(new Request('https://admin.studiofimel.com/api/library',{method:'PUT',headers:{Origin:'https://admin.studiofimel.com','X-Fimel-CSRF':'1'}}),'https://admin.studiofimel.com'));
});
test('JWT fallback verifies a real RSA signature, expiry, issuer and audience',async()=>{
  const {publicKey,privateKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);const fetchBefore=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({keys:[{...jwk,kid:'test-key',alg:'RS256',use:'sig'}]});
  try{
    async function token(aud=env.ACCESS_AUD,iss=env.ACCESS_ISSUER,exp=Math.floor(Date.now()/1000)+60){return new SignJWT({email:'test-admin@example.invalid'}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setIssuedAt().setSubject('test-user').setIssuer(iss).setAudience(aud).setExpirationTime(exp).sign(privateKey);}
    const request=async(aud?:string,iss?:string,exp?:number)=>new Request('https://admin.studiofimel.com/api/library',{headers:{'cf-access-jwt-assertion':await token(aud,iss,exp)}});
    assert.equal(await authenticate(await request(),env,{}),'test-admin@example.invalid');
    await assert.rejects(authenticate(await request('other-aud'),env,{}));
    await assert.rejects(authenticate(await request(undefined,'https://other.cloudflareaccess.com'),env,{}));
    await assert.rejects(authenticate(await request(undefined,undefined,Math.floor(Date.now()/1000)-60),env,{}));
  }finally{globalThis.fetch=fetchBefore;}
});
