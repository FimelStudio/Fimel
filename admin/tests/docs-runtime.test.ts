import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { DOCS_LIBRARY_KEY, makeDoc, makeDocsCategory } from '../shared/docs';
import type { DocsExampleSource, DocsLibrary, DocsPreview, DocsState } from '../shared/docs';
import { DOCS_MANIFEST_KEY, parseDocsManifest } from '../../src/content/docs';
import type { Asset } from '../shared/model';
import type { AuditEvent } from '../shared/audit';

let runtime: Miniflare;
const origin = 'http://127.0.0.1:5174';
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1sAAAAASUVORK5CYII=', 'base64'));
const hash = async (bytes: Uint8Array<ArrayBuffer>) => Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex');
before(async () => {
  const bundle = await build({ stdin: { contents: `import local from './admin/worker/local';
    export default { async fetch(request,env,ctx) {
      const fail=request.headers.get('x-test-docs-fail');
      const privateBucket=new Proxy(env.PRIVATE,{get(bucket,key){
        if(key==='put')return (name,value,options)=>{if(name.startsWith('audit/')&&(fail==='audit-prepare'||fail==='audit-finish'&&options?.onlyIf?.etagMatches))throw Error('Injected audit failure');return bucket.put(name,value,options);};
        const value=Reflect.get(bucket,key);return typeof value==='function'?value.bind(bucket):value;
      }});
      let imageHeads=0;
      const publicBucket=new Proxy(env.PUBLIC,{get(bucket,key){
        if(key==='head')return (name,...args)=>{if(name.startsWith('docs/images/'))imageHeads++;return bucket.head(name,...args);};
        if(key==='put')return async(name,value,options)=>{
          if(fail==='image'&&name.startsWith('docs/images/')||fail==='snapshot'&&name.startsWith('data/docs-snapshots/')||fail==='commit'&&name==='data/docs.json')throw Error('Injected publication failure');
          if(fail==='draft-race'&&name.startsWith('data/docs-snapshots/')){const stored=await env.PRIVATE.get('state/docs.json');const library=await stored.json();library.documents[0].body.zh+='\\n竞态新草稿';await env.PRIVATE.put('state/docs.json',JSON.stringify(library));}
          if(fail==='public-race'&&name==='data/docs.json'){const winner=JSON.parse(value);winner.publicationId='competing-publisher';await bucket.put(name,JSON.stringify(winner));}
          return bucket.put(name,value,options);
        };
        const value=Reflect.get(bucket,key);return typeof value==='function'?value.bind(bucket):value;
      }});
      const assets={async fetch(request){const object=await env.PRIVATE.get('test-assets'+new URL(request.url).pathname);return object?new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream'}}):new Response('missing',{status:404});}};
      const response=await local.fetch(request,{...env,PRIVATE:privateBucket,PUBLIC:publicBucket,ASSETS:assets},ctx);response.headers.set('X-Test-Image-Heads',String(imageHeads));return response;
    }};`, resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'browser' });
  runtime = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-10-14', r2Buckets: ['PRIVATE', 'PUBLIC'], bindings: { ADMIN_ORIGIN: origin, ACCESS_AUD: 'local-test', ACCESS_ISSUER: 'https://local.invalid', ADMIN_EMAILS: 'local-admin@example.invalid' } })); await runtime.ready;
});
after(async () => { await runtime?.dispose(); });
beforeEach(async () => { for (const name of ['PRIVATE', 'PUBLIC']) { const bucket = await runtime.getR2Bucket(name), keys = await bucket.list(); if (keys.objects.length) await bucket.delete(keys.objects.map(object => object.key)); } });
const request = (path = '', method = 'GET', body?: unknown, headers: Record<string, string> = {}) => runtime.dispatchFetch(`http://127.0.0.1/api/docs${path ? '/' + path : ''}`, { method, headers: { Origin: origin, 'X-Fimel-CSRF': '1', 'Content-Type': 'application/json', Connection: 'close', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
async function getState() { const response = await request(); assert.equal(response.status, 200, await response.clone().text()); return response.json() as Promise<DocsState>; }
const save = (library: DocsLibrary, etag: string, extra: Record<string, string> = {}) => request('', 'PUT', { library }, { 'If-Match': etag, ...extra });
const publish = (state: DocsState, extra: Record<string, string> = {}) => request('publish', 'POST', {}, { 'If-Match': state.etag, 'X-Public-ETag': state.publicEtag, ...extra });
const preview = (state: DocsState) => request('preview', 'POST', {}, { 'If-Match': state.etag, 'X-Public-ETag': state.publicEtag });
function fixture(): DocsLibrary { const category = { ...makeDocsCategory(), slug: 'fimel-card', title: { zh: 'Fimel Card' } }; const doc = { ...makeDoc(category.id), slug: 'game-rules', title: { zh: '游戏规则' }, body: { zh: '# 游戏规则\n\n尚未公开的正文' } }; return { schemaVersion: 1, categories: [category], documents: [doc] }; }
async function seed() { const library = fixture(); const response = await save(library, (await getState()).etag); assert.equal(response.status, 200, await response.clone().text()); return response.json() as Promise<DocsState>; }
async function events() { const bucket = await runtime.getR2Bucket('PRIVATE'); return Promise.all((await bucket.list({ prefix: 'audit/' })).objects.map(async object => (await (await bucket.get(object.key))!.json()) as AuditEvent)); }
async function upload(state: DocsState, docIndex = 0, extra: Record<string, string> = {}, bytes = png) { return runtime.dispatchFetch(`http://127.0.0.1/api/docs/images/${state.library.documents[docIndex].id}`, { method: 'POST', headers: { Origin: origin, 'X-Fimel-CSRF': '1', 'Content-Type': 'image/png', 'X-File-Name': encodeURIComponent('游戏说明.png'), 'X-Image-SHA256': await hash(bytes), Connection: 'close', ...extra }, body: bytes }); }

test('真实Admin身份/CSRF入口保护所有文档与示例，空库不创建公开内容，错误条件拒绝', async () => {
  for (const path of ['', 'example', 'media/other/asset/name.png']) assert.equal((await request(path, 'GET', undefined, { 'x-local-test-anonymous': '1' })).status, 401);
  const state = await getState(); assert.equal(state.etag, '"empty"'); assert.equal(state.publicEtag, '"empty"'); assert.equal(state.published, null);
  assert.equal((await request('', 'PUT', { library: fixture() }, { Origin: 'https://evil.invalid', 'If-Match': state.etag })).status, 403);
  assert.equal((await request('', 'PUT', { library: fixture() }, { 'X-Fimel-CSRF': '', 'If-Match': state.etag })).status, 403);
  assert.equal((await request('', 'PUT', { library: fixture() })).status, 428);
  assert.equal((await save(fixture(), '"stale"')).status, 409);
  assert.equal(await (await runtime.getR2Bucket('PUBLIC')).get(DOCS_MANIFEST_KEY), null);
});

test('SVG 文档表格从私有上传、归属校验到公开投影保持尺寸与哈希，主动内容拒绝', async () => {
  let state = await seed();
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#00ffff"/></svg>');
  const headers = { 'Content-Type': 'image/svg+xml', 'X-File-Name': encodeURIComponent('游戏图标.svg') };
  for (const text of ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://example.com/icon.svg"/></svg>']) {
    const response = await upload(state, 0, headers, new TextEncoder().encode(text)); assert.equal(response.status, 422);
  }
  assert.equal((await (await runtime.getR2Bucket('PRIVATE')).list({ prefix: 'docs/uploads/' })).objects.length, 0);
  let response = await upload(state, 0, headers, svg); assert.equal(response.status, 200, await response.clone().text());
  const { asset } = await response.json() as { asset: Asset }; assert.equal(asset.mime, 'image/svg+xml'); assert.equal(asset.sha256, await hash(svg));
  const doc = state.library.documents[0]; doc.images.push(asset); doc.workflow = 'ready'; doc.body.zh = `| 图标 | 名称 |\n| --- | --- |\n| <img src="fimel-doc-image:${asset.id}" width="40" height="40" alt="游戏图标"> | 牌类 |`;
  response = await save(state.library, state.etag); assert.equal(response.status, 200, await response.clone().text()); state = await response.json() as DocsState;
  response = await request(`media/${doc.id}/${asset.id}/${asset.name}`); assert.equal(response.headers.get('Content-Type'), 'image/svg+xml'); assert.match(response.headers.get('Content-Security-Policy')!, /sandbox/); assert.deepEqual(new Uint8Array(await response.arrayBuffer()), svg);
  response = await publish(state); assert.equal(response.status, 200, await response.clone().text()); state = await getState();
  const published = state.published!.documents[0].body.zh!; assert.ok(!published.includes('fimel-doc-image:')); assert.match(published, /width="40" height="40"/);
  const image = (await (await runtime.getR2Bucket('PUBLIC')).list({ prefix: 'docs/images/' })).objects[0];
  assert.deepEqual(new Uint8Array(await (await (await runtime.getR2Bucket('PUBLIC')).get(image.key))!.arrayBuffer()), svg);
  const foreign = structuredClone(state.library); foreign.documents[0].images = []; assert.equal((await save(foreign, state.etag)).status, 422);
});

test('多图文档按批准备且仅最终切换正文，断点可重试、并发条件和图片校验保持', async () => {
  let state = await seed(); const library = state.library, first = library.documents[0];
  const second = { ...makeDoc(first.categoryId), slug: 'many-pictures', title: '大量图片', body: { zh: '' }, workflow: 'ready' as const };
  first.workflow = 'ready'; library.documents.push(second);
  const bucket = await runtime.getR2Bucket('PRIVATE'), digest = await hash(png);
  for (let index = 0; index < 250; index++) {
    const doc = index < 125 ? first : second, id = `image-${index}`, name = `${id}.png`, privateKey = `docs/uploads/${doc.id}/${id}/${name}`;
    const asset = { id, name, privateKey, size: png.length, mime: 'image/png', sha256: digest };
    await bucket.put(privateKey, png, { httpMetadata: { contentType: asset.mime }, customMetadata: { docId: doc.id, assetId: id, sha256: digest } });
    doc.images.push(asset); doc.body.zh += `\n![图 ${index}](fimel-doc-image:${id})\n`;
  }
  let response = await save(library, state.etag); assert.equal(response.status, 200, await response.clone().text()); state = await response.json() as DocsState;
  assert.equal((await publish(state)).status, 409); assert.equal(await (await runtime.getR2Bucket('PUBLIC')).get(DOCS_MANIFEST_KEY), null);
  const prepare = (cursor: number, etag = state.etag) => request('prepare', 'POST', { cursor }, { 'If-Match': etag, 'X-Public-ETag': state.publicEtag });
  assert.equal((await prepare(-1)).status, 422); assert.equal((await prepare(251)).status, 422); assert.equal((await prepare(0, '"stale"')).status, 409);
  assert.equal((await prepare(24)).status, 409, '不能跳过前一批');
  response = await prepare(0); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { prepared: 24, total: 250, nextCursor: 24 });
  assert.equal((await (await runtime.getR2Bucket('PUBLIC')).list({ prefix: 'docs/images/' })).objects.length, 24);
  response = await prepare(0); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { prepared: 24, total: 250, nextCursor: 24 }); assert.equal(response.headers.get('X-Test-Image-Heads'), '0', '重试从服务端完成位置继续');
  for (let cursor = 24; cursor < 250; cursor += 24) { response = await prepare(cursor); assert.equal(response.status, 200, await response.clone().text()); }
  assert.equal(await (await runtime.getR2Bucket('PUBLIC')).get(DOCS_MANIFEST_KEY), null);
  response = await publish(state); assert.equal(response.status, 200); assert.equal(response.headers.get('X-Test-Image-Heads'), '0', '最终发布使用绑定双ETag的批次凭证'); state = await getState(); assert.equal(state.published!.documents.length, 2);
  assert.ok(state.published!.documents[1].body.zh?.includes('https://download.studiofimel.com/docs/images/'));
  assert.ok((await events()).some(event => event.operation === 'prepare-docs-images' && event.status === 'success'));
  const visible = await (await (await runtime.getR2Bucket('PUBLIC')).get(DOCS_MANIFEST_KEY))!.text();
  const unchanged = structuredClone(state.published!.documents[1]);
  state.library.documents[0].body.zh += '\n只修改第一篇文字';
  response = await save(state.library, state.etag); state = await response.json() as DocsState;
  response = await prepare(0); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { prepared: 24, total: 125, nextCursor: 24 }, '只检查改动文章的图片');
  assert.equal((await publish(state)).status, 409, '未完成批次不能发布');
  for (let cursor = 24; cursor < 125; cursor += 24) assert.equal((await prepare(cursor)).status, 200);
  const privateBucket = await runtime.getR2Bucket('PRIVATE');
  const preparation = (await privateBucket.list({ prefix: 'state/docs-preparations/' })).objects;
  for (const object of preparation) { const record = await (await privateBucket.get(object.key))!.json() as Record<string, unknown>; if (record.etag === state.etag && record.publicEtag === state.publicEtag) await privateBucket.put(object.key, JSON.stringify({ ...record, expiresAt: '2020-01-01T00:00:00.000Z' })); }
  assert.equal((await publish(state)).status, 409, '过期凭证必须重新准备');
  for (let cursor = 0; cursor < 125; cursor += 24) assert.equal((await prepare(cursor)).status, 200);
  response = await publish(state); assert.equal(response.status, 200); assert.equal(response.headers.get('X-Test-Image-Heads'), '0'); state = await getState(); assert.deepEqual(state.published!.documents[1], unchanged, '未改动文章保留原正文与日期');
  const latestVisible = await (await (await runtime.getR2Bucket('PUBLIC')).get(DOCS_MANIFEST_KEY))!.text(); assert.notEqual(latestVisible, visible);
  state.library.documents[0].body.zh += '\n再次修改'; response = await save(state.library, state.etag); state = await response.json() as DocsState;
  const asset = first.images[0], publicBucket = await runtime.getR2Bucket('PUBLIC');
  await publicBucket.put(`docs/images/${first.slug}/${asset.id}/${asset.name}`, png, { httpMetadata: { contentType: 'image/png' }, customMetadata: { docId: 'wrong-owner', assetId: asset.id, sha256: digest } });
  assert.equal((await request('prepare', 'POST', { cursor: 0 }, { 'If-Match': state.etag, 'X-Public-ETag': state.publicEtag })).status, 409);
  assert.equal((await publish(state)).status, 409); assert.equal(await (await publicBucket.get(DOCS_MANIFEST_KEY))!.text(), latestVisible);
});
test('草稿CRUD、分类重命名/合并/排序、文档归档恢复在单一CAS保存，永久删除和稳定地址修改拒绝', async () => {
  let state = await seed(); const initial = structuredClone(state);
  const category = { ...makeDocsCategory(1), slug: 'tutorials', title: { zh: '教程' } }; state.library.categories.push(category); state.library.documents[0].categoryId = category.id; state.library.documents[0].title = { zh: '重命名游戏规则' }; state.library.categories = [category];
  let response = await save(state.library, state.etag); assert.equal(response.status, 200, await response.clone().text()); state = await response.json() as DocsState;
  assert.equal(state.library.documents[0].title && typeof state.library.documents[0].title === 'object' && state.library.documents[0].title.zh, '重命名游戏规则');
  assert.equal((await save(initial.library, initial.etag)).status, 409);
  const deleted = structuredClone(state.library); deleted.documents = []; assert.equal((await save(deleted, state.etag)).status, 422);
  const renamed = structuredClone(state.library); renamed.documents[0].slug = 'another-name'; assert.equal((await save(renamed, state.etag)).status, 422);
  const nonempty = structuredClone(state.library); nonempty.categories = []; assert.equal((await save(nonempty, state.etag)).status, 422);
  state.library.documents[0].workflow = 'archived'; response = await save(state.library, state.etag); assert.equal(response.status, 200); state = await response.json() as DocsState;
  state.library.documents[0].workflow = 'draft'; response = await save(state.library, state.etag); assert.equal(response.status, 200);
  const bucket = await runtime.getR2Bucket('PRIVATE'); assert.ok((await bucket.list({ prefix: 'backups/docs/' })).objects.length >= 4); assert.ok((await events()).some(event => event.operation === 'save-docs' && event.status === 'success'));
  assert.equal((await (await runtime.getR2Bucket('PUBLIC')).list()).objects.length, 0);
});
test('空分类库可创建修改发布根级独立文档，归档下架恢复均保留编号与地址', async () => {
  const doc = { ...makeDoc(''), slug: 'root-overview', title: '独立指南', body: { zh: '# 独立指南\n\n根目录正文' } };
  const identity = { id: doc.id, slug: doc.slug, createdAt: doc.createdAt };
  let state = await getState(), response = await save({ schemaVersion: 1, categories: [], documents: [doc] }, state.etag);
  assert.equal(response.status, 200, await response.clone().text()); state = await response.json() as DocsState;
  assert.deepEqual(state.library.categories, []); assert.equal(state.library.documents[0].categoryId, '');
  state.library.documents[0].title = '根目录安装指南'; state.library.documents[0].body.zh += '\n修改正文'; state.library.documents[0].workflow = 'ready';
  response = await save(state.library, state.etag); assert.equal(response.status, 200); state = await response.json() as DocsState;
  let diff = await (await preview(state)).json() as DocsPreview;
  assert.deepEqual(diff.added.map(doc => doc.slug), [identity.slug]); assert.deepEqual(diff.changed, []); assert.deepEqual(diff.removed, []); assert.equal(diff.categoriesChanged, false);
  assert.equal((await publish(state)).status, 200); state = await getState();
  assert.deepEqual(state.published!.categories, []); assert.equal(state.published!.documents[0].categoryId, ''); assert.equal(state.published!.documents[0].title, '根目录安装指南');
  state.library.documents[0].workflow = 'archived'; response = await save(state.library, state.etag); assert.equal(response.status, 200); state = await response.json() as DocsState;
  diff = await (await preview(state)).json() as DocsPreview; assert.deepEqual(diff.removed.map(doc => doc.slug), [identity.slug]);
  assert.equal((await publish(state)).status, 200); state = await getState(); assert.deepEqual(state.published!.documents, []);
  state.library.documents[0].workflow = 'draft'; response = await save(state.library, state.etag); assert.equal(response.status, 200); state = await response.json() as DocsState;
  assert.deepEqual((await (await preview(state)).json() as DocsPreview).added, []);
  const restored = state.library.documents[0]; assert.deepEqual({ id: restored.id, slug: restored.slug, createdAt: restored.createdAt }, identity);
  restored.workflow = 'ready'; response = await save(state.library, state.etag); state = await response.json() as DocsState; assert.equal((await publish(state)).status, 200);
  state = await getState(); const invalid = structuredClone(state.library); invalid.documents[0].categoryId = 'unknown-category'; assert.equal((await save(invalid, state.etag)).status, 422);
  assert.equal((await save({ ...state.library, documents: [] }, state.etag)).status, 422);
  assert.ok((await events()).some(event => event.operation === 'save-docs' && event.changes.some(change => change.fields.some(field => field.name === '所属分类' && field.after === '根目录（独立文档）'))));
});
test('分类到根再移入分类在发布diff中属于同篇修改，图片归属和稳定URL不变，孤儿分类拒绝', async () => {
  let state = await seed(); const doc = state.library.documents[0], oldCategory = state.library.categories[0];
  const uploaded = await upload(state); assert.equal(uploaded.status, 200); const asset = (await uploaded.json() as { asset: Asset }).asset;
  doc.images = [asset]; doc.body.zh = `# 移动示例\n\n![示意](fimel-doc-image:${asset.id})`; doc.workflow = 'ready';
  let response = await save(state.library, state.etag); assert.equal(response.status, 200); state = await response.json() as DocsState;
  assert.equal((await publish(state)).status, 200); state = await getState();
  const original = state.published!.documents[0], originalImageBody = original.body.zh, originalRevision = original.sourceRevision;
  const invalid = structuredClone(state.library); invalid.categories = []; assert.equal((await save(invalid, state.etag)).status, 422);
  state.library.documents[0].categoryId = ''; state.library.categories = [];
  response = await save(state.library, state.etag); assert.equal(response.status, 200, await response.clone().text()); state = await response.json() as DocsState;
  let diff = await (await preview(state)).json() as DocsPreview;
  assert.deepEqual(diff.added, []); assert.deepEqual(diff.removed, []); assert.deepEqual(diff.changed.map(doc => doc.id), [doc.id]); assert.equal(diff.categoriesChanged, true);
  assert.equal((await publish(state)).status, 200); state = await getState();
  const root = state.published!.documents[0]; assert.equal(root.categoryId, ''); assert.equal(root.id, doc.id); assert.equal(root.slug, doc.slug); assert.equal(root.body.zh, originalImageBody); assert.notEqual(root.sourceRevision, originalRevision);
  assert.equal(state.library.documents[0].images[0].privateKey, asset.privateKey);
  const nextCategory = { ...makeDocsCategory(), slug: 'installation', title: '安装教程' }; state.library.categories = [nextCategory]; state.library.documents[0].categoryId = nextCategory.id;
  response = await save(state.library, state.etag); assert.equal(response.status, 200); state = await response.json() as DocsState;
  diff = await (await preview(state)).json() as DocsPreview; assert.deepEqual(diff.changed.map(doc => doc.id), [doc.id]); assert.deepEqual(diff.added, []); assert.deepEqual(diff.removed, []);
  assert.equal((await publish(state)).status, 200); state = await getState();
  assert.equal(state.published!.documents[0].categoryId, nextCategory.id); assert.equal(state.published!.documents[0].body.zh, originalImageBody); assert.equal(state.published!.documents[0].slug, doc.slug);
  assert.equal((await (await runtime.getR2Bucket('PUBLIC')).list({ prefix: `docs/images/${doc.slug}/` })).objects.length, 1);
  const audit = await events(); assert.ok(audit.some(event => event.changes.some(change => change.fields.some(field => field.name === '所属分类' && field.before === oldCategory.id && field.after === '根目录（独立文档）'))));
  assert.ok(audit.some(event => event.changes.some(change => change.fields.some(field => field.name === '所属分类' && field.before === '根目录（独立文档）' && field.after === nextCategory.id))));
  const visibleRaw = await (await (await runtime.getR2Bucket('PUBLIC')).get(DOCS_MANIFEST_KEY))!.text();
  assert.throws(() => parseDocsManifest({ ...state.published!, documents: [{ ...state.published!.documents[0], categoryId: 'missing' }] }));
  assert.equal(await (await (await runtime.getR2Bucket('PUBLIC')).get(DOCS_MANIFEST_KEY))!.text(), visibleRaw);
});
test('并发草稿真实R2 CAS只有一方成功，JSON大小与损坏状态失败关闭，不覆盖现有数据', async () => {
  const state = await seed(), left = structuredClone(state.library), right = structuredClone(state.library); left.documents[0].title = '左窗口'; right.documents[0].title = '右窗口';
  const responses = await Promise.all([save(left, state.etag), save(right, state.etag)]); assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  const latest = await getState(), oversized = structuredClone(latest.library); oversized.documents[0].body.zh = '大'.repeat(1500000); assert.equal((await save(oversized, latest.etag)).status, 413);
  const bucket = await runtime.getR2Bucket('PRIVATE'); await bucket.put(DOCS_LIBRARY_KEY, '{broken'); assert.equal((await request()).status, 503); assert.equal((await save(left, latest.etag)).status, 503); assert.equal(await (await bucket.get(DOCS_LIBRARY_KEY))!.text(), '{broken');
});
test('独立图片签名/hash/归属校验与私有预览；不引用不公开，发布只输出ready且代码示例不被替换', async () => {
  let state = await seed(); let response = await upload(state, 0, { 'X-Image-SHA256': '0'.repeat(64) }); assert.equal(response.status, 422);
  response = await upload(state, 0, {}, new Uint8Array([1, 2, 3, 4])); assert.equal(response.status, 422);
  response = await upload(state); assert.equal(response.status, 200, await response.clone().text()); const asset = (await response.json() as { asset: Asset }).asset;
  assert.equal(asset.privateKey, `docs/uploads/${state.library.documents[0].id}/${asset.id}/${asset.name}`);
  assert.equal((await getState()).etag, state.etag);
  assert.equal((await request(`media/${state.library.documents[0].id}/${asset.id}/${asset.name}`)).status, 200);
  assert.equal((await request(`media/wrong-owner/${asset.id}/${asset.name}`)).status, 404);
  const unreferenced = (await (await upload(state)).json() as { asset: Asset }).asset;
  const doc = state.library.documents[0]; doc.images = [asset, unreferenced]; doc.body.zh = `# 图片规则\n\n:::image-left\n![示意](fimel-doc-image:${asset.id})\n\n右侧正文\n:::\n\n\`fimel-doc-image:${asset.id}\`\n\n\`\`\`md\n![教学](fimel-doc-image:someone-else)\n/api/docs/media/docs/uploads\n\`\`\``; doc.workflow = 'ready';
  const privateDoc = { ...makeDoc(doc.categoryId, 1), slug: 'private-draft', title: '保密草稿标题', body: { zh: '保密草稿正文' } }; state.library.documents.push(privateDoc);
  response = await save(state.library, state.etag); assert.equal(response.status, 200, await response.clone().text()); state = await response.json() as DocsState;
  const diff = await (await preview(state)).json() as DocsPreview; assert.deepEqual(diff.added.map(doc => doc.slug), ['game-rules']);
  assert.equal((await publish(state, { 'x-test-docs-fail': 'image' })).status, 503); assert.equal(await (await runtime.getR2Bucket('PUBLIC')).get(DOCS_MANIFEST_KEY), null);
  response = await publish(state); assert.equal(response.status, 200, await response.clone().text());
  const bucket = await runtime.getR2Bucket('PUBLIC'), stored = await bucket.get(DOCS_MANIFEST_KEY), raw = await stored!.text(), manifest = parseDocsManifest(JSON.parse(raw)); assert.equal(manifest.documents.length, 1); assert.ok(!raw.includes('保密草稿')); assert.ok(!raw.includes('privateKey')); assert.ok(!raw.includes('workflow')); assert.ok(!raw.includes('createdAt')); assert.ok(!raw.includes('docs/uploads/'));
  assert.ok(manifest.documents[0].body.zh?.includes('https://download.studiofimel.com/docs/images/game-rules/')); assert.ok(manifest.documents[0].body.zh?.includes(`\`fimel-doc-image:${asset.id}\``)); assert.ok(manifest.documents[0].body.zh?.includes('![教学](fimel-doc-image:someone-else)'));
  const images = await bucket.list({ prefix: 'docs/images/' }); assert.equal(images.objects.length, 1); assert.ok(!images.objects.some(object => object.key.includes(unreferenced.id)));
  const forged = structuredClone(state.library), evil = { ...makeDoc(doc.categoryId), slug: 'evil-owner', title: '错误归属' }; evil.images = [asset]; evil.body.zh = `![偷图](fimel-doc-image:${asset.id})`; forged.documents.push(evil); assert.equal((await save(forged, state.etag)).status, 422);
});
test('发布双版本条件、图片/快照/index失败保持旧公开版本，发布期间草稿竞态中止，真实公共CAS保留赢家', async () => {
  let state = await seed(); state.library.documents[0].workflow = 'ready'; let response = await save(state.library, state.etag); state = await response.json() as DocsState;
  assert.equal((await publish(state)).status, 200); state = await getState(); const bucket = await runtime.getR2Bucket('PUBLIC'), original = await (await bucket.get(DOCS_MANIFEST_KEY))!.text();
  state.library.documents[0].body.zh += '\n新修订'; response = await save(state.library, state.etag); state = await response.json() as DocsState;
  assert.equal((await request('publish', 'POST', {}, { 'If-Match': state.etag })).status, 428);
  assert.equal((await publish({ ...state, publicEtag: '"stale"' })).status, 409);
  for (const fail of ['snapshot', 'commit']) { assert.equal((await publish(state, { 'x-test-docs-fail': fail })).status, 503); assert.equal(await (await bucket.get(DOCS_MANIFEST_KEY))!.text(), original); }
  assert.equal((await publish(state, { 'x-test-docs-fail': 'draft-race' })).status, 409); assert.equal(await (await bucket.get(DOCS_MANIFEST_KEY))!.text(), original);
  state = await getState(); assert.equal((await publish(state, { 'x-test-docs-fail': 'public-race' })).status, 409); assert.equal((await (await bucket.get(DOCS_MANIFEST_KEY))!.json() as { publicationId: string }).publicationId, 'competing-publisher');
});
test('归档/恢复和仅分类修改不会意外公开draft，发布diff明确列出下架并保留历史对象', async () => {
  let state = await seed(); const doc = state.library.documents[0]; doc.workflow = 'ready'; let response = await save(state.library, state.etag); state = await response.json() as DocsState; assert.equal((await publish(state)).status, 200); state = await getState();
  state.library.documents[0].workflow = 'archived'; state.library.categories[0].title = '分类改名'; const privateDoc = { ...makeDoc(doc.categoryId), slug: 'only-draft', title: '仍是草稿', body: { zh: '不会公开' } }; state.library.documents.push(privateDoc); response = await save(state.library, state.etag); state = await response.json() as DocsState;
  const diff = await (await preview(state)).json() as DocsPreview; assert.deepEqual(diff.removed.map(doc => doc.slug), ['game-rules']); assert.deepEqual(diff.added, []); assert.equal(diff.categoriesChanged, true);
  assert.equal((await publish(state)).status, 200); state = await getState(); assert.equal(state.published!.documents.length, 0); assert.equal(state.library.documents.length, 2);
  state.library.documents[0].workflow = 'ready'; response = await save(state.library, state.etag); state = await response.json() as DocsState; assert.deepEqual((await (await preview(state)).json() as DocsPreview).added.map(doc => doc.slug), ['game-rules']);
  assert.ok((await (await runtime.getR2Bucket('PUBLIC')).list({ prefix: 'data/docs-snapshots/' })).objects.length >= 2);
});
test('审计准备失败阻止写入；收尾失败保留prepared并返回pending；只写独立docs数据不碰作品', async () => {
  const state = await getState(), library = fixture(); assert.equal((await save(library, state.etag, { 'x-test-docs-fail': 'audit-prepare' })).status, 503); assert.equal((await getState()).etag, state.etag);
  const response = await save(library, state.etag, { 'x-test-docs-fail': 'audit-finish' }); assert.equal(response.status, 200); assert.equal(response.headers.get('X-Fimel-Audit-Pending'), '1'); assert.ok((await events()).some(event => event.status === 'prepared' && event.operation === 'save-docs'));
  const bucket = await runtime.getR2Bucket('PRIVATE'); assert.equal(await bucket.get('state/library.json'), null); assert.equal(await bucket.get('state/site.json'), null); assert.equal(await (await runtime.getR2Bucket('PUBLIC')).get('data/works.json'), null);
});
test('真实23篇游戏规则与25图逐篇导入Fimel Card草稿，重复slug拒绝覆盖，导入中断可继续且不公开', async () => {
  const source = JSON.parse(await readFile('admin/examples/docs-example.json', 'utf8')) as DocsExampleSource; assert.equal(source.documents.length, 23);
  const bucket = await runtime.getR2Bucket('PRIVATE'); await bucket.put('test-assets/migration/docs-example/docs-example.json', JSON.stringify(source));
  for (const doc of source.documents) for (const image of doc.images) await bucket.put(`test-assets${image.url}`, await readFile(`admin/examples/docs-example/images/${image.url.split('/').at(-1)}`));
  let state = await getState(); const exposed = await request('example'); assert.equal(exposed.status, 200, await exposed.clone().text()); assert.equal((await exposed.json() as DocsExampleSource).documents.length, 23);
  for (let index = 0; index < source.documents.length; index++) { const doc = source.documents[index]; const response = await request(`import-example/${doc.slug}`, 'POST', {}, { 'If-Match': state.etag }); assert.equal(response.status, 200, await response.clone().text()); state = await response.json() as DocsState;
    if (index === 1) { assert.equal((await request(`import-example/${source.documents[0].slug}`, 'POST', {}, { 'If-Match': state.etag })).status, 409); state = await getState(); }
  }
  assert.equal(state.library.categories.length, 1); assert.equal(state.library.categories[0].slug, 'fimel-card'); assert.equal(state.library.documents.length, 23); assert.ok(state.library.documents.every(doc => doc.workflow === 'draft')); assert.equal(state.library.documents.flatMap(doc => doc.images).length, 25);
  assert.ok(state.library.documents.every(doc => doc.images.every(image => image.privateKey?.startsWith(`docs/uploads/${doc.id}/`)))); assert.ok(!JSON.stringify(state.library).includes('fimel-doc-image:example-'));
  assert.equal(state.published, null); assert.equal((await (await runtime.getR2Bucket('PUBLIC')).list()).objects.length, 0);
  const diff = await (await preview(state)).json() as DocsPreview; assert.deepEqual(diff.added, []); assert.equal((await events()).filter(event => event.operation === 'import-docs-example' && event.status === 'success').length, 23);
});
