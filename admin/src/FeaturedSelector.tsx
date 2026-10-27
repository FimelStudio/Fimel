import type { Project } from '../../src/content/projects';
import { localizedText } from '../../src/content/projects';
import { matchesFeaturedGroup } from '../../src/content/home-featured';
import type { FeaturedGroup } from '../../src/content/home-featured';
import type { SiteContent } from '../../src/content/site-content';
import type { Library } from '../shared/model';
import { FEATURED_GROUP_NAMES, FEATURED_GROUP_HINTS, PROJECT_TYPE_NAMES, PROJECT_STATUS_NAMES, featuredIssue, moveFeaturedWork } from '../shared/featured';

type Props = { site: SiteContent; library: Library; publicProjects: Project[]; onChange(site: SiteContent): void; onRefresh(): void; busy: boolean };

export function FeaturedSelector({ site, library, publicProjects, onChange, onRefresh, busy }: Props) {
  const published = new Map(publicProjects.map(project => [project.slug, project]));
  const name = (project: Project) => `${localizedText(project.title, 'zh')} · ${project.slug}`;
  return <>
    <div className="section-heading"><h2>首页精选与推荐顺序</h2><button type="button" disabled={busy} onClick={onRefresh}>刷新作品公开状态</button></div>
    <p className="hint">按官网当前分类和发行状态选择分组。可以保存尚未公开作品的推荐草稿，发布网站内容前须先公开对应作品。刷新状态会保留正在编辑的网站内容。</p>
    {(Object.keys(FEATURED_GROUP_NAMES) as FeaturedGroup[]).map(group => {
      const candidates = library.works.filter(work => work.workflow !== 'archived').map(work => published.get(work.project.slug) ?? work.project).filter(project => matchesFeaturedGroup(project, group));
      const unused = candidates.filter(project => !site.featured[group].includes(project.slug));
      return <section key={group} className="site-featured-group" aria-label={FEATURED_GROUP_NAMES[group]}>
        <h3>{FEATURED_GROUP_NAMES[group]}</h3><p className="hint">{FEATURED_GROUP_HINTS[group]}</p>
        {site.featured[group].map((slug, index) => {
          const publicProject = published.get(slug);
          const project = publicProject ?? library.works.find(work => work.project.slug === slug)?.project;
          const issue = featuredIssue(group, slug, publicProject);
          const options = candidates.filter(candidate => candidate.slug === slug || !site.featured[group].includes(candidate.slug));
          const selectedInOptions = options.some(project => project.slug === slug);
          const helpId = `featured-${group}-${index}`;
          const fullTarget = !!issue?.target && site.featured[issue.target].length >= 12 && !site.featured[issue.target].includes(slug);
          return <div className="featured-selection" key={`${index}-${slug}`}>
            <div className="button-row"><select aria-label={`${FEATURED_GROUP_NAMES[group]}第 ${index + 1} 个作品`} aria-invalid={!!issue} aria-describedby={helpId} value={slug} onChange={event => onChange({ ...site, featured: { ...site.featured, [group]: site.featured[group].map((value, position) => position === index ? event.target.value : value) } })}>
              {!selectedInOptions && <option value={slug} disabled>{project ? name(project) : slug} · 当前选择需调整</option>}
              {options.map(project => <option key={project.slug} value={project.slug}>{name(project)}{published.has(project.slug) ? '' : ' · 尚未公开'}</option>)}
            </select><button type="button" disabled={index === 0} onClick={() => {
              const list = [...site.featured[group]]; [list[index - 1], list[index]] = [list[index], list[index - 1]];
              onChange({ ...site, featured: { ...site.featured, [group]: list } });
            }}>前移</button><button type="button" onClick={() => onChange({ ...site, featured: { ...site.featured, [group]: site.featured[group].filter((_, position) => position !== index) } })}>移除推荐</button></div>
            <p className="hint" id={helpId}>{project ? `${publicProject ? '已公开' : '尚未公开（仅草稿）'} · ${PROJECT_TYPE_NAMES[project.type]} · ${PROJECT_STATUS_NAMES[project.status]}` : '该作品当前不在作品库中。'}</p>
            {issue && <div className="featured-warning"><p>{issue.message}</p>{issue.target && <button type="button" disabled={fullTarget} onClick={() => onChange(moveFeaturedWork(site, slug, issue.target!))}>移至{FEATURED_GROUP_NAMES[issue.target]}</button>}{fullTarget && <p>目标分组已满 12 个作品，请先移除不需要的推荐。</p>}</div>}
          </div>;
        })}
        <button type="button" disabled={site.featured[group].length >= 12 || !unused.length} onClick={() => {
          if (unused[0]) onChange({ ...site, featured: { ...site.featured, [group]: [...site.featured[group], unused[0].slug] } });
        }}>添加推荐作品</button>
        {!unused.length && <p className="hint">暂无其他符合此分组的作品。</p>}
      </section>;
    })}
  </>;
}
