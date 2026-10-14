import { useEffect, useRef, useState } from 'react';
import { UploadCloud, X, RotateCcw } from 'lucide-react';
import { api, RequestError } from './api';
import { MAX_FILE_SIZE, MAX_IMAGE_SIZE, MIME_TYPES, PART_SIZE } from '../shared/model';
import type { Asset, Upload } from '../shared/model';

type Props = { workId: string; versionId?: string; kind: 'image' | 'file'; disabled?: boolean; onUploaded(asset: Asset): void };
type UploadState = { upload: Upload; parts: { partNumber: number; size: number; sha256: string }[] };
export function UploadPanel({ workId, versionId, kind, disabled, onUploaded }: Props) {
  const [progress, setProgress] = useState(0); const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null); const session = useRef<string | null>(null);
  const pending = useRef<File[]>([]); const hashing = useRef<Worker | null>(null);
  const onUploadedRef = useRef(onUploaded);
  useEffect(() => { onUploadedRef.current = onUploaded; }, [onUploaded]);
  useEffect(() => () => { controller.current?.abort(); hashing.current?.terminate(); }, []);
  useEffect(() => { if(!busy)return; const warn=(event:BeforeUnloadEvent)=>event.preventDefault(); window.addEventListener('beforeunload',warn); return ()=>window.removeEventListener('beforeunload',warn); }, [busy]);
  const hash = (file: File, signal: AbortSignal) => new Promise<{ sha256: string; parts: string[] }>((resolve, reject) => {
    const worker = new Worker(new URL('./hash-worker.ts', import.meta.url), { type: 'module' }); hashing.current = worker;
    const abort = () => { worker.terminate(); reject(new Error('上传已暂停，可重新选择同一文件续传。')); };
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = e => {
      if (e.data.error || e.data.sha256) { worker.terminate(); signal.removeEventListener('abort', abort); if(e.data.error) reject(new Error(e.data.error)); else resolve(e.data); }
      else setLabel(`正在校验 ${file.name} · ${Math.round(e.data.progress * 100)}%`);
    };
    worker.onerror = () => { worker.terminate(); reject(new Error('文件校验失败。')); };
    worker.postMessage(file);
  });
  const partRequest = (id: string, n: number, bytes: Blob, sha256: string, signal: AbortSignal, doneBytes: number, total: number) => new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest(); xhr.open('PUT', `/api/uploads/${id}/parts/${n}`);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream'); xhr.setRequestHeader('X-Fimel-CSRF', '1'); xhr.setRequestHeader('X-Part-SHA256', sha256);
    xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(Math.min(.99, (doneBytes + e.loaded) / total)); };
    xhr.timeout = 120_000;
    const abort = () => xhr.abort(); signal.addEventListener('abort', abort, { once: true });
    const cleanup = () => signal.removeEventListener('abort', abort);
    xhr.onload = () => { cleanup(); if (xhr.status >= 200 && xhr.status < 300) resolve(); else {
      let message = `上传失败（${xhr.status}），可重试或重新登录。`; try { message = JSON.parse(xhr.responseText).error || message; } catch { /* Access may return HTML */ } reject(new Error(message));
    } };
    xhr.onerror = xhr.ontimeout = () => { cleanup(); reject(new Error('网络中断，请重试续传。')); };
    xhr.onabort = () => { cleanup(); reject(new Error('上传已暂停，可重新选择同一文件续传。')); };
    xhr.send(bytes);
  });
  async function start(files: File[]) {
    setBusy(true); setError(''); pending.current = files;
    const abort = new AbortController(); controller.current = abort;
    try {
      for (const file of files) {
        setProgress(0); session.current = null;
        const ext = file.name.split('.').pop()!.toLowerCase();
        if (!MIME_TYPES[ext] || file.size < 1 || file.size > (kind === 'image' ? MAX_IMAGE_SIZE : MAX_FILE_SIZE) || (kind === 'image') !== ['png','jpg','jpeg','webp'].includes(ext)) throw new Error('格式不支持或文件超过限制。');
        const checked = await hash(file, abort.signal);
        const storageKey = `fimel_upload:${workId}:${versionId ?? 'images'}:${checked.sha256}`;
        let saved: UploadState | null = null;
        const oldId = localStorage.getItem(storageKey);
        if (oldId) { try { saved = (await api<UploadState>(`uploads/${oldId}`, {signal:abort.signal})).data; } catch(cause) { if(cause instanceof RequestError && [404,410].includes(cause.status)) localStorage.removeItem(storageKey); else throw cause; } }
        if (saved && (saved.upload.status === 'cancelled' || Date.parse(saved.upload.expiresAt) < Date.now())) saved = null;
        if (!saved) {
          const stem=file.name.slice(0,-ext.length-1).replace(/[^a-zA-Z0-9_-]/g,'-').replace(/^[^a-zA-Z0-9]+/,'').slice(0,120)||'file';
          const name=`${stem}.${ext}`;
          const created = await api<{ upload: Upload }>('uploads', { method: 'POST', signal:abort.signal, body: JSON.stringify({ name, displayName:file.name, size: file.size, kind, workId, versionId }) });
          saved = { upload: created.data.upload, parts: [] }; localStorage.setItem(storageKey, saved.upload.id);
        }
        session.current = saved.upload.id;
        if (saved.upload.status === 'complete' && saved.upload.asset) { onUploadedRef.current(saved.upload.asset); localStorage.removeItem(storageKey); continue; }
        let done = saved.parts.reduce((sum, p) => sum + p.size, 0);
        for (let n = 1; n <= Math.ceil(file.size / PART_SIZE); n++) {
          if (abort.signal.aborted) throw new Error('上传已暂停。');
          const receipt = saved.parts.find(p => p.partNumber === n);
          if (receipt) { if (receipt.sha256 !== checked.parts[n-1]) throw new Error('续传文件内容不同。'); continue; }
          const chunk = file.slice((n-1)*PART_SIZE, n*PART_SIZE); setLabel(`${file.name} · 分片 ${n}/${checked.parts.length}`);
          for (let retry = 0; ; retry++) {
            try { await partRequest(saved.upload.id, n, chunk, checked.parts[n-1], abort.signal, done, file.size); break; }
            catch (cause) { if (retry >= 2 || abort.signal.aborted) throw cause; setLabel(`分片 ${n} 重试 ${retry+1}/2`); }
          }
          done += chunk.size; setProgress(done / file.size);
        }
        setLabel(`${file.name} · R2 完整 SHA-256 验证中`);
        const completed = await api<{ asset: Asset }>(`uploads/${saved.upload.id}/complete`, { method: 'POST', signal:abort.signal, body: JSON.stringify({ sha256: checked.sha256 }) });
        onUploadedRef.current(completed.data.asset); localStorage.removeItem(storageKey); setProgress(1);
      }
      setLabel('文件已验证并关联，请保存作品草稿。'); pending.current = [];
    } catch (cause) { setError(cause instanceof Error ? cause.message : '上传失败。'); }
    finally { setBusy(false); }
  }
  async function cancel() {
    controller.current?.abort();
    if (session.current) { try { await api(`uploads/${session.current}`, { method: 'DELETE' }); setLabel('会话已取消，未发布文件。'); } catch (cause) { setError(String(cause)); } }
  }
  return <div className="upload-panel">
    <label className="upload-picker"><UploadCloud size={22}/><span>{kind === 'image' ? '添加封面与截图' : '上传发行文件'}<small>{kind === 'image' ? 'PNG / JPEG / WebP · 每张 ≤ 10 MiB' : 'ZIP / JAR / EXE / MCWORLD / MCPACK · ≤ 1 GiB'}</small></span>
      <input aria-label={kind === 'image' ? '选择图片' : '选择发行文件'} type="file" multiple={kind === 'image'} accept={kind === 'image' ? '.png,.jpg,.jpeg,.webp' : '.zip,.jar,.exe,.mcworld,.mcpack,.mctemplate'} disabled={busy || disabled} onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) void start(files); e.target.value = ''; }}/>
    </label>
    {disabled && <p className="hint">先保存作品与版本，上传后仍须发布才会公开。</p>}
    {label && <p role="status">{label}</p>}
    {busy && <><progress max={1} value={progress}/><div className="button-row"><button type="button" onClick={() => controller.current?.abort()}>暂停</button><button type="button" onClick={() => void cancel()}><X size={15}/>取消会话</button></div></>}
    {error && <div role="alert" className="error"><p>{error}</p><button type="button" onClick={() => void start(pending.current)}><RotateCcw size={15}/>重试续传</button></div>}
  </div>;
}
