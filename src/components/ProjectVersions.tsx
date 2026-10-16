import {useState} from 'react';
import type {ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {Download,ChevronDown,ExternalLink} from 'lucide-react';
import type {Project} from '../content/projects';
import {formatProjectDate,localizedText,projectDownloadUrl} from '../content/projects';
import {ProjectDownload} from './ProjectDownload';
import {fileSize} from '../content/releases';
import type {DownloadFile,DownloadRelease} from '../content/releases';

const copy={
 zh:{title:'版本与下载',latest:'最新',game:'游戏版本',loader:'加载器',all:'全部',download:'下载',files:'文件与更新说明',recommended:'推荐',checksum:'SHA-256 校验值',notes:'更新说明',legacy:'补充说明与历史记录',empty:'没有符合筛选条件的版本。',reset:'清除筛选',published:'发布于',preview:'预览中不下载文件'},
 en:{title:'Versions & downloads',latest:'Latest',game:'Game version',loader:'Loader',all:'All',download:'Download',files:'Files & release notes',recommended:'Recommended',checksum:'SHA-256 checksum',notes:'Release notes',legacy:'Additional notes & history',empty:'No versions match these filters.',reset:'Clear filters',published:'Published',preview:'Downloads disabled in preview'},
 ja:{title:'バージョンとダウンロード',latest:'最新',game:'ゲームバージョン',loader:'ローダー',all:'すべて',download:'ダウンロード',files:'ファイルと更新内容',recommended:'推奨',checksum:'SHA-256 チェックサム',notes:'更新内容',legacy:'補足と過去の記録',empty:'条件に一致するバージョンはありません。',reset:'絞り込みを解除',published:'公開日',preview:'プレビューではダウンロードできません'},
};
const fallbackCopy={
 zh:{current:'当前下载',platform:'平台分发',release:'发行记录',store:'前往平台',releases:'查看发行',unknown:'版本号未标注',updated:'记录更新于',platformNote:'通过平台获取，兼容性和可用版本以平台说明为准。',pending:'尚未发布可下载的公开版本。',unavailable:'暂未提供下载或获取入口。'},
 en:{current:'Current download',platform:'Platform distribution',release:'Releases',store:'Open platform',releases:'View releases',unknown:'Version not specified',updated:'Record updated',platformNote:'Get this work on the platform. Check its listing for compatibility and available versions.',pending:'No public download has been released yet.',unavailable:'No download or distribution link is available yet.'},
 ja:{current:'現在のダウンロード',platform:'プラットフォーム配信',release:'リリース情報',store:'配信ページへ',releases:'リリースを見る',unknown:'バージョン未記載',updated:'記録更新日',platformNote:'配信プラットフォームで入手できます。対応環境と提供バージョンは配信ページをご確認ください。',pending:'ダウンロード可能な公開版はまだありません。',unavailable:'ダウンロードや配信先はまだ公開されていません。'},
};
const action='hover-target inline-flex min-h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sm border border-obsidian bg-obsidian px-4 text-sm font-semibold text-white transition-colors hover:border-[#007d7e] hover:bg-[#007d7e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link dark:border-diamond dark:bg-diamond dark:text-obsidian dark:hover:bg-[#35dddd]';

/** Older works keep their verified entry point without inventing a release or file checksum. */
function ExistingVersion({project,language,preview,onDownload}:{project:Project;language:string;preview:boolean;onDownload?:()=>void}){
 const labels=fallbackCopy[language.split('-')[0]as keyof typeof fallbackCopy]??fallbackCopy.en;
 const direct=projectDownloadUrl(project),downloadable=!!direct||!!project.latestReleaseRepo;
 const external=project.store??project.releasePage;const externalLabel=project.store?labels.store:labels.releases;
 let name='';if(direct){try{name=decodeURIComponent(new URL(direct,'https://studiofimel.com/').pathname.split('/').at(-1)??'');}catch{/* Keep malformed legacy filenames out of the display. */}}
 return <li className="version-row py-5 sm:py-6" data-kind={downloadable?'existing-download':project.store?'platform':'release-page'}>
  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto] sm:items-center">
   <div className="min-w-0"><h3 className="text-base font-bold">{project.version|| (downloadable?labels.current:project.store?labels.platform:labels.release)}</h3>
    {!project.version&&<p className="mt-2 text-xs text-gray-600 dark:text-content-muted">{labels.unknown}</p>}
    {name&&<p className="mt-2 break-all text-xs text-gray-600 dark:text-content-muted">{name}</p>}
    {(project.size||project.updated)&&<p className="mt-1 text-xs text-gray-600 dark:text-content-muted">{project.size}{project.size&&project.updated?' · ':''}{project.updated&&<>{labels.updated} <time dateTime={project.updated}>{formatProjectDate(project.updated,language,project.updated)}</time></>}</p>}
   </div>
   <div className="col-span-2 row-start-2 min-w-0 text-xs text-gray-600 dark:text-content-muted sm:col-span-1 sm:col-start-2 sm:row-start-1"><p className="break-words">{project.platform.join(' / ')}</p>{!downloadable&&project.store&&<p className="mt-2 leading-relaxed">{labels.platformNote}</p>}</div>
   <div className="col-start-2 row-start-1 sm:col-start-3">{downloadable?<ProjectDownload project={project} preview={preview} onDownload={onDownload}/>:preview?<button type="button" disabled className={action}><ExternalLink size={16} aria-hidden/>{externalLabel}</button>:<a href={external} target="_blank" rel="noopener noreferrer" className={action}><ExternalLink size={16} aria-hidden/>{externalLabel}</a>}</div>
  </div>
 </li>;
}

