import { useEffect, useMemo, useRef, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import type { Project, ProjectTab } from '../../src/content/projects';
import { assetUrl, localizedText, projectCopy } from '../../src/content/projects';
import { ProjectMarkdownBody } from '../../src/components/ProjectMarkdown';
import { ProjectDownloads } from '../../src/components/ProjectDownloads';
import { ProjectVersions } from '../../src/components/ProjectVersions';
import { releaseProject } from '../../src/content/releases';
import type { DownloadRelease } from '../../src/content/releases';
import type { Work, Locale } from '../shared/model';
import { LOCALES } from '../shared/model';
import { stable } from '../shared/revisions';
import { api } from './api';
import { TextChanges } from './TextChanges';
import { previewReleases } from './preview-releases';

type Published = { project: Project | null; markdown: Work['markdown'] | null; releases: DownloadRelease[]; unavailable?: string[] };
export function PublicationPreview({ work, before, busy, onClose, onPublish }: { work: Work; before: Project | null; busy: boolean; onClose(): void; onPublish(): void }) {
  const dialog = useRef<HTMLDialogElement>(null); const { i18n } = useTranslation();
  const [locale,setLocale]=useState<Locale>('zh'),[tab,setTab]=useState<ProjectTab>('description'),[device,setDevice]=useState('desktop'),[version,setVersion]=useState('draft');
  const [published,setPublished]=useState<Published|null>(null),[error,setError]=useState('');
  const previewI18n=useMemo(()=>i18n.cloneInstance({lng:locale}),[i18n,locale]);
  useEffect(()=>{const current=dialog.current;current?.showModal();return()=>current?.close();},[]);
  useEffect(()=>{const controller=new AbortController();void api<Published>(`published/${work.id}`,{signal:controller.signal}).then(r=>setPublished(r.data)).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'公开内容读取失败');});return()=>controller.abort();},[work.id]);
  const previous=published?.project??before;const viewingPublished=version==='published';
  const releases:DownloadRelease[]=viewingPublished?published?.releases??[]:previewReleases(work);
  const source=viewingPublished?previous:work.project;
  const project=source?releaseProject(source,releases,viewingPublished?undefined:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'})):null;
  const markdown=viewingPublished?published?.markdown:work.markdown;
  const selectedCover=work.gallery.find(a=>a.id===work.coverId);
  const cover=viewingPublished?previous?.image:selectedCover?.privateKey?new URL(`/api/media/${selectedCover.id}`,location.origin).href:selectedCover?.publicUrl??work.project.image;
  const rawText=localizedText(markdown?.[tab],locale);
  const text=rawText;
  const label={description:'详情',changelog:'更新日志',versions:'版本'};
  const names:Record<string,string>={title:'作品名称',summary:'简介',platform:'平台',version:'版本',size:'文件大小',image:'封面',status:'发行状态',tags:'标签',creators:'作者'};
  const changes=previous?Object.entries(work.project).filter(([key,value])=>key!=='content'&&!(key==='image'&&work.coverId)&&stable(value)!==stable(previous[key as keyof Project])).map(([key])=>names[key]??key):['新作品'];
  if(work.coverId)changes.push('上传封面（请在预览中核对）');
  const bodyChanges=published?.markdown?(['description','changelog','versions'] as const).flatMap(key=>LOCALES.filter(l=>work.markdown[key][l]!==published.markdown?.[key][l]).map(l=>`${label[key]} · ${l}`)):[];
  const display=project?projectCopy(project,previewI18n.t.bind(previewI18n),locale):null;
  return <dialog ref={dialog} className="publication-dialog modal visual-publication" onCancel={onClose} aria-labelledby="preview-title">
    <h2 id="preview-title">发布预览</h2><p>检查当前已保存草稿。确认发布后才会替换官网内容；预览不会下载文件或修改线上数据。</p>
    <div className="button-row preview-controls"><button aria-pressed={!viewingPublished} onClick={()=>setVersion('draft')}>即将发布</button><button disabled={!previous||!published} aria-pressed={viewingPublished} onClick={()=>setVersion('published')}>当前官网</button><label>预览宽度<select value={device} onChange={e=>setDevice(e.target.value)}><option value="desktop">桌面</option><option value="mobile">手机 · 390 px</option></select></label><label>正文语言<select value={locale} onChange={e=>setLocale(e.target.value as Locale)}>{LOCALES.map(l=><option key={l} value={l}>{l}</option>)}</select></label></div>
    {error&&<p role="alert" className="error">{error}，无法核对旧正文；当前草稿预览仍可使用。</p>}
    {!!published?.unavailable?.length&&<p className="notice">部分历史正文无法读取，差异可能不完整：{published.unavailable.join('、')}</p>}
    <details className="publication-changes" open><summary>本次变化</summary><p>{changes.length?changes.join('、'):'作品元数据未改动。'}</p><p>{bodyChanges.length?`正文需核对：${bodyChanges.join('、')}（旧正文中的图片地址可能已转换，请结合预览比较）`:'正文加载完成后可比较当前官网和草稿。'}</p><p>本次公开 {releases.length} 个已发行版本、{releases.reduce((sum,r)=>sum+r.files.length,0)} 个文件。未发行版本保持私有。</p></details>
    {published?.markdown&&<TextChanges before={localizedText(published.markdown[tab],locale)} after={localizedText(work.markdown[tab],locale)}/>}
    <I18nextProvider i18n={previewI18n}><div className={`publication-canvas ${device==='mobile'?'is-mobile':''}`} onClickCapture={event=>{if((event.target as HTMLElement).closest('a'))event.preventDefault();}}>
      {project&&display?<article className="publication-article"><header className="publication-heading"><img src={cover?assetUrl(cover):undefined} alt="封面预览"/><div><h1>{display.title}</h1><p>{display.summary}</p><small>{project.platform.join(' / ')} · {project.status==='released'?'已发行':project.status==='development'?'制作中':'计划中'}</small></div></header>
        <ProjectDownloads key={`download-${version}`} project={project} releases={releases} preview/>
        <div className="button-row content-tabs">{(['description','changelog','versions']as const).map(key=><button key={key} aria-pressed={key===tab} onClick={()=>setTab(key)}>{label[key]}</button>)}</div>
        {tab==='versions'?<ProjectVersions key={`versions-${version}`} project={project} releases={releases} preview renderNotes={text=><ProjectMarkdownBody content={text} fileUrl={new URL('https://studiofimel.com/')}/>} notes={text?<ProjectMarkdownBody content={text} fileUrl={new URL('https://studiofimel.com/')}/>:undefined}/>:<ProjectMarkdownBody content={text||'此语言暂无正文。'} fileUrl={new URL('https://studiofimel.com/')} resolveAsset={id=>{const asset=work.gallery.find(a=>a.id===id);return asset?.privateKey?new URL(`/api/media/${id}`,location.origin).href:asset?.publicUrl;}}/>}
      </article>:<p>此作品尚未公开。</p>}
    </div></I18nextProvider>
    <details><summary>查看原始数据</summary><pre>{JSON.stringify({project:work.project,markdown:work.markdown,versions:work.versions.filter(v=>v.status==='released').map(v=>({label:v.label,files:v.files.map(f=>({name:f.name,size:f.size,sha256:f.sha256}))}))},null,2)}</pre></details>
    <div className="button-row"><button autoFocus onClick={onClose} disabled={busy}>返回编辑</button><button className="primary" disabled={busy} onClick={onPublish}>{busy?'发布中…':'确认发布'}</button></div>
    <small>正文预览与官网共用 Markdown、图片轮播和下载组件。</small>
  </dialog>;
}
