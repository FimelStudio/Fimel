import { useEffect, useState } from 'react';
import type { Upload } from '../shared/model';
import { api } from './api';
export function UploadSessions(){
  const [uploads,setUploads]=useState<Upload[]>([]);const [error,setError]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  async function load(){try{setUploads((await api<{uploads:Upload[]}>('uploads')).data.uploads);}catch(e){setError(String(e));}}
  useEffect(()=>{const timer=setTimeout(()=>void load(),0);return ()=>clearTimeout(timer);},[]);
  async function cancel(id:string){if(!window.confirm('确认取消此未完成上传会话？已验证和已发布文件不会被删除。'))return;setBusy(true);try{await api(`uploads/${id}`,{method:'DELETE'});await load();setMessage('会话已取消。');}catch(e){setError(String(e));}finally{setBusy(false);}}
  async function cleanup(){if(!window.confirm('清理已完成/已取消/过期会话的临时对象？已验证文件、公开安装包和备份均保留。'))return;setBusy(true);try{const r=await api<{cleaned:number}>('uploads/cleanup',{method:'POST',body:'{}'});await load();setMessage(`已处理 ${r.data.cleaned} 个临时对象。`);}catch(e){setError(String(e));}finally{setBusy(false);}}
  return <section className="upload-sessions"><div className="section-heading"><div><h2>上传会话</h2><p>重新选择同一文件可续传。会话有效期 24 小时。</p></div><button disabled={busy} onClick={()=>void cleanup()}>清理临时对象</button></div>{error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status" className="success">{message}</p>}{uploads.length?uploads.map(u=><div className="file-row" key={u.id}><div><strong>{u.displayName??u.name}</strong><p>{(u.size/1024**2).toFixed(1)} MiB · {u.status==='complete'?'已验证':u.status==='verifying'?'等待完成校验':u.status==='cancelled'?'已取消':'上传中 / 可续传'}</p><small>{new Date(u.expiresAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})} 到期</small></div>{!['complete','cancelled'].includes(u.status)&&<button disabled={busy} onClick={()=>void cancel(u.id)}>取消会话</button>}</div>):<p className="hint">暂无上传会话。</p>}</section>;
}
