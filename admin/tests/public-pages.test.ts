import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { publicMarkdown, publicUrl } from '../../src/lib/public-markdown';
import { legacyPublicPath } from '../../src/lib/public-routing';

let runtime: Miniflare;
const origin = 'https://studiofimel.com';
const fileUrl = 'https://download.studiofimel.com/works/datapacks/sample/release/pack.zip';
const project = {
  slug: 'sample', type: 'datapacks', title: { zh: '公开作品 <测试>', en: 'Public project' }, summary: '来自已发布目录',
  image: 'assets/cover.png', status: 'released', platform: ['Minecraft Java'], creators: [{ name: 'Fimel Studio' }], tags: [],
  repository: 'https://github.com/FimelStudio/example',
  content: { description: { zh: 'https://download.studiofimel.com/content/sample/rev/description.zh.md' }, changelog: 'works/sample/changelog.zh.md' },
};
const manifest = () => ({ schemaVersion: 2, projects: [structuredClone(project)], releases: { sample: [{ id: 'r1', label: 'v1.1', date: '2026-11-26', gameVersions: ['1.21'], status: 'released', files: [{ id: 'f1', name: 'pack.zip', size: 2048, sha256: 'a'.repeat(64), mime: 'application/zip', publicUrl: fileUrl }] }] } });
const docs = () => ({ schemaVersion: 1, publicationId: 'public-docs', publishedAt: '2026-11-26T00:00:00.000Z', categories: [{ id: 'cards', slug: 'fimel-card', title: 'Fimel Card', summary: '', order: 0 }], documents: [
  { id: 'doc1', slug: 'game-rules', categoryId: 'cards', title: { zh: '游戏规则', en: 'Game rules' }, summary: '已发布规则', order: 0, updatedAt: '2026-11-26T00:00:00.000Z', sourceRevision: 'b'.repeat(64), body: { zh: ':::image-right\n![示意图](https://download.studiofimel.com/images/diagram.svg)\n\n这是右图左文。\n:::\n\n| 图标 | 说明 |\n| --- | --- |\n| <img src="https://download.studiofimel.com/images/icon.svg" width="40"> | 使用道具 |' } },
  { id: 'doc2', slug: 'standalone', categoryId: '', title: '独立文档', summary: '', order: 1, updatedAt: '2026-11-26T00:00:00.000Z', sourceRevision: 'c'.repeat(64), body: { zh: '# 独立说明\n\n正文可直接读取。' } },
] });
const get = (path: string, init?: Parameters<Miniflare['dispatchFetch']>[1]) => runtime.dispatchFetch(origin + path, init);
async function seed() {
  const bucket = await runtime.getR2Bucket('PUBLIC');
  await bucket.put('data/works.json', JSON.stringify(manifest()));
  await bucket.put('data/docs.json', JSON.stringify(docs()));
  await bucket.put('content/sample/rev/description.zh.md', '# 可直接读取的正文\n\n段落与[版本](#/works/sample?tab=versions)。\n\n![图片](image.webp)');
  return bucket;
}