export function ProjectVersions({project,releases=[],notes,onDownload,preview=false,renderNotes}:{project:Project;releases?:DownloadRelease[];notes?:ReactNode;onDownload?:()=>void;preview?:boolean;renderNotes?:(text:string)=>ReactNode}){
 const {i18n}=useTranslation();const language=i18n.resolvedLanguage??'zh';const labels=copy[language.split('-')[0]as keyof typeof copy]??copy.en;
 const fallbackLabels=fallbackCopy[language.split('-')[0]as keyof typeof fallbackCopy]??fallbackCopy.en;
 const available=releases.filter(r=>r.files.length);const [game,setGame]=useState(''),[loader,setLoader]=useState('');
 const [expanded,setExpanded]=useState<Set<string>>(new Set());
 const games=[...new Set(available.flatMap(r=>r.gameVersions))],loaders=[...new Set(available.flatMap(r=>r.loaders??[]))];
 const filtered=available.filter(r=>(!game||r.gameVersions.includes(game))&&(!loader||r.loaders?.includes(loader)));
 const download=(file:DownloadFile)=>preview?<button type="button" disabled title={labels.preview} className={action}><Download size={16} aria-hidden/>{labels.download}</button>:<a href={file.publicUrl} download onClick={onDownload} className={action}><Download size={16} aria-hidden/>{labels.download}</a>;
 const existing=!available.length&&!!(projectDownloadUrl(project)||project.latestReleaseRepo||project.store||project.releasePage);
 return <section className="project-versions space-y-5" aria-label={labels.title} onClickCapture={preview?event=>{if((event.target as HTMLElement).closest('a'))event.preventDefault();}:undefined}>
  <div className="flex flex-wrap items-end gap-3"><h2 className="mr-auto basis-full text-xl font-bold tracking-tight sm:basis-auto">{labels.title}<span className="ml-3 text-sm font-normal text-gray-600 dark:text-content-muted">{available.length||Number(existing)}</span></h2>
   {available.length>1&&games.length>1&&<label className="grid gap-1 text-xs text-gray-600 dark:text-content-muted">{labels.game}<select className="min-h-10 max-w-full rounded-sm border border-line bg-canvas px-3 text-sm text-content" value={game} onChange={e=>setGame(e.target.value)}><option value="">{labels.all}</option>{games.map(v=><option key={v}>{v}</option>)}</select></label>}
   {available.length>1&&loaders.length>1&&<label className="grid gap-1 text-xs text-gray-600 dark:text-content-muted">{labels.loader}<select className="min-h-10 max-w-full rounded-sm border border-line bg-canvas px-3 text-sm text-content" value={loader} onChange={e=>setLoader(e.target.value)}><option value="">{labels.all}</option>{loaders.map(v=><option key={v}>{v}</option>)}</select></label>}
  </div>
  {(available.length>0||existing)&&<ul className="divide-y divide-line border-y border-line">{existing&&<ExistingVersion project={project} language={language} preview={preview} onDownload={onDownload}/>}{filtered.map(release=>{const primary=release.files.find(f=>f.primary)??release.files[0];const changelog=localizedText(release.changelog,language);return <li key={release.id} className="version-row py-5 sm:py-6">
   <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto] sm:items-center">
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-bold">{release.label}</h3>{release.id===available[0].id&&<span className="rounded-sm bg-diamond/10 px-2 py-1 text-[11px] font-semibold text-[#007d7e] dark:text-diamond">{labels.latest}</span>}</div><p className="mt-2 break-all text-xs text-gray-600 dark:text-content-muted">{primary.displayName??primary.name}</p><p className="mt-1 text-xs text-gray-600 dark:text-content-muted">{fileSize(primary.size)} · {labels.published} <time dateTime={release.date}>{formatProjectDate(release.date,language,release.date)}</time></p></div>
    <div className="col-span-2 row-start-2 min-w-0 space-y-2 text-xs sm:col-span-1 sm:col-start-2 sm:row-start-1"><div className="flex flex-wrap gap-1.5">{[...release.gameVersions,...release.loaders??[]].map((value,i)=><span className="rounded-sm border border-line px-2 py-1" key={`${i}-${value}`}>{value}</span>)}</div><p className="break-words text-gray-600 dark:text-content-muted">{(release.platforms?.length?release.platforms:project.platform).join(' / ')}</p></div>
    <div className="col-start-2 row-start-1 sm:col-start-3">{download(primary)}</div>
   </div>
   <details className="mt-4 text-sm" onToggle={event=>{const open=event.currentTarget.open;setExpanded(previous=>{const next=new Set(previous);if(open)next.add(release.id);else next.delete(release.id);return next;});}}><summary className="hover-target inline-flex min-h-9 cursor-pointer items-center gap-2 text-gray-600 hover:text-obsidian dark:text-content-muted dark:hover:text-content"><ChevronDown size={14} aria-hidden/>{labels.files} <span className="text-xs">({release.files.length})</span></summary><div className="mt-3 space-y-5 rounded-sm border border-line bg-surface p-4">
    {release.files.map(file=><div key={file.id} className="min-w-0 space-y-2"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="break-all text-sm font-semibold">{file.displayName??file.name}</p><p className="text-xs text-gray-600 dark:text-content-muted">{fileSize(file.size)}{file.id===primary.id?` · ${labels.recommended}`:''}</p></div>{file.id!==primary.id&&download(file)}</div><details className="text-xs text-gray-600 dark:text-content-muted"><summary className="hover-target min-h-8 cursor-pointer">{labels.checksum}</summary><code className="block break-all py-2">{file.sha256}</code></details></div>)}
    {changelog&&expanded.has(release.id)&&<div className="border-t border-line pt-4"><h4 className="mb-3 text-sm font-semibold">{labels.notes}</h4>{renderNotes?.(changelog)??<p className="whitespace-pre-wrap">{changelog}</p>}</div>}
   </div></details>
  </li>;})}</ul>}
  {!!available.length&&!filtered.length&&<div className="py-6 text-sm"><p>{labels.empty}</p><button type="button" className="hover-target mt-3 min-h-11 underline underline-offset-4" onClick={()=>{setGame('');setLoader('');}}>{labels.reset}</button></div>}
  {!available.length&&!existing&&<p className="border-y border-line py-8 text-sm text-gray-600 dark:text-content-muted">{project.status==='released'?fallbackLabels.unavailable:fallbackLabels.pending}</p>}
  {notes&&<details className="text-sm"><summary className="hover-target min-h-11 cursor-pointer text-gray-600 dark:text-content-muted">{labels.legacy}</summary><div className="pt-4">{notes}</div></details>}
 </section>;
}
