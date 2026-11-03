import { DOCS_MANIFEST_KEY, DOCS_MAX_BYTES, docsId, docsKeys, docsRecord, docsSlug, parseDocsManifest } from '../../src/content/docs';
import type { DocsManifest, PublicDoc } from '../../src/content/docs';
import { DOCS_LIBRARY_KEY, docsImageRefs, docsLibraryErrors, replaceDocsImages, validDocsImage } from '../shared/docs';
import type { DocDraft, DocsExampleSource, DocsLibrary, DocsPreview, DocsState } from '../shared/docs';
import type { Asset } from '../shared/model';
import { PUBLIC_ORIGIN } from '../shared/model';
import type { AuditChange, AuditEvent } from '../shared/audit';
import { stable } from '../shared/revisions';
import { actorKey } from './audit';
import { ApiError, EMPTY_ETAG, expectMatch, json, putJson, readJson } from './http';

type DocsEnv = { PRIVATE: R2Bucket; PUBLIC: R2Bucket; ASSETS: Fetcher };
const MAX_IMAGE = 10 * 1024 * 1024;
const emptyLibrary = (): DocsLibrary => ({ schemaVersion: 1, categories: [], documents: [] });
async function sha256(bytes: BufferSource) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join(''); }
async function boundedBytes(body: ReadableStream<Uint8Array> | null, max: number): Promise<Uint8Array<ArrayBuffer>> {
  if (!body) throw new ApiError(422, '缺少图片正文。');
  const reader = body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  for (;;) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > max) { await reader.cancel(); throw new ApiError(413, '图片不能超过 10 MiB。'); } chunks.push(next.value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; } return bytes;
}
async function storedJson(bucket: R2Bucket, key: string): Promise<{ value: unknown; etag: string; updatedAt: string } | null> {
  const object = await bucket.get(key); if (!object) return null;
  if (object.size > DOCS_MAX_BYTES) { await object.body.cancel(); throw new ApiError(503, '文档存储超过安全上限，请联系维护者。'); }
  try { return { value: await object.json(), etag: object.httpEtag, updatedAt: object.uploaded.toISOString() }; } catch { throw new ApiError(503, '文档存储格式错误，未修改现有数据。'); }
}
async function state(env: DocsEnv): Promise<DocsState> {
  const [draft, visible] = await Promise.all([storedJson(env.PRIVATE, DOCS_LIBRARY_KEY), storedJson(env.PUBLIC, DOCS_MANIFEST_KEY)]);
  const library = draft?.value ?? emptyLibrary();
  if (docsLibraryErrors(library).length) throw new ApiError(503, '私有文档库校验失败，未修改现有数据。');
  let published: DocsManifest | null = null;
  try { if (visible) published = parseDocsManifest(visible.value); } catch { throw new ApiError(503, '公开文档目录校验失败，未修改现有数据。'); }
  return { library: library as DocsLibrary, published, etag: draft?.etag ?? EMPTY_ETAG, publicEtag: visible?.etag ?? EMPTY_ETAG, updatedAt: draft?.updatedAt ?? null };
}
function checkedLibrary(value: unknown): DocsLibrary { const errors = docsLibraryErrors(value); if (errors.length) throw new ApiError(422, errors.join('\n')); return value as DocsLibrary; }
function transition(before: DocsLibrary, after: DocsLibrary) {
  for (const old of before.documents) { const doc = after.documents.find(doc => doc.id === old.id); if (!doc) throw new ApiError(422, '删除文档请使用归档，历史文档可以恢复。'); if (doc.slug !== old.slug || doc.createdAt !== old.createdAt) throw new ApiError(422, '已保存文档的编号、slug 和创建日期保持固定。'); }
  for (const old of before.categories) { const category = after.categories.find(category => category.id === old.id); if (category && category.slug !== old.slug) throw new ApiError(422, '已保存分类的 slug 保持固定。'); }
}
async function verifyAsset(bucket: R2Bucket, docId: string, asset: Asset, body: true): Promise<R2ObjectBody>;
async function verifyAsset(bucket: R2Bucket, docId: string, asset: Asset, body?: false): Promise<R2Object>;
async function verifyAsset(bucket: R2Bucket, docId: string, asset: Asset, body = false): Promise<R2Object | R2ObjectBody> {
  if (!validDocsImage(asset, docId)) throw new ApiError(422, '文档图片归属无效。');
  const object = body ? await bucket.get(asset.privateKey!) : await bucket.head(asset.privateKey!);
  if (!object || object.size !== asset.size || object.customMetadata?.docId !== docId || object.customMetadata.assetId !== asset.id || object.customMetadata.sha256 !== asset.sha256 || object.httpMetadata?.contentType !== asset.mime) throw new ApiError(422, '图片尚未验证或不属于当前文档。');
  return object;
}
async function validateNewAssets(bucket: R2Bucket, before: DocsLibrary, after: DocsLibrary) {
  for (const doc of after.documents) for (const asset of doc.images) { const old = before.documents.find(item => item.id === doc.id)?.images.find(item => item.id === asset.id); if (old && stable(old) !== stable(asset)) throw new ApiError(422, '已上传图片信息保持固定，请重新上传图片。'); if (!old) await verifyAsset(bucket, doc.id, asset); }
}
async function backupDocs(bucket: R2Bucket, value: DocsLibrary | DocsManifest | null, kind: 'docs' | 'docs-public') { const id = crypto.randomUUID(); await putJson(bucket, `backups/${kind}/${id}.json`, { id, kind, time: new Date().toISOString(), value }); }
function summarizeChanges(before: DocsLibrary, after: DocsLibrary): AuditChange[] {
  const changes: AuditChange[] = [];
  for (const doc of after.documents) { const old = before.documents.find(item => item.id === doc.id); if (stable(old) === stable(doc)) continue; changes.push({ workId: doc.id, slug: doc.slug, title: typeof doc.title === 'string' ? doc.title : doc.title.zh ?? doc.title.en ?? doc.title.ja ?? doc.slug, action: old ? 'updated' : 'created', fields: [{ name: '文档名称', before: old ? JSON.stringify(old.title).slice(0, 180) : '未创建', after: JSON.stringify(doc.title).slice(0, 180) }, { name: '文档状态', before: old?.workflow ?? '未创建', after: doc.workflow }, { name: '所属分类', before: old?.categoryId ?? '未创建', after: doc.categoryId }, { name: '正文', before: old ? `${Object.values(old.body).join('').length} 字符` : '未创建', after: `${Object.values(doc.body).join('').length} 字符（内容与元数据已保存）` }] }); }
  if (stable(before.categories) !== stable(after.categories)) changes.push({ workId: 'docs-categories', slug: 'docs-categories', title: '文档分类', action: 'updated', fields: [{ name: '分类与顺序', before: `${before.categories.length} 个分类`, after: `${after.categories.length} 个分类（含合并、移动或重命名）` }] });
  return changes.slice(0, 301);
}
async function audited(env: DocsEnv, email: string, operation: string, run: (changes: AuditChange[]) => Promise<Response>) {
  const time = new Date().toISOString(), id = crypto.randomUUID(), changes: AuditChange[] = [];
  const key = `audit/${time.slice(0, 10)}/${time.replaceAll(':', '-')}-${id}.json`;
  const event: AuditEvent = { schemaVersion: 2, id, actorId: await actorKey(email), operation, time, status: 'prepared', changes };
  const stored = await putJson(env.PRIVATE, key, event);
  const finish = async (status: AuditEvent['status'], httpStatus: number, afterEtag?: string) => { try { await putJson(env.PRIVATE, key, { ...event, status, httpStatus, finishedAt: new Date().toISOString(), ...(afterEtag ? { afterEtag } : {}) }, stored.httpEtag); return true; } catch { console.error(JSON.stringify({ operation: 'docs-audit-finalize-failed', requestId: id })); return false; } };
  try { const response = await run(changes); if (!await finish(response.ok ? 'success' : 'failed', response.status, response.headers.get('etag') ?? undefined)) response.headers.set('X-Fimel-Audit-Pending', '1'); return response; }
  catch (error) { await finish('failed', error instanceof ApiError ? error.status : 503); throw error; }
}
async function save(request: Request, env: DocsEnv, changes: AuditChange[]) {
  const current = await state(env); expectMatch(request, current.etag);
  const input = await readJson(request, DOCS_MAX_BYTES);
  if (!docsRecord(input) || !docsKeys(input, ['library'])) throw new ApiError(422, '需要文档草稿库。');
  const library = checkedLibrary(input.library); transition(current.library, library);
  await validateNewAssets(env.PRIVATE, current.library, library);
  const now = new Date().toISOString();
  for (const doc of library.documents) { const old = current.library.documents.find(item => item.id === doc.id); doc.updatedAt = !old || stable({ ...old, updatedAt: '' }) !== stable({ ...doc, updatedAt: '' }) ? now : old.updatedAt; }
  checkedLibrary(library); changes.push(...summarizeChanges(current.library, library));
  await backupDocs(env.PRIVATE, current.library, 'docs');
  const written = await putJson(env.PRIVATE, DOCS_LIBRARY_KEY, library, current.etag);
  return json({ ...current, library, updatedAt: now }, 200, written.httpEtag);
}
export async function docsSourceRevision(doc: DocDraft) { const { id, slug, categoryId, title, summary, body, order } = doc; return sha256(new TextEncoder().encode(stable({ id, slug, categoryId, title, summary, body, order, images: doc.images.filter(asset => docsImageRefs(doc.body).has(asset.id)) }))); }
async function preview(current: DocsState): Promise<DocsPreview> {
  const ready = current.library.documents.filter(doc => doc.workflow === 'ready');
  const ordered = (categories: DocsLibrary['categories']) => [...categories].sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
  const result: DocsPreview = { added: [], changed: [], removed: [], categoriesChanged: stable(ordered(current.library.categories)) !== stable(ordered(current.published?.categories ?? [])) };
  for (const doc of ready) { const entry = { id: doc.id, slug: doc.slug, title: doc.title }, old = current.published?.documents.find(item => item.id === doc.id); if (!old) result.added.push(entry); else if (old.sourceRevision !== await docsSourceRevision(doc)) result.changed.push(entry); }
  for (const old of current.published?.documents ?? []) if (!ready.some(doc => doc.id === old.id)) result.removed.push({ id: old.id, slug: old.slug, title: old.title });
  return result;
}
async function publication(request: Request, env: DocsEnv, onlyPreview: boolean, changes: AuditChange[]) {
  const current = await state(env); expectMatch(request, current.etag); expectMatch(request, current.publicEtag, 'x-public-etag');
  const diff = await preview(current); if (onlyPreview) return json(diff);
  const input = await readJson(request, 1024); if (!docsRecord(input) || Object.keys(input).length) throw new ApiError(422, '发布请求格式不正确。');
  const publicationId = crypto.randomUUID(), publishedAt = new Date().toISOString(), documents: PublicDoc[] = [];
  for (const doc of current.library.documents.filter(item => item.workflow === 'ready')) {
    const urls = new Map<string, string>();
    for (const id of docsImageRefs(doc.body)) {
      const asset = doc.images.find(item => item.id === id)!; const source = await verifyAsset(env.PRIVATE, doc.id, asset, true);
      if (!('body' in source)) throw new ApiError(422, '图片不存在。');
      const key = `docs/images/${doc.slug}/${asset.id}/${asset.name}`, existing = await env.PUBLIC.head(key);
      if (existing) { await source.body.cancel(); if (existing.size !== asset.size || existing.customMetadata?.sha256 !== asset.sha256 || existing.customMetadata?.docId !== doc.id || existing.customMetadata?.assetId !== asset.id || existing.httpMetadata?.contentType !== asset.mime) throw new ApiError(409, '公开图片已存在且校验信息不同，禁止覆盖。'); }
      else { const saved = await env.PUBLIC.put(key, source.body, { sha256: asset.sha256, onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: asset.mime, cacheControl: 'public, max-age=31536000, immutable' }, customMetadata: { docId: doc.id, assetId: asset.id, sha256: asset.sha256 } }); if (!saved) throw new ApiError(409, '发布图片发生版本冲突，未覆盖。'); }
      urls.set(id, `${PUBLIC_ORIGIN}/${key}`);
    }
    documents.push({ id: doc.id, slug: doc.slug, categoryId: doc.categoryId, title: doc.title, summary: doc.summary, body: replaceDocsImages(doc.body, urls), order: doc.order, updatedAt: doc.updatedAt, sourceRevision: await docsSourceRevision(doc) });
  }
  documents.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
  const manifest: DocsManifest = { schemaVersion: 1, publicationId, publishedAt, categories: [...current.library.categories].sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug)), documents };
  try { parseDocsManifest(manifest); } catch { throw new ApiError(422, '公开文档目录过大或仍有私有图片标记，请检查文档。'); }
  changes.push(...[...diff.added.map(doc => ({ ...doc, action: 'created' as const })), ...diff.changed.map(doc => ({ ...doc, action: 'updated' as const })), ...diff.removed.map(doc => ({ ...doc, action: 'removed' as const }))].map(doc => ({ workId: doc.id, slug: doc.slug, title: typeof doc.title === 'string' ? doc.title : doc.title.zh ?? doc.title.en ?? doc.title.ja ?? doc.slug, action: doc.action, fields: [{ name: '公开文档', before: '前一公开版本', after: doc.action === 'removed' ? '本次下架' : '本次发布' }] })));
  if (diff.categoriesChanged) changes.push({ workId: 'docs-categories', slug: 'docs-categories', title: '文档分类', action: 'updated', fields: [{ name: '公开分类', before: `${current.published?.categories.length ?? 0} 个分类`, after: `${manifest.categories.length} 个分类（含名称、顺序或归并修改）` }] });
  await backupDocs(env.PRIVATE, current.published, 'docs-public');
  await putJson(env.PRIVATE, `snapshots/docs/${publicationId}.json`, manifest);
  await putJson(env.PUBLIC, `data/docs-snapshots/${publicationId}.json`, manifest);
  const latest = await env.PRIVATE.head(DOCS_LIBRARY_KEY);
  if ((latest?.httpEtag ?? EMPTY_ETAG) !== current.etag) throw new ApiError(409, '发布期间文档草稿已被修改，请重新预览后重试。');
  const committed = await putJson(env.PUBLIC, DOCS_MANIFEST_KEY, manifest, current.publicEtag);
  return json({ published: true, publicationId }, 200, committed.httpEtag);
}
function imageType(bytes: Uint8Array) {
  if (bytes.length >= 24 && bytes.slice(0, 8).every((byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index])) return { mime: 'image/png', extension: 'png' };
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { mime: 'image/jpeg', extension: 'jpg' };
  if (bytes.length >= 16 && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP') return { mime: 'image/webp', extension: 'webp' };
  throw new ApiError(422, '只接受有正确文件签名的 PNG、JPEG 或 WebP 图片。');
}
async function storeImage(env: DocsEnv, docId: string, name: string, bytes: Uint8Array<ArrayBuffer>, declaredMime: string, expectedHash: string): Promise<Asset> {
  if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE) throw new ApiError(413, '图片大小必须为 1 字节至 10 MiB。');
  const detected = imageType(bytes); if (detected.mime !== declaredMime) throw new ApiError(422, '图片类型与文件签名不一致。');
  if (!/^[a-f0-9]{64}$/.test(expectedHash) || await sha256(bytes) !== expectedHash) throw new ApiError(422, '图片 SHA-256 校验失败。');
  const id = crypto.randomUUID(), fileName = `${id}.${detected.extension}`, key = `docs/uploads/${docId}/${id}/${fileName}`;
  const asset: Asset = { id, name: fileName, displayName: name, size: bytes.byteLength, mime: detected.mime, sha256: expectedHash, privateKey: key };
  const saved = await env.PRIVATE.put(key, bytes, { sha256: expectedHash, onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: detected.mime, cacheControl: 'no-store' }, customMetadata: { docId, assetId: id, sha256: expectedHash } });
  if (!saved) throw new ApiError(409, '图片编号冲突，请重试。'); return asset;
}
async function upload(request: Request, env: DocsEnv, docId: string, changes: AuditChange[]) {
  const current = await state(env), doc = current.library.documents.find(item => item.id === docId); if (!doc || doc.workflow === 'archived') throw new ApiError(422, '请先保存文档草稿，归档文档请先恢复。');
  if (doc.images.length >= 40) throw new ApiError(422, '每篇文档最多 40 张图片。');
  let name: string; try { name = decodeURIComponent(request.headers.get('x-file-name') ?? ''); } catch { throw new ApiError(422, '图片名称编码错误。'); }
  if (!name.trim() || name.length > 200 || [...name].some(character => character.charCodeAt(0) < 32) || name.includes('/') || name.includes('\\')) throw new ApiError(422, '图片名称不正确。');
  const asset = await storeImage(env, docId, name, await boundedBytes(request.body, MAX_IMAGE), request.headers.get('content-type')?.split(';')[0] ?? '', request.headers.get('x-image-sha256') ?? '');
  changes.push({ workId: doc.id, slug: doc.slug, title: typeof doc.title === 'string' ? doc.title : doc.title.zh ?? doc.slug, action: 'updated', fields: [{ name: '上传文档图片', before: '未上传', after: `${asset.displayName}（${asset.size} 字节，私有）` }] }); return json({ asset });
}
async function media(env: DocsEnv, docId: string, assetId: string, name: string) {
  if (!docsId(docId) || !docsId(assetId) || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(name)) throw new ApiError(404, '文档图片不存在。');
  const current = await state(env); if (!current.library.documents.some(doc => doc.id === docId)) throw new ApiError(404, '文档不存在。');
  const object = await env.PRIVATE.get(`docs/uploads/${docId}/${assetId}/${name}`);
  if (!object || object.size > MAX_IMAGE || object.customMetadata?.docId !== docId || object.customMetadata?.assetId !== assetId || !/^[a-f0-9]{64}$/.test(object.customMetadata?.sha256 ?? '') || !['image/png', 'image/jpeg', 'image/webp'].includes(object.httpMetadata?.contentType ?? '')) throw new ApiError(404, '图片归属或验证信息不正确。');
  return new Response(object.body, { headers: { 'Content-Type': object.httpMetadata!.contentType!, 'Cache-Control': 'no-store' } });
}
async function example(request: Request, env: DocsEnv): Promise<DocsExampleSource> {
  const response = await env.ASSETS.fetch(new Request(new URL('/migration/docs-example/docs-example.json', request.url)));
  if (!response.ok) throw new ApiError(503, '游戏规则示例尚未构建。');
  const input = await readJson({ headers: new Headers({ 'Content-Type': 'application/json' }), body: response.body }, DOCS_MAX_BYTES);
  if (!docsRecord(input) || !docsKeys(input, ['schemaVersion', 'category', 'documents']) || input.schemaVersion !== 1 || !Array.isArray(input.documents)) throw new ApiError(503, '示例清单格式错误。');
  const value = input as DocsExampleSource;
  const candidate: DocsLibrary = { schemaVersion: 1, categories: [value.category], documents: value.documents.map(doc => ({ ...doc, categoryId: value.category?.id, workflow: 'draft', createdAt: '2026-11-03T00:00:00.000Z', updatedAt: '2026-11-03T00:00:00.000Z', images: doc.images.map(asset => ({ id: asset.id, name: asset.name, ...(asset.displayName ? { displayName: asset.displayName } : {}), size: asset.size, mime: asset.mime, sha256: asset.sha256, privateKey: `docs/uploads/${doc.id}/${asset.id}/${asset.name}` })) })) };
  if (docsLibraryErrors(candidate).length || value.documents.some(doc => doc.images.some(asset => !/^\/migration\/docs-example\/images\/[a-zA-Z0-9/_.-]+$/.test(asset.url) || asset.url.split('/').includes('..')))) throw new ApiError(503, '示例清单校验失败。');
  return value;
}
async function importExample(request: Request, env: DocsEnv, slug: string, changes: AuditChange[]) {
  if (!docsSlug(slug)) throw new ApiError(422, '示例 slug 无效。');
  const current = await state(env); expectMatch(request, current.etag);
  if (current.library.documents.some(doc => doc.slug === slug)) throw new ApiError(409, '该游戏规则已存在，已拒绝覆盖；请选择下一篇。');
  const source = await example(request, env), sourceDoc = source.documents.find(doc => doc.slug === slug); if (!sourceDoc) throw new ApiError(404, '示例文档不存在。');
  const library = structuredClone(current.library), category = library.categories.find(item => item.slug === source.category.slug);
  if (!category) { if (library.categories.some(item => item.id === source.category.id)) throw new ApiError(409, '示例分类编号已被其他分类使用。'); library.categories.push(source.category); }
  const id = crypto.randomUUID(), now = new Date().toISOString(), urls = new Map<string, string>(), images: Asset[] = [];
  for (const image of sourceDoc.images) { const response = await env.ASSETS.fetch(new Request(new URL(image.url, request.url))); if (!response.ok) throw new ApiError(503, '示例图片缺失，当前文档尚未导入。'); const bytes = await boundedBytes(response.body, MAX_IMAGE); if (bytes.byteLength !== image.size) throw new ApiError(503, '示例图片大小校验失败。'); const asset = await storeImage(env, id, image.displayName ?? image.name, bytes, image.mime, image.sha256); images.push(asset); urls.set(image.id, `fimel-doc-image:${asset.id}`); }
  library.documents.push({ id, slug, categoryId: category?.id ?? source.category.id, title: sourceDoc.title, summary: sourceDoc.summary, body: replaceDocsImages(sourceDoc.body, urls), order: sourceDoc.order, workflow: 'draft', images, createdAt: now, updatedAt: now });
  checkedLibrary(library); changes.push(...summarizeChanges(current.library, library));
  await backupDocs(env.PRIVATE, current.library, 'docs'); const saved = await putJson(env.PRIVATE, DOCS_LIBRARY_KEY, library, current.etag);
  return json({ ...current, library, updatedAt: now }, 200, saved.httpEtag);
}
export async function docsRoute(request: Request, env: DocsEnv, segments: string[], email: string): Promise<Response> {
  const method = request.method;
  if (!segments.length && method === 'GET') { const current = await state(env); return json(current, 200, current.etag); }
  if (!segments.length && method === 'PUT') return audited(env, email, 'save-docs', changes => save(request, env, changes));
  if (segments.length === 1 && ['preview', 'publish'].includes(segments[0]) && method === 'POST') return segments[0] === 'preview' ? publication(request, env, true, []) : audited(env, email, 'publish-docs', changes => publication(request, env, false, changes));
  if (segments.length === 2 && segments[0] === 'images' && docsId(segments[1]) && method === 'POST') return audited(env, email, 'upload-docs-image', changes => upload(request, env, segments[1], changes));
  if (segments.length === 4 && segments[0] === 'media' && method === 'GET') return media(env, segments[1], segments[2], segments[3]);
  if (segments.length === 1 && segments[0] === 'example' && method === 'GET') return json(await example(request, env));
  if (segments.length === 2 && segments[0] === 'import-example' && method === 'POST') return audited(env, email, 'import-docs-example', changes => importExample(request, env, segments[1], changes));
  throw new ApiError(405, '文档接口路径或请求方法不支持。');
}
