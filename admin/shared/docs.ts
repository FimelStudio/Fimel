import type { Asset } from './model';
import type { DocsBody, DocsCategory, DocsManifest, DocsImageCache } from '../../src/content/docs';
import { DOCS_MAX_BYTES, docsBody, docsCategory, docsCategoryMember, docsDate, docsId, docsKeys, docsMarkdownImages, docsRecord, docsSlug, docsText, privateDocsImageUrl } from '../../src/content/docs';
export type { DocsBody, DocsCategory, DocsManifest, PublicDoc } from '../../src/content/docs';
/** categoryId === '' is an independent root document, without a synthetic category. */
export type DocDraft = { id: string; slug: string; categoryId: string; title: import('../../src/content/projects').LocalizedText; summary: import('../../src/content/projects').LocalizedText; body: DocsBody; order: number; workflow: 'draft' | 'ready' | 'archived'; images: Asset[]; createdAt: string; updatedAt: string };
export type DocsLibrary = { schemaVersion: 1; categories: DocsCategory[]; documents: DocDraft[] };
export type DocsState = { library: DocsLibrary; published: DocsManifest | null; publicEtag: string; updatedAt: string | null; etag: string };
export type DocsPreviewEntry = Pick<DocDraft, 'id' | 'slug' | 'title'>;
export type DocsPreview = { added: DocsPreviewEntry[]; changed: DocsPreviewEntry[]; removed: DocsPreviewEntry[]; categoriesChanged: boolean };
export type DocsExampleImage = Omit<Asset, 'privateKey' | 'publicUrl' | 'primary'> & { url: string };
export type DocsExampleDocument = Pick<DocDraft, 'id' | 'slug' | 'title' | 'summary' | 'body' | 'order'> & { images: DocsExampleImage[] };
export type DocsExampleSource = { schemaVersion: 1; category: DocsCategory; documents: DocsExampleDocument[] };
export type DocsExample = DocsExampleSource;
export const DOCS_LIBRARY_KEY = 'state/docs.json';
export function makeDoc(categoryId: string, order = 0): DocDraft { const now = new Date().toISOString(); return { id: crypto.randomUUID(), slug: '', categoryId, title: { zh: '' }, summary: { zh: '' }, body: { zh: '' }, order, workflow: 'draft', images: [], createdAt: now, updatedAt: now }; }
export function makeDocsCategory(order = 0): DocsCategory { return { id: crypto.randomUUID(), slug: '', title: { zh: '' }, summary: { zh: '' }, order }; }
export function docsImageRefs(body: DocsBody, cache?: DocsImageCache): Set<string> { const refs = new Set<string>(); for (const text of Object.values(body)) for (const image of docsMarkdownImages(text ?? '', cache)) if (image.url.startsWith('fimel-doc-image:')) refs.add(image.url.slice(16)); return refs; }
export function replaceDocsImages(body: DocsBody, urls: Map<string, string>, cache?: DocsImageCache): DocsBody { return Object.fromEntries(Object.entries(body).map(([locale, text]) => { let result = text; for (const image of [...docsMarkdownImages(text, cache)].sort((a, b) => b.start - a.start)) if (image.url.startsWith('fimel-doc-image:')) { const replacement = urls.get(image.url.slice(16)); if (replacement) result = result.slice(0, image.start) + replacement + result.slice(image.end); } return [locale, result]; })); }
export function validDocsImage(asset: unknown, docId: string): asset is Asset { return docsRecord(asset) && docsKeys(asset, ['id', 'name', 'displayName', 'size', 'mime', 'sha256', 'privateKey']) && docsId(asset.id) && typeof asset.name === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(asset.name) && (asset.displayName === undefined || typeof asset.displayName === 'string' && asset.displayName.length <= 200) && Number.isSafeInteger(asset.size) && (asset.size as number) > 0 && (asset.size as number) <= 10 * 1024 * 1024 && ['image/png', 'image/jpeg', 'image/webp'].includes(asset.mime as string) && typeof asset.sha256 === 'string' && /^[a-f0-9]{64}$/.test(asset.sha256) && asset.privateKey === `docs/uploads/${docId}/${asset.id}/${asset.name}`; }
export function docsLibraryErrors(value: unknown, cache?: DocsImageCache): string[] {
  if (!docsRecord(value) || !docsKeys(value, ['schemaVersion', 'categories', 'documents']) || value.schemaVersion !== 1 || !Array.isArray(value.categories) || value.categories.length > 50 || !value.categories.every(docsCategory) || !Array.isArray(value.documents) || value.documents.length > 300) return ['文档库格式错误：最多 50 个分类、300 篇文档。'];
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > DOCS_MAX_BYTES) return ['文档库不能超过 4 MiB。'];
  const categories = value.categories as DocsCategory[], ids = new Set<string>(), slugs = new Set<string>(), assets = new Set<string>();
  if (new Set(categories.map(category => category.id)).size !== categories.length || new Set(categories.map(category => category.slug)).size !== categories.length) return ['分类编号或 slug 重复。'];
  for (const doc of value.documents) {
    if (!docsRecord(doc) || !docsKeys(doc, ['id', 'slug', 'categoryId', 'title', 'summary', 'body', 'order', 'workflow', 'images', 'createdAt', 'updatedAt']) || !docsId(doc.id) || !docsSlug(doc.slug) || ids.has(doc.id) || slugs.has(doc.slug) || !docsCategoryMember(doc.categoryId, categories) || !docsText(doc.title, 160, true) || !docsText(doc.summary, 600) || !docsBody(doc.body) || !Number.isSafeInteger(doc.order) || Math.abs(doc.order as number) > 100000 || !['draft', 'ready', 'archived'].includes(doc.workflow as string) || !Array.isArray(doc.images) || doc.images.length > 40 || !doc.images.every(asset => validDocsImage(asset, doc.id as string)) || !docsDate(doc.createdAt) || !docsDate(doc.updatedAt)) return ['文档字段不合法，请检查名称、稳定 slug、分类、正文长度和图片。'];
    if (doc.workflow === 'ready' && !Object.values(doc.body).some(text => text?.trim())) return ['待发布文档至少需要一种语言正文。'];
    const refs = new Set<string>();
    for (const text of Object.values(doc.body)) for (const image of docsMarkdownImages(text ?? '', cache)) {
      if (image.url.startsWith('fimel-doc-image:')) { const id = image.url.slice(16); if (!docsId(id)) return ['文档图片不能引用作品私有资源或私有接口。']; refs.add(id); }
      else if (privateDocsImageUrl(image.url)) return ['文档图片不能引用作品私有资源或私有接口。'];
    }
    for (const asset of doc.images as Asset[]) { if (assets.has(asset.id)) return ['图片必须独立属于一篇文档。']; assets.add(asset.id); }
    for (const id of refs) if (!(doc.images as Asset[]).some(asset => asset.id === id)) return ['正文引用了不属于当前文档的图片。'];
    ids.add(doc.id); slugs.add(doc.slug);
  }
  return [];
}
export const validateDocsLibrary = docsLibraryErrors;
