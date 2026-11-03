import { expect, test, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { makeDoc, makeDocsCategory } from '../shared/docs';
import type { DocsLibrary } from '../shared/docs';
import type { DocsManifest } from '../../src/content/docs';

// All edits, publications, images and audits use a disposable in-memory R2 runtime.
// The browser API is routed to the real local Admin entry; no production requests.
let runtime: Miniflare;
let fixtureLibrary: DocsLibrary;
let image: Buffer;
const origin = 'http://127.0.0.1:5184';
const artifactDir = '.artifacts/docs-tree-review';
test.beforeAll(async () => {
  const bundle = await build({ stdin: { contents: `import local from './admin/worker/local';
    export default{fetch(request,env){env.ASSETS={fetch:async(req)=>{const object=await env.PRIVATE.get('fixtures'+new URL(req.url).pathname);return object?new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType??'application/octet-stream'}}):new Response('fixture missing',{status:404})}};return local.fetch(request,env)}}`, resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'browser' });
  runtime = new Miniflare(convertV4MiniflareOptions({ port: 19597, modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-10-12', r2Buckets: ['PRIVATE', 'PUBLIC'],
    bindings: { ADMIN_ORIGIN: origin, ACCESS_AUD: 'local-test', ACCESS_ISSUER: 'https://local.invalid', ADMIN_EMAILS: 'local-admin@example.invalid' } }));
  await runtime.ready; await mkdir(artifactDir, { recursive: true });
  image = await readFile('public/assets/images/team/TreeHey.png');
});
test.afterAll(async () => { await runtime?.dispose(); });
test.beforeEach(async ({ page }) => {
  const privateBucket = await runtime.getR2Bucket('PRIVATE'), publicBucket = await runtime.getR2Bucket('PUBLIC');
  for (const bucket of [privateBucket, publicBucket]) { const objects = (await bucket.list()).objects; if (objects.length) await bucket.delete(objects.map(object => object.key)); }
  await privateBucket.put('state/library.json', JSON.stringify({ schemaVersion: 1, works: [] }));
  await publicBucket.put('data/works.json', JSON.stringify({ schemaVersion: 2, publicationId: 'local-docs-test', projects: [], releases: {} }));
  const category = makeDocsCategory(); category.slug = 'fimel-card'; category.title = { zh: 'Fimel Card' };
  const other = makeDocsCategory(1); other.slug = 'tools'; other.title = { zh: '工具指南' };
  const doc = makeDoc(category.id); doc.slug = 'card-rules'; doc.title = { zh: '游戏规则' }; doc.body = { zh: '# 游戏规则\n\n用于本地验收的规则内容。' };
  fixtureLibrary = { schemaVersion: 1, categories: [category, other], documents: [doc] };
  await privateBucket.put('state/docs.json', JSON.stringify(fixtureLibrary));
  await page.route('**/assets/{brand,fonts}/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const local = path.resolve('public', `.${pathname}`), root = `${path.resolve('public')}${path.sep}`;
    if (!local.startsWith(root)) return route.abort();
    try { await route.fulfill({ status: 200, body: await readFile(local), contentType: pathname.endsWith('.svg') ? 'image/svg+xml' : 'font/woff' }); } catch { await route.fulfill({ status: 404, body: '' }); }
  });
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const response = await runtime.dispatchFetch(`http://127.0.0.1${url.pathname}${url.search}`, { method: request.method(), headers: { ...request.headers(), origin, connection: 'close' }, ...(request.postDataBuffer() ? { body: request.postDataBuffer()! } : {}) });
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
  });
});
async function openDocs(page: Page) { await page.goto('/'); await page.getByRole('button', { name: '文档中心', exact: true }).click(); await expect(page.getByRole('region', { name: '文档中心管理' })).toBeVisible(); await expect(page.getByLabel('搜索文档')).toBeVisible(); }
async function openRule(page: Page) { await openDocs(page); await page.locator('.docs-list .docs-file-open').filter({ hasText: '游戏规则' }).click(); }
async function storedLibrary() { return (await (await runtime.getR2Bucket('PRIVATE')).get('state/docs.json'))!.json<DocsLibrary>(); }
async function publicManifest() { return (await runtime.getR2Bucket('PUBLIC')).get('data/docs.json'); }
async function save(page: Page) { await page.getByRole('button', { name: '保存文档草稿', exact: true }).click(); await expect(page.getByRole('status')).toContainText('文档草稿已保存'); }
async function publish(page: Page) { await page.getByRole('button', { name: '预览文档发布', exact: true }).click(); const dialog = page.getByRole('dialog', { name: '确认文档发布差异' }); await expect(dialog).toBeVisible(); await dialog.getByRole('button', { name: '确认发布文档', exact: true }).click(); await expect(dialog).toHaveCount(0); await expect(page.getByRole('status')).toContainText('文档已发布'); }

