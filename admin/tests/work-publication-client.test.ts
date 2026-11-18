import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWork } from '../shared/model';
import { publicationFingerprint } from '../shared/revisions';
import { PublicationUnconfirmed, publishWork } from '../src/work-publication';
import { RequestError } from '../src/api';

const work=makeWork();work.project.slug='publication-network-test';work.markdown.description.zh='已保存的正文';
const snapshot=async(current:boolean)=>({library:{schemaVersion:1,works:[work]},public:{schemaVersion:2,publicationId:'confirmed',projects:current?[work.project]:[],releases:{},publicationStates:current?{[work.project.slug]:{fingerprint:await publicationFingerprint(work),publishedAt:work.updatedAt,savedAt:work.updatedAt}}:{}},publicEtag:'public-next',etag:'private-next'});
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});

test('发布断网但指纹已提交时确认成功，不重复发布',async t=>{
  const current=await snapshot(true);const calls:string[]=[];
  t.mock.method(globalThis,'fetch',async(path:string,options:RequestInit)=>{calls.push(path);if(path.includes('/publish/')){assert.deepEqual(options.headers,{'Content-Type':'application/json','X-Fimel-CSRF':'1','If-Match':'private-before','X-Public-ETag':'public-before'});throw new TypeError('network');}return response(current);});
  const phases:string[]=[];const result=await publishWork(work,'publish','private-before','public-before',phase=>phases.push(phase));
  assert.equal(result.current,true);assert.equal(result.snapshot?.etag,'private-next');assert.deepEqual(phases,['publishing','checking']);assert.deepEqual(calls,[`/api/publish/${work.id}`,'/api/library']);
});

test('90 秒无响应自动中断并核对，未完成时保留草稿且明确提示',async t=>{
  const current=await snapshot(false);let began!:()=>void;const started=new Promise<void>(resolve=>{began=resolve;});let aborted=false;
  t.mock.timers.enable({apis:['setTimeout']});
  t.mock.method(globalThis,'fetch',async(path:string,options:RequestInit)=>{if(path.includes('/publish/'))return new Promise<Response>((_resolve,reject)=>{options.signal!.addEventListener('abort',()=>{aborted=true;reject(new DOMException('aborted','AbortError'));});began();});return response(current);});
  const pending=publishWork(work,'publish','before','public-before',()=>{});const rejection=assert.rejects(pending,(error:unknown)=>error instanceof PublicationUnconfirmed&&error.snapshot?.data.library.works[0].markdown.description.zh==='已保存的正文'&&/尚未确认/.test(error.message));
  await started;t.mock.timers.tick(90_000);await rejection;assert.equal(aborted,true);
});

test('请求和核对都无响应时至多等待 110 秒，不留下无限等待',async t=>{
  let began!:()=>void;const started=new Promise<void>(resolve=>{began=resolve;});let checking!:()=>void;const checkStarted=new Promise<void>(resolve=>{checking=resolve;});
  t.mock.timers.enable({apis:['setTimeout']});
  t.mock.method(globalThis,'fetch',(path:string,options:RequestInit)=>new Promise<Response>((_resolve,reject)=>{options.signal!.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')));if(path==='/api/library')checking();else began();}));
  const pending=publishWork(work,'publish','before','public-before',()=>{});const rejection=assert.rejects(pending,/暂时无法确认发布结果，草稿已保存/);
  await started;t.mock.timers.tick(90_000);await checkStarted;t.mock.timers.tick(20_000);await rejection;
});

test('明确的验证、登录及并发错误原样显示，不误报已发布',async t=>{
  for(const status of [401,403,409,422]){
    let calls=0;const mocked=t.mock.method(globalThis,'fetch',async()=>{calls++;return response({error:`原始错误 ${status}`},status);});
    await assert.rejects(publishWork(work,'publish','before','public-before',()=>{}),(error:unknown)=>error instanceof RequestError&&error.status===status&&error.message===`原始错误 ${status}`);
    assert.equal(calls,1);mocked.mock.restore();
  }
});

test('服务端成功后读取失败仍报告已确认，但不伪造刷新状态',async t=>{
  t.mock.method(globalThis,'fetch',async(path:string)=>{if(path==='/api/library')throw new TypeError('offline');return response({ok:true});});
  assert.deepEqual(await publishWork(work,'publish','before','public-before',()=>{}),{snapshot:undefined,current:true});
});

test('失败响应不能凭旧指纹误报成功，下架按公开作品缺席核对',async t=>{
  const changed=await snapshot(true);changed.public.publicationStates[work.project.slug].fingerprint='different';
  let current:unknown=changed;
  t.mock.method(globalThis,'fetch',async(path:string)=>path==='/api/library'?response(current):response({error:'unknown'},503));
  await assert.rejects(publishWork(work,'publish','before','public-before',()=>{}),PublicationUnconfirmed);
  current=await snapshot(false);assert.equal((await publishWork(work,'unpublish','before','public-before',()=>{})).current,true);
});
