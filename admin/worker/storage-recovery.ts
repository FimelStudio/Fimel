import type { StorageGate } from '../shared/storage-gate';
import type { AuditEvent } from '../shared/audit';
import { PREPARATION_MAX_AGE, RECOVERY_WAIT, recoverableWriters } from '../shared/storage-gate';
import { actorKey } from './audit';
import { ApiError, EMPTY_ETAG, expectMatch, json, putJson, readJson } from './http';
import { changeStorageGate, readStorageGate } from './storage-gate';

type Env = { PRIVATE: R2Bucket; PUBLIC: R2Bucket };
const roots = [['private','state/library.json'],['private','state/docs.json'],['private','state/site.json'],['public','data/works.json'],['public','data/docs.json'],['private','maintenance/policy.json']] as const;
async function revisions(env: Env) {
  const values: Record<string,string> = {};
  for (const [name,key] of roots) values[name+':'+key] = (await (name==='private'?env.PRIVATE:env.PUBLIC).head(key))?.httpEtag ?? EMPTY_ETAG;
  return values;
}
function sameWriters(first: Record<string,string>, second: Record<string,string>) {
  return Object.keys(first).length===Object.keys(second).length && Object.entries(first).every(([id,time])=>second[id]===time);
}
export async function storageRecovery(request: Request, env: Env, email: string) {
  const input = await readJson(request,1024) as {action?:string;confirm?:string;id?:string;mode?:'cleanup';clientId?:string};
  if (!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).some(key=>!['action','confirm','id','mode','clientId'].includes(key)) || !['prepare','complete','cancel'].includes(input.action??'') || input.mode!==undefined&&input.mode!=='cleanup' || input.clientId!==undefined&&(typeof input.clientId!=='string'||!/^[a-f0-9-]{36}$/.test(input.clientId)) || input.mode==='cleanup'&&!input.clientId) throw new ApiError(422,'维护恢复参数无效。');
  if (input.action!=='cancel' && input.confirm!=='恢复维护锁') throw new ApiError(422,'请确认没有正在进行的上传、保存或发布，并输入“恢复维护锁”。');
  const current = await readStorageGate(env.PRIVATE);
  expectMatch(request,current.etag);
  if (input.action==='prepare') {
    // Age enables a manual review, never automatic expiration or deletion.
    if (!recoverableWriters(current.gate,Date.now())) throw new ApiError(409,'只允许人工恢复全部超过 24 小时的写入记录；正在执行或归属未知的清理锁不能在此解除。');
    const time = new Date(Date.now()).toISOString(), id = crypto.randomUUID();
    const auditKey = `audit/${time.slice(0,10)}/${time.replaceAll(':','-')}-${id}.json`;
    const snapshot = await revisions(env);
    const event = {schemaVersion:2,id,actorId:await actorKey(email),operation:'recover-storage-lock',time,status:'prepared',changes:[{workId:'storage',slug:'storage',title:'人工恢复遗留维护锁',action:'updated',fields:Object.entries(current.gate.writers).map(([name,before])=>({name,before,after:'等待隔离核对；尚未解除'}))}],writers:current.gate.writers};
    // Persist intent first. Any uncertain failure remains locked and can be read
    // again; the gate CAS arbitrates concurrent recovery and business writers.
    await putJson(env.PRIVATE,auditKey,event);
    const result = await changeStorageGate(env.PRIVATE,gate=>({...gate,cleaner:id,recovery:{id,startedAt:time,readyAt:new Date(Date.now()+(input.mode==='cleanup'?0:RECOVERY_WAIT)).toISOString(),writers:{...gate.writers},revisions:snapshot,auditKey,...(input.mode?{mode:input.mode,clientId:input.clientId}:{})}}),current.etag);
    return json({gate:result.gate,gateEtag:result.etag},200);
  }
  const recovery = current.gate.recovery;
  if (!recovery || input.id!==recovery.id || current.gate.cleaner!==recovery.id) throw new ApiError(409,'维护恢复记录已变化，请重新读取；不要重复解除。');
  const intent = await env.PRIVATE.get(recovery.auditKey);
  if (!intent) throw new ApiError(503,'恢复审计记录缺失，已保留维护锁。');
  const event = await intent.json<AuditEvent>();
  if (event.id!==recovery.id || event.operation!=='recover-storage-lock') throw new ApiError(503,'恢复审计记录无效，已保留维护锁。');
  let next: StorageGate;
  const time = new Date(Date.now()).toISOString();
  if (input.action==='complete') {
    if (Date.now()<Date.parse(recovery.readyAt)) throw new ApiError(409,'正在隔离等待，请满 60 秒后重新读取并完成恢复。');
    if (Date.now()-Date.parse(recovery.startedAt)>(recovery.mode==='cleanup'?PREPARATION_MAX_AGE:10*60*1000)) throw new ApiError(409,'本次核对已超时，请重新检查。',{kind:'storage-recovery-expired'});
    if (!sameWriters(current.gate.writers,recovery.writers)) throw new ApiError(409,'核对期间仍有操作在结束，已停止恢复，请等待操作完成。',{kind:'storage-recovery-changed'});
    const latest = await revisions(env);
    if (Object.keys(latest).some(key=>latest[key]!==recovery.revisions[key])) throw new ApiError(409,'核对期间有内容发生变化，已停止恢复，请等待操作完成。',{kind:'storage-recovery-changed'});
    next = {writers:{},recovered:{id:recovery.id,time,auditKey:recovery.auditKey}};
  } else next = {...current.gate,cleaner:undefined,recovery:undefined};
  const result = await changeStorageGate(env.PRIVATE,()=>next,current.etag);
  // If the response/audit update fails after the CAS, the gate receipt proves
  // what completed; the prepared audit still preserves the exact original IDs.
  const changes=event.changes.map(change=>({...change,fields:change.fields.map(field=>({...field,after:input.action==='complete'?'已人工解除；文件未删除':'已取消恢复，保留写入记录'}))}));
  await putJson(env.PRIVATE,recovery.auditKey,{...event,changes,status:input.action==='complete'?'success':'cancelled',finishedAt:time,httpStatus:200},intent.httpEtag);
  return json({gate:result.gate,gateEtag:result.etag},200);
}
