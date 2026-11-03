import type { LocalizedText } from './projects';

export const DOCS_MANIFEST_KEY = 'data/docs.json';
export const DOCS_MAX_BYTES = 4 * 1024 * 1024;
export const DOCS_LOCALES = ['zh', 'en', 'ja'] as const;
export type DocsBody = Partial<Record<typeof DOCS_LOCALES[number], string>>;
export type DocsCategory = { id: string; slug: string; title: LocalizedText; summary: LocalizedText; order: number; workSlug?: string };
export type PublicDoc = { id: string; slug: string; categoryId: string; title: LocalizedText; summary: LocalizedText; body: DocsBody; order: number; updatedAt: string; sourceRevision: string };
export type PublishedDoc = PublicDoc;
export type DocsManifest = { schemaVersion: 1; publicationId: string; publishedAt: string; categories: DocsCategory[]; documents: PublicDoc[] };
export type DocsMarkdownImage = { url: string; start: number; end: number };
/** Owned by one request; never retain private Markdown in a module-level cache. */
export type DocsImageCache = Map<string, DocsMarkdownImage[]>;

/** Empty translation fields are drafts, so readers fall back to available text. */
export function docsLocalizedText(value: LocalizedText | undefined, language: string): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  for (const locale of [language.split('-')[0], ...DOCS_LOCALES]) {
    const text = value[locale as keyof typeof value];
    if (typeof text === 'string' && text.trim()) return text;
  }
  return '';
}

