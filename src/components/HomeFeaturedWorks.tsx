import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Download } from 'lucide-react';
import { useProjectCatalogue } from '../hooks/useProjectCatalogue';
import { HOME_FEATURED, matchesFeaturedGroup } from '../content/home-featured';
import { assetUrl, projectCopy, projectStatus } from '../content/projects';
import type { Project } from '../content/projects';

type PreviewProps = {
  onPreview: (title: string, category: string, description: string) => void;
  onPreviewEnd: () => void;
};

export function HomeFeaturedWorks({ onPreview, onPreviewEnd }: PreviewProps) {
  const { t, i18n } = useTranslation();
  const { projects, status, retry, site } = useProjectCatalogue();
  const featured = site?.featured ?? HOME_FEATURED;
  const language = i18n.resolvedLanguage ?? i18n.language;
  const select = (slugs: readonly string[], group: 'maps' | 'released' | 'development') => slugs
    .map(slug => projects.find(project => project.slug === slug))
    .filter((project): project is Project => Boolean(project && matchesFeaturedGroup(project, group)));
  const preview = (project: Project) => {
    const copy = projectCopy(project, t, language);
    onPreview(copy.title, t(`catalogue.types.${project.type}`), copy.summary);
  };
  const linkClasses = 'hover-target group focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link';

  // Catalogue requests never suspend the hero or navigation. Failures leave
  // a retry and the existing full catalogue link rather than a blank Home.
  if (status !== 'ready') return (
    <div className="min-h-64 py-12 text-gray-600 dark:text-content-muted" aria-live="polite">
      <p>{t(status === 'error' ? 'catalogue.error' : 'catalogue.loading')}</p>
      {status === 'error' && <button type="button" onClick={() => void retry()} className="hover-target mt-4 border border-current px-5 py-3 focus-visible:outline-2 focus-visible:outline-link">{t('catalogue.retry')}</button>}
    </div>
  );

  return (
    <div className="space-y-20 md:space-y-28" data-home-featured>
      <div>
        <div className="flex flex-wrap items-end justify-between gap-5 mb-8">
          <h3 className="text-3xl md:text-5xl font-black tracking-tighter text-obsidian dark:text-content">{t('homeFeatured.maps')}</h3>
          <div className="flex flex-wrap gap-6">{(['bedrock','java'] as const).map(type=><Link key={type} to={`/works?type=${type}`} className={`${linkClasses} flex items-center gap-2 border-b border-current pb-2 text-sm text-obsidian dark:text-content hover:text-brand`}>{t(`catalogue.types.${type}`)} <ArrowUpRight aria-hidden size={16} /></Link>)}</div>
        </div>
        <div className="grid lg:grid-cols-3 gap-6" data-featured-group="maps">
          {select(featured.maps, 'maps').map(project => {
            const { title, summary, tags } = projectCopy(project, t, language);
            return (
              <article key={project.slug} className="group relative" onMouseEnter={() => preview(project)} onMouseLeave={onPreviewEnd}>
                <Link to={`/works/${project.slug}`} className={`${linkClasses} relative block min-h-[28rem] overflow-hidden border border-obsidian/10 dark:border-line bg-surface`}>
                  <div className="parallax-bg absolute inset-[-18%] w-[136%] h-[136%]">
                    <img src={assetUrl(project.featuredImage || project.image)} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 motion-reduce:transition-none motion-reduce:transform-none" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/45 to-obsidian/10" />
                  <div className="relative flex min-h-[28rem] flex-col justify-end p-6 text-white">
                    <p className="text-xs text-white/90">{tags.join(' / ')}</p>
                    <h4 className="mt-3 text-3xl font-bold tracking-tight leading-tight">{title}</h4>
                    <p className="mt-4 text-sm leading-relaxed text-white/90 line-clamp-3">{summary}</p>
                    {project.downloads !== undefined && <p className="mt-5 flex items-center gap-3 text-xs font-mono text-white/90"><Download aria-hidden size={16} />{t('works.downloads_metric', { downloads: project.downloads.toLocaleString('en-US') })}</p>}
                  </div>
                </Link>
              </article>
            );
          })}
        </div>
        <p className="mt-5 text-xs leading-relaxed text-gray-600 dark:text-content-muted">{t('project.historical_metrics')}</p>
      </div>

      <div>
        <h3 className="mb-8 text-3xl md:text-5xl font-black tracking-tighter text-obsidian dark:text-content">{t('homeFeatured.released')}</h3>
        <div className="grid md:grid-cols-2 gap-6" data-featured-group="released">
          {select(featured.released, 'released').map((project, index, items) => {
            const { title, summary, tags } = projectCopy(project, t, language);
            return (
              <Link key={project.slug} to={`/works/${project.slug}`} onMouseEnter={()=>preview(project)} onMouseLeave={onPreviewEnd} className={`${linkClasses} relative flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-sm border border-obsidian/10 dark:border-line bg-obsidian p-6 md:p-8 text-white ${index === 0 && items.length % 2 === 1 ? 'md:col-span-2' : ''}`}>
                <img src={assetUrl(project.featuredImage || project.image)} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 motion-reduce:transition-none motion-reduce:transform-none"/>
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/10"/>
                <div className="relative max-w-3xl">
                  <p className="text-xs text-white/90">{t(`catalogue.types.${project.type}`)} / {t(`catalogue.${projectStatus(project)}`)}</p>
                  <h4 className="mt-3 text-2xl md:text-3xl font-bold leading-tight tracking-tight">{title}</h4>
                  <p className="mt-4 text-sm leading-relaxed text-white/90 line-clamp-3">{summary}</p>
                  <p className="mt-5 text-xs text-white/80">{tags.join(' / ')}</p>
                  <span className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm">{t('homeFeatured.explore')}<ArrowUpRight aria-hidden size={16}/></span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-8 text-3xl md:text-5xl font-black tracking-tighter text-obsidian dark:text-content">{t('homeFeatured.development')}</h3>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8" data-featured-group="development">
          {select(featured.development, 'development').map(project => {
            const { title, summary, tags } = projectCopy(project, t, language);
            return (
              <Link key={project.slug} to={`/works/${project.slug}`} className={`${linkClasses} border-t border-obsidian/15 dark:border-line pt-6 text-obsidian dark:text-content`}>
                <div className="flex items-center gap-4">
                  <img src={assetUrl(project.featuredImage || project.image)} alt="" loading="lazy" decoding="async" width={80} height={80} className="h-20 w-20 shrink-0 object-contain bg-surface-raised" />
                  <div>
                    <p className="text-xs text-brand">{t(`catalogue.types.${project.type}`)} / {t(`catalogue.${projectStatus(project)}`)}</p>
                    <h4 className="mt-2 text-xl font-bold leading-tight group-hover:text-brand transition-colors">{title}</h4>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-relaxed text-gray-600 dark:text-content-muted">{summary}</p>
                <p className="mt-4 text-xs text-gray-600 dark:text-content-muted">{tags.join(' / ')}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