test('文档改名与正文草稿不公开，标记待发布后先预览差异再公开，slug保存后固定', async ({ page }) => {
  await openRule(page); await expect(page.getByLabel('文档 slug', { exact: true })).toBeDisabled();
  await page.getByLabel('文档名称', { exact: true }).fill('新的游戏规则');
  await page.getByLabel('文档 Markdown 正文', { exact: true }).fill('# 规则介绍\n\n本段已经修改。');
  await save(page); expect((await storedLibrary()).documents[0].title).toEqual({ zh: '新的游戏规则' }); expect(await publicManifest()).toBeNull();
  await page.getByRole('button', { name: '预览文档发布', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: '确认文档发布差异' }); await expect(dialog).toContainText('新增公开（0）'); await dialog.getByRole('button', { name: '返回文档编辑' }).click();
  await page.getByLabel('文档状态', { exact: true }).selectOption('ready'); await save(page);
  await page.getByRole('button', { name: '预览文档发布', exact: true }).click(); dialog = page.getByRole('dialog', { name: '确认文档发布差异' }); await expect(dialog).toContainText('新增公开（1）'); await expect(dialog).toContainText('新的游戏规则');
  expect(await publicManifest()).toBeNull(); await dialog.getByRole('button', { name: '确认发布文档', exact: true }).click(); await expect(dialog).toHaveCount(0);
  const manifest = await (await publicManifest())!.json<DocsManifest>(); expect(manifest.documents[0].slug).toBe('card-rules'); expect(manifest.documents[0].body.zh).toContain('本段已经修改'); expect(JSON.stringify(manifest)).not.toMatch(/privateKey|workflow|fimel-doc-image/);
  await expect(page.getByTestId('doc-publication-status')).toHaveText('已公开 · 已同步'); await expect(page.locator('.docs-list .docs-file-open')).toContainText('已公开 · 已同步');
  await page.getByLabel('文档名称', { exact: true }).fill('再次修改的规则名称'); await expect(page.getByTestId('doc-publication-status')).toHaveText('已公开 · 有修改待发布'); await expect(page.locator('.docs-list .docs-file-open')).toContainText('已公开 · 有修改待发布');
});

test('新建分类和文档、改名排序移动、非空分类合并一次保存、归档与恢复', async ({ page }) => {
  await openDocs(page); await page.getByRole('button', { name: '管理分类', exact: true }).click();
  const manager = page.getByRole('dialog', { name: '管理文档分类' });
  await expect(manager.locator('.docs-category-list>div').filter({ hasText: 'Fimel Card' }).getByRole('button', { name: '删除空分类' })).toBeDisabled();
  await manager.getByRole('button', { name: '新建分类', exact: true }).click();
  await page.getByLabel('新分类名称', { exact: true }).fill('new-category'); await page.getByLabel('新分类名称', { exact: true }).press('Enter'); await page.getByRole('button', { name: '管理分类', exact: true }).click();
  const card = manager.locator('.docs-category-list>div').filter({ has: page.getByText('Fimel Card', { exact: true }) }); await card.getByRole('button', { name: '合并到其他分类' }).click();
  const merging = page.getByRole('dialog', { name: '确认合并分类' }); await merging.getByLabel('合并目标分类').selectOption(fixtureLibrary.categories[1].id); await merging.getByRole('button', { name: '确认合并分类', exact: true }).click();
  await manager.getByRole('button', { name: '完成分类编辑' }).click();
  expect((await storedLibrary()).categories).toHaveLength(2);
  let puts = 0; page.on('request', request => { if (new URL(request.url()).pathname === '/api/docs' && request.method() === 'PUT') puts++; });
  await save(page); expect(puts).toBe(1); const stored = await storedLibrary(); expect(stored.categories.map(c => c.slug)).toEqual(['tools', 'new-category']); expect(stored.documents[0].categoryId).toBe(fixtureLibrary.categories[1].id); expect(stored.documents[0].slug).toBe('card-rules');
  await page.getByRole('button', { name: '新建文档', exact: true }).click(); await page.getByLabel('新文档名称', { exact: true }).fill('新增文章'); await page.getByLabel('新文档名称', { exact: true }).press('Enter'); await page.getByLabel('文档 slug', { exact: true }).fill('new-document'); await page.getByLabel('文档 Markdown 正文', { exact: true }).fill('# 新增正文'); await save(page);
  await page.getByRole('button', { name: '归档文档', exact: true }).click(); await save(page); await page.getByLabel('筛选文档状态').selectOption('archived'); await page.locator('.docs-list .docs-file-open').filter({ hasText: '新增文章' }).click(); await page.getByRole('button', { name: '恢复为私有草稿' }).click(); await save(page); expect((await storedLibrary()).documents.find(d => d.slug === 'new-document')!.workflow).toBe('draft');
  expect(await publicManifest()).toBeNull();
});

