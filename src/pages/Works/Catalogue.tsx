import { useDeferredValue } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, CalendarDays, Download, Search, X } from 'lucide-react';
import { useProjectCatalogue } from '../../hooks/useProjectCatalogue';
import { PROJECT_TYPES, assetUrl, formatProjectDate, projectCopy, projectStatus, projectTagSearchText } from '../../content/projects';
import type { ProjectType } from '../../content/projects';

export function Catalogue() {
  const { t, i18n } = useTranslation();
  const { projects, status, retry } = useProjectCatalogue();
  const [params, setParams] = useSearchParams();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const typeParam = params.get('type');
  const activeType = PROJECT_TYPES.includes(typeParam as ProjectType) ? typeParam : 'all';
  const search = params.get('q') ?? '';
  const query = useDeferredValue(search.trim().toLocaleLowerCase());
  const sort = params.get('sort') ?? 'featured';
  const numberFormatter = new Intl.NumberFormat(language);
  const updateParams = (key: string, value: string, replace = false) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'all' || value === 'featured') next.delete(key);
    else next.set(key, value);
    setParams(next, { replace });
  };

  const entries = projects.map((project) => ({ project, ...projectCopy(project, t, language) }))
    .filter(({ project, title, summary, tags }) => {
      if (activeType !== 'all' && project.type !== activeType) return false;
      return !query || `${title} ${summary} ${tags.join(' ')} ${projectTagSearchText(project)} ${project.platform.join(' ')} ${project.slug} ${project.creators.map((creator) => creator.name).join(' ')}`.toLocaleLowerCase().includes(query);
    });
  if (sort === 'updated') entries.sort((a, b) => (b.project.updated ?? '').localeCompare(a.project.updated ?? ''));
  if (sort === 'name') entries.sort((a, b) => a.title.localeCompare(b.title, language));
  const catalogueSearch = params.toString() ? `?${params.toString()}` : '';

  return (
    <div className="min-h-[75dvh] px-5 sm:px-8 lg:px-12 pt-36 md:pt-28 pb-24 text-obsidian dark:text-content">
      <div className="mx-auto max-w-[1320px]">
        <header className="mb-8 md:mb-10">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter">{t('catalogue.title')}</h1>
          <p className="mt-3 max-w-2xl text-base text-gray-600 dark:text-content-muted">{t('catalogue.intro')}</p>
        </header>

        <div className="mb-7">
          <label htmlFor="work-search" className="block mb-2 font-mono text-xs text-gray-600 dark:text-content-muted">{t('catalogue.search')}</label>
          <div className="relative">
            <Search aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-content-muted" />
            <input id="work-search" type="search" value={search} onChange={(event) => updateParams('q', event.target.value, true)}
              placeholder={t('catalogue.search_placeholder')}
              className="work-search w-full min-h-14 bg-white dark:bg-surface border border-obsidian/15 dark:border-line pl-12 pr-14 rounded-sm text-base placeholder:text-content-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link" />
            {search && <button type="button" onClick={() => updateParams('q', '', true)} aria-label={t('catalogue.clear')}
              className="absolute right-1 top-1 h-12 w-12 flex items-center justify-center hover:text-diamond focus-visible:outline-2 focus-visible:outline-link"><X aria-hidden size={18} /></button>}
          </div>
        </div>

        <nav aria-label={t('catalogue.title')} className="flex gap-1 overflow-x-auto pb-1 border-b border-obsidian/15 dark:border-line mb-6">
          {(['all', ...PROJECT_TYPES] as const).map((type) => {
            const next = new URLSearchParams(params);
            if (type === 'all') next.delete('type'); else next.set('type', type);
            return <Link key={type} to={{ pathname: '/works', search: next.toString() }} aria-current={activeType === type ? 'page' : undefined}
              className={`hover-target shrink-0 whitespace-nowrap min-h-12 px-3 sm:px-5 inline-flex items-center gap-2 font-mono text-xs sm:text-sm border-b-2 transition-colors ${activeType === type ? 'border-obsidian dark:border-diamond text-obsidian dark:text-diamond bg-obsidian/5 dark:bg-surface-raised' : 'border-transparent text-gray-600 dark:text-content-muted hover:text-obsidian dark:hover:text-content'} focus-visible:outline-2 focus-visible:outline-link focus-visible:-outline-offset-2`}>
              {type === 'all' ? t('catalogue.all') : t(`catalogue.types.${type}`)}
              <span aria-hidden className="text-[10px]">{type === 'all' ? projects.length : projects.filter((project) => project.type === type).length}</span>
            </Link>;
          })}
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p role="status" className="font-mono text-xs text-gray-600 dark:text-content-muted">{t('catalogue.results', { count: entries.length })}</p>
          <div className="flex items-center gap-2">
            <label htmlFor="work-sort" className="text-xs text-gray-600 dark:text-content-muted">{t('catalogue.sort')}</label>
            <select id="work-sort" value={sort} onChange={(event) => updateParams('sort', event.target.value)}
              className="min-h-11 px-3 bg-white dark:bg-surface border border-obsidian/15 dark:border-line rounded-sm text-xs focus-visible:outline-2 focus-visible:outline-link">
              <option value="featured">{t('catalogue.featured')}</option>
              <option value="updated">{t('catalogue.newest')}</option>
              <option value="name">{t('catalogue.alphabetical')}</option>
            </select>
          </div>
        </div>

        {(status === 'idle' || status === 'loading') && <div role="status" aria-label={t('catalogue.loading')} className="space-y-3">
          {[0, 1, 2].map((index) => <div key={index} className="h-40 border border-obsidian/10 dark:border-line rounded-sm bg-obsidian/5 dark:bg-surface-raised animate-pulse motion-reduce:animate-none" />)}
        </div>}
        {status === 'error' && <div role="alert" className="py-16 border border-obsidian/15 dark:border-line text-center">
          <p>{t('catalogue.error')}</p><button type="button" onClick={() => void retry()} className="mt-5 min-h-11 px-5 border border-current hover:text-diamond">{t('catalogue.retry')}</button>
        </div>}
        {status === 'ready' && !entries.length && <div className="py-16 text-center border border-obsidian/15 dark:border-line">
          <h2 className="text-xl font-bold">{t('catalogue.empty')}</h2><p className="mt-3 text-gray-600 dark:text-content-muted">{t('catalogue.empty_desc')}</p>
          <button type="button" onClick={() => setParams({})} className="mt-5 min-h-11 px-5 border border-current hover:text-diamond">{t('catalogue.clear')}</button>
        </div>}

        <div className="space-y-3">
          {status === 'ready' && entries.map(({ project, title, summary, tags }) => <Link key={project.slug} to={`/works/${project.slug}`} state={{ catalogueSearch }}
            className="work-row hover-target group grid grid-cols-[5rem_minmax(0,1fr)] sm:grid-cols-[7.5rem_minmax(0,1fr)] lg:grid-cols-[8.5rem_minmax(0,1fr)_12rem] gap-x-4 sm:gap-x-6 gap-y-3 p-4 sm:p-5 bg-white/65 dark:bg-surface border border-obsidian/10 dark:border-line rounded-sm hover:border-obsidian/35 dark:hover:border-content-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link transition-colors">
            <div className="aspect-square self-start overflow-hidden rounded-sm bg-obsidian/5 dark:bg-surface-raised">
              <img src={assetUrl(project.image)} alt="" width={144} height={144} loading="lazy" decoding="async"
                className={`w-full h-full transition-transform duration-300 motion-reduce:transition-none group-hover:scale-[1.04] ${project.imageFit === 'contain' ? 'object-contain p-2' : 'object-cover'}`} />
            </div>
            <div className="min-w-0 contents sm:flex sm:flex-col">
              <div className="col-start-2 min-w-0">
              <div className="flex gap-3 justify-between items-start">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight leading-tight group-hover:text-[#007d7e] dark:group-hover:text-diamond transition-colors break-words">{title}</h2>
                <ArrowUpRight aria-hidden size={18} className="shrink-0 text-gray-500 lg:hidden" />
              </div>
              <p className="mt-1 text-xs text-gray-600 dark:text-content-muted">{project.creators.map((creator) => creator.name).join(' / ')}</p>
              </div>
              <p className="col-span-2 sm:col-span-1 sm:mt-3 text-sm leading-relaxed text-gray-600 dark:text-content-muted line-clamp-2 sm:line-clamp-3">{summary}</p>
              <ul aria-label={t('catalogue.types.' + project.type)} className="col-span-2 sm:col-span-1 sm:mt-3 flex flex-wrap gap-1.5 text-[11px] font-mono text-gray-600 dark:text-content-muted">
                <li className="px-2 py-1 bg-obsidian/5 dark:bg-surface-raised rounded-sm">{t(`catalogue.types.${project.type}`)}</li>
                {tags.map((tag) => <li key={tag} className="px-2 py-1 border border-obsidian/10 dark:border-line rounded-sm">{tag}</li>)}
              </ul>
            </div>
            <div className="col-span-2 sm:col-span-1 sm:col-start-2 lg:col-start-auto flex flex-wrap lg:flex-col gap-x-5 gap-y-2 lg:border-l border-obsidian/10 dark:border-line lg:pl-5 text-xs font-mono text-gray-600 dark:text-content-muted">
              <div className="flex items-center gap-2"><CalendarDays size={13} aria-hidden /><span><span className="lg:block text-[10px]">{t('catalogue.updated')} </span><time dateTime={project.updated}>{formatProjectDate(project.updated, language, t('catalogue.no_date'))}</time></span></div>
              {project.downloads !== undefined && <div className="flex items-center gap-2"><Download size={13} aria-hidden /><span>{numberFormatter.format(project.downloads)} {t('catalogue.downloads')}</span></div>}
              {project.version && <span>{t('catalogue.version')} {project.version}</span>}
              <span className={project.status === 'released' ? 'text-[#007d7e] dark:text-diamond' : ''}>{t(`catalogue.${projectStatus(project)}`)}</span>
            </div>
          </Link>)}
        </div>
      </div>
    </div>
  );
}
