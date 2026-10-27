import { useEffect, useRef, useState } from 'react';
import type { SiteContent } from '../../src/content/site-content';
import { siteContentErrors } from '../../src/content/site-content';
import { localizedText } from '../../src/content/projects';
import type { LocalizedText, Project } from '../../src/content/projects';
import { RecentUpdatesList } from '../../src/components/RecentUpdates';
import type { Library, Locale } from '../shared/model';
import { LOCALES } from '../shared/model';
import { stable } from '../shared/revisions';
import { api, RequestError } from './api';
import { FeaturedSelector } from './FeaturedSelector';
import { FEATURED_GROUP_NAMES, sitePublicationIssues } from '../shared/featured';
import { recoveryStore, browserTabId } from './draft-recovery';
type State = { site: SiteContent; updatedAt: string | null; published: SiteContent | null; publicProjects: Project[]; publicEtag: string };
type LocalRecovery = { key:string; at:string; site:SiteContent; etag:string };
export function SiteEditor({library,actorId,onDirtyChange}:{library:Library;actorId:string|null;onDirtyChange(value:boolean):void}) {
  const [data,setData]=useState<State|null>(null),[original,setOriginal]=useState(''),[etag,setEtag]=useState(''),[site,setSite]=useState<SiteContent|null>(null);
  const [locale,setLocale]=useState<Locale>('zh'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[preview,setPreview]=useState(false);
  const [conflict,setConflict]=useState(false);
  const [local,setLocal]=useState<LocalRecovery|null>(null),[ready,setReady]=useState(false);const first=useRef(true);
  const dirty=!!site&&!!original&&stable(site)!==original;
  useEffect(()=>{onDirtyChange(dirty);return()=>onDirtyChange(false);},[dirty,onDirtyChange]);
  useEffect(()=>{const controller=new AbortController();void api<State>('site',{signal:controller.signal}).then(r=>{if(!controller.signal.aborted){setData(r.data);setSite(r.data.site);setOriginal(stable(r.data.site));setEtag(r.etag);}}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'网站内容读取失败。');});return()=>controller.abort();},[]);
  useEffect(()=>{if(!actorId)return;let active=true;setTimeout(()=>{if(active&&first.current){first.current=false;void recoveryStore<LocalRecovery[]>(`site:${actorId}:${browserTabId()}`,'list').then(records=>{if(active){const own=records.filter(r=>typeof r?.key==='string'&&r.key.startsWith(`site:${actorId}:`)&&Date.parse(r.at)>Date.now()-7*86400000&&!siteContentErrors(r.site).length);const record=own.find(r=>r.key===`site:${actorId}:${browserTabId()}`)??own.sort((a,b)=>b.at.localeCompare(a.at))[0];if(record)setLocal(record);setReady(true);}}).catch(()=>{if(active){setReady(true);setError('本机网站内容恢复记录不可用，请及时保存。');}});}},0);return()=>{active=false;};},[actorId]);
  useEffect(()=>{if(!actorId||!ready||local?.key===`site:${actorId}:${browserTabId()}`||!site)return;const timer=setTimeout(()=>{void recoveryStore(`site:${actorId}:${browserTabId()}`,dirty?'put':'delete',dirty?{key:`site:${actorId}:${browserTabId()}`,at:new Date().toISOString(),site,etag}:undefined).catch(()=>setError('网站内容本机备份失败，请保存草稿或导出。'));},800);return()=>clearTimeout(timer);},[actorId,ready,local,site,etag,dirty]);
  async function save(){if(!site)return;const errors=siteContentErrors(site);if(errors.length){setError(errors.join('\n'));return;}setBusy(true);setError('');setMessage('');setConflict(false);try{const r=await api<{site:SiteContent;updatedAt:string}>('site',{method:'PUT',headers:{'If-Match':etag},body:JSON.stringify({site})});if(actorId)await recoveryStore(`site:${actorId}:${browserTabId()}`,'delete').catch(()=>{});setLocal(null);setEtag(r.etag);setOriginal(stable(r.data.site));setData(prev=>prev?{...prev,...r.data}:null);setMessage('网站内容草稿已保存，官网尚未更新。');}catch(e){showError(e,'保存失败。');}finally{setBusy(false);}}
  async function loadPublicState() {
    const result=await api<State>('site');
    setData(previous=>previous?{...previous,published:result.data.published,publicProjects:result.data.publicProjects,publicEtag:result.data.publicEtag}:result.data);
    return result;
  }
  async function refreshPublicState() {
    setBusy(true);setError('');setMessage('');setConflict(false);
    try {
      const result=await loadPublicState();
      if(result.etag!==etag)throw new RequestError(409,'服务器上的网站草稿已改变。当前网站编辑已保留，请先导出草稿，再重新加载核对；本次刷新没有更新你的保存基线。');
      setMessage('作品公开状态已刷新，当前网站编辑已保留。');
    }catch(cause){showError(cause,'无法刷新作品公开状态。');}finally{setBusy(false);}
  }
  async function preparePublication(draft:SiteContent) {
    const result=await loadPublicState();
    if(result.etag!==etag)throw new RequestError(409,'服务器上的网站草稿已改变，请先导出当前草稿，再刷新核对。');
    const issues=sitePublicationIssues(draft,result.data.publicProjects);
    if(issues.length)throw new Error(issues.join('\n'));
    return result.data;
  }
  async function openPreview() {
    if(!site||dirty)return;
    setBusy(true);setError('');setMessage('');setConflict(false);
    try{await preparePublication(site);setPreview(true);}catch(cause){showError(cause,'无法预览网站发布。');}finally{setBusy(false);}
  }
  async function publish() {
    if(!site||!data||dirty)return;
    setBusy(true);setError('');setMessage('');setConflict(false);
    try {
      const fresh=await preparePublication(site);
      const result=await api('site/publish',{method:'POST',headers:{'If-Match':etag,'X-Public-ETag':fresh.publicEtag},body:'{}'});
      setData({...fresh,published:site,publicEtag:result.etag});setPreview(false);
      setMessage('网站内容已发布，官网现有区块和近期更新将读取新内容。');
    }catch(cause){showError(cause,'发布失败。');}finally{setBusy(false);}
  }
  function showError(cause:unknown,fallback:string) {
    setConflict(cause instanceof RequestError&&cause.status===409);
    setError(cause instanceof Error?cause.message:fallback);
  }
  function editSite(next:SiteContent) {
    setSite(next);setMessage('');setError('');setConflict(false);setPreview(false);
  }
  const exportLocal=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({site,etag},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='fimel-site-draft.json';a.click();URL.revokeObjectURL(url);};
  if(!site)return <section>{error?<p role="alert" className="error">{error}</p>:<p role="status">正在读取网站内容…</p>}</section>;
  const localText=(value:LocalizedText|undefined)=>typeof value==='string'?locale==='zh'?value:'':value?.[locale]??'';
  const changeLocale=(value:LocalizedText|undefined,text:string)=>({...typeof value==='string'?{zh:value}:value??{},[locale]:text});
  const studioField=(key:keyof SiteContent['studio'],value:string)=>editSite({...site,studio:{...site.studio,[key]:changeLocale(site.studio[key],value)}});
  const groupNames=FEATURED_GROUP_NAMES;
  const news=(id:string,patch:Partial<SiteContent['updates'][number]>)=>editSite({...site,updates:site.updates.map(n=>n.id===id?{...n,...patch}:n)});
  return <section className="site-editor">
    <p className="notice">网站文案、精选顺序和近期更新独立保存、独立发布，不会自动重发作品。留空的工作室文案沿用现有三语内容。</p>
    {local&&<div className="notice"><span>发现本机网站内容编辑：{new Date(local.at).toLocaleString('zh-CN')}</span><button disabled={dirty||busy} onClick={()=>{setSite(local.site);if(stable(local.site)!==original)setEtag(local.etag);void recoveryStore(local.key,'delete').catch(()=>{});setLocal(null);}}>恢复网站编辑</button><button onClick={()=>{if(window.confirm('放弃本机网站内容恢复记录？')){void recoveryStore(local.key,'delete').catch(()=>{});setLocal(null);}}}>放弃恢复</button></div>}
    {error&&<div className="error" role="alert"><p>{error}</p>{conflict&&<p>请先导出当前草稿，再刷新核对；不会覆盖其他人的内容。</p>}<button onClick={exportLocal}>导出网站草稿</button></div>}{message&&<p role="status" className="success">{message}</p>}
    <fieldset disabled={busy}><div className="locale-tabs">{LOCALES.map(l=><button key={l} aria-pressed={locale===l} onClick={()=>setLocale(l)}>{l}</button>)}</div>
      <FeaturedSelector site={site} library={library} publicProjects={data?.publicProjects??[]} onChange={editSite} onRefresh={()=>void refreshPublicState()} busy={busy}/>
      <h2>工作室与联系文案 · {locale}</h2><div className="form-grid">{([['title','工作室标题'],['description','工作室介绍'],['contactTitle','联系区标题'],['contactIntro','联系区介绍']]as const).map(([key,label])=><label key={key}>{label}<textarea aria-label={label} rows={key==='description'?4:2} value={localText(site.studio[key])} onChange={e=>studioField(key,e.target.value)} placeholder="留空使用官网现有文案"/></label>)}</div>
      <h2>公开联系方式</h2><div className="form-grid">{Object.entries({email:'公开联系邮箱',qqGroup:'QQ 群号',qqUrl:'QQ 入群链接',discord:'Discord 链接',x:'X 链接',github:'GitHub 链接'}).map(([key,label])=><label key={key}>{label}<input aria-label={label} value={site.contact[key as keyof SiteContent['contact']]} onChange={e=>setSite({...site,contact:{...site.contact,[key]:e.target.value}})}/></label>)}</div>
      <h2>近期更新 · {locale}</h2><p className="hint">发布后显示在官网首页作品区之后，按日期从新到旧排列。没有条目时不显示此区块。</p>
      {site.updates.map(item=><section className="release-editor" key={item.id}><div className="form-grid"><label>更新标题<input value={localText(item.title)} onChange={e=>news(item.id,{title:changeLocale(item.title,e.target.value)})}/></label><label>更新日期<input type="date" value={item.date} onChange={e=>news(item.id,{date:e.target.value})}/></label><label className="full">更新摘要<textarea rows={3} value={localText(item.summary)} onChange={e=>news(item.id,{summary:changeLocale(item.summary,e.target.value)})}/></label><label>关联作品<select value={item.workSlug??''} onChange={e=>news(item.id,{workSlug:e.target.value||undefined})}><option value="">不关联作品</option>{library.works.filter(w=>w.workflow!=='archived').map(w=><option key={w.id} value={w.project.slug}>{localizedText(w.project.title,'zh')}</option>)}</select></label><label>外部详情链接（可留空）<input value={item.url??''} onChange={e=>news(item.id,{url:e.target.value||undefined})}/></label></div><button onClick={()=>setSite({...site,updates:site.updates.filter(n=>n.id!==item.id)})}>移除此更新</button></section>)}
      <button disabled={site.updates.length>=30} onClick={()=>setSite({...site,updates:[{id:crypto.randomUUID(),title:{zh:''},summary:{zh:''},date:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'})},...site.updates]})}>添加近期更新</button>
    </fieldset>
    <div className="publish-bar"><div><strong>{dirty?'有未保存的网站修改':data?.published&&stable(site)===stable(data.published)?'网站内容已同步':'网站内容有草稿待发布'}</strong><p>最近保存：{data?.updatedAt?new Date(data.updatedAt).toLocaleString('zh-CN'):'尚未保存'}</p></div><div className="button-row"><button disabled={busy} onClick={exportLocal}>导出网站草稿</button><button disabled={busy||(!dirty&&!!data?.updatedAt)} onClick={()=>void save()}>保存网站草稿</button><button disabled={busy||dirty||!data?.updatedAt} onClick={()=>void openPreview()}>预览网站发布</button></div></div>
    {preview&&<div className="site-publish-preview"><h2>网站发布预览 · {locale}</h2><p>将替换官网精选顺序、工作室与联系文案，以及近期更新；作品正文、版本和文件不变。</p><h3>{localizedText(site.studio.title,locale)||'沿用现有工作室标题'}</h3><p>{localizedText(site.studio.description,locale)||'沿用现有工作室介绍'}</p><div className="form-grid">{Object.entries(site.featured).map(([group,slugs])=><div key={group}><h3>{groupNames[group as keyof typeof groupNames]}</h3><ol>{slugs.map(slug=><li key={slug}>{localizedText(library.works.find(w=>w.project.slug===slug)?.project.title,locale)||slug}</li>)}</ol></div>)}</div><RecentUpdatesList updates={site.updates} language={locale} preview/><div className="button-row"><button disabled={busy} onClick={()=>setPreview(false)}>返回网站编辑</button><button disabled={busy} onClick={()=>void publish()}>确认发布网站内容</button></div></div>}
  </section>;
}