export const docsId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value);
export const docsSlug = (value: unknown): value is string => typeof value === 'string' && value.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
export const docsRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export const docsKeys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
export const docsDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
export function docsText(value: unknown, max: number, required = false): value is LocalizedText {
  const texts = typeof value === 'string' ? [value] : docsRecord(value) && docsKeys(value, [...DOCS_LOCALES]) ? Object.values(value) : null;
  return !!texts && texts.every(text => typeof text === 'string' && text.length <= max) && (!required || texts.some(text => typeof text === 'string' && text.trim()));
}
export function docsBody(value: unknown): value is DocsBody {
  return docsRecord(value) && docsKeys(value, [...DOCS_LOCALES]) && Object.values(value).every(text => typeof text === 'string' && text.length <= 120000);
}
export function docsCategory(value: unknown): value is DocsCategory {
  return docsRecord(value) && docsKeys(value, ['id', 'slug', 'title', 'summary', 'order', 'workSlug']) && docsId(value.id) && docsSlug(value.slug) && docsText(value.title, 160, true) && docsText(value.summary, 600) && Number.isSafeInteger(value.order) && Math.abs(value.order as number) <= 100000 && (value.workSlug === undefined || docsSlug(value.workSlug));
}
/** Source offsets for actual Markdown image destinations; code examples stay literal. */
export function docsMarkdownImages(source: string, cache?: DocsImageCache): DocsMarkdownImage[] {
  const cached = cache?.get(source); if (cached) return cached;
  const images = findDocsMarkdownImages(source); cache?.set(source, images); return images;
}
function findDocsMarkdownImages(source: string): DocsMarkdownImage[] {
  if (!source.includes('![')) return [];
  // Preserve offsets with string ranges instead of allocating one entry per character.
  const blank = (value: string) => value.replace(/[^\r\n]+/g, part => ' '.repeat(part.length));
  let fence: { character: string; length: number } | undefined;
  let prose = source.split(/(?<=\n)/).map(line => {
    const plain = line.replace(/^(?: {0,3}> ?)+/, '');
    const token = /^ {0,3}(`{3,}|~{3,})(.*)/.exec(plain);
    if (fence) { if (token && token[1][0] === fence.character && token[1].length >= fence.length && !token[2].trim()) fence = undefined; return blank(line); }
    if (token && !(token[1][0] === '`' && token[2].includes('`'))) { fence = { character: token[1][0], length: token[1].length }; return blank(line); }
    return /^(?: {4}|\t)/.test(plain) ? blank(line) : line;
  }).join('');
  const ranges: { start: number; end: number }[] = [];
  const tokens = /\\[\s\S]|`+/g;
  for (let match = tokens.exec(prose); match; match = tokens.exec(prose)) {
    const index = match.index, token = match[0];
    if (token[0] === '\\') { if (token[1] === '!' || token[1] === '`') ranges.push({ start: index, end: index + 2 }); continue; }
    const length = token.length; let end = prose.indexOf(token, index + length);
    while (end >= 0 && (prose[end - 1] === '`' || prose[end + length] === '`')) end = prose.indexOf(token, end + length);
    if (end >= 0) { ranges.push({ start: index, end: end + length }); tokens.lastIndex = end + length; }
  }
  if (ranges.length) {
    const parts: string[] = []; let offset = 0;
    for (const range of ranges) { parts.push(prose.slice(offset, range.start), blank(prose.slice(range.start, range.end))); offset = range.end; }
    parts.push(prose.slice(offset)); prose = parts.join('');
  }
  if (!prose.includes('![')) return [];
  const decode = (value: string) => value.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1').replace(/&#(?:x([a-f\d]+)|(\d+));?/gi, (full, hex, decimal) => { const code = Number.parseInt(hex ?? decimal, hex ? 16 : 10); return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : full; }).replace(/&colon;/gi, ':');
  const output: { url: string; start: number; end: number }[] = [];
  const destination = (match: RegExpMatchArray, value: string) => { const local = match[0].lastIndexOf(value); const start = match.index! + local; output.push({ url: decode(value.startsWith('<') ? value.slice(1, -1) : value), start, end: start + value.length }); };
  for (const match of prose.matchAll(/!\[(?:[^\]\\]|\\.)*\]\(\s*(<[^>\r\n]*>|[^\s)]*)/g)) if (match[1]) destination(match, match[1]);
  const labels = new Set<string>(), normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  for (const match of prose.matchAll(/!\[((?:[^\]\\]|\\.)*)\](?:\[([^\]]*)\])?/g)) if (prose[match.index! + match[0].length] !== '(') labels.add(normalize(match[2] || match[1]));
  for (const match of prose.matchAll(/^ {0,3}\[([^\]]+)\]:[ \t]*(<[^>\r\n]*>|[^\s]+)/gm)) if (labels.has(normalize(match[1]))) destination(match, match[2]);
  const seen = new Set<number>();
  return output.filter(entry => { if (seen.has(entry.start)) return false; seen.add(entry.start); return true; });
}
export function privateDocsImageUrl(value: string): boolean {
  try { const url = new URL(value, 'https://studiofimel.com/'); let path = url.pathname; for (let count = 0; count < 2; count++) path = decodeURIComponent(path); return /(?:^|\/)docs\/uploads\//i.test(path) || /^\/api\/(?:docs|media)(?:\/|$)/i.test(path) || /^(?:fimel-doc-image|fimel-asset):/i.test(value); } catch { return true; }
}
export function parseDocsManifest(value: unknown, cache?: DocsImageCache): DocsManifest {
  if (!docsRecord(value) || !docsKeys(value, ['schemaVersion', 'publicationId', 'publishedAt', 'categories', 'documents']) || value.schemaVersion !== 1 || !docsId(value.publicationId) || !docsDate(value.publishedAt) || !Array.isArray(value.categories) || value.categories.length > 50 || !value.categories.every(docsCategory) || !Array.isArray(value.documents) || value.documents.length > 300) throw new Error('文档目录格式错误。');
  const categories = value.categories as DocsCategory[], ids = new Set<string>(), slugs = new Set<string>();
  if (new Set(categories.map(category => category.id)).size !== categories.length || new Set(categories.map(category => category.slug)).size !== categories.length) throw new Error('文档分类重复。');
  for (const doc of value.documents) {
    if (!docsRecord(doc) || !docsKeys(doc, ['id', 'slug', 'categoryId', 'title', 'summary', 'body', 'order', 'updatedAt', 'sourceRevision']) || !docsId(doc.id) || !docsSlug(doc.slug) || ids.has(doc.id) || slugs.has(doc.slug) || !categories.some(category => category.id === doc.categoryId) || !docsText(doc.title, 160, true) || !docsText(doc.summary, 600) || !docsBody(doc.body) || !Object.values(doc.body).some(text => text?.trim()) || !Number.isSafeInteger(doc.order) || Math.abs(doc.order as number) > 100000 || !docsDate(doc.updatedAt) || typeof doc.sourceRevision !== 'string' || !/^[a-f0-9]{64}$/.test(doc.sourceRevision) || Object.values(doc.body).some(text => docsMarkdownImages(text ?? '', cache).some(image => privateDocsImageUrl(image.url)))) throw new Error('公开文档格式错误。');
    ids.add(doc.id); slugs.add(doc.slug);
  }
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > DOCS_MAX_BYTES) throw new Error('文档目录过大。');
  return value as DocsManifest;
}
