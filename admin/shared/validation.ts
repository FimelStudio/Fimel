import tags from '../../src/content/project-tags.json';
import { PUBLIC_ORIGIN } from './model';
import type { Work } from './model';
import type { ErrorObject } from 'ajv';
import { releaseLabelError } from './releases';
import validate from './generated/library-validator.js';
export { librarySchema } from './schema';

export function safeUrl(value: string, local = false): boolean {
  if (local && /^(?:assets|works|mods|plugins)\/[a-zA-Z0-9_./-]+$/.test(value) && !value.split('/').includes('..')) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}

function releaseContext(work: Partial<Work> | undefined, workIndex: number, versionIndex: number, label: unknown): string {
  const title = work?.project?.title;
  const rawName = typeof title === 'string' ? title : [title?.zh, title?.en, title?.ja].find(value => typeof value === 'string');
  const name = typeof rawName === 'string' ? rawName.slice(0, 80) : '';
  const slug = typeof work?.project?.slug === 'string' ? work.project.slug : '';
  const identity = name ? `作品「${name}」${slug ? `（${slug}）` : ''}` : slug || `第 ${workIndex + 1} 个作品`;
  const version = typeof label === 'string' && label ? `（${label.slice(0, 80)}）` : '（未命名）';
  return `${identity} · 第 ${versionIndex + 1} 个版本${version}`;
}

function schemaErrors(value: unknown, errors: ErrorObject[]): string[] {
  const works = value && typeof value === 'object' && 'works' in value && Array.isArray(value.works) ? value.works : [];
  return [...new Set(errors.map(error => {
    const path = /^\/works\/(\d+)\/versions\/(\d+)(?:\/label)?$/.exec(error.instancePath);
    if (path) {
      const workIndex = Number(path[1]), versionIndex = Number(path[2]);
      const work = works[workIndex];
      const release = work?.versions?.[versionIndex];
      const labelError = typeof release?.label === 'string' ? releaseLabelError(release.label, release.status) : '版本号必须为文本。';
      const isLabelError = error.instancePath.endsWith('/label') || error.keyword === 'required' && error.params.missingProperty === 'label' || error.keyword === 'if' && labelError;
      if (isLabelError && labelError) return `${releaseContext(work, workIndex, versionIndex, release?.label)}：${labelError}`;
    }
    return `${error.instancePath || '/'} ${error.message}`;
  }))].slice(0, 15);
}

export function validateLibrary(value: unknown, boundedRequestBody = false): string[] {
  // Only the Worker may skip this serialization after readJson has enforced its byte limit.
  if (!boundedRequestBody && JSON.stringify(value).length > 4_000_000) return ['作品库超过 4 MB，请减少正文或拆分内容。'];
  if (!validate(value)) return schemaErrors(value, validate.errors ?? []);
  const errors: string[] = [];
  const ids = new Set<string>(), slugs = new Set<string>();
  for (const [workIndex, work] of value.works.entries()) {
    const p = work.project;
    if (!p.image.trim() && !work.gallery.some(a => a.id === work.coverId)) errors.push(`${p.slug}：请选择一张上传图片作为封面，或填写已有封面地址。`);
    if (ids.has(work.id) || slugs.has(p.slug)) errors.push('作品 ID / slug 重复。');
    ids.add(work.id); slugs.add(p.slug);
    if (!p.title || !Object.values(typeof p.title === 'string' ? { zh: p.title } : p.title).some(s => s.trim())) errors.push(`${p.slug} 名称不能为空。`);
    if (p.tags.some(tag => !Object.hasOwn(tags, tag))) errors.push(`${p.slug} 使用了未知标签。`);
    for (const [key, url] of Object.entries(p)) {
      if (['image', 'featuredImage', 'download', 'fallbackDownload'].includes(key) && typeof url === 'string' && !(key === 'image' && url === '') && !safeUrl(url, true)) errors.push(`${p.slug} ${key} 地址不安全。`);
      if (['store', 'repository', 'issues', 'releasePage', 'downloadUrl'].includes(key) && typeof url === 'string' && !safeUrl(url)) errors.push(`${p.slug} ${key} 地址不安全。`);
    }
    if (p.creators.some(c => c.url && !safeUrl(c.url)) || p.source && !safeUrl(p.source.url)) errors.push(`${p.slug} 作者/来源链接不安全。`);
    if (p.downloadUrl && (!p.downloadUrl.startsWith(`${PUBLIC_ORIGIN}/works/${p.type}/${p.slug}/`) || /[?#]/.test(p.downloadUrl))) errors.push(`${p.slug} 下载路径不匹配。`);
    for (const tab of Object.values(p.content)) for (const path of typeof tab === 'string' ? [tab] : Object.values(tab ?? {})) if (!safeUrl(path, true)) errors.push(`${p.slug} 正文路径不安全。`);
    const versionIds = new Set<string>(), labels = new Set<string>(), assetIds = new Set<string>();
    if(work.gallery.length+work.versions.reduce((sum,v)=>sum+v.files.length,0)>250)errors.push(`${p.slug} 单个作品最多关联 250 个资源文件。`);
    for (const [versionIndex, release] of work.versions.entries()) {
      const context = releaseContext(work, workIndex, versionIndex, release.label);
      const labelError = releaseLabelError(release.label, release.status);
      if (labelError) errors.push(`${context}：${labelError}`);
      if (versionIds.has(release.id)) errors.push(`${context}：版本记录重复。`);
      if (release.label && labels.has(release.label)) errors.push(`${context}：版本号重复，请使用不同的版本号。`);
      versionIds.add(release.id); if (release.label) labels.add(release.label);
      if (release.files.filter(f => f.primary).length > 1) errors.push(`${p.slug} 每版本只能有一个主下载。`);
    }
    for (const a of [...work.gallery, ...work.versions.flatMap(v => v.files)]) {
      if (assetIds.has(a.id)) errors.push(`${p.slug} 文件 ID 重复。`);
      assetIds.add(a.id);
      if (!a.privateKey && !a.publicUrl || a.publicUrl && (!safeUrl(a.publicUrl) || new URL(a.publicUrl).origin !== PUBLIC_ORIGIN)) errors.push(`${p.slug} 文件来源不合法。`);
    }
    if (work.coverId && !work.gallery.some(a => a.id === work.coverId)) errors.push(`${p.slug} 封面不存在。`);
    if (work.featuredCoverId && !work.gallery.some(a => a.id === work.featuredCoverId && a.mime.startsWith('image/'))) errors.push(`${p.slug} 精选封图不存在或不是图片。`);
    if (p.status !== 'released' && (p.downloadUrl || p.download || work.versions.some(v => v.status === 'released' && v.files.length))) errors.push(`${p.slug} 未发行作品不能提供下载。`);
  }
  return errors;
}
