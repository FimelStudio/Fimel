import type { Project, ProjectTab, LocalizedText } from '../../src/content/projects';

export const PUBLIC_ORIGIN = 'https://download.studiofimel.com';
export const PART_SIZE = 16 * 1024 * 1024;
export const MAX_FILE_SIZE = 1024 ** 3;
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
export const LOCALES = ['zh', 'en', 'ja'] as const;
export type Locale = typeof LOCALES[number];
export type Asset = {
  id: string; name: string; displayName?: string; size: number; mime: string; sha256: string;
  privateKey?: string; publicUrl?: string; primary?: boolean;
};
export type Release = {
  id: string; label: string; date: string; gameVersions: string[];
  status: 'draft' | 'released'; changelog: LocalizedText; files: Asset[];
};
export type Work = {
  id: string; project: Project; workflow: 'draft' | 'ready' | 'archived'; order: number;
  markdown: Record<ProjectTab, Partial<Record<Locale, string>>>;
  gallery: Asset[]; coverId?: string; versions: Release[];
  createdAt: string; updatedAt: string; legacy?: Project;
};
export type Library = { schemaVersion: 1; works: Work[] };
export type PublicRelease = Omit<Release, 'files'> & { files: Omit<Asset, 'privateKey'>[] };
export type PublicManifest = {
  schemaVersion: 2; publicationId: string; projects: Project[];
  releases: Record<string, PublicRelease[]>;
};
export type Upload = {
  id: string; workId: string; versionId?: string; kind: 'image' | 'file';
  name: string; displayName?: string; size: number; mime: string; key: string; uploadId: string;
  expiresAt: string; status: 'uploading' | 'verifying' | 'complete' | 'cancelled';
  asset?: Asset; sha256?: string;
};

export function makeWork(): Work {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), project: {
      slug: '', type: 'bedrock', title: { zh: '' }, image: 'assets/brand/fimel-logo.svg',
      status: 'development', platform: ['Minecraft Bedrock'], creators: [{ name: 'Fimel Studio' }], tags: [],
      content: { description: 'works/new/description.zh.md', changelog: 'works/new/changelog.zh.md', versions: 'works/new/versions.zh.md' },
    }, workflow: 'draft', order: 0, markdown: { description: { zh: '' }, changelog: { zh: '尚未公布更新日志。' }, versions: { zh: '尚未发布。' } },
    gallery: [], versions: [], createdAt: now, updatedAt: now,
  };
}

export const MIME_TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  zip: 'application/zip', jar: 'application/java-archive', exe: 'application/vnd.microsoft.portable-executable',
  mcworld: 'application/zip', mcpack: 'application/zip', mctemplate: 'application/zip',
};
