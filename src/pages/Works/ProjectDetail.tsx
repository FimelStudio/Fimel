import { lazy, Suspense, useEffect, useMemo } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowUpRight, ExternalLink } from 'lucide-react';
import { useProjectCatalogue } from '../../hooks/useProjectCatalogue';
import { useDownloadCounters } from '../../hooks/useDownloadCounters';
import { PROJECT_TABS, assetUrl, formatProjectDate, localizedText, projectCopy, projectStatus } from '../../content/projects';
import type { Project, ProjectTab } from '../../content/projects';
import { ProjectDownloads } from '../../components/ProjectDownloads';
import { ProjectVersions } from '../../components/ProjectVersions';
import { ProjectRepository } from '../../components/ProjectRepository';
import { WorkDownloadMetric } from '../../components/WorkDownloadMetric';
import { releaseProject } from '../../content/releases';
import type { DownloadRelease } from '../../content/releases';
import { recordWorkEvent } from '../../lib/work-events';

const ProjectMarkdown = lazy(() => import('../../components/ProjectMarkdown').then((module) => ({ default: module.ProjectMarkdown })));
const ProjectMarkdownBody = lazy(() => import('../../components/ProjectMarkdown').then((module) => ({ default: module.ProjectMarkdownBody })));

function Detail({ project: source, releases, discordUrl }: { project: Project; releases?: DownloadRelease[]; discordUrl?:string }) {
  const project=releaseProject(source,releases??[]);
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const locale = language.split('-')[0];
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const activeTab: ProjectTab = PROJECT_TABS.includes(tabParam as ProjectTab) ? tabParam as ProjectTab : 'description';
  const { title, summary, tags } = projectCopy(project, t, language);
  const trackedDownloads = useMemo(() => source.downloadSlug ? [source.downloadSlug] : [], [source.downloadSlug]);
  const { recordDownload } = useDownloadCounters(trackedDownloads);
  const returnSearch = typeof location.state?.catalogueSearch === 'string' ? location.state.catalogueSearch : `?type=${project.type}`;
  const markdownSource = project.content[activeTab];
  const markdownPath = localizedText(markdownSource, language);
  const hasTranslation = typeof markdownSource === 'object' && locale in markdownSource;
  const date = (value?: string) => formatProjectDate(value, language, t('project.unknown'));
  useEffect(()=>{recordWorkEvent(project.slug,'view');},[project.slug]);
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} | Fimel`;
    return () => { document.title = previous; };
  }, [title]);
  const buttonBase = 'hover-target inline-flex items-center gap-2 min-h-12 px-4 rounded-sm border border-obsidian/20 dark:border-line text-sm hover:border-obsidian dark:hover:border-content-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link transition-colors';
  const secondaryButton = `${buttonBase} dark:bg-surface-raised`;
  const trackDownload=()=>{recordWorkEvent(project.slug,'download');if(project.downloadSlug)void recordDownload(project.downloadSlug);};
  const content=markdownPath?<>
    {locale!=='zh'&&!hasTranslation&&<p className="mb-5 border-l-2 border-line pl-3 text-xs text-gray-600 dark:text-content-muted">{t('project.translation_notice')}</p>}
    <Suspense fallback={<p role="status" className="text-gray-600 dark:text-content-muted">{t('project.loading')}</p>}><ProjectMarkdown key={markdownPath} path={markdownPath}/></Suspense>
  </>:null;

  return <div className="px-5 sm:px-8 lg:px-12 pt-36 md:pt-28 pb-24 text-obsidian dark:text-content min-h-[75dvh]">
    <div className="max-w-[1320px] mx-auto">
      <Link to={`/works${returnSearch}`} className="hover-target inline-flex gap-2 items-center min-h-11 mb-5 text-sm text-gray-600 dark:text-content-muted hover:text-obsidian dark:hover:text-content"><ArrowLeft aria-hidden size={16} />{t('project.back')}</Link>
      <header className="grid grid-cols-1 sm:grid-cols-[10rem_minmax(0,1fr)] gap-6 md:gap-8 pb-8 md:pb-10 border-b border-obsidian/15 dark:border-line">
        <div className="w-28 h-28 sm:w-40 sm:h-40 overflow-hidden rounded-sm bg-obsidian/5 dark:bg-surface-raised border border-obsidian/10 dark:border-line">
          <img src={assetUrl(project.image)} alt="" width={160} height={160} fetchPriority="high" className={`w-full h-full ${project.imageFit === 'contain' ? 'object-contain p-3' : 'object-cover'}`} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap gap-3 text-xs font-mono text-gray-600 dark:text-content-muted mb-3"><span>{t(`catalogue.types.${project.type}`)}</span><span className="text-[#007d7e] dark:text-diamond">{t(`catalogue.${projectStatus(project)}`)}</span></div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter leading-[1.1] break-words">{title}</h1>
          <p className="mt-4 max-w-[75ch] text-sm sm:text-base leading-relaxed text-gray-600 dark:text-content-muted">{summary}</p>
          <div className="flex flex-wrap gap-3 mt-6 items-start">
            <ProjectDownloads project={project} releases={releases} onDownload={trackDownload} />
            {project.store && <a href={project.store} onClick={trackDownload} target="_blank" rel="noopener noreferrer" className={`${buttonBase} bg-obsidian dark:bg-diamond text-white dark:text-obsidian`}><ExternalLink size={16} aria-hidden />{t('project.store')}</a>}
            <ProjectRepository repository={project.repository} className={secondaryButton}/>
          </div>
          {project.status !== 'released' && <p className="mt-4 text-sm text-gray-600 dark:text-content-muted">{t('project.developing')}</p>}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_18rem] gap-8 lg:gap-12 mt-7">
        <section className="min-w-0">
          <div role="tablist" aria-label={title} className="flex overflow-x-auto border-b border-obsidian/15 dark:border-line gap-2 mb-7">
            {PROJECT_TABS.map((tab, index) => <button type="button" role="tab" id={`tab-${tab}`} key={tab} aria-selected={activeTab === tab} aria-controls="project-content" tabIndex={activeTab === tab ? 0 : -1}
              onClick={() => setParams(tab === 'description' ? {} : { tab }, { replace: true, state: location.state })}
              onKeyDown={(event) => {
                let nextIndex: number | undefined;
                if (event.key === 'ArrowRight') nextIndex = (index + 1) % PROJECT_TABS.length;
                if (event.key === 'ArrowLeft') nextIndex = (index + PROJECT_TABS.length - 1) % PROJECT_TABS.length;
                if (event.key === 'Home') nextIndex = 0;
                if (event.key === 'End') nextIndex = PROJECT_TABS.length - 1;
                if (nextIndex !== undefined) {
                  event.preventDefault(); const next = PROJECT_TABS[nextIndex];
                  setParams(next === 'description' ? {} : { tab: next }, { replace: true, state: location.state });
                  document.getElementById(`tab-${next}`)?.focus();
                }
              }}
              className={`hover-target min-h-12 shrink-0 px-4 sm:px-6 border-b-2 font-mono text-sm transition-colors focus-visible:outline-2 focus-visible:outline-link focus-visible:-outline-offset-2 ${activeTab === tab ? 'border-obsidian dark:border-diamond text-obsidian dark:text-diamond' : 'border-transparent text-gray-600 dark:text-content-muted hover:text-obsidian dark:hover:text-content'}`}>
              {t(`project.${tab}`)}
            </button>)}
          </div>
          <div role="tabpanel" id="project-content" aria-labelledby={`tab-${activeTab}`} tabIndex={0} className="min-h-56 focus-visible:outline-2 focus-visible:outline-link">
            {activeTab==='versions'?<ProjectVersions key={project.slug} project={project} releases={releases} onDownload={trackDownload} notes={content??undefined} renderNotes={text=><Suspense fallback={<p role="status">{t('project.loading')}</p>}><ProjectMarkdownBody content={text} fileUrl={new URL('https://studiofimel.com/')}/></Suspense>}/>:content??<p className="py-10 text-gray-600 dark:text-content-muted">{t('project.unavailable')}</p>}
          </div>
        </section>

        <aside className="space-y-7 lg:border-l border-obsidian/10 dark:border-line lg:pl-7">
          <WorkDownloadMetric slug={project.slug} detail/>
          <section>
            <h2 className="text-base font-bold mb-3">{t('project.compatibility')}</h2>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-content-muted">{project.platform.map((platform) => <li key={platform}>{platform}</li>)}</ul>
          </section>
          <section>
            <h2 className="text-base font-bold mb-3">{t('project.creators')}</h2>
            <ul className="space-y-2 text-sm">{project.creators.map((creator) => <li key={creator.name}>{creator.url ? <a href={creator.url} target="_blank" rel="noopener noreferrer" className="hover-target inline-flex items-center gap-2 min-h-9 hover:underline">{creator.name}<ArrowUpRight size={13} aria-hidden /></a> : creator.name}</li>)}</ul>
          </section>
          <section>
            <h2 className="text-base font-bold mb-3">{t('project.details')}</h2>
            <dl className="space-y-3 text-xs">
              {[
                [t('project.published'), date(project.published)], [t('project.updated'), date(project.updated)],
                ...(project.version ? [[t('project.version'), project.version]] : []),
                ...(project.size ? [[t('project.size'), project.size]] : []),
                ...(project.rating ? [[t('project.rating'), project.rating]] : []),
                ...(project.downloads !== undefined ? [[t('project.downloads'), new Intl.NumberFormat(language).format(project.downloads)]] : []),
              ].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-gray-600 dark:text-content-muted">{label}</dt><dd className="text-right font-mono">{value}</dd></div>)}
            </dl>
            {project.downloads !== undefined && <p className="mt-4 text-[11px] leading-relaxed text-gray-600 dark:text-content-muted">{t('project.historical_metrics')}</p>}
          </section>
          {!!tags.length && <ul className="flex flex-wrap gap-1.5">{tags.map((tag) => <li key={tag} className="text-[11px] px-2 py-1 border border-obsidian/10 dark:border-line rounded-sm text-gray-600 dark:text-content-muted">{tag}</li>)}</ul>}
          <section className="space-y-2 text-sm">
            {project.issues && <a href={project.issues} target="_blank" rel="noopener noreferrer" className="hover-target flex gap-2 items-center min-h-9 hover:underline">{t('project.issues')}<ArrowUpRight aria-hidden size={14} /></a>}
            {project.source && <a href={project.source.url} target="_blank" rel="noopener noreferrer" className="hover-target flex gap-2 items-center min-h-9 hover:underline">{t('project.source')}<ArrowUpRight aria-hidden size={14} /></a>}
            <a href={discordUrl??'https://discord.gg/X9aVJJVvA'} target="_blank" rel="noopener noreferrer" className="hover-target flex gap-2 items-center min-h-9 hover:underline">{t('project.discord')}<ArrowUpRight aria-hidden size={14} /></a>
            <Link to="/studio" state={{ scrollTo: '#contact' }} className="hover-target flex gap-2 items-center min-h-9 hover:underline">{t('project.support')}<ArrowUpRight aria-hidden size={14} /></Link>
          </section>
        </aside>
      </div>
    </div>
  </div>;
}

export function ProjectDetail() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const { status, projects, releases, site, retry, fallback } = useProjectCatalogue();
  const project = projects.find((entry) => entry.slug === slug);
  if (status === 'idle' || status === 'loading') return <div role="status" className="pt-40 pb-24 px-6 min-h-[75dvh] max-w-[1320px] mx-auto text-gray-600 dark:text-content-muted">{t('catalogue.loading')}</div>;
  if (status === 'error') return <div role="alert" className="pt-40 pb-24 px-6 min-h-[75dvh]"><p>{t('catalogue.error')}</p><button type="button" onClick={() => void retry()} className="mt-4 min-h-11 border border-current px-4">{t('catalogue.retry')}</button></div>;
  if (!project) return <div className="pt-40 pb-24 px-6 min-h-[75dvh] max-w-[1320px] mx-auto text-obsidian dark:text-content"><h1 className="text-3xl font-bold">{t('project.not_found')}</h1><Link to="/works" className="inline-flex items-center gap-2 mt-5 min-h-11"><ArrowLeft size={16} />{t('project.back')}</Link></div>;
  return <>{fallback && <p role="status" className="px-6 pt-28 text-sm text-content-muted">{t('catalogue.fallback')}</p>}<Detail key={project.slug} project={project} releases={releases?.[project.slug]} discordUrl={site?.contact.discord}/></>;
}
