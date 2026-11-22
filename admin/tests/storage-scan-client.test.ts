import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RequestError } from '../src/api';
import { advanceStorageScan, readStoragePage } from '../src/storage-scan-client';
import type { ScanProgress } from '../src/storage-scan-client';
import { DEFAULT_STORAGE_POLICY } from '../shared/storage';

const state=(etag:string,ready=false):ScanProgress=>({etag,scan:{id:'job',algorithm:3,format:2,status:ready?'ready':'references',createdAt:'2026-11-22T00:00:00Z',bucket:'public',items:[],refs:[],queue:[],read:0,revisions:{},policy:DEFAULT_STORAGE_POLICY,deleted:[],skipped:[]}});
test('响应丢失但步骤已提交，先恢复服务器进度再继续',async()=>{
  const steps:string[]=[],notes:string[]=[];
  const result=await advanceStorageScan(state('a'),{active:()=>true,wait:async()=>{},progress:(_s,n)=>{if(n)notes.push(n);},read:async()=>state('b'),step:async current=>{steps.push(current.etag);if(current.etag==='a')throw new RequestError(0,'网络中断');return state('c',true);}});
  assert.deepEqual(steps,['a','b']);assert.equal(result.scan.status,'ready');assert.equal(notes.length,1);
});
test('另一窗口推进后发生版本冲突，跟随新进度完成扫描',async()=>{
  let n=0;
  const result=await advanceStorageScan(state('a'),{active:()=>true,wait:async()=>{},progress:()=>{},read:async()=>state('b'),step:async()=>{if(++n===1)throw new RequestError(409,'扫描冲突',{kind:'scan-conflict',retryable:true});return state('c',true);}});
  assert.equal(result.etag,'c');assert.equal(n,2);
});
test('持续断网有有限退避，停止时保留服务端进度',async()=>{
  const waits:number[]=[];let attempts=0;
  await assert.rejects(advanceStorageScan(state('a'),{active:()=>true,wait:async ms=>{waits.push(ms);},progress:()=>{},read:async()=>state('a'),step:async()=>{attempts++;throw new RequestError(503,'服务暂时不可用');}}),/扫描已暂停.*进度仍保留/);
  assert.equal(attempts,5);assert.deepEqual(waits,[500,1000,2000,4000]);
});
test('引用校验失败和会话失效不会通过盲目重试绕过',async()=>{
  for(const error of [new RequestError(503,'引用损坏',{retryable:false}),new RequestError(401,'请重新登录'),new RequestError(409,'扫描对象消失',{retryable:false})]){
    let reads=0;
    await assert.rejects(advanceStorageScan(state('a'),{active:()=>true,wait:async()=>{},progress:()=>{},read:async()=>{reads++;return state('b');},step:async()=>{throw error;}}),e=>e===error);
    assert.equal(reads,0);
  }
});
test('用户暂停后不会因为响应失败而自动重启扫描',async()=>{
  let active=true,reads=0;
  const result=await advanceStorageScan(state('a'),{active:()=>active,wait:async()=>{},progress:()=>{},read:async()=>{reads++;return state('b');},step:async()=>{active=false;throw new RequestError(0,'网络中断');}});
  assert.equal(result.etag,'a');assert.equal(reads,0);
});
test('报告分页下载断网可以恢复，持续错误和缺页停止读取',async()=>{
  let calls=0;assert.equal(await readStoragePage(async()=>{if(++calls===1)throw new RequestError(0,'断网');return 'page';},async()=>{}),'page');
  calls=0;await assert.rejects(readStoragePage(async()=>{calls++;throw new RequestError(0,'断网');},async()=>{}));assert.equal(calls,4);
  calls=0;await assert.rejects(readStoragePage(async()=>{calls++;throw new RequestError(404,'分页缺失');},async()=>{}));assert.equal(calls,1);
});
