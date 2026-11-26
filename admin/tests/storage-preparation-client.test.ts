import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RequestError } from '../src/api';
import { prepareStorageScan } from '../src/storage-preparation-client';
import type { PreparationState } from '../src/storage-preparation-client';

const clientId='11111111-1111-4111-8111-111111111111';
const now=Date.parse('2026-11-26T00:00:00Z');
function harness(writers:Record<string,string>={}) {
  const state:PreparationState={gate:{writers},gateEtag:'a',serverTime:now};let revision=0,active=true,confirm=true;
  const actions:string[]=[],waits:number[]=[],notes:string[]=[];let confirmations=0;
  const transport={clientId,read:async()=>structuredClone(state),active:()=>active,wait:async(ms:number)=>{waits.push(ms);state.serverTime+=ms;},confirmRecovery:()=>{confirmations++;return confirm;},progress:(_state:PreparationState,note:string)=>notes.push(note),recover:async(action:'prepare'|'complete'|'cancel',current:PreparationState)=>{
    actions.push(action);assert.equal(current.gateEtag,state.gateEtag);
    state.gateEtag=String(++revision);
    if(action==='prepare')state.gate={...state.gate,cleaner:'recovery',recovery:{id:'recovery',startedAt:new Date(state.serverTime).toISOString(),readyAt:new Date(state.serverTime).toISOString(),writers:{...state.gate.writers},revisions:{},auditKey:'audit/day/id.json',mode:'cleanup',clientId}};
    else if(action==='complete')state.gate={writers:{},recovered:{id:'recovery',time:new Date(state.serverTime).toISOString(),auditKey:'audit/day/id.json'}};
    else state.gate={writers:state.gate.writers};
  }};
  return {transport,actions,waits,notes,get state(){return state;},get confirmations(){return confirmations;},set active(value:boolean){active=value;},set confirm(value:boolean){confirm=value;}};
}
const stale={'old-writer':'2020-01-01T00:00:00Z'};

test('无活动操作直接开始扫描，不显示维护确认也不修改门',async()=>{
  const h=harness();assert.ok(await prepareStorageScan(h.transport));assert.equal(h.confirmations,0);assert.deepEqual(h.actions,[]);assert.deepEqual(h.waits,[]);
});
test('正常活动写入自动等待结束，不要求人工恢复',async()=>{
  const h=harness({'active-writer':new Date(now).toISOString()});const wait=h.transport.wait;
  h.transport.wait=async ms=>{await wait(ms);if(h.waits.length===3)h.state.gate.writers={};};
  const result=await prepareStorageScan(h.transport);assert.deepEqual(result?.gate.writers,{});assert.equal(h.confirmations,0);assert.deepEqual(h.actions,[]);assert.equal(h.waits.length,3);
});
test('无法确认的遗留记录只问一次，核对完成自动继续，没有固定倒计时',async()=>{
  const h=harness(stale);assert.deepEqual((await prepareStorageScan(h.transport))?.gate.writers,{});assert.equal(h.confirmations,1);assert.deepEqual(h.actions,['prepare','complete']);assert.deepEqual(h.waits,[]);
});
test('取消一次确认立即停止，不改变旧记录',async()=>{
  const h=harness(stale);h.confirm=false;assert.equal(await prepareStorageScan(h.transport),null);assert.deepEqual(h.actions,[]);assert.deepEqual(h.state.gate.writers,stale);
});
test('准备请求已提交但响应丢失，先读取状态再完成，不重复开始或重复询问',async()=>{
  const h=harness(stale),recover=h.transport.recover;let lost=false;
  h.transport.recover=async(action,current)=>{await recover(action,current);if(!lost){lost=true;throw new RequestError(0,'网络断开');}};
  assert.deepEqual((await prepareStorageScan(h.transport))?.gate.writers,{});assert.deepEqual(h.actions,['prepare','complete']);assert.equal(h.confirmations,1);
});
test('完成回执已写但响应丢失，读回已完成状态，不重复恢复',async()=>{
  const h=harness(stale),recover=h.transport.recover;
  h.transport.recover=async(action,current)=>{await recover(action,current);if(action==='complete')throw new RequestError(503,'响应丢失');};
  assert.ok((await prepareStorageScan(h.transport))?.gate.recovered);assert.deepEqual(h.actions,['prepare','complete']);assert.equal(h.confirmations,1);
});
test('目录在核对期间变化时取消自己的检查隔离，保留原写入记录并停止',async()=>{
  const h=harness(stale),recover=h.transport.recover;
  h.transport.recover=async(action,current)=>{if(action==='complete')throw new RequestError(409,'仍有内容变化',{kind:'storage-recovery-changed'});await recover(action,current);};
  await assert.rejects(prepareStorageScan(h.transport),/仍有内容变化/);assert.deepEqual(h.actions,['prepare','cancel']);assert.deepEqual(h.state.gate.writers,stale);assert.equal(h.state.gate.cleaner,undefined);
});
test('准备后暂停会取消自己的检查隔离，不会自动解除业务写入或继续扫描',async()=>{
  const h=harness(stale),recover=h.transport.recover;
  h.transport.recover=async(action,current)=>{await recover(action,current);if(action==='prepare')h.active=false;};
  assert.equal(await prepareStorageScan(h.transport),null);assert.deepEqual(h.actions,['prepare','cancel']);assert.deepEqual(h.state.gate.writers,stale);
});
test('其他窗口的检查只等待，不抢占或取消对方的隔离',async()=>{
  const h=harness(stale);await h.transport.recover('prepare',h.state);h.state.gate.recovery!.clientId='22222222-2222-4222-8222-222222222222';h.actions.length=0;
  const wait=h.transport.wait;h.transport.wait=async ms=>{await wait(ms);h.state.gate={writers:{}};};
  assert.ok(await prepareStorageScan(h.transport));assert.deepEqual(h.actions,[]);assert.equal(h.confirmations,0);
});
test('活动请求长期不结束时有限等待后暂停，不强行清锁',async()=>{
  const h=harness({'active-writer':new Date(now).toISOString()});await assert.rejects(prepareStorageScan(h.transport),/仍有上传/);assert.equal(h.waits.length,45);assert.deepEqual(h.actions,[]);assert.equal(h.confirmations,0);
});
test('身份失效和不可重试的数据错误不会绕过检查',async()=>{
  for(const error of [new RequestError(401,'需要登录'),new RequestError(503,'损坏',{retryable:false})]){
    const h=harness();h.transport.read=async()=>{throw error;};await assert.rejects(prepareStorageScan(h.transport),value=>value===error);assert.deepEqual(h.actions,[]);assert.deepEqual(h.waits,[]);
  }
});
test('刷新可接续同一窗口已确认的检查，不再重复询问',async()=>{
  const h=harness(stale);await h.transport.recover('prepare',h.state);h.actions.length=0;
  assert.ok(await prepareStorageScan(h.transport));assert.deepEqual(h.actions,['complete']);assert.equal(h.confirmations,0);
});
