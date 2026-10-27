import type { Project } from '../../src/content/projects';
import { localizedText } from '../../src/content/projects';
import { matchesFeaturedGroup } from '../../src/content/home-featured';
import type { FeaturedGroup } from '../../src/content/home-featured';
import type { SiteContent } from '../../src/content/site-content';

export const FEATURED_GROUP_NAMES = { maps: '精选地图', released: '已发行作品', development: '制作中的作品' };
export const FEATURED_GROUP_HINTS = {
  maps: '只展示已发行的基岩版地图。数据包、模组与工具请选“已发行作品”。',
  released: '展示已发行的作品，支持数据包、模组、插件与工具。',
  development: '展示制作中或企划中的作品；已发行作品请移至其他分组。',
};
export const PROJECT_TYPE_NAMES = { bedrock: '基岩版地图', java: 'Java 地图', datapacks: '数据包', tools: '插件与工具', mods: '模组' };
export const PROJECT_STATUS_NAMES = { released: '已发行', development: '制作中', planned: '企划中' };
export type FeaturedIssue = { group: FeaturedGroup; slug: string; message: string; target?: FeaturedGroup };

export function featuredIssue(group: FeaturedGroup, slug: string, project: Project | undefined): FeaturedIssue | undefined {
  if (!project) return { group, slug, message: `精选作品尚未公开：${slug}。请先在作品编辑页确认发布，再刷新作品公开状态。` };
  if (matchesFeaturedGroup(project, group)) return;
  const identity = `${localizedText(project.title, 'zh') || slug}（${slug}）`;
  const target: FeaturedGroup = project.status === 'released' ? group === 'development' && project.type === 'bedrock' ? 'maps' : 'released' : 'development';
  const reason = group === 'maps' && project.type !== 'bedrock'
    ? `作品已公开，但分类不适合“精选地图”：${identity} 是${PROJECT_TYPE_NAMES[project.type]}，此分组只接受已发行的基岩版地图。`
    : `作品已公开，但发行状态不适合“${FEATURED_GROUP_NAMES[group]}”：${identity} 当前为${PROJECT_STATUS_NAMES[project.status]}。`;
  return { group, slug, target, message: `${reason}可移至“${FEATURED_GROUP_NAMES[target]}”。` };
}

export function sitePublicationIssues(site: SiteContent, projects: Project[]): string[] {
  const bySlug = new Map(projects.map(project => [project.slug, project]));
  const errors = Object.entries(site.featured).flatMap(([group, slugs]) => slugs.flatMap(slug => {
    const issue = featuredIssue(group as FeaturedGroup, slug, bySlug.get(slug));
    return issue ? [issue.message] : [];
  }));
  for (const update of site.updates) if (update.workSlug && !bySlug.has(update.workSlug)) errors.push(`近期更新引用的作品尚未公开：${update.workSlug}`);
  return errors;
}

// Explicit editor action only: preserve other selections and do not save/publish.
export function moveFeaturedWork(site: SiteContent, slug: string, target: FeaturedGroup): SiteContent {
  if (!site.featured[target].includes(slug) && site.featured[target].length >= 12) return site;
  const groups: FeaturedGroup[] = ['maps', 'released', 'development'];
  const featured = { ...site.featured };
  for (const group of groups) featured[group] = group === target ? [...new Set([...featured[group], slug])] : featured[group].filter(value => value !== slug);
  return { ...site, featured };
}
