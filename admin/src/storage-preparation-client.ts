import type { StorageGate } from '../shared/storage-gate';
import { PREPARATION_MAX_AGE, recoverableWriters } from '../shared/storage-gate';
import { RequestError } from './api';
import { readStoragePage, retryableScanError } from './storage-scan-client';

export type PreparationState = {gate:StorageGate;gateEtag:string;serverTime:number};
type Transport<T extends PreparationState> = {
  clientId:string;
  read():Promise<T>;
  recover(action:'prepare'|'complete'|'cancel',state:T):Promise<void>;
  confirmRecovery():boolean;
  active():boolean;
  wait(ms:number):Promise<void>;
  progress(state:T,note:string):void;
};
const writerSignature=(state:PreparationState)=>JSON.stringify(Object.entries(state.gate.writers).sort(([a],[b])=>a.localeCompare(b)));
const details=(error:unknown)=>error instanceof RequestError?error.details as {kind?:string}|undefined:undefined;

// Coordinates preparation only. This transport has no file deletion method.
// Responses may be lost after a mutation: read the current gate before deciding
// what to do next, rather than replaying a recovery with an obsolete revision.
export async function prepareStorageScan<T extends PreparationState>(transport:Transport<T>):Promise<T|null> {
  let ownRecovery:string|undefined,consented:string|undefined,waits=0,failures=0,attempted=false;
  const read=()=>readStoragePage(transport.read,transport.wait);
  async function cancelOwned(state?:T) {
    const current=state??await read();
    if(current.gate.recovery&&(current.gate.recovery.id===ownRecovery||current.gate.recovery.clientId===transport.clientId))await transport.recover('cancel',current);
  }
  try{
    let state=await read();
    for(let turn=0;turn<120&&transport.active();turn++){
      const recovery=state.gate.recovery;
      transport.progress(state,'正在检查上传、保存和发布状态…');
      if(!state.gate.cleaner&&Object.keys(state.gate.writers).length===0)return state;
      let action:'prepare'|'complete'|'cancel'|undefined;
      if(recovery){
        if(recovery.clientId===transport.clientId)ownRecovery=recovery.id;
        if(state.serverTime-Date.parse(recovery.startedAt)>(recovery.mode==='cleanup'?PREPARATION_MAX_AGE:600_000)){
          transport.progress(state,'正在结束上次中断的检查…');action='cancel';
        }else if(recovery.mode==='cleanup'&&recovery.clientId!==transport.clientId){
          if(++waits>45)throw new Error('其他窗口正在检查存储，请等待其完成后继续检查。');
          transport.progress(state,'其他窗口正在检查，完成后会自动继续…');await transport.wait(1000);
        }else if(state.serverTime<Date.parse(recovery.readyAt)){
          if(++waits>65)throw new Error('检查暂未完成，已保留进度；请稍后继续检查。');
          transport.progress(state,'正在核对上次操作，完成后会自动扫描…');
          await transport.wait(Math.min(1000,Date.parse(recovery.readyAt)-state.serverTime));
        }else{
          transport.progress(state,'正在核对内容版本，随后自动开始扫描…');action='complete';
        }
      }else if(recoverableWriters(state.gate,state.serverTime)){
        const signature=writerSignature(state);
        if(consented!==signature){
          if(consented!==undefined)throw new Error('操作记录已变化，检查已停止；请等待其他操作结束后再检查。');
          if(!transport.confirmRecovery())return null;
          consented=signature;
        }
        if(!transport.active())break;
        transport.progress(state,'正在核对上次未完成的操作…');action='prepare';
      }else{
        if(++waits>45)throw new Error('仍有上传、保存、发布或维护操作正在进行。检查已暂停，当前文件未删除；操作结束后可继续检查。');
        transport.progress(state,'正在等待其他操作完成，之后会自动扫描…');
        await transport.wait(1000);
      }
      if(action){
        if(action==='prepare')attempted=true;
        try{await transport.recover(action,state);failures=0;}
        catch(error){
          if(details(error)?.kind==='storage-recovery-changed'){
            await cancelOwned().catch(()=>{});
            throw error;
          }
          if(!(retryableScanError(error)||error instanceof RequestError&&error.status===409)||++failures>3)throw error;
          transport.progress(state,'连接暂时中断，正在核对已完成的步骤…');
          await transport.wait(Math.min(500*2**(failures-1),2000));
        }
      }
      state=await read();
    }
    if(transport.active())throw new Error('检查暂未完成，请等待其他操作结束后继续检查。');
    return null;
  }finally{
    // Pausing, a fatal conflict or a broken connection must not leave a new
    // preparation barrier indefinitely. A crashed tab is also handled by the
    // server's bounded preparation expiry, which preserves all writer records.
    if(ownRecovery||attempted)await cancelOwned().catch(()=>{});
  }
}
