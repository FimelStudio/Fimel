import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { Download, HardDrive, RefreshCw, Search, Trash2 } from 'lucide-react';
import { api } from './api';
import { advanceStorageScan, readStoragePage } from './storage-scan-client';
import { DEFAULT_STORAGE_POLICY, storageId } from '../shared/storage';
import type { StorageItem, StoragePolicy, StorageScan } from '../shared/storage';
import type { StorageGate } from '../shared/storage-gate';
import { prepareStorageScan } from './storage-preparation-client';
import './StorageManager.css';

type State = { policy: StoragePolicy; scan: StorageScan | null; scanEtag: string; gate: StorageGate; gateEtag: string; serverTime: number; automatic: { id: string; finished?: boolean; finishedAt?: string; reason?: string } | null };
const names = { temporary:'临时上传',asset:'图片与下载文件',content:'作品正文',history:'备份与发布快照',receipt:'上传记录',system:'系统／统计／非托管文件' };
const wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const preparationKey='fimel-storage-preparation-v1';
function savedPreparation():{clientId:string;startedAt:number}|null {
  try{const value=JSON.parse(sessionStorage.getItem(preparationKey)??'null');return value&&typeof value.clientId==='string'&&/^[a-f0-9-]{36}$/.test(value.clientId)&&typeof value.startedAt==='number'&&Date.now()-value.startedAt<6*60*60*1000?value:null;}catch{return null;}
}
const bytes = (value: number) => value >= 1024**3 ? `${(value/1024**3).toFixed(2)} GiB` : value >= 1024**2 ? `${(value/1024**2).toFixed(1)} MiB` : value>=1024?`${(value/1024).toFixed(1)} KiB`:`${value} B`;
function exportReport(scan: StorageScan) { const url=URL.createObjectURL(new Blob([JSON.stringify(scan,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`fimel-storage-${scan.createdAt.slice(0,10)}.json`;link.click();URL.revokeObjectURL(url); }
function Confirmation({busy,onClose,children}:{busy:boolean;onClose():void;children:ReactNode}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();},[]);
  return createPortal(<div className="admin-shell storage-dialog-portal"><dialog ref={ref} className="storage-confirm" aria-label="确认永久清理" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>{children}</dialog></div>,document.body);
}

export function StorageManager({ onBusyChange }: { onBusyChange(value: boolean): void }) {
  const [data,setData]=useState<State|null>(null),[policy,setPolicy]=useState<StoragePolicy>({...DEFAULT_STORAGE_POLICY}),[etag,setEtag]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[q,setQ]=useState(''),[scope,setScope]=useState('all'),[view,setView]=useState('candidate'),[page,setPage]=useState(1);
  const [selected,setSelected]=useState<Set<string>>(new Set()),[review,setReview]=useState(false),[confirmation,setConfirmation]=useState('');
  const [reading,setReading]=useState(false);
  const [preparing,setPreparing]=useState(false);
  const activeBusy=busy||reading;
  const scanning=useRef(false),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;scanning.current=false;};},[]);
  useEffect(()=>{onBusyChange(activeBusy);return()=>onBusyChange(false);},[activeBusy,onBusyChange]);
  async function load(hydrate=true) {
    if(mounted.current)setReading(true);
    try{
    const result=await api<State>('storage'),value=result.data.scan;
    if(hydrate&&value?.format===2&&value.status==='ready'){
      const all:StorageItem[]=[];
      for(let start=0;start<(value.pageCount??0);start+=4){
        const batch=await Promise.all(Array.from({length:Math.min(4,value.pageCount!-start)},(_,offset)=>readStoragePage(()=>api<StorageItem[]>(`storage/items/${value.id}/${start+offset}`),wait)));
        for(const page of batch)all.push(...page.data);
      }
      value.items=all;value.deleted=all.filter(i=>i.outcome==='deleted').map(i=>storageId(i.bucket,i.key));value.skipped=all.filter(i=>i.outcome==='skipped').map(i=>storageId(i.bucket,i.key));
    }
    if(mounted.current){setData(result.data);setPolicy(result.data.policy);setEtag(result.etag);}
    return result.data;
    }finally{if(mounted.current)setReading(false);}
  }
  useEffect(()=>{const timer=setTimeout(()=>{void (savedPreparation()?runScan(true):load()).catch(cause=>setError(cause instanceof Error?cause.message:'存储报告读取失败。'));},0);return()=>clearTimeout(timer);
    // Resume once on mount; current progress is read from the server, and the
    // mounted/scanning refs cancel the old loop when this component unmounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const scan=data?.scan;
  const reportComplete=scan?.status==='ready'&&scan.items.length===(scan.objectCount??scan.items.length);
  const gateBlocked=!!data&&(!!data.gate.cleaner||Object.keys(data.gate.writers).length>0);
  const needsRescan=!!(scan&&data?.gate.recovered&&Date.parse(scan.createdAt)<=Date.parse(data.gate.recovered.time));
  const items=useMemo(()=>scan?.items.filter(item=>!scan.deleted.includes(storageId(item.bucket,item.key)))??[],[scan]);
  const candidates=items.filter(item=>item.eligible&&!scan?.skipped.includes(storageId(item.bucket,item.key)));
  const filtered=items.filter(item=>(scope==='all'||item.bucket===scope)&&(view==='all'||view==='candidate'&&item.eligible&&!scan?.skipped.includes(storageId(item.bucket,item.key))||view==='kept'&&!item.eligible)&&item.key.toLowerCase().includes(q.toLowerCase()));
  const pages=Math.max(1,Math.ceil(filtered.length/50)),currentPage=Math.min(page,pages);
  const picked=candidates.filter(item=>selected.has(storageId(item.bucket,item.key)));
  const total=(name:'private'|'public')=>!scan?.items.length?scan?.totals?.[name].bytes??0:items.filter(item=>item.bucket===name).reduce((n,item)=>n+item.size,0);
  async function runScan(resume=false) {
    if(scanning.current)return;
    const clientId=(resume?savedPreparation()?.clientId:undefined)??crypto.randomUUID();
    try{sessionStorage.setItem(preparationKey,JSON.stringify({clientId,startedAt:Date.now()}));}catch{/* The workflow also works without browser persistence. */}
    scanning.current=true;setBusy(true);setPreparing(true);setError('');setMessage('正在检查操作状态…');setSelected(new Set());
    try{
      const current=await prepareStorageScan({
        clientId,active:()=>scanning.current&&mounted.current,wait,
        read:async()=>{const result=await api<State>('storage',{},20_000);if(mounted.current){setPolicy(result.data.policy);setEtag(result.etag);}return result.data;},
        recover:async(action,state)=>{await api('storage/recovery',{method:'POST',headers:{'If-Match':state.gateEtag},body:JSON.stringify({action,confirm:'恢复维护锁',...(action==='prepare'?{mode:'cleanup',clientId}:{}),...(state.gate.recovery?{id:state.gate.recovery.id}:{})})},20_000);},
        confirmRecovery:()=>window.confirm('上次操作未正常结束。请确认其他窗口与成员当前没有正在上传、保存或发布，并已暂停外部 R2 写入。继续后会自动完成核对和扫描，不会删除文件。是否继续？'),
        progress:(state,note)=>{if(mounted.current){setData(previous=>({...state,scan:previous?.scan?.id===state.scan?.id&&previous?.scan?.status==='ready'?previous.scan:state.scan}));setMessage(note);}},
      });
      if(!current||!scanning.current){if(mounted.current)setMessage('检查已暂停，未删除任何文件。');return;}
      if(mounted.current)setPreparing(false);
      let value:StorageScan,revision:string;
      const canResume=resume&&current.scan?.algorithm===3&&current.scan.status!=='ready'&&current.serverTime-Date.parse(current.scan.createdAt)<86_400_000&&(!current.gate.recovered||Date.parse(current.scan.createdAt)>Date.parse(current.gate.recovered.time));
      if(canResume){value=current.scan!;revision=current.scanEtag;}
      else{const initial=await api<{scan:StorageScan}>('storage/scan',{method:'POST',body:JSON.stringify({restart:!!current.scan})});value=initial.data.scan;revision=initial.etag;}
      setData(previous=>({...previous!,scan:value,scanEtag:revision}));
      const completed=await advanceStorageScan({scan:value,etag:revision},{
        active:()=>scanning.current&&mounted.current,
        wait,
        progress:(next,note)=>{if(mounted.current){setData(previous=>({...previous!,scan:next.scan,scanEtag:next.etag}));setMessage(note??'');}},
        read:async()=>{const result=await api<State>('storage');if(!result.data.scan)throw new Error('扫描报告不存在，请重新扫描。');return {scan:result.data.scan,etag:result.data.scanEtag};},
        step:async current=>{const result=await api<{scan:StorageScan}>(`storage/scan/${current.scan.id}`,{method:'POST',headers:{'If-Match':current.etag},body:'{}'});return {scan:result.data.scan,etag:result.etag};},
      });
      value=completed.scan;
      if(value.status==='ready')await load();
      if(mounted.current)setMessage(value.status==='ready'?'扫描完成。尚未删除任何文件，请核对可清理项。':'扫描已暂停，进度已保存在服务器，可稍后继续。');
    }catch(cause){if(mounted.current){setMessage('');setError(cause instanceof Error?cause.message:'扫描失败，未执行删除。');}}
    finally{scanning.current=false;try{if(savedPreparation()?.clientId===clientId)sessionStorage.removeItem(preparationKey);}catch{/* Optional browser persistence. */}if(mounted.current){setBusy(false);setPreparing(false);}}
  }
  async function savePolicy() {
    if(policy.enabled&&!window.confirm('启用自动清理后，服务器会定时扫描并永久删除符合本页保留期及引用规则的对象。默认只处理临时上传、过期历史和上传记录；额外选择的无引用资源也会删除。确认保存策略？'))return;
    setBusy(true);setError('');setMessage('');
    try{await api('storage/policy',{method:'PUT',headers:{'If-Match':etag},body:JSON.stringify(policy)});await load();setMessage('清理策略已保存。修改保留期后请重新扫描；自动清理依赖部署时配置的定时触发器。');}
    catch(cause){setError(cause instanceof Error?cause.message:'策略未确认保存，请刷新核对。');}finally{setBusy(false);}
  }
  async function remove() {
    if(!scan||!reportComplete||confirmation!=='永久删除'||!picked.length)return;
    setBusy(true);setError('');setMessage('');let count=0,size=0;
    try{
      for(let offset=0;offset<picked.length;offset+=20){
        const batch=picked.slice(offset,offset+20),keys=batch.map(item=>storageId(item.bucket,item.key)),pages=[...new Set(batch.map(item=>item.page))];
        const result=await api<{scan:StorageScan;removed:number;bytes:number}>('storage/delete',{method:'POST',body:JSON.stringify({scanId:scan.id,keys,pages,confirm:confirmation})});
        count+=result.data.removed;size+=result.data.bytes;
        setData(previous=>({...previous!,scan:{...previous!.scan!,deleted:[...previous!.scan!.deleted,...result.data.scan.deleted],skipped:[...previous!.scan!.skipped,...result.data.scan.skipped]}}));
        setMessage(`已确认删除 ${count} 个对象，释放 ${bytes(size)}。`);
      }
      setSelected(new Set());setReview(false);setConfirmation('');await load();
    }catch(cause){setError(`${cause instanceof Error?cause.message:'删除未确认。'} 请重新读取报告与管理员日志核对已完成的批次；不要假定整批均未执行。`);}finally{setBusy(false);}
  }
  const editingPolicy=JSON.stringify(policy)!==JSON.stringify(data?.policy);
  return <section className="storage-manager">
    <div className="section-heading"><div><h2><HardDrive size={20}/>R2 存储管理</h2><p>检查后自动扫描，完成后选择要删除的文件。</p></div><div className="button-row"><button disabled={activeBusy} onClick={()=>{setBusy(true);setError('');setMessage('');void load().catch(e=>setError(String(e))).finally(()=>setBusy(false));}}><RefreshCw size={15}/>重新读取</button><button disabled={activeBusy||!data||editingPolicy} onClick={()=>void runScan()}>{gateBlocked||needsRescan?'检查并扫描':scan?'重新扫描':'开始扫描'}</button></div></div>
    {error&&<p role="alert" className="error">{error}</p>}{message&&<p role={preparing||!scan||scan.status==='ready'||!busy?'status':undefined} className="success">{message}</p>}
    {reading&&<p className="hint">正在读取分页报告，请稍候…</p>}
    {scan?.status==='ready'&&!reportComplete&&!activeBusy&&<p className="notice">文件清单尚未读取完整，请点击“重新读取”。读取完成前不会导出不完整报告或执行删除。</p>}
    {!!scan?.warnings?.length&&<details className="storage-note"><summary>发现 {scan.warnings.length} 个失效正文链接</summary><p>这些链接的目标文件在枚举时就不存在，已记录为警告；现存文件的引用仍完整核对。可在对应文章中修正链接。</p><ul>{scan.warnings.slice(0,50).map((warning,index)=><li key={index}><code>{warning.bucket} / {warning.key}</code></li>)}</ul>{scan.warnings.length>50&&<p>完整清单见导出报告。</p>}</details>}
    {preparing&&<div className="notice"><p>操作状态核对完成后会自动开始扫描，无需另行恢复或重新扫描。</p><button onClick={()=>{scanning.current=false;}}>暂停检查</button></div>}
    {!activeBusy&&gateBlocked&&<div className="notice"><p>有操作尚未确认结束。点击“检查并扫描”，后台会一并核对并继续。</p><details><summary>诊断详情</summary><p>{Object.keys(data!.gate.writers).length} 条写入记录{data!.gate.cleaner?'，正在维护核对':''}。</p></details></div>}
    {!activeBusy&&needsRescan&&<p className="notice">上次检查已完成。点击“检查并扫描”即可生成最新清单。</p>}
    <div className="storage-totals"><div><span>private 已扫描占用</span><strong>{scan?bytes(total('private')):'待扫描'}</strong></div><div><span>public 已扫描占用</span><strong>{scan?bytes(total('public')):'待扫描'}</strong></div><div><span>符合保留期、无引用</span><strong>{reportComplete?bytes(candidates.reduce((n,item)=>n+item.size,0)):'待核对'}</strong><small>{candidates.length} 个候选</small></div></div>
    {scan&&(scan.format!==2||scan.algorithm!==3)&&<p className="notice">扫描算法已更新，请点击“重新扫描”；已有文件未被删除。</p>}
    {!preparing&&scan?.format===2&&scan.algorithm===3&&scan.status!=='ready'&&<div className="notice" role="status"><span>{scan.status==='roots'?`正在读取当前目录 ${(scan.rootRead??0)+1}/6`:scan.status==='inventory'?`正在枚举 ${scan.bucket}，已扫描 ${scan.objectCount??0} 个对象`:scan.status==='classification'?`正在生成报告 ${scan.classifyPage??0}/${scan.pageCount??0} 页`:`正在核对引用 ${scan.read}/${scan.referenceCount??scan.queue.length}`}。可暂停后继续。</span><button disabled={!activeBusy} onClick={()=>{scanning.current=false;}}>暂停扫描</button>{!busy&&<button onClick={()=>void runScan(true)}>继续扫描</button>}</div>}
    {scan&&<><p className="hint">扫描开始：{new Date(scan.createdAt).toLocaleString('zh-CN')} · 完成后结果有效 24 小时。统计为已完成对象，不包括尚未完成的 multipart 分片；R2 面板可能延迟更新。</p><div className="storage-breakdown">{Object.entries(names).map(([kind,label])=><div key={kind}><span>{label}</span><strong>{bytes(items.filter(item=>item.kind===kind).reduce((n,item)=>n+item.size,0))}</strong></div>)}</div></>}
    <div className="storage-note"><p>草稿、公开内容、归档作品、已保存的素材和发行文件，以及现存备份引用的资源都会保留。历史或人工上传的非托管文件不自动删除。</p><p>不再需要的图片或下载文件，请先在作品／文档编辑器移除并保存；公开资源还需确认发布或下架。过期备份清掉后，下一次扫描才能回收它们曾引用的资源。每类历史至少保留最近 10 份。</p><p>删除前请暂停 rclone 等外部写入工具；后台会自动协调自身的保存、上传和发布。删除不可撤销，也不会清除已下载到访客本机的文件或浏览器缓存。</p></div>
    {scan?.format===2&&scan.algorithm===3&&scan.status==='ready'&&<><div className="filter-bar"><label className="search"><Search size={16}/><input type="search" aria-label="搜索存储路径" placeholder="搜索文件路径" value={q} onChange={e=>{setQ(e.target.value);setPage(1);}}/></label><select aria-label="存储桶筛选" value={scope} onChange={e=>{setScope(e.target.value);setPage(1);}}><option value="all">两个桶</option><option value="private">private</option><option value="public">public</option></select><select aria-label="存储状态筛选" value={view} onChange={e=>{setView(e.target.value);setPage(1);}}><option value="candidate">可清理</option><option value="kept">受保护</option><option value="all">全部对象</option></select></div><div className="button-row"><button disabled={activeBusy||!filtered.some(item=>item.eligible)} onClick={()=>setSelected(new Set(filtered.filter(item=>item.eligible&&!scan.skipped.includes(storageId(item.bucket,item.key))).map(item=>storageId(item.bucket,item.key))))}>选择筛选内可清理项</button><button disabled={activeBusy||!reportComplete||gateBlocked||needsRescan||!picked.length} onClick={()=>{setReview(true);setConfirmation('');}}><Trash2 size={15}/>清理选中（{picked.length}）</button><button disabled={activeBusy||!reportComplete} onClick={()=>exportReport(scan)}><Download size={15}/>导出扫描报告</button></div>
      <div className="report-table storage-table"><table><thead><tr><th>选择</th><th>桶／路径</th><th>大小</th><th>判定</th></tr></thead><tbody>{filtered.slice((currentPage-1)*50,currentPage*50).map(item=>{const id=storageId(item.bucket,item.key);return <tr key={id}><td><input type="checkbox" aria-label={`选择 ${item.key}`} disabled={activeBusy||!item.eligible||scan.skipped.includes(id)} checked={selected.has(id)} onChange={()=>setSelected(previous=>{const next=new Set(previous);if(next.has(id))next.delete(id);else next.add(id);return next;})}/></td><td><small>{item.bucket}</small><code>{item.key}</code></td><td>{bytes(item.size)}</td><td>{scan.skipped.includes(id)?'对象已改变或不存在，已跳过':item.reason}</td></tr>;})}</tbody></table>{!filtered.length&&<p className="empty">此筛选下没有对象。</p>}</div><div className="pagination"><button disabled={currentPage<=1} onClick={()=>setPage(p=>p-1)}>上一页</button><span>{currentPage} / {pages}</span><button disabled={currentPage>=pages} onClick={()=>setPage(p=>p+1)}>下一页</button></div></>}
    {review&&<Confirmation busy={activeBusy} onClose={()=>setReview(false)}><h3>永久删除 {picked.length} 个对象 · {bytes(picked.reduce((n,item)=>n+item.size,0))}</h3><p>所选文件及过期快照将从 R2 删除，不能通过代码回滚恢复。确认以下路径后输入“永久删除”。</p><ul>{picked.map(item=><li key={storageId(item.bucket,item.key)}>{item.bucket} / {item.key}</li>)}</ul><label>确认文字<input aria-label="清理确认文字" value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={activeBusy}/></label><div className="button-row"><button disabled={activeBusy} onClick={()=>setReview(false)}>取消删除</button><button className="danger" disabled={activeBusy||confirmation!=='永久删除'} onClick={()=>void remove()}>确认永久删除</button></div></Confirmation>}
    <fieldset disabled={activeBusy||!data} className="storage-policy"><legend>自动清理与保留期限</legend><label className="storage-check"><input type="checkbox" checked={policy.enabled} onChange={e=>setPolicy({...policy,enabled:e.target.checked})}/>启用服务器自动清理（默认关闭）</label><p className="hint">定时触发器每 15 分钟分批推进；每轮删除最多 20 个对象、2 GiB。无需保持浏览器打开。先清理临时上传、过期历史与上传记录，以下资源需额外授权。</p><label className="storage-check"><input type="checkbox" checked={policy.assets} onChange={e=>setPolicy({...policy,assets:e.target.checked,publicAssets:e.target.checked&&policy.publicAssets})}/>自动清理无引用的私有图片／文件</label><label className="storage-check"><input type="checkbox" disabled={!policy.assets} checked={policy.publicAssets} onChange={e=>setPolicy({...policy,publicAssets:e.target.checked})}/>同时清理无引用的公开图片、正文和下载文件</label><div className="form-grid">{([['temporaryDays','临时上传保留',[7,14,30]],['privateDays','私有资源保留',[30,60,90]],['publicDays','公开资源保留',[90,180,365]],['historyDays','历史快照保留',[30,60,90,180]]] as const).map(([key,label,values])=><label key={key}>{label}<select value={policy[key]} onChange={e=>setPolicy({...policy,[key]:Number(e.target.value)})}>{values.map(days=><option key={days} value={days}>{days} 天</option>)}</select></label>)}</div><button disabled={activeBusy||!editingPolicy} onClick={()=>void savePolicy()}>保存清理策略</button>{editingPolicy&&<p className="hint">策略有未保存修改；保存后重新扫描再清理。</p>}{data?.automatic&&<p className="hint">最近自动任务：{data.automatic.finished?'本轮已结束':'正在分批处理'}{data.automatic.reason?` · ${data.automatic.reason}`:''}</p>}</fieldset>
  </section>;
}