test('正文选图上传入私有R2并分栏预览，删正文不会恢复图片，明确发布后转公开URL', async ({ page }) => {
  await openRule(page); await page.getByLabel('选择文档正文图片').setInputFiles({ name: '规则截图.png', mimeType: 'image/png', buffer: image });
  await expect(page.getByRole('status')).toContainText('图片已上传并插入正文');
  const stored = await storedLibrary(), doc = stored.documents[0]; expect(doc.images).toHaveLength(1); expect(doc.body.zh).toContain(`fimel-doc-image:${doc.images[0].id}`); expect(await publicManifest()).toBeNull(); expect((await (await runtime.getR2Bucket('PUBLIC')).list()).objects.some(o => o.key.startsWith('docs/images/'))).toBe(false);
  await page.getByLabel('文档 Markdown 正文', { exact: true }).fill(`:::image-left\n![截图](fimel-doc-image:${doc.images[0].id})\n\n## 图片右边的说明\n说明文字\n:::`);
  await expect(page.locator('.docs-rendered-preview .docs-image-text')).toHaveCount(1);
  await expect(page.locator('.docs-rendered-preview img')).toBeVisible();
  await page.evaluate(() => document.documentElement.classList.add('dark')); await page.screenshot({ path: `${artifactDir}/editor-desktop.png`, fullPage: true });
  await page.getByLabel('文档 Markdown 正文', { exact: true }).fill('# 删除所有图片'); await expect(page.locator('.docs-rendered-preview img')).toHaveCount(0); await save(page); expect((await storedLibrary()).documents[0].images).toHaveLength(1);
  await page.getByLabel('文档 Markdown 正文', { exact: true }).fill(`![截图](fimel-doc-image:${doc.images[0].id})`); await page.getByLabel('文档状态', { exact: true }).selectOption('ready'); await save(page); await publish(page);
  const manifest = await (await publicManifest())!.json<DocsManifest>(); expect(manifest.documents[0].body.zh).toMatch(/^!\[截图\]\(https:\/\/download\.studiofimel\.com\/docs\/images\//); expect(JSON.stringify(manifest)).not.toMatch(/privateKey|fimel-doc-image/);
  await expect(page.getByTestId('doc-publication-status')).toHaveText('已公开 · 已同步');
});

test('图片拖入和粘贴均保存草稿且保留归属，非法图片不发上传请求', async ({ page }) => {
  await openRule(page); let uploads = 0; page.on('request', request => { if (request.method() === 'POST' && /\/api\/docs\/images\//.test(request.url())) uploads++; });
  const target = page.getByLabel('文档 Markdown 正文', { exact: true });
  await target.evaluate((element, bytes) => { const data = new DataTransfer(); data.items.add(new File([new Uint8Array(bytes)], 'drop.png', { type: 'image/png' })); element.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true })); }, [...image]);
  await expect(page.getByRole('status')).toContainText('图片已上传并插入正文');
  await target.evaluate((element, bytes) => { const data = new DataTransfer(); data.items.add(new File([new Uint8Array(bytes)], 'paste.png', { type: 'image/png' })); element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })); }, [...image]);
  await expect.poll(async () => (await storedLibrary()).documents[0].images.length).toBe(2); await expect(page.getByRole('status')).toContainText('图片已上传并插入正文'); expect(uploads).toBe(2);
  await page.getByLabel('选择文档正文图片').setInputFiles({ name: 'test.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') }); await expect(page.getByRole('alert')).toContainText('仅支持'); expect(uploads).toBe(2);
});

