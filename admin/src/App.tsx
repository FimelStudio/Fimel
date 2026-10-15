import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowLeft, Copy, Download, ExternalLink, FileText, History, Images, Moon, Plus, RefreshCw, Save, Search, Sun, Upload } from 'lucide-react';
import { ProjectMarkdownBody } from '../../src/components/ProjectMarkdown';
import { MarkdownImagePicker } from './MarkdownImagePicker';
import { transferFiles, useMarkdownImages } from './useMarkdownImages';
import type { Project, ProjectTab, LocalizedText } from '../../src/content/projects';
import { localizedText, PROJECT_TYPES } from '../../src/content/projects';
import tags from '../../src/content/project-tags.json';
import { LOCALES, makeWork } from '../shared/model';
import type { Library, Locale, PublicManifest, Work } from '../shared/model';
import { validateLibrary } from '../shared/validation';
import { api, RequestError } from './api';
import { sameWork } from '../shared/revisions';
import type { WorkConflict } from '../shared/revisions';
import { ConflictReview } from './ConflictReview';
import { usePublicationStatus } from './usePublicationStatus';
import { useDraftRecovery } from './useDraftRecovery';
import { useAppUpdate } from './useAppUpdate';
import { ImageUsage } from './ImageUsage';
import { imageUsage } from '../shared/image-usage';
import { PublicationTimes } from './PublicationTimes';
import { ReleaseCompatibilityFields } from './ReleaseCompatibilityFields';
import { SiteEditor } from './SiteEditor';
import { UploadPanel } from './UploadPanel';
import { PublicationPreview } from './PublicationPreview';
import i18n from '../../src/i18n';
import { UploadSessions } from './UploadSessions';
import { AuditPanel, AnalyticsPanel } from './Reports';
import { planImport } from '../shared/import';
import type { ImportPlan } from '../shared/import';
import { ImportPreview } from './ImportPreview';

