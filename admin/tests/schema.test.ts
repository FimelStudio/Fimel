import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeWork } from '../shared/model';
import { validateLibrary } from '../shared/validation';
import { authenticate, protectWrite } from '../worker/auth';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';

function fixture() { const work=makeWork(); work.project.slug='test-map'; work.project.title={zh:'测试地图',en:'Test Map',ja:'テスト'}; return {schemaVersion:1,works:[work]}; }
test('valid existing migration retains all 28 records',async()=>{const library=JSON.parse(await readFile('.artifacts/admin-migration/library.json','utf8'));assert.equal(library.works.length,28);assert.deepEqual(validateLibrary(library),[]);for(const work of library.works)assert.equal(work.legacy.slug,work.project.slug);});
test('schema rejects empty titles, duplicate IDs, invalid slug and unknown language',()=>{
  for(const change of [(x:ReturnType<typeof fixture>)=>x.works[0].project.title=' ',(x:ReturnType<typeof fixture>)=>x.works.push(x.works[0]),(x:ReturnType<typeof fixture>)=>x.works[0].project.slug='../escape',(x:ReturnType<typeof fixture>)=>Object.assign(x.works[0].project.title,{fr:'bad'})]){const x=fixture();change(x);assert.ok(validateLibrary(x).length);}
});
test('schema rejects executable links and arbitrary private object keys',()=>{const x=fixture();x.works[0].project.repository='javascript:alert(1)';assert.ok(validateLibrary(x).length);x.works[0].project.repository='https://example.com';x.works[0].gallery=[{id:'file',name:'test.png',size:1,mime:'image/png',sha256:'a'.repeat(64),privateKey:'backups/secret.json'}];assert.ok(validateLibrary(x).length);});
test('schema rejects duplicate versions and unpublished downloads',()=>{const x=fixture();const v={id:'v1',label:'1.0',date:'2026-10-14',gameVersions:[],status:'draft' as const,changelog:'',files:[]};x.works[0].versions=[v,v];assert.ok(validateLibrary(x).length);x.works[0].versions=[];x.works[0].project.downloadUrl='https://download.studiofimel.com/works/bedrock/test-map/1.0/test.zip';assert.ok(validateLibrary(x).length);});
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