before(async () => {
  const bundle = await build({ stdin: { contents: `
    import worker from './src/worker';
    const template='<!doctype html><html lang="zh"><head><title>Fimel Studio</title><meta name="description" content="old"><meta property="og:title" content="old"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>';
    export default {fetch(request,env,ctx){env.ASSETS={fetch(request){return new Response(new URL(request.url).pathname==='/index.html'?template:'# 历史更新\\n\\n这是打包的历史正文。',{headers:{'Content-Type':new URL(request.url).pathname==='/index.html'?'text/html':'text/markdown'}})}};return worker.fetch(request,env,ctx)}};
  `, resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'browser' });
  runtime = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-07-28', r2Buckets: ['PUBLIC'] }));
  await runtime.ready;
});
after(async () => { await runtime?.dispose(); });

test('首页和目录直接包含公开作品及真实链接，所有 User-Agent 返回相同正文', async () => {
  await seed();
  for (const path of ['/', '/works']) {
    const response = await get(path); assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<main>/); assert.match(html, /公开作品 &lt;测试&gt;/);
    assert.match(html, /href="https:\/\/studiofimel.com\/works\/sample"/);
    assert.match(html, /href="https:\/\/studiofimel.com\/docs"/);
    assert.match(html, /<script type="module"/);
    const bot = await get(path, { headers: { 'User-Agent': 'GPTBot' } }); assert.equal(await bot.text(), html);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('作品正文、相对图片和元信息直出；更新日志与版本下载仍在各自标签', async () => {
  await seed();
  const response = await get('/works/sample'); const html = await response.text();
  assert.equal(response.status, 200); assert.match(html, /<h1 id="可直接读取的正文">可直接读取的正文<\/h1>/);
  assert.match(html, /https:\/\/download.studiofimel.com\/content\/sample\/rev\/image.webp/);
  assert.match(html, /href="https:\/\/studiofimel.com\/works\/sample\?tab=versions"/);
  assert.match(html, /<title>公开作品 &lt;测试&gt; \| Fimel Studio<\/title>/);
  assert.match(html, /name="description" content="来自已发布目录"/);
  assert.match(html, /rel="canonical" href="https:\/\/studiofimel.com\/works\/sample"/);
  assert.match(html, /2026-11-26/); assert.match(html, /github.com\/FimelStudio\/example/);
  assert.doesNotMatch(html, /href="https:\/\/download.studiofimel.com\/works/);
  assert.match(await (await get('/works/sample?tab=changelog')).text(), /这是打包的历史正文/);
  const versions = await (await get('/works/sample?tab=versions')).text();
  assert.match(versions, /v1.1/); assert.ok(versions.includes(`href="${fileUrl}"`)); assert.match(versions, /SHA-256/);
  assert.doesNotMatch(versions, /可直接读取的正文/);
  const english = await (await get('/works/sample?lang=en')).text(); assert.match(english, /<html lang="en"/); assert.match(english, /<h1>Public project<\/h1>/);
});

test('文档分类、独立文档、左右图文、SVG 与表格图片直接可读', async () => {
  await seed();
  const index = await (await get('/docs')).text(); assert.match(index, /Fimel Card/); assert.match(index, /独立文档/);
  const category = await (await get('/docs?category=fimel-card')).text(); assert.match(category, /游戏规则/); assert.doesNotMatch(category, /独立文档/);
  const doc = await (await get('/docs/game-rules')).text();
  assert.match(doc, /public-split-right/); assert.match(doc, /这是右图左文/); assert.match(doc, /<table>/);
  assert.match(doc, /icon.svg" alt="" width="40"/);
  assert.match(await (await get('/docs/standalone')).text(), /正文可直接读取/);
});

test('发布后立即更新，作品与文档下架后旧地址和站点地图不会复活缓存', async () => {
  const bucket = await seed();
  assert.equal((await get('/works/sample')).status, 200); assert.equal((await get('/docs/game-rules')).status, 200);
  await bucket.put('content/sample/rev/description.zh.md', '# 修改已发布内容');
  assert.match(await (await get('/works/sample')).text(), /修改已发布内容/);
  await bucket.put('data/works.json', JSON.stringify({ schemaVersion: 2, projects: [] }));
  const docData = docs(); docData.documents = []; await bucket.put('data/docs.json', JSON.stringify(docData));
  for (const path of ['/works/sample', '/docs/game-rules', '/works/unknown/deeper']) {
    const result = await get(path); assert.equal(result.status, 404); assert.equal(result.headers.get('x-robots-tag'), 'noindex'); assert.doesNotMatch(await result.text(), /<script/);
  }
  const sitemap = await (await get('/sitemap.xml')).text(); assert.doesNotMatch(sitemap, /\/sample|game-rules/);
});

test('目录不可用或过大时返回可重试503，不读取旧Git快照、不把失败伪装成空目录', async () => {
  const bucket = await seed();
  await bucket.delete('data/works.json');
  for (const path of ['/', '/works', '/works/sample', '/sitemap.xml']) {
    const response = await get(path); assert.equal(response.status, 503); assert.equal(response.headers.get('retry-after'), '60'); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.doesNotMatch(await response.text(), /<script/);
  }
  await bucket.put('data/works.json', ' '.repeat(4 * 1024 * 1024 + 1)); assert.equal((await get('/works')).status, 503);
  await bucket.put('data/docs.json', '{}'); assert.equal((await get('/docs')).status, 503);
});

test('正文读取限定公开路径，不能借内容字段访问外部地址、私有目录或SPA HTML', async () => {
  const bucket = await seed();
  for (const source of ['http://127.0.0.1/private.md', 'https://example.invalid/a.md', 'https://download.studiofimel.com/docs/uploads/private.md', 'https://download.studiofimel.com/content/a/%252e%252e/private.md']) {
    const data = manifest(); data.projects[0].content.description.zh = source;
    await bucket.put('data/works.json', JSON.stringify(data));
    assert.equal((await get('/works/sample')).status, 503);
  }
  // Browsing never creates events or writes another storage object.
  assert.deepEqual((await bucket.list()).objects.map(object => object.key).sort(), ['content/sample/rev/description.zh.md', 'data/docs.json', 'data/works.json']);
});

test('robots、站点地图、HEAD、方法限制和旧分类路径遵守HTTP语义', async () => {
  await seed();
  const sitemap = await get('/sitemap.xml'); assert.equal(sitemap.status, 200); assert.match(sitemap.headers.get('content-type')!, /application\/xml/);
  const xml = await sitemap.text(); assert.match(xml, /<loc>https:\/\/studiofimel.com\/works\/sample<\/loc>/); assert.match(xml, /<lastmod>2026-11-26/);
  assert.match(await (await get('/robots.txt')).text(), /Sitemap: https:\/\/studiofimel.com\/sitemap.xml/);
  for (const path of ['/works/sample', '/docs', '/sitemap.xml', '/robots.txt']) { const head = await get(path, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), ''); }
  assert.equal((await get('/works', { method: 'POST' })).status, 405);
  assert.equal((await get('/works/', { redirect: 'manual' })).headers.get('location'), '/works');
  assert.equal((await get('/works/maps?lang=en', { redirect: 'manual' })).headers.get('location'), '/works?lang=en&type=bedrock');
  for (const path of ['/works/catalogue.json', '/works/sample/description.md']) {
    const asset = await get(path); assert.equal(asset.status, 200); assert.match(await asset.text(), /打包的历史正文/);
  }
});

test('Markdown只重建安全图片，不执行HTML、SVG内联或危险链接，代码示例保持字面量', () => {
  const body = publicMarkdown('# 标题\n\n<script>alert(1)</script>\n\n<iframe src="https://evil.invalid"></iframe>\n\n<svg onload="alert(1)"></svg>\n\n<img src="https://download.studiofimel.com/images/a.svg" width="40" onerror="alert(1)">\n\n![x](javascript:alert) [坏链接](javascript:alert) [安全](https://example.org)\n\n```html\n<img src="javascript:alert">\n```', origin + '/');
  assert.doesNotMatch(body, /<script|<iframe|<svg|onerror=|href="javascript|src="javascript/);
  assert.match(body, /a.svg" alt="" width="40"/); assert.match(body, /&lt;img/);
  assert.match(body, /href="https:\/\/example.org\/"/);
  for (const value of ['javascript:alert(1)', 'data:image/svg+xml,test', 'https://user:pass@example.org/a.png', 'fimel-asset:x', '/api/media/private']) assert.equal(publicUrl(value, origin, true), undefined);
});

test('旧哈希地址保留查询与锚点，不能跳往外部站点，普通目录锚点保持原样', () => {
  assert.equal(legacyPublicPath('#/works/sample?tab=versions'), '/works/sample?tab=versions');
  assert.equal(legacyPublicPath('#/docs/game-rules?lang=en#rules'), '/docs/game-rules?lang=en#rules');
  for (const value of ['#//evil.org', '#/\\evil.org', '#contact', '#rules', '#/unrelated']) assert.equal(legacyPublicPath(value), undefined);
});