const typeNames = { bedrock: '基岩版 / 网易', java: 'Java 地图', datapacks: '数据包', mods: '模组', tools: '插件与工具' };
const workflowNames = { draft: '草稿', ready: '待发布', archived: '已归档' };
const snapshotLabel=(key:string)=>key.startsWith('backups/public/')?'公开发布快照':key.startsWith('backups/site/')?'网站内容草稿快照':'私有作品库快照';
type Loaded = { library: Library; public: PublicManifest; publicEtag: string };
const empty: Library = { schemaVersion: 1, works: [] };
function downloadJson(value: unknown, filename: string) { const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
export function App() {
  const [library, setLibrary] = useState<Library>(empty); const [original, setOriginal] = useState('');
  const [published, setPublished] = useState<PublicManifest | null>(null); const [etag, setEtag] = useState(''); const [publicEtag, setPublicEtag] = useState('');
  const [selected, setSelected] = useState<string | null>(null); const [q, setQ] = useState(''); const [type, setType] = useState(''); const [filter, setFilter] = useState('active'); const [sort, setSort] = useState('order'); const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(false); const [history, setHistory] = useState<{ key: string; time: string }[] | null>(null);
  const [username,setUsername]=useState<string|null>(null);
  const [actorId,setActorId]=useState<string|null>(null);
  const [siteDirty,setSiteDirty]=useState(false);
  useEffect(()=>{const controller=new AbortController();void api<{username:string;actorId:string}>('session',{signal:controller.signal}).then(r=>{if(!controller.signal.aborted){setUsername(r.data.username);setActorId(r.data.actorId);}}).catch(()=>{if(!controller.signal.aborted)setUsername('身份读取失败');});return()=>controller.abort();},[]);
  const [report,setReport]=useState<'audit'|'analytics'|'site'|null>(null);
  const [importPreview,setImportPreview]=useState<{plan:ImportPlan;source:string}|null>(null);
  const [activeUploads,setActiveUploads]=useState<Set<string>>(new Set());
  const uploading=activeUploads.size>0;
  const onUploadBusy=useCallback((id:string,active:boolean)=>setActiveUploads(previous=>{const next=new Set(previous);if(active)next.add(id);else next.delete(id);return next;}),[]);
  const [dark, setDark] = useState(document.documentElement.classList.contains('dark'));
  const fileRef = useRef<HTMLInputElement>(null);
  const work = library.works.find(w => w.id === selected); const libraryDirty = !!original && JSON.stringify(library) !== original; const dirty=libraryDirty||siteDirty;
  const publicationStatus=usePublicationStatus(library,published);
  const recovery=useDraftRecovery(actorId,library,original,selected);
  const updateAvailable=useAppUpdate();
  const [conflict,setConflict]=useState<WorkConflict|null>(null);
  const publicationText=(w:Work)=>w.workflow==='archived'?'已归档':!published?.projects.some(p=>p.slug===w.project.slug)?workflowNames[w.workflow]:publicationStatus[w.project.slug]==='synced'?'已公开 · 已同步':publicationStatus[w.project.slug]==='pending'?'已公开 · 有修改待发布':'已公开 · 历史版本待核对';
  const load = useCallback(async (quiet=false) => {
    if(!quiet)setLoading(true); setError('');
    try { const result = await api<Loaded>('library'); setLibrary(result.data.library); setOriginal(JSON.stringify(result.data.library)); setPublished(result.data.public); setEtag(result.etag); setPublicEtag(result.data.publicEtag); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '无法加载。'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(initial); }, [load]);
  useEffect(() => { const handler = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [dirty]);
  const status = (w: Work) => w.workflow === 'archived' ? 'archived' : published?.projects.some(p => p.slug === w.project.slug) ? 'published' : w.workflow;
  const filtered = useMemo(() => library.works.filter(w => (!type || w.project.type === type) && (!filter || (filter === 'active' ? w.workflow !== 'archived' : (w.workflow === 'archived' ? 'archived' : published?.projects.some(p => p.slug === w.project.slug) ? 'published' : w.workflow) === filter)) && JSON.stringify([w.project.title,w.project.summary,w.project.slug,w.project.tags]).toLowerCase().includes(q.toLowerCase())).sort((a,b) => sort === 'updated' ? b.updatedAt.localeCompare(a.updatedAt) : sort === 'name' ? localizedText(a.project.title,'zh').localeCompare(localizedText(b.project.title,'zh')) : a.order - b.order), [library, type, filter, published, q, sort]);
  const currentPage = Math.max(1, Math.min(page, Math.ceil(filtered.length / 20)));
  const update = (next: Work) => { setMessage(''); setLibrary(prev => ({ ...prev, works: prev.works.map(w => w.id === next.id ? { ...next, updatedAt: new Date().toISOString() } : w) })); };
  async function save(all=false): Promise<boolean> {
    if(uploading){setError('请先完成或暂停上传，再保存草稿。');return false;}
    const errors = validateLibrary(library); if (errors.length) { setError(errors.join('\n')); return false; }
    setBusy(true); setError(''); setMessage('');
    try {
      const base=JSON.parse(original) as Library;
      const edits=library.works.filter(w=>!sameWork(w,base.works.find(b=>b.id===w.id)));
      const targets=all||!work?edits:edits.filter(w=>w.id===work.id);
      const remaining=new Map(edits.map(w=>[w.id,w]));
      for(const target of targets){
        const result=await api<Loaded>(`works/${target.id}`,{method:'PUT',body:JSON.stringify({base:base.works.find(w=>w.id===target.id)??null,work:target})});
        remaining.delete(target.id);const server=result.data.library;
        setLibrary({...server,works:[...server.works.map(w=>remaining.get(w.id)??w),...Array.from(remaining.values()).filter(w=>!server.works.some(s=>s.id===w.id))]});
        setOriginal(JSON.stringify(server));setEtag(result.etag);setPublished(result.data.public);setPublicEtag(result.data.publicEtag);
      }
      setMessage(remaining.size?'当前作品已保存。另有未保存修改，可点击“保存全部修改”。':'草稿已保存到私有存储。官网尚未同步；需要更新官网时，请点击“发布预览”并确认发布。');return true;
    }
    catch (cause) { if(cause instanceof RequestError&&cause.status===409&&cause.details&&typeof cause.details==='object'&&'conflict'in cause.details)setConflict(cause.details.conflict as WorkConflict);setError(cause instanceof Error ? cause.message : '保存失败。'); return false; } finally { setBusy(false); }
  }
  function restoreRecovery(){
    const record=recovery.found;if(!record)return;
    const errors=validateLibrary({schemaVersion:1,works:record.edits.map(edit=>edit.work)});if(errors.length){setError('本机恢复记录无效，请保留导出并检查。');return;}
    const edits=new Map(record.edits.map(edit=>[edit.work.id,edit]));
    setLibrary(prev=>({...prev,works:[...prev.works.map(w=>edits.get(w.id)?.work??w),...record.edits.filter(edit=>!prev.works.some(w=>w.id===edit.work.id)).map(edit=>edit.work)]}));
    setOriginal(previous=>{const base=JSON.parse(previous) as Library;return JSON.stringify({...base,works:base.works.filter(w=>!edits.has(w.id)).concat(record.edits.flatMap(edit=>edit.base?[edit.base]:[]))});});
    setSelected(record.selected);void recovery.dismiss();setMessage('已恢复本机编辑。再次保存时会核对服务器内容，冲突不会自动覆盖。');
  }
  async function publish(action: 'publish' | 'unpublish') {
    if (!work || dirty) { setError('请先保存草稿，再发布或下架。'); return; }
    setBusy(true); setError('');
    try { await api(`${action}/${work.id}`, { method: 'POST', headers: { 'If-Match': etag, 'X-Public-ETag': publicEtag }, body: '{}' }); setPreview(false); await load(true); setMessage(action === 'publish' ? '发布成功，公开 manifest 已更新。' : '作品已下架，草稿与历史文件保留。'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败。'); } finally { setBusy(false); }
  }
  function create(copy?: Work) {
    if (loading || busy || uploading || !original) return;
    const next = copy ? { ...structuredClone(copy), id: crypto.randomUUID(), workflow: 'draft' as const, versions: [], gallery: [], coverId: undefined,
      project: { ...copy.project, slug: `${copy.project.slug}-copy-${Date.now().toString(36)}`, downloadUrl: undefined, download: undefined }, legacy: undefined } : makeWork();
    next.order = Math.max(-1, ...library.works.map(w => w.order)) + 1; next.createdAt = next.updatedAt = new Date().toISOString();
    setLibrary(prev => ({ ...prev, works: [...prev.works, next] })); setSelected(next.id); setError('');
  }
  async function importFile(file: File) {
    if (loading || busy || uploading || !original) return;
    if (dirty) { setError('请先保存或导出当前修改，再导入作品。'); return; }
    if (file.size > 4_000_000) { setError('导入文件超过 4 MB。'); return; }
    try { const plan=planImport(library,JSON.parse(await file.text()));setError('');setImportPreview({plan,source:file.name});
    } catch (cause) { setError(cause instanceof Error ? cause.message : '导入失败。'); }
  }
  async function importExisting() {
    if (loading || busy || dirty || uploading || !original) return;
    setBusy(true);setError('');
    try {const result=await api<{library:Library;source:string}>('import-source');setImportPreview({plan:planImport(library,result.data.library),source:result.data.source});}
    catch(cause){setError(cause instanceof Error?cause.message:'无法读取现有作品。');}finally{setBusy(false);}
  }
  async function restore(key: string) {
    if (dirty || !window.confirm('恢复前将创建当前版本备份。确认恢复此快照？')) { if (dirty) setError('请先保存或导出当前修改。'); return; }
    setBusy(true); try { const [, kind, id] = key.split('/'); const restoreEtag=kind==='site'?(await api('site')).etag:etag; await api(`restore/${kind}/${id.replace('.json','')}`, { method:'POST', headers: { 'If-Match':restoreEtag, 'X-Public-ETag':publicEtag }, body:'{}' }); await load(); setHistory(null); setMessage('恢复成功，恢复前状态已备份。'); }
    catch (cause) { setError(String(cause)); } finally { setBusy(false); }
  }
  const totalPublished = published?.projects.length ?? 0;
  const archivedCount = library.works.filter(w => w.workflow === 'archived').length;
  return <div className="admin-shell">
    <header className="admin-header"><a className="brand-link" href="https://studiofimel.com" target="_blank" rel="noreferrer"><img className="brand-mark" src="/assets/brand/fimel-logo.svg" alt="Fimel"/><span className="brand-wordmark" data-wordmark="Fimel Studio">Fimel Studio</span></a><span className="admin-label">Admin</span><div className="header-actions"><span className="admin-username" aria-label="当前登录用户" title={username ?? undefined}>{username??'正在读取身份…'}</span><button type="button" aria-label="切换主题" onClick={() => { setDark(!dark); document.documentElement.classList.toggle('dark', !dark); localStorage.setItem('fimel_theme', !dark ? 'dark':'light'); }}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button><a href="/cdn-cgi/access/logout">退出</a></div></header>
    <div className="admin-body"><aside className="sidebar"><div className="sidebar-title">内容管理</div><button disabled={uploading} className={!history&&!report?'active':''} onClick={() => {if(siteDirty){setError('请先保存网站草稿。');return;}setHistory(null);setReport(null);}}><FileText size={18}/>作品库<span>{library.works.length}</span></button><button disabled={uploading} onClick={() => { if (dirty) { setError('请先保存或导出当前修改。'); return; } setReport(null); void api<{ snapshots: {key:string;time:string}[] }>('history').then(r => setHistory(r.data.snapshots)).catch(e => setError(String(e))); }}><History size={18}/>备份与恢复</button><button disabled={uploading} className={report==='site'?'active':''} onClick={()=>{if(dirty){setError('请先保存或导出当前修改。');return;}setHistory(null);setReport('site');}}><FileText size={18}/>{'网站内容'}</button><button disabled={uploading} className={report==='audit'?'active':''} onClick={()=>{if(dirty){setError('请先保存或导出当前修改。');return;}setHistory(null);setReport('audit');}}><History size={18}/>管理员日志</button><button disabled={uploading} className={report==='analytics'?'active':''} onClick={()=>{if(dirty){setError('请先保存或导出当前修改。');return;}setHistory(null);setReport('analytics');}}><FileText size={18}/>访问与下载统计</button><a href="https://studiofimel.com/#/works" target="_blank" rel="noreferrer"><ExternalLink size={18}/>公开作品页</a><div className="sidebar-note"><span className="status-dot"/>私有编辑空间<p>草稿和上传资源在发布后才会公开。</p></div></aside>
    <main className="admin-main" id="main-content"><div className="page-heading"><div><div className="breadcrumb">Fimel Studio / 内容管理{work ? ` / ${localizedText(work.project.title,'zh') || '新作品'}` : ''}</div><h1>{report ? report==='site'?'网站内容':report==='audit'?'管理员日志':'访问与下载统计' : history ? '备份与恢复' : work ? localizedText(work.project.title,'zh') || '新作品' : '作品库'}</h1><p>{report ? '工作室管理记录与域名活动。' : history ? '每次保存与发布前创建私有快照。' : work ? `${typeNames[work.project.type]} · ${work.project.slug || '填写稳定 slug'}` : `${library.works.length - archivedCount} 个在用作品 · ${totalPublished} 个后台已发布${archivedCount ? ` · ${archivedCount} 个已归档` : ''}`}</p></div><div className="button-row">{report ? null : work ? <><button disabled={busy||uploading} onClick={() => setSelected(null)}><ArrowLeft size={16}/>返回</button><button disabled={busy||uploading} onClick={() => create(work)}><Copy size={16}/>复制</button><button className="primary" disabled={busy||uploading} onClick={() => void save()}><Save size={16}/>{busy ? '处理中' : '保存草稿'}</button></> : <><button disabled={loading||busy||uploading||!original} onClick={() => downloadJson(library,'fimel-library.json')}><Download size={16}/>导出</button><button disabled={loading||busy||uploading||!original} onClick={() => fileRef.current?.click()}><Upload size={16}/>导入</button><button disabled={loading||busy||uploading||dirty||!original} onClick={()=>void importExisting()}>导入现有作品</button><button className="primary" disabled={loading||busy||uploading||!original} onClick={() => create()}><Plus size={16}/>新建作品</button></>}</div></div>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => { const file = e.target.files?.[0]; if(file) void importFile(file); e.target.value=''; }}/>
      {updateAvailable&&<div className="notice" role="status"><span>后台已有新版本。刷新后可使用最新修复，当前编辑不会被自动刷新。{siteDirty?'请先保存网站内容草稿，再刷新。':''}</span><button disabled={busy||uploading||siteDirty} onClick={async()=>{if(!siteDirty&&(!dirty||await save(true)))requestAnimationFrame(()=>window.location.reload());}}>{dirty?'保存全部草稿并刷新':'刷新使用新版'}</button></div>}
      {recovery.found&&<div className="notice" role="status"><span>发现 {new Date(recovery.found.at).toLocaleString('zh-CN')} 的本机未保存编辑（{recovery.found.edits.length} 个作品）。</span><button disabled={loading||busy||uploading||dirty} onClick={restoreRecovery}>恢复编辑</button><button onClick={()=>downloadJson(recovery.found,'fimel-recovery.json')}>导出恢复记录</button><button disabled={busy||uploading} onClick={()=>{if(window.confirm('放弃此本机恢复记录？服务器草稿不变。'))void recovery.dismiss();}}>放弃恢复</button></div>}
      {recovery.error&&<p role="alert" className="error">{recovery.error}</p>}
      {dirty&&recovery.savedAt&&<p className="hint">本机恢复记录：{new Date(recovery.savedAt).toLocaleTimeString('zh-CN')} · 仅保存在当前浏览器，保留 7 天；尚未保存到服务器。</p>}
      {dirty&&report!=='site'&&<button disabled={busy||uploading} onClick={()=>void save(true)}>保存全部修改</button>}
      {dirty && report!=='site' && <div className="notice"><span>有未保存的更改</span><button disabled={busy||uploading} onClick={() => void save()}>保存草稿</button><button disabled={busy||uploading} onClick={() => { if(window.confirm('放弃未保存修改并重新加载？')) void load(); }}>放弃修改</button></div>}
      {error && <div className="error" role="alert"><p>{error}</p><div className="button-row"><button onClick={() => downloadJson(library,'fimel-unsaved.json')}>导出当前修改</button><button disabled={busy||uploading} onClick={() => { if(!dirty || window.confirm('已导出修改？重新加载会放弃当前编辑。')) void load(); }}><RefreshCw size={15}/>重新加载</button></div></div>}
      {message && <p className="success" role="status">{message}</p>}
      {loading ? <div role="status" className="skeleton-list">正在加载作品库…{[1,2,3].map(n=><div key={n}/>)}</div> : report==='site' ? <SiteEditor library={library} actorId={actorId} onDirtyChange={setSiteDirty}/> : report==='audit' ? <AuditPanel workNames={Object.fromEntries(library.works.map(w=>[w.id,localizedText(w.project.title,'zh')]))}/> : report==='analytics' ? <AnalyticsPanel workNames={Object.fromEntries(library.works.map(w=>[w.project.slug,localizedText(w.project.title,'zh')]))}/> : history ? <div className="history-list">{history.length ? history.map(s=><div key={s.key}><div><strong>{snapshotLabel(s.key)}</strong><p>{new Date(s.time).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}</p></div><button disabled={busy} onClick={()=>void restore(s.key)}>恢复</button></div>) : <div className="empty"><History/><h2>还没有备份</h2><p>第一次保存草稿或发布时会自动创建。</p></div>}<UploadSessions/></div> : work ? <>
        <fieldset disabled={busy}><Editor onSave={save} uploading={uploading} onUploadBusy={onUploadBusy} key={work.id} publicUrls={Object.fromEntries((published?.releases[work.project.slug]??[]).flatMap(v=>v.files).map(a=>[a.id,a.publicUrl??'']))} work={work} update={update} saved={!!original && JSON.parse(original).works.some((w:Work)=>w.id===work.id)} savedVersionIds={original ? JSON.parse(original).works.find((w:Work)=>w.id===work.id)?.versions.map((v:{id:string})=>v.id) ?? [] : []}/></fieldset>
        <div className="publish-bar"><div><strong>{publicationText(work)}</strong><PublicationTimes savedAt={work.updatedAt} storedAt={original?(JSON.parse(original) as Library).works.find(w=>w.id===work.id)?.updatedAt:undefined} published={published?.publicationStates?.[work.project.slug]}/><p>保存草稿用于后台私有库。归档会移出在用列表，可从“已归档”筛选中恢复。</p>{published?.projects.find(p=>p.slug===work.project.slug)?.downloadUrl&&<a className="published-download" href={published.projects.find(p=>p.slug===work.project.slug)!.downloadUrl} target="_blank" rel="noreferrer">查看当前公开下载地址 ↗</a>}</div><div className="button-row"><button disabled={busy||uploading} onClick={() => { if (window.confirm(work.workflow==='archived'?'恢复为草稿？':'归档作品？已公开作品请先下架。')) { if(status(work)==='published'){setError('请先下架作品再归档。');return;} update({...work,workflow:work.workflow==='archived'?'draft':'archived'}); } }}><Archive size={16}/>{work.workflow==='archived'?'恢复草稿':'归档'}</button>{status(work)==='published'&&<button className="danger" disabled={busy||uploading||dirty} onClick={()=>{if(window.confirm('确认下架？历史文件会保留。'))void publish('unpublish');}}>下架</button>}<button className="primary" disabled={busy||uploading||dirty||work.workflow==='archived'} onClick={()=>setPreview(true)}>发布预览</button></div></div>
      </> : <><div className="filter-bar"><label className="search"><Search size={18}/><input type="search" aria-label="搜索作品" placeholder="搜索名称、slug 或标签" value={q} onChange={e=>{setQ(e.target.value);setPage(1);}}/></label><select aria-label="作品分类" value={type} onChange={e=>{setType(e.target.value);setPage(1);}}><option value="">全部分类</option>{PROJECT_TYPES.map(t=><option key={t} value={t}>{typeNames[t]}</option>)}</select><select aria-label="发布状态" value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);}}><option value="active">在用作品</option><option value="">全部状态</option><option value="published">已公开</option><option value="draft">草稿</option><option value="ready">待发布</option><option value="archived">已归档</option></select><select aria-label="排序" value={sort} onChange={e=>setSort(e.target.value)}><option value="order">自定义顺序</option><option value="updated">最近修改</option><option value="name">名称</option></select></div>
        <div className="work-table"><div className="table-heading"><span>作品</span><span>分类</span><span>状态</span><span>最近修改</span><span/></div>{filtered.slice((currentPage-1)*20,currentPage*20).map(w=><button disabled={uploading} className="work-row" key={w.id} onClick={()=>setSelected(w.id)}><div className="work-identity"><img src={w.coverId?`/api/media/${w.coverId}`:w.project.image.startsWith('https:')?w.project.image:`https://studiofimel.com/${w.project.image}`} alt="" loading="lazy"/><div><strong>{localizedText(w.project.title,'zh')}</strong><p>{w.project.slug}</p></div></div><span>{typeNames[w.project.type]}</span><span className={`badge ${status(w)}`}>{publicationText(w)}</span><span className="muted">{new Date(w.updatedAt).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'})}</span><span>编辑 →</span></button>)}</div>
        {!filtered.length&&<div className="empty"><FileText size={32}/><h2>{library.works.length?'没有匹配的作品':'开始管理你的作品'}</h2><p>{library.works.length?'调整搜索或筛选条件。':'新建作品，或导入迁移预览 JSON。'}</p></div>}
        {filtered.length>20&&<div className="pagination"><button disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>上一页</button><span>{currentPage} / {Math.ceil(filtered.length/20)}</span><button disabled={currentPage>=Math.ceil(filtered.length/20)} onClick={()=>setPage(currentPage+1)}>下一页</button></div>}
      </>}
      {importPreview&&<ImportPreview plan={importPreview.plan} source={importPreview.source} onClose={()=>setImportPreview(null)} onApply={()=>{setLibrary(importPreview.plan.library);setSelected(null);setHistory(null);setReport(null);setError('');setMessage(`已合并 ${importPreview.plan.added.length} 个新作品到编辑区，请检查后保存草稿。`);setImportPreview(null);}}/>}
      {preview&&work&&<PublicationPreview work={work} before={published?.projects.find(p=>p.slug===work.project.slug)??null} busy={busy} onClose={()=>setPreview(false)} onPublish={()=>void publish('publish')}/>}
      {conflict&&<ConflictReview conflict={conflict} close={()=>setConflict(null)} resolve={(next,current)=>{setLibrary(prev=>({...prev,works:prev.works.map(w=>w.id===next.id?next:w)}));setOriginal(previous=>{const base=JSON.parse(previous) as Library;return JSON.stringify({...base,works:current?base.works.some(w=>w.id===current.id)?base.works.map(w=>w.id===current.id?current:w):[...base.works,current]:base.works.filter(w=>w.id!==next.id)});});setConflict(null);setError('');setMessage('冲突选择已应用到编辑区，请检查后保存草稿。');}}/>}
    </main></div><footer className="admin-footer">Fimel Studio · 内容工作台 <span>中文界面 · 三语作品内容</span></footer>
  </div>;
}

function Editor({work,update,saved,savedVersionIds,publicUrls,uploading,onUploadBusy,onSave}:{work:Work;update(work:Work):void;saved:boolean;savedVersionIds:string[];publicUrls:Record<string,string>;uploading:boolean;onUploadBusy(id:string,active:boolean):void;onSave():Promise<boolean>}) {
  const [section,setSection]=useState('basic'); const [locale,setLocale]=useState<Locale>('zh'); const [tab,setTab]=useState<ProjectTab>('description');
  const [jsonDraft,setJsonDraft]=useState(JSON.stringify(work,null,2)); const [jsonError,setJsonError]=useState('');
  const project=(patch:Partial<Project>)=>update({...work,project:{...work.project,...patch}});
  const displayField=(key:'title'|'summary')=>{const pointer=work.project.translations?.[key];return pointer&&i18n.exists(pointer,{lng:locale})?i18n.t(pointer,{lng:locale}):localizedField(work.project[key],locale);};
  const local=(key:'title'|'summary',value:string)=>{const current=work.project[key];const pointer=work.project.translations?.[key];const next=pointer?Object.fromEntries(LOCALES.filter(l=>i18n.exists(pointer,{lng:l})).map(l=>[l,i18n.t(pointer,{lng:l})])):{...(typeof current==='string'?{zh:current}:current??{})};if(value)next[locale]=value;else delete next[locale];const translations={...work.project.translations};delete translations[key];project({[key]:next,translations:Object.keys(translations).length?translations:undefined});};
  const text=work.markdown[tab][locale]??'';
  const [imagePicker,setImagePicker]=useState(false);
  const {uploadRef:inlineUploadRef,textRef,inputRef:imageInputRef,importFiles:importInlineImages,onUploaded:inlineImageUploaded,error:inlineImageError,preparing:imagePreparing}=useMarkdownImages({work,saved,tab,locale,update,onSave});
  const [draggingImages,setDraggingImages]=useState(false);
  const setText=(value:string)=>update({...work,markdown:{...work.markdown,[tab]:{...work.markdown[tab],[locale]:value}}});
  const insertText=(value:string)=>{
    const start=textRef.current?.selectionStart??text.length;const end=textRef.current?.selectionEnd??start;
    const inserted=`\n\n${value}\n\n`;setText(text.slice(0,start)+inserted+text.slice(end));
    requestAnimationFrame(()=>{textRef.current?.focus();textRef.current?.setSelectionRange(start+inserted.length,start+inserted.length);});
  };
  const previewText=text;
  const resolvePreviewAsset=(id:string)=>{const asset=work.gallery.find(a=>a.id===id);return asset?.privateKey?new URL(`/api/media/${asset.id}`,window.location.origin).href:asset?.publicUrl;};
  return <div className="editor"><nav className="editor-tabs" aria-label="编辑内容">{[['basic','基本信息',FileText],['content','正文与预览',FileText],['images','封面与截图',Images],['versions','发行版本',Download],['advanced','完整字段',FileText]].map(([id,label,Icon])=><button disabled={uploading} key={String(id)} className={section===id?'active':''} onClick={()=>{setSection(String(id));if(id==='advanced')setJsonDraft(JSON.stringify(work,null,2));}}>{typeof Icon!=='string'&&<Icon size={16}/>}{String(label)}</button>)}</nav>
    <div className="editor-content">{['basic','content','versions'].includes(section)&&<div className="locale-tabs" aria-label="作品语言">{LOCALES.map(l=><button disabled={uploading||imagePreparing} aria-pressed={l===locale} key={l} onClick={()=>setLocale(l)}>{l==='zh'?'中文':l==='en'?'English':'日本語'}</button>)}</div>}
    {section==='basic'&&<div className="form-grid"><label>作品名称<input value={displayField('title')} onChange={e=>local('title',e.target.value)} required/></label><label>稳定 slug<input value={work.project.slug} disabled={saved} onChange={e=>project({slug:e.target.value})}/><small>保存后固定，避免分享和下载地址失效。</small></label><label className="full">简短介绍<textarea rows={3} value={displayField('summary')} onChange={e=>local('summary',e.target.value)}/></label><label>分类<select value={work.project.type} disabled={saved} onChange={e=>project({type:e.target.value as Project['type']})}>{PROJECT_TYPES.map(t=><option key={t} value={t}>{typeNames[t]}</option>)}</select></label><label>作品发行状态<select value={work.project.status} onChange={e=>project({status:e.target.value as Project['status']})}><option value="development">制作中</option><option value="planned">计划中</option><option value="released">已发行</option></select></label><label>编辑状态<select value={work.workflow} onChange={e=>update({...work,workflow:e.target.value as Work['workflow']})}>{Object.entries(workflowNames).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label><label>列表顺序<input type="number" min={0} value={work.order} onChange={e=>update({...work,order:Number(e.target.value)})}/></label><label>游戏平台<input value={work.project.platform.join(', ')} onChange={e=>project({platform:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}/></label><label>作者（逗号分隔）<input value={work.project.creators.map(c=>c.name).join(', ')} onChange={e=>project({creators:e.target.value.split(',').map(s=>s.trim()).filter(Boolean).map(name=>work.project.creators.find(c=>c.name===name)??{name})})}/></label><fieldset className="full tags-field"><legend>用途标签（最多 4 个）</legend>{Object.entries(tags).map(([id,labels])=><label key={id}><input type="checkbox" checked={work.project.tags.includes(id as keyof typeof tags)} disabled={!work.project.tags.includes(id as keyof typeof tags)&&work.project.tags.length>=4} onChange={e=>project({tags:e.target.checked?[...work.project.tags,id as keyof typeof tags]:work.project.tags.filter(t=>t!==id)})}/>{labels.zh}</label>)}</fieldset>{work.project.translations&&<p className="notice full">此作品名称/介绍来自现有 i18n 指针。迁移脚本会解析真实三语，编辑这些字段后将使用直接三语文案。</p>}</div>}
    {section==='content'&&<>
      <div className="button-row content-tabs">{(['description','changelog','versions'] as ProjectTab[]).map(t=><button disabled={uploading||imagePreparing} className={t===tab?'active':''} key={t} onClick={()=>setTab(t)}>{t==='description'?'详情':t==='changelog'?'更新日志':'版本说明'}</button>)}</div>
      <div className="button-row markdown-tools"><button disabled={uploading||imagePreparing} onClick={()=>insertText('## 标题')}>插入标题</button><button disabled={uploading||imagePreparing} onClick={()=>insertText('[链接文字](https://)')}>插入链接</button><button disabled={uploading||imagePreparing} onClick={()=>imageInputRef.current?.click()}>上传图片</button><button disabled={uploading||imagePreparing} aria-expanded={imagePicker} onClick={()=>setImagePicker(value=>!value)}>插入图片 / 轮播</button></div>
      <input ref={imageInputRef} hidden type="file" multiple accept=".png,.jpg,.jpeg,.webp" aria-label="选择正文图片" onChange={event=>{const files=Array.from(event.target.files??[]);event.target.value='';void importInlineImages(files);}}/>
      <UploadPanel compact uploadRef={inlineUploadRef} kind="image" workId={work.id} onUploaded={inlineImageUploaded} onBusyChange={onUploadBusy}/>
      {inlineImageError&&<p role="alert" className="error">{inlineImageError}</p>}
      {imagePicker&&!uploading&&!imagePreparing&&<MarkdownImagePicker key={`${work.id}-${tab}-${locale}`} assets={work.gallery} onInsert={insertText} onClose={()=>setImagePicker(false)}/>}
      <p className="hint">直接拖入图片，或粘贴截图/复制的图片，自动上传并插入光标处；一次导入多张组成轮播。PNG / JPEG / WebP，每张 ≤ 10 MiB。新作品会先保存草稿，发布后才会公开。</p>
      <div className="markdown-editor"><label>Markdown 正文<textarea ref={textRef} className={draggingImages?'image-drag-over':''} aria-label="Markdown 正文" rows={22} value={text} readOnly={uploading||imagePreparing} onChange={e=>setText(e.target.value)}
        onDragOver={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();event.dataTransfer.dropEffect='copy';setDraggingImages(true);}}}
        onDragLeave={()=>setDraggingImages(false)} onDrop={event=>{const files=transferFiles(event.dataTransfer);if(files.length){event.preventDefault();if(!uploading)void importInlineImages(files);}setDraggingImages(false);}}
        onPaste={event=>{const files=transferFiles(event.clipboardData);if(files.length){event.preventDefault();if(!uploading)void importInlineImages(files);}}}/></label><div><span className="preview-label">官网效果预览 · {locale}</span><ProjectMarkdownBody content={previewText||'此语言尚无正文。公开页面将按原有语言回退规则显示。'} fileUrl={new URL('https://studiofimel.com/')} resolveAsset={resolvePreviewAsset}/></div></div>
    </>}
    {section==='images'&&<div className="notice"><span>{work.coverId?'当前使用已选中的上传封面，已有封面地址可以留空。':'请填写已有封面地址，或上传图片后设为封面。'}本页上传的图片只作为封面候选，不会自动加入正文。正文图片请在“正文与预览”拖入、粘贴或明确插入。</span>{work.coverId&&<button disabled={!work.project.image.trim()} onClick={()=>update({...work,coverId:undefined})}>改用已有地址作为封面</button>}</div>}
    {section==='images'&&<><UploadPanel onBusyChange={onUploadBusy} key={work.id} workId={work.id} kind="image" disabled={!saved} onUploaded={asset=>update({...work,gallery:[...work.gallery.filter(a=>a.id!==asset.id),asset],coverId:work.coverId??asset.id})}/><label className="external-image">已有封面 URL / 原路径<input value={work.project.image} onChange={e=>project({image:e.target.value})}/></label><div className="gallery-grid">{work.gallery.map((a,index)=><div key={a.id}><img src={a.privateKey?`/api/media/${a.id}`:a.publicUrl} alt={a.displayName??a.name}/><strong>{a.displayName??a.name}</strong><ImageUsage work={work} asset={a} locate={(nextTab,nextLocale)=>{setSection('content');setTab(nextTab);setLocale(nextLocale);}}/><small>{(a.size/1024).toFixed(1)} KiB</small><div className="button-row"><button aria-pressed={work.coverId===a.id} onClick={()=>update({...work,coverId:a.id})}>{work.coverId===a.id?'当前封面':'设为封面'}</button><button disabled={index===0} onClick={()=>{const next=[...work.gallery];[next[index-1],next[index]]=[next[index],next[index-1]];update({...work,gallery:next});}}>前移</button><button disabled={imageUsage(work,a).length>0} onClick={()=>{if(window.confirm('从草稿移除此图片关联？历史文件保留。'))update({...work,gallery:work.gallery.filter(x=>x.id!==a.id),coverId:work.coverId===a.id?undefined:work.coverId});}}>移除</button></div></div>)}</div></>}
    {section==='versions'&&<><div className="section-heading"><div><h2>发行版本</h2><p>最新版本放在最前，已发布文件采用不可变地址。</p></div><button disabled={uploading} onClick={()=>update({...work,versions:[{id:crypto.randomUUID(),label:'',date:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'}),gameVersions:[],status:'draft',changelog:{zh:''},files:[]},...work.versions]})}><Plus size={16}/>添加版本</button></div>{work.versions.map((v,index)=><section key={v.id} className="release-editor"><div className="form-grid"><label>版本号<input value={v.label} onChange={e=>update({...work,versions:work.versions.map(r=>r.id===v.id?{...r,label:e.target.value}:r)})}/></label><label>发布日期<input type="date" value={v.date} onChange={e=>update({...work,versions:work.versions.map(r=>r.id===v.id?{...r,date:e.target.value}:r)})}/></label><label>发行状态<select value={v.status} onChange={e=>update({...work,versions:work.versions.map(r=>r.id===v.id?{...r,status:e.target.value as typeof v.status}:r)})}><option value="draft">未发行（私有）</option><option value="released">已发行（随作品发布）</option></select></label><label className="full">更新日志 · {locale}<textarea value={localizedField(v.changelog,locale)} onChange={e=>update({...work,versions:work.versions.map(r=>r.id===v.id?{...r,changelog:{...(typeof r.changelog==='object'?r.changelog:{zh:r.changelog}),[locale]:e.target.value}}:r)})}/></label></div><ReleaseCompatibilityFields work={work} release={v} update={update}/><UploadPanel onBusyChange={onUploadBusy} workId={work.id} versionId={v.id} kind="file" disabled={!savedVersionIds.includes(v.id)} onUploaded={asset=>update({...work,versions:work.versions.map(r=>r.id===v.id?{...r,files:[...r.files.filter(a=>a.id!==asset.id),{...asset,primary:r.files.length===0}]}:r)})}/>{v.files.map(f=><div className="file-row" key={f.id}><div><strong>{f.displayName??f.name}</strong><p>{(f.size/1024**2).toFixed(1)} MiB · {f.mime}</p><code>SHA-256 {f.sha256}</code>{f.privateKey&&<a href={`/api/files/${f.id}`} download={f.displayName??f.name}>下载私有文件</a>}{(publicUrls[f.id]||f.publicUrl)&&<a href={publicUrls[f.id]||f.publicUrl} target="_blank" rel="noreferrer">下载地址</a>}</div><div className="button-row"><button aria-pressed={!!f.primary} onClick={()=>update({...work,versions:work.versions.map(r=>r.id===v.id?{...r,files:r.files.map(a=>({...a,primary:a.id===f.id}))}:r)})}>{f.primary?'主下载':'设为主下载'}</button><button onClick={()=>{if(window.confirm('移除文件关联？不会删除历史文件。'))update({...work,versions:work.versions.map(r=>r.id===v.id?{...r,files:r.files.filter(a=>a.id!==f.id)}:r)});}}>移除</button></div></div>)}<div className="button-row"><button disabled={index===0} onClick={()=>{const next=[...work.versions];[next[index-1],next[index]]=[next[index],next[index-1]];update({...work,versions:next});}}>设为最新版本</button><button disabled={uploading} onClick={()=>{if(window.confirm('移除此版本的草稿关联？历史发行快照保留。'))update({...work,versions:work.versions.filter(r=>r.id!==v.id)});}}>移除版本</button></div></section>)}</>}
    {section==='advanced'&&<><h2>完整作品记录</h2><p className="hint">保留商店来源、作者链接、历史下载量、评分、旧下载地址等所有原字段。这里的 JSON 修改需先应用，再保存草稿。</p><label>Work JSON<textarea className="json-editor" rows={24} value={jsonDraft} onChange={e=>setJsonDraft(e.target.value)}/></label>{jsonError&&<p role="alert" className="error">{jsonError}</p>}<button onClick={()=>{try{const next=JSON.parse(jsonDraft);const errors=validateLibrary({schemaVersion:1,works:[next]});if(errors.length)throw new Error(errors.join('\n'));if(next.id!==work.id)throw new Error('作品 ID 不可修改。');update(next);setJsonError('');}catch(e){setJsonError(String(e));}}}>应用字段修改</button></>}
    </div></div>;
}
function localizedField(value:LocalizedText|undefined,locale:Locale){return typeof value==='string'?locale==='zh'?value:'':value?.[locale]??'';}
