import type { TFunction } from 'i18next';
import projectTags from './project-tags.json';

export type ProjectTag = keyof typeof projectTags;

export const PROJECT_TYPES = ['bedrock', 'java', 'datapacks', 'tools', 'mods'] as const;
export type ProjectType = typeof PROJECT_TYPES[number];
export const PROJECT_TABS = ['description', 'changelog', 'versions'] as const;
export type ProjectTab = typeof PROJECT_TABS[number];
export type LocalizedText = string | { zh?: string; en?: string; ja?: string };

export interface Project {
  slug: string;
  type: ProjectType;
  title: LocalizedText;
  summary?: LocalizedText;
  tags: ProjectTag[];
  translations?: { title?: string; summary?: string };
  image: string;
  imageFit?: 'cover' | 'contain';
  status: 'released' | 'development' | 'planned';
  platform: string[];
  creators: { name: string; url?: string }[];
  published?: string;
  updated?: string;
  version?: string;
  size?: string;
  downloads?: number;
  rating?: string;
  store?: string;
  repository?: string;
  issues?: string;
  download?: string;
  downloadSlug?: string;
  latestReleaseRepo?: string;
  releasePage?: string;
  fallbackDownload?: string;
  fallbackFileName?: string;
  content: Partial<Record<ProjectTab, LocalizedText>>;
  source?: { label: string; url: string; retrieved?: string };
}

export function assetUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}

export function localizedText(value: LocalizedText | undefined, language: string): string {
  if (typeof value === 'string') return value;
  if (!value) return '';
  const locale = language.split('-')[0] as 'zh' | 'en' | 'ja';
  return value[locale] ?? value.zh ?? value.en ?? value.ja ?? '';
}

export function projectCopy(project: Project, t: TFunction, language: string) {
  const title = project.translations?.title ? t(project.translations.title) : localizedText(project.title, language);
  const summary = project.translations?.summary ? t(project.translations.summary) : localizedText(project.summary, language);
  // Genre/purpose IDs are maintained explicitly; summaries and feature lists
  // never become category labels, even when the display language changes.
  const tags = project.tags.map((tag) => localizedText(projectTags[tag], language));
  return { title, summary, tags };
}

export function projectTagSearchText(project: Project): string {
  return project.tags.flatMap((tag) => [tag, ...Object.values(projectTags[tag])]).join(' ');
}

export function projectStatus(project: Project): string {
  return project.status === 'released' ? 'live' : project.status === 'development' ? 'development' : 'planned';
}

export function formatProjectDate(value: string | undefined, language: string, unknown: string): string {
  if (!value) return unknown;
  // Date-only values are displayed in UTC so browser timezone cannot shift the day.
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? unknown : new Intl.DateTimeFormat(language, {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  }).format(date);
}

export function parseCatalogue(value: unknown): Project[] {
  if (!value || typeof value !== 'object' || !('projects' in value) || !Array.isArray(value.projects)) {
    throw new Error('Invalid work catalogue.');
  }
  const slugs = new Set<string>();
  for (const entry of value.projects) {
    if (!entry || typeof entry !== 'object' || typeof entry.slug !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) || slugs.has(entry.slug) ||
      !PROJECT_TYPES.includes(entry.type) || !entry.title || typeof entry.image !== 'string' ||
      !['released', 'development', 'planned'].includes(entry.status) ||
      !Array.isArray(entry.creators) || !Array.isArray(entry.platform) || !entry.content || typeof entry.content !== 'object' ||
      !Array.isArray(entry.tags) || entry.tags.length > 4 || new Set(entry.tags).size !== entry.tags.length ||
      entry.tags.some((tag: unknown) => typeof tag !== 'string' || !Object.hasOwn(projectTags, tag))) {
      throw new Error('Invalid project record in work catalogue.');
    }
    slugs.add(entry.slug);
  }
  return value.projects as Project[];
}
