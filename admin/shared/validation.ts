import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import catalogueSchema from '../../public/works/catalogue.schema.json';
import tags from '../../src/content/project-tags.json';
import { MAX_FILE_SIZE, PUBLIC_ORIGIN } from './model';
import type { Library } from './model';

const text = { type: 'string', maxLength: 200_000 };
const localized = { anyOf: [text, { type: 'object', properties: { zh: text, en: text, ja: text }, minProperties: 1, additionalProperties: false }] };
const id = { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$' };
const asset = { type: 'object', additionalProperties: false, required: ['id', 'name', 'size', 'mime', 'sha256'], properties: {
  id, name: { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,149}$' }, displayName: {type:'string',minLength:1,maxLength:200,pattern:'^[^\u0000-\u001f\u007f]+$'},
  size: { type: 'integer', minimum: 1, maximum: MAX_FILE_SIZE }, mime: { type: 'string' },
  sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' }, privateKey: { type: 'string', pattern: '^uploads/verified/[a-zA-Z0-9-]+/[a-zA-Z0-9._-]+$' },
  publicUrl: { type: 'string', format: 'uri' }, primary: { type: 'boolean' },
} };
const project = structuredClone(catalogueSchema.$defs.project);
// Embed the existing contract without losing fields or accepting unknown ones.
const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'works'], properties: { schemaVersion: { const: 1 }, works: {
    type: 'array', maxItems: 500, items: { type: 'object', additionalProperties: false,
      required: ['id', 'project', 'workflow', 'order', 'markdown', 'gallery', 'versions', 'createdAt', 'updatedAt'],
      properties: { id, project, legacy: project, workflow: { enum: ['draft', 'ready', 'archived'] },
        order: { type: 'integer', minimum: 0, maximum: 100000 }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' }, coverId: id,
        markdown: { type: 'object', required: ['description', 'changelog', 'versions'], additionalProperties: false,
          properties: Object.fromEntries(['description', 'changelog', 'versions'].map(k => [k, { type: 'object', additionalProperties: false, maxProperties: 3, properties: { zh: text, en: text, ja: text } }])) },
        gallery: { type: 'array', maxItems: 100, items: asset }, versions: { type: 'array', maxItems: 100, items: {
          type: 'object', additionalProperties: false, required: ['id', 'label', 'date', 'gameVersions', 'status', 'changelog', 'files'],
          properties: { id, label: { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,79}$' }, date: { type: 'string', format: 'date' },
            gameVersions: { type: 'array', maxItems: 30, items: { type: 'string', maxLength: 80 } }, status: { enum: ['draft', 'released'] },
            changelog: localized, files: { type: 'array', maxItems: 30, items: asset },
          },
        } },
      },
    },
  } }, $defs: catalogueSchema.$defs,
};
export const librarySchema = schema;
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile<Library>(schema);

export function safeUrl(value: string, local = false): boolean {
  if (local && /^(?:assets|works|mods|plugins)\/[a-zA-Z0-9_./-]+$/.test(value) && !value.split('/').includes('..')) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}

export function validateLibrary(value: unknown): string[] {
  if (JSON.stringify(value).length > 4_000_000) return ['作品库超过 4 MB，请减少正文或拆分内容。'];
  if (!validate(value)) return (validate.errors ?? []).map(e => `${e.instancePath || '/'} ${e.message}`).slice(0, 15);
  const errors: string[] = [];
  const ids = new Set<string>(), slugs = new Set<string>();
  for (const work of value.works) {
    const p = work.project;
    if (ids.has(work.id) || slugs.has(p.slug)) errors.push('作品 ID / slug 重复。');
    ids.add(work.id); slugs.add(p.slug);
    if (!p.title || !Object.values(typeof p.title === 'string' ? { zh: p.title } : p.title).some(s => s.trim())) errors.push(`${p.slug} 名称不能为空。`);
    if (p.tags.some(tag => !Object.hasOwn(tags, tag))) errors.push(`${p.slug} 使用了未知标签。`);
    for (const [key, url] of Object.entries(p)) {
      if (['image', 'download', 'fallbackDownload'].includes(key) && typeof url === 'string' && !safeUrl(url, true)) errors.push(`${p.slug} ${key} 地址不安全。`);
      if (['store', 'repository', 'issues', 'releasePage', 'downloadUrl'].includes(key) && typeof url === 'string' && !safeUrl(url)) errors.push(`${p.slug} ${key} 地址不安全。`);
    }
    if (p.creators.some(c => c.url && !safeUrl(c.url)) || p.source && !safeUrl(p.source.url)) errors.push(`${p.slug} 作者/来源链接不安全。`);
    if (p.downloadUrl && (!p.downloadUrl.startsWith(`${PUBLIC_ORIGIN}/works/${p.type}/${p.slug}/`) || /[?#]/.test(p.downloadUrl))) errors.push(`${p.slug} 下载路径不匹配。`);
    for (const tab of Object.values(p.content)) for (const path of typeof tab === 'string' ? [tab] : Object.values(tab ?? {})) if (!safeUrl(path, true)) errors.push(`${p.slug} 正文路径不安全。`);
    const versionIds = new Set<string>(), labels = new Set<string>(), assetIds = new Set<string>();
    if(work.gallery.length+work.versions.reduce((sum,v)=>sum+v.files.length,0)>250)errors.push(`${p.slug} 单个作品最多关联 250 个资源文件。`);
    for (const release of work.versions) {
      if (versionIds.has(release.id) || labels.has(release.label)) errors.push(`${p.slug} 版本重复。`);
      versionIds.add(release.id); labels.add(release.label);
      if (release.files.filter(f => f.primary).length > 1) errors.push(`${p.slug} 每版本只能有一个主下载。`);
    }
    for (const a of [...work.gallery, ...work.versions.flatMap(v => v.files)]) {
      if (assetIds.has(a.id)) errors.push(`${p.slug} 文件 ID 重复。`);
      assetIds.add(a.id);
      if (!a.privateKey && !a.publicUrl || a.publicUrl && (!safeUrl(a.publicUrl) || new URL(a.publicUrl).origin !== PUBLIC_ORIGIN)) errors.push(`${p.slug} 文件来源不合法。`);
    }
    if (work.coverId && !work.gallery.some(a => a.id === work.coverId)) errors.push(`${p.slug} 封面不存在。`);
    if (p.status !== 'released' && (p.downloadUrl || p.download || work.versions.some(v => v.status === 'released' && v.files.length))) errors.push(`${p.slug} 未发行作品不能提供下载。`);
  }
  return errors;
}