test('保存409保留正文并可导出，本机恢复按操作者保留', async ({ page }) => {
  await openRule(page); await page.getByLabel('文档 Markdown 正文', { exact: true }).fill('# 冲突后仍需保留的内容');
  await page.route('**/api/docs', async route => { if (route.request().method() === 'PUT') await route.fulfill({ status: 409, json: { error: '本地模拟其他管理员已保存' } }); else await route.fallback(); });
  await page.getByRole('button', { name: '保存文档草稿', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('当前输入已保留'); await expect(page.getByLabel('文档 Markdown 正文', { exact: true })).toHaveValue('# 冲突后仍需保留的内容');
  const exported = page.waitForEvent('download'); await page.getByRole('button', { name: '导出当前文档草稿', exact: true }).click(); expect((await exported).suggestedFilename()).toBe('fimel-docs-draft.json');
  await page.waitForTimeout(1000); page.on('dialog', dialog => void dialog.accept()); await page.reload(); await page.getByRole('button', { name: '文档中心', exact: true }).click();
  await expect(page.getByRole('button', { name: '恢复文档编辑', exact: true })).toBeVisible(); await page.getByRole('button', { name: '恢复文档编辑', exact: true }).click(); await expect(page.getByLabel('文档 Markdown 正文', { exact: true })).toHaveValue('# 冲突后仍需保留的内容'); expect((await storedLibrary()).documents[0].body.zh).not.toContain('冲突后');
});

test('导入23篇规则仅追加私有草稿，已有slug跳过，手机编辑与分栏预览无横向溢出', async ({ page }) => {
  const privateBucket = await runtime.getR2Bucket('PRIVATE');
  await privateBucket.delete('state/docs.json');
  const source = await readFile('admin/examples/docs-example.json'); await privateBucket.put('fixtures/migration/docs-example/docs-example.json', source, { httpMetadata: { contentType: 'application/json' } });
  const imagesDir = 'admin/examples/docs-example/images';
  const files = await readdir(imagesDir, { recursive: true });
  for (const file of files) { const name = String(file).replaceAll('\\', '/'); if (/\.png$/.test(name)) await privateBucket.put(`fixtures/migration/docs-example/images/${name}`, await readFile(path.join(imagesDir, String(file))), { httpMetadata: { contentType: 'image/png' } }); }
  let attempts = 0; await page.route('**/api/docs/import-example/*', async route => {
    attempts++;
    if (attempts === 4) {
      // Commit the fourth real import, then lose its response before the UI sees it.
      const request = route.request(); const response = await runtime.dispatchFetch(`http://127.0.0.1${new URL(request.url()).pathname}`, { method: 'POST', headers: { ...request.headers(), origin, connection: 'close' }, body: request.postDataBuffer()! }); expect(response.status).toBe(200); await response.arrayBuffer(); await route.abort('connectionfailed');
    } else await route.fallback();
  });
  await openDocs(page); await page.getByRole('button', { name: '预览示例导入' }).click(); const dialog = page.getByRole('dialog', { name: '导入 Fimel Card 游戏规则' }); await expect(dialog).toContainText('23 篇规则'); await dialog.getByRole('button', { name: '确认追加导入示例' }).click();
  await expect(dialog.getByRole('alert')).toContainText('导入中断'); expect((await storedLibrary()).documents).toHaveLength(4); await expect(dialog.getByText('已存在 · 跳过，不覆盖', { exact: true })).toHaveCount(3); await dialog.getByRole('button', { name: '确认追加导入示例' }).click();
  await expect(dialog).toHaveCount(0, { timeout: 90000 }); const stored = await storedLibrary(); expect(stored.documents).toHaveLength(23); expect(stored.documents.every(doc => doc.workflow === 'draft')).toBe(true); expect(stored.categories).toHaveLength(1); expect(stored.documents.reduce((sum, doc) => sum + doc.images.length, 0)).toBe(25); expect(await publicManifest()).toBeNull();
  await page.getByRole('button', { name: '预览示例导入' }).click(); const duplicate = page.getByRole('dialog', { name: '导入 Fimel Card 游戏规则' }); await expect(duplicate.getByRole('button', { name: '确认追加导入示例' })).toBeDisabled(); await expect(duplicate.getByText('已存在 · 跳过，不覆盖', { exact: true })).toHaveCount(23); await duplicate.getByRole('button', { name: '取消导入' }).click();
  await page.getByRole('button', { name: '选择当前筛选文档', exact: true }).click(); await page.getByRole('button', { name: '所选设为待发布', exact: true }).click(); await save(page); expect(await publicManifest()).toBeNull(); await publish(page); expect((await (await publicManifest())!.json<DocsManifest>()).documents).toHaveLength(23); expect((await (await runtime.getR2Bucket('PUBLIC')).list({ prefix: 'docs/images/' })).objects).toHaveLength(25);
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('.docs-list .docs-file-open').first().click(); await page.screenshot({ path: `${artifactDir}/editor-mobile.png`, fullPage: true }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('分类验证在最上层弹窗显示，空分类可删除，待发布批量操作仍须保存与预览，发布503保留差异可重试', async ({ page }) => {
  await openRule(page); await page.getByRole('button', { name: '在文档树新建分类', exact: true }).click(); await page.getByLabel('新分类名称', { exact: true }).fill('待删除分类'); await page.getByLabel('新分类名称', { exact: true }).press('Enter'); await page.getByRole('button', { name: '分类操作 待删除分类', exact: true }).click(); await page.getByRole('menuitem', { name: '分类设置', exact: true }).click();
  const creating = page.getByRole('dialog', { name: '编辑文档分类' }); await creating.getByLabel('分类 slug', { exact: true }).fill('中文错误'); await creating.getByRole('button', { name: '应用分类修改' }).click(); await expect(creating.getByRole('alert')).toContainText('分类名称或 slug 不合法'); await expect(creating).toBeVisible();
  await creating.getByLabel('分类 slug', { exact: true }).fill('empty-category'); await creating.getByRole('button', { name: '应用分类修改' }).click();
  await page.getByRole('button', { name: '管理分类', exact: true }).click(); const manager = page.getByRole('dialog', { name: '管理文档分类' });
  await manager.locator('.docs-category-list>div').filter({ has: page.getByText('待删除分类', { exact: true }) }).getByRole('button', { name: '删除空分类' }).click(); await page.getByRole('dialog', { name: '删除分类', exact: true }).getByRole('button', { name: '确认删除分类', exact: true }).click();
  await page.getByRole('button', { name: '选择当前筛选文档', exact: true }).click(); await page.getByRole('button', { name: '所选设为待发布', exact: true }).click(); expect((await storedLibrary()).documents[0].workflow).toBe('draft'); await save(page); expect((await storedLibrary()).documents[0].workflow).toBe('ready'); expect(await publicManifest()).toBeNull();
  let fail = true; await page.route('**/api/docs/publish', async route => { if (fail) { fail = false; await route.fulfill({ status: 503, json: { error: '本地模拟发布暂时失败' } }); } else await route.fallback(); });
  await page.getByRole('button', { name: '预览文档发布', exact: true }).click(); const review = page.getByRole('dialog', { name: '确认文档发布差异' }); await review.getByRole('button', { name: '确认发布文档', exact: true }).click(); await expect(review.getByRole('alert')).toContainText('本地模拟发布暂时失败'); expect(await publicManifest()).toBeNull(); await review.getByRole('button', { name: '确认发布文档', exact: true }).click(); await expect(review).toHaveCount(0); expect((await (await publicManifest())!.json<DocsManifest>()).documents).toHaveLength(1);
  await page.getByRole('button', { name: '选择当前筛选文档', exact: true }).click(); await page.getByRole('button', { name: '归档所选文档', exact: true }).click(); const archive = page.getByRole('dialog', { name: '确认归档所选文档' }); await expect(archive).toContainText('游戏规则'); await archive.getByRole('button', { name: '确认归档所选文档', exact: true }).click(); await expect(page.getByTestId('doc-publication-status')).toHaveText('已公开 · 下次发布将下架'); await save(page); await page.getByRole('button', { name: '预览文档发布', exact: true }).click(); await expect(page.getByRole('dialog', { name: '确认文档发布差异' })).toContainText('从官网下架（1）'); expect((await (await publicManifest())!.json<DocsManifest>()).documents).toHaveLength(1);
});

test('损坏IndexedDB恢复记录不会进入编辑器，空名称与未完成slug仍可恢复', async ({ page }) => {
  await openRule(page);
  const session = await (await runtime.dispatchFetch('http://127.0.0.1/api/session')).json() as { actorId: string };
  const invalidBody = structuredClone(fixtureLibrary), invalidImage = structuredClone(fixtureLibrary), invalidMetadata = structuredClone(fixtureLibrary);
  (invalidBody.documents[0].body as unknown as { zh: number }).zh = 123;
  (invalidImage.documents[0].images as unknown[]).push(null);
  (invalidMetadata.documents[0].summary as unknown) = { zh: null };
  const now = new Date().toISOString();
  const records = [invalidBody, invalidImage, invalidMetadata].map((library, index) => ({ key: `docs:${session.actorId}:broken-${index}`, at: now, library, etag: '"local-bad"', selected: fixtureLibrary.documents[0].id }));
  async function store(records: unknown[]) {
    await page.evaluate(async values => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('fimel-admin-recovery', 1); request.onupgradeneeded = () => request.result.createObjectStore('drafts', { keyPath: 'key' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      await new Promise<void>((resolve, reject) => { const transaction = db.transaction('drafts', 'readwrite'); for (const item of values) transaction.objectStore('drafts').put(item); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); }); db.close();
    }, records);
  }
  await store(records); await page.reload(); await page.getByRole('button', { name: '文档中心', exact: true }).click(); await expect(page.getByLabel('搜索文档')).toBeVisible(); await expect(page.getByRole('button', { name: '恢复文档编辑', exact: true })).toHaveCount(0); await page.locator('.docs-list .docs-file-open').first().click(); await expect(page.getByLabel('文档 Markdown 正文', { exact: true })).toHaveValue(fixtureLibrary.documents[0].body.zh!);
  const library = structuredClone(fixtureLibrary), pending = makeDoc(library.categories[0].id); pending.title = ''; pending.summary = ''; pending.slug = '未完成 slug'; pending.body = { zh: '# 还没填完的新文章' }; library.categories[0].summary = ''; library.documents.push(pending);
  await store([{ key: `docs:${session.actorId}:valid-incomplete`, at: new Date().toISOString(), library, etag: '"local-incomplete"', selected: pending.id }]); await page.reload(); await page.getByRole('button', { name: '文档中心', exact: true }).click(); await page.getByRole('button', { name: '恢复文档编辑', exact: true }).click(); await expect(page.getByLabel('文档名称', { exact: true })).toHaveValue(''); await expect(page.getByLabel('文档 slug', { exact: true })).toHaveValue('未完成 slug'); await expect(page.getByLabel('文档 Markdown 正文', { exact: true })).toHaveValue('# 还没填完的新文章');
});

test('切换空白翻译时预览回退已有语言，标题跳过空字符串，输入框保持空白', async ({ page }) => {
  fixtureLibrary.documents[0].title = { zh: '', en: 'English document title' };
  await (await runtime.getR2Bucket('PRIVATE')).put('state/docs.json', JSON.stringify(fixtureLibrary));
  await openDocs(page); await page.locator('.docs-list .docs-file-open').filter({ hasText: 'English document title' }).click(); await expect(page.getByLabel('文档名称', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'English', exact: true }).click(); await expect(page.getByLabel('文档 Markdown 正文', { exact: true })).toHaveValue(''); await expect(page.getByRole('region', { name: '官网文档效果预览' })).toContainText('当前语言为空，预览已有语言内容'); await expect(page.getByRole('region', { name: '官网文档效果预览' })).toContainText('用于本地验收的规则内容'); expect((await storedLibrary()).documents[0].body.en).toBeUndefined();
});

test('图片上传及示例导入期间导航被锁定且beforeunload阻止关闭，完成后恢复', async ({ page }) => {
  await openRule(page);
  const prevented = () => page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; });
  let releaseImage: (() => void) | undefined;
  await page.route('**/api/docs/images/*', async route => { await new Promise<void>(resolve => { releaseImage = resolve; }); await route.fallback(); });
  await page.getByLabel('选择文档正文图片').setInputFiles({ name: 'busy.png', mimeType: 'image/png', buffer: image }); await expect.poll(() => !!releaseImage).toBe(true); await expect(page.getByLabel('文档 Markdown 正文', { exact: true })).toBeDisabled(); await expect(page.locator('.sidebar button').first()).toBeDisabled(); expect(await prevented()).toBe(true); releaseImage!(); await expect(page.getByRole('status')).toContainText('图片已上传并插入正文'); await expect.poll(prevented).toBe(false);
  const sourceDoc = makeDoc(fixtureLibrary.categories[0].id); sourceDoc.slug = 'busy-example'; sourceDoc.title = { zh: '导入忙碌测试' }; sourceDoc.body = { zh: '# 导入忙碌测试' };
  const source = { schemaVersion: 1, category: fixtureLibrary.categories[0], documents: [{ id: sourceDoc.id, slug: sourceDoc.slug, title: sourceDoc.title, summary: sourceDoc.summary, body: sourceDoc.body, order: 0, images: [] }] };
  await (await runtime.getR2Bucket('PRIVATE')).put('fixtures/migration/docs-example/docs-example.json', JSON.stringify(source), { httpMetadata: { contentType: 'application/json' } });
  let releaseImport: (() => void) | undefined; await page.route('**/api/docs/import-example/*', async route => { await new Promise<void>(resolve => { releaseImport = resolve; }); await route.fallback(); });
  await page.getByRole('button', { name: '预览示例导入', exact: true }).click(); const dialog = page.getByRole('dialog', { name: '导入 Fimel Card 游戏规则' }); await dialog.getByRole('button', { name: '确认追加导入示例' }).click(); await expect.poll(() => !!releaseImport).toBe(true); await expect(dialog.getByRole('button', { name: '取消导入' })).toBeDisabled(); expect(await prevented()).toBe(true); releaseImport!(); await expect(dialog).toHaveCount(0); await expect.poll(prevented).toBe(false); expect((await storedLibrary()).documents.some(doc => doc.slug === 'busy-example')).toBe(true);
});

test('空库直接新建根文档，逐字输入、IME选词与失焦不创建，Esc取消无dirty，Enter后保存并公开', async ({ page }) => {
  await (await runtime.getR2Bucket('PRIVATE')).put('state/docs.json', JSON.stringify({ schemaVersion: 1, categories: [], documents: [] }));
  await openDocs(page); const saved = page.getByRole('button', { name: '保存文档草稿', exact: true }); await expect(saved).toBeDisabled();
  await page.getByRole('button', { name: '新建文档', exact: true }).click(); let name = page.getByLabel('新文档名称', { exact: true }); await name.pressSequentially('CancelledFile'); await expect(name).toHaveValue('CancelledFile'); await page.getByLabel('搜索文档', { exact: true }).click(); await expect(page.locator('.docs-file-open')).toHaveCount(0); await expect(saved).toBeDisabled(); await name.press('Escape'); await expect(name).toHaveCount(0); await expect(saved).toBeDisabled();
  await page.getByRole('button', { name: '在根目录新建文档', exact: true }).click(); name = page.getByLabel('新文档名称', { exact: true }); await name.pressSequentially('独立文档 Alpha'); await expect(name).toHaveValue('独立文档 Alpha'); await name.dispatchEvent('compositionstart'); await name.press('Enter'); await expect(name).toBeVisible(); await expect(page.locator('.docs-file-open')).toHaveCount(0); await name.press('Escape'); await expect(name).toBeVisible(); await expect(name).toHaveValue('独立文档 Alpha'); await name.dispatchEvent('compositionend'); await name.press('Enter');
  await expect(page.getByLabel('文档所属分类', { exact: true })).toHaveValue(''); await expect(page.getByLabel('文档 slug', { exact: true })).toHaveValue(/^[a-z0-9]+(?:-[a-z0-9]+)*$/); expect((await storedLibrary()).documents).toHaveLength(0);
  await page.getByLabel('文档 Markdown 正文', { exact: true }).fill('# 根级文档\n\n没有分类也可以直接发布。'); await page.getByLabel('文档状态', { exact: true }).selectOption('ready'); await save(page); await publish(page); let manifest = await (await publicManifest())!.json<DocsManifest>(); expect(manifest.categories).toHaveLength(0); expect(manifest.documents[0].categoryId).toBe('');
  await page.reload(); await page.getByRole('button', { name: '文档中心', exact: true }).click(); await expect(page.locator('.docs-file-open')).toContainText('独立文档 Alpha'); await expect(page.locator('.docs-tree-file.nested')).toHaveCount(0); manifest = await (await publicManifest())!.json<DocsManifest>(); expect(manifest.documents[0].slug).toBe('alpha');
});

test('文件夹折叠仅改本机偏好，搜索仍展开命中；inline重命名与局部Delete确认保留slug和归档内容', async ({ page }) => {
  const archived = makeDoc(fixtureLibrary.categories[0].id); archived.slug = 'archived-child'; archived.title = { zh: '已归档规则' }; archived.body = { zh: '# 保留的归档内容' }; archived.workflow = 'archived'; fixtureLibrary.documents.push(archived); await (await runtime.getR2Bucket('PRIVATE')).put('state/docs.json', JSON.stringify(fixtureLibrary));
  await openRule(page); const saved = page.getByRole('button', { name: '保存文档草稿', exact: true });
  await page.getByRole('button', { name: '收起分类 Fimel Card', exact: true }).click(); await expect(page.locator('.docs-file-open').filter({ hasText: '游戏规则' })).toBeHidden(); await expect(saved).toBeDisabled(); expect((await storedLibrary()).documents[0].slug).toBe('card-rules');
  await page.getByLabel('搜索文档', { exact: true }).fill('游戏规则'); await expect(page.locator('.docs-file-open').filter({ hasText: '游戏规则' })).toBeVisible(); await expect(page.getByRole('button', { name: '收起分类 Fimel Card', exact: true })).toHaveAttribute('aria-expanded', 'true'); await page.getByLabel('搜索文档', { exact: true }).fill('');
  const folder = page.getByRole('button', { name: '展开分类 Fimel Card', exact: true }); await folder.focus(); await folder.press('Delete'); let dialog = page.getByRole('dialog', { name: '删除分类', exact: true }); await expect(dialog).toContainText('包含 2 篇文档（含归档）'); await expect(dialog.getByRole('button', { name: '确认删除分类' })).toBeDisabled(); await dialog.getByRole('button', { name: '取消删除' }).click();
  await page.getByRole('button', { name: '展开分类 Fimel Card', exact: true }).click(); const folderRename = page.getByRole('button', { name: '收起分类 Fimel Card', exact: true }); await folderRename.focus(); await folderRename.press('F2'); let rename = page.getByLabel('重命名', { exact: true }); await rename.fill(''); await rename.pressSequentially('Card Folder'); await rename.press('Enter'); await save(page); await page.reload(); await page.getByRole('button', { name: '文档中心', exact: true }).click(); await expect(page.getByRole('button', { name: '收起分类 Card Folder', exact: true })).toBeVisible(); expect((await storedLibrary()).categories[0]).toMatchObject({ id: fixtureLibrary.categories[0].id, slug: 'fimel-card', title: { zh: 'Card Folder' } }); await page.locator('.docs-file-open').filter({ hasText: '游戏规则' }).click();
  const file = page.locator('.docs-file-open').filter({ hasText: '游戏规则' }); await file.focus(); await file.press('F2'); rename = page.getByLabel('重命名', { exact: true }); await rename.fill(''); await rename.pressSequentially('Cancelled Rename'); await expect(rename).toHaveValue('Cancelled Rename'); await rename.press('Escape'); await expect(saved).toBeDisabled();
  await file.focus(); await file.press('F2'); rename = page.getByLabel('重命名', { exact: true }); await rename.fill(''); await rename.pressSequentially('改名后的 Rule'); await expect(rename).toHaveValue('改名后的 Rule'); await rename.press('Enter'); await expect(page.getByLabel('文档 slug', { exact: true })).toHaveValue('card-rules'); await save(page);
  const renamed = page.locator('.docs-file-open').filter({ hasText: '改名后的 Rule' }); await renamed.focus(); await renamed.press('Delete'); dialog = page.getByRole('dialog', { name: '删除文档', exact: true }); await expect(dialog).toContainText('正文和图片保留'); await expect(dialog).toContainText('预览并确认发布'); await dialog.getByRole('button', { name: '确认删除文档', exact: true }).click(); await save(page); const stored = await storedLibrary(); expect(stored.documents[0].workflow).toBe('archived'); expect(stored.documents[0].slug).toBe('card-rules'); expect(stored.documents[0].body.zh).toContain('用于本地验收的规则内容');
  await page.getByRole('button', { name: '分类操作 工具指南', exact: true }).click(); await page.getByRole('menuitem', { name: /删除分类/ }).click(); const emptyFolder = page.getByRole('dialog', { name: '删除分类', exact: true }); await expect(emptyFolder).toContainText('包含 0 篇文档'); await emptyFolder.getByRole('button', { name: '确认删除分类', exact: true }).click(); await save(page); expect((await storedLibrary()).categories).toHaveLength(1); expect((await storedLibrary()).categories[0].id).toBe(fixtureLibrary.categories[0].id);
});

test('筛选分类后inline新建定位正确，root与分类通过select和拖动移动，保存重载与公开归属一致', async ({ page }) => {
  await openRule(page); const target = fixtureLibrary.categories[1]; await page.getByLabel('筛选文档分类', { exact: true }).selectOption(target.id); await page.getByRole('button', { name: '新建文档', exact: true }).click(); let name = page.getByLabel('新文档名称', { exact: true }); await expect(name).toBeVisible(); await name.pressSequentially('Folder B Guide'); await name.press('Enter'); await expect(page.getByLabel('文档所属分类', { exact: true })).toHaveValue(target.id); await page.getByLabel('文档 Markdown 正文', { exact: true }).fill('# B 类文档'); await page.getByLabel('文档状态', { exact: true }).selectOption('ready'); await save(page); await publish(page);
  await page.getByRole('button', { name: '在根目录新建文档', exact: true }).click(); name = page.getByLabel('新文档名称', { exact: true }); await expect(name).toBeVisible(); await name.pressSequentially('Root Guide'); await name.press('Enter'); await expect(page.getByLabel('文档所属分类', { exact: true })).toHaveValue(''); await expect(page.getByLabel('筛选文档分类', { exact: true })).toHaveValue('__root__'); await page.getByLabel('文档 Markdown 正文', { exact: true }).fill('# 根目录指南'); await page.getByLabel('文档状态', { exact: true }).selectOption('ready'); await save(page); await publish(page);
  const slug = await page.getByLabel('文档 slug', { exact: true }).inputValue(); await page.getByLabel('文档所属分类', { exact: true }).selectOption(target.id); await save(page); await publish(page); expect((await (await publicManifest())!.json<DocsManifest>()).documents.find(doc => doc.slug === slug)!.categoryId).toBe(target.id);
  await page.reload(); await page.getByRole('button', { name: '文档中心', exact: true }).click(); await page.locator('.docs-file-open').filter({ hasText: 'Root Guide' }).click(); await expect(page.getByLabel('文档所属分类', { exact: true })).toHaveValue(target.id); await expect(page.getByLabel('文档 slug', { exact: true })).toHaveValue(slug);
  await page.getByRole('button', { name: '文档操作 Root Guide', exact: true }).click(); await page.getByRole('menuitem', { name: '移到根目录', exact: true }).click(); await save(page); await publish(page); await page.getByLabel('筛选文档分类', { exact: true }).selectOption('');
  const row = page.locator('.docs-tree-file').filter({ has: page.locator('.docs-file-open').filter({ hasText: 'Root Guide' }) }).locator('.docs-list-row'); await row.dragTo(page.locator(`[data-category-id="${fixtureLibrary.categories[0].id}"]>.docs-tree-folder-row`)); await expect(page.getByLabel('文档所属分类', { exact: true })).toHaveValue(fixtureLibrary.categories[0].id); await save(page); await publish(page); expect((await (await publicManifest())!.json<DocsManifest>()).documents.find(doc => doc.slug === slug)!.categoryId).toBe(fixtureLibrary.categories[0].id);
  await page.evaluate(() => document.documentElement.classList.add('dark')); await page.screenshot({ path: `${artifactDir}/tree-desktop-dark.png`, fullPage: true }); await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => document.documentElement.classList.remove('dark')); await page.screenshot({ path: `${artifactDir}/tree-mobile-light.png`, fullPage: true }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
