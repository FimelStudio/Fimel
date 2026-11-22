import { useEffect, useState } from 'react';
import type { StorageGate } from '../shared/storage-gate';
import { recoverableWriters } from '../shared/storage-gate';

export function StorageGatePanel({gate,serverTime,disabled,onAction}:{gate:StorageGate;serverTime:number;disabled:boolean;onAction(action:'prepare'|'complete'|'cancel',confirm:string):Promise<void>}) {
  const [review,setReview]=useState(false),[confirmed,setConfirmed]=useState(false),[text,setText]=useState(''),[clock,setClock]=useState(serverTime);
  useEffect(()=>{if(!gate.recovery)return;const started=Date.now();const timer=setInterval(()=>setClock(serverTime+Date.now()-started),1000);return()=>clearInterval(timer);},[gate.recovery,serverTime]);
  const now=clock,recovery=gate.recovery,entries=Object.entries(gate.writers);
  const remaining=recovery?Math.max(0,Math.ceil((Date.parse(recovery.readyAt)-now)/1000)):0;
  if(!entries.length&&!gate.cleaner)return null;
  return <div className="notice storage-gate-panel">
    {recovery?<>
      <h3>维护恢复已隔离新写入</h3>
      <p>请暂停其他窗口中的上传、保存、发布及外部 R2 写入。隔离期间这些操作会被拒绝；完成或取消恢复后解除隔离。关闭页面后可重新打开继续。</p>
      <p role="status">{remaining?`正在等待核对：${remaining} 秒后可以完成恢复。`:'隔离等待已满，可再次核对目录并完成恢复。'}</p>
      <div className="button-row"><button disabled={disabled||remaining>0} onClick={()=>void onAction('complete','恢复维护锁')}>核对并完成恢复</button><button disabled={disabled} onClick={()=>void onAction('cancel','')}>取消恢复并解除隔离</button></div>
    </>:<>
      <p>{gate.cleaner?'正在清理或维护，暂不能重复删除。':`有 ${entries.length} 条未释放的写入记录，当前不能删除文件。`}</p>
      {recoverableWriters(gate,now)&&<><p>这些记录均已超过 24 小时，可在确认没有上传、保存或发布正在进行后，人工恢复。系统不会按时间自动解除锁。</p><button disabled={disabled} onClick={()=>{setReview(!review);setConfirmed(false);setText('');}}>检查并恢复遗留锁</button></>}
      {!recoverableWriters(gate,now)&&<p>请等待当前操作结束后重新读取。归属未知的清理锁不能在这里强制解除。</p>}
    </>}
    <details><summary>查看 {entries.length} 条写入记录</summary><ul>{entries.map(([id,time])=><li key={id}><code>{id}</code> · {new Date(time).toLocaleString('zh-CN')}</li>)}</ul></details>
    {review&&!recovery&&<div className="storage-note"><h3>确认人工恢复维护锁</h3><p>这会暂停新的写入至少 60 秒，并核对作品、文档及清理策略是否变化。恢复仅解除上方记录；不删除文件。完成后必须重新扫描再选择清理对象。</p><label className="storage-check"><input type="checkbox" checked={confirmed} disabled={disabled} onChange={event=>setConfirmed(event.target.checked)}/>我已确认其他窗口与成员没有正在进行的上传、保存或发布，且已暂停外部 R2 写入</label><label>输入“恢复维护锁”<input aria-label="维护恢复确认文字" disabled={disabled} value={text} onChange={event=>setText(event.target.value)}/></label><div className="button-row"><button disabled={disabled||!confirmed||text!=='恢复维护锁'} onClick={()=>void onAction('prepare',text)}>开始隔离核对</button><button disabled={disabled} onClick={()=>setReview(false)}>返回</button></div></div>}
  </div>;
}
