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
  /** Optional landscape artwork for homepage featured cards. */
  featuredImage?: string;
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
  /** Published R2 URL. Takes precedence over legacy local/GitHub downloads. */
  downloadUrl?: string;
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

export function projectDownloadUrl(project: Pick<Project, 'downloadUrl' | 'download'>): string | undefined {
  return project.downloadUrl || project.download;
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
  if (!value || typeof value !== 'object' || !('schemaVersion' in value) || (value.schemaVersion !== 1 && value.schemaVersion !== 2) || !('projects' in value) || !Array.isArray(value.projects)) {
    throw new Error('Invalid work catalogue.');
  }
  const slugs = new Set<string>();
  for (const entry of value.projects) {
    if (!entry || typeof entry !== 'object' || typeof entry.slug !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) || slugs.has(entry.slug) ||
      !PROJECT_TYPES.includes(entry.type) || !validLocalizedText(entry.title) || !localizedText(entry.title, 'zh').trim() || typeof entry.image !== 'string' ||
      (entry.summary !== undefined && !validLocalizedText(entry.summary)) ||
      (entry.featuredImage !== undefined && (typeof entry.featuredImage !== 'string' || !entry.featuredImage.trim() || !validImagePath(entry.featuredImage))) ||
      !['released', 'development', 'planned'].includes(entry.status) ||
      !Array.isArray(entry.creators) || entry.creators.some((creator: unknown) => !creator || typeof creator !== 'object' || !('name' in creator) || typeof creator.name !== 'string' || ('url' in creator && typeof creator.url !== 'string')) ||
      !Array.isArray(entry.platform) || entry.platform.some((platform: unknown) => typeof platform !== 'string') ||
      !entry.content || typeof entry.content !== 'object' || Array.isArray(entry.content) ||
      Object.entries(entry.content).some(([tab, path]) => !PROJECT_TABS.includes(tab as ProjectTab) || !validLocalizedText(path) || !Object.values(typeof path === 'string' ? { path } : path).every(validContentPath)) ||
      (entry.translations !== undefined && (!entry.translations || typeof entry.translations !== 'object' || Object.entries(entry.translations).some(([key, text]) => !['title', 'summary'].includes(key) || typeof text !== 'string'))) ||
      !Array.isArray(entry.tags) || entry.tags.length > 4 || new Set(entry.tags).size !== entry.tags.length ||
      (entry.downloadUrl !== undefined && (typeof entry.downloadUrl !== 'string' ||
        !entry.downloadUrl.startsWith(`https://download.studiofimel.com/works/${entry.type}/${entry.slug}/`))) ||
      entry.tags.some((tag: unknown) => typeof tag !== 'string' || !Object.hasOwn(projectTags, tag))) {
      throw new Error('Invalid project record in work catalogue.');
    }
    slugs.add(entry.slug);
  }
  return value.projects as Project[];
}

function validImagePath(value: string): boolean {
  if (/^(?:assets|works|mods|plugins)\/[a-zA-Z0-9_./-]+$/.test(value) && !value.split('/').includes('..')) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}

function validLocalizedText(value: unknown): value is LocalizedText {
  return typeof value === 'string' || !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.entries(value).every(([locale, text]) => ['zh', 'en', 'ja'].includes(locale) && typeof text === 'string');
}

function validContentPath(value: string): boolean {
  try { return ['https:', 'http:'].includes(new URL(value, 'https://studiofimel.com/').protocol); }
  catch { return false; }
}
