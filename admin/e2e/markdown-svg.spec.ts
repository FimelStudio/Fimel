import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { makeWork } from '../shared/model';
import { makeDoc, makeDocsCategory } from '../shared/docs';
import type { DocsLibrary } from '../shared/docs';
import { docsMarkdownImages } from '../../src/content/docs';

// Disposable real R2 and Worker entry; public routes read that same in-memory bucket.
let runtime: Miniflare;
const origin = 'http://127.0.0.1:5184';
let markdown: string;
let images: { name: string; buffer: Buffer; mimeType: string }[];
const artifactDir = '.artifacts/markdown-svg-review';
const staticSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><g id="card"><rect width="32" height="32" rx="4" fill="var(--top)"/></g><filter id="shadow"><feDropShadow dx="1" dy="1" stdDeviation="1"/></filter></defs><use href="#card" style="--top:#00b8be" filter="url(#shadow)"/></svg>';

test.beforeAll(async () => {
  const reference = process.env.FIMEL_MARKDOWN_REFERENCE;
  markdown = reference ? await readFile(reference, 'utf8') : '# Fimel Card 游戏\n\n| 图标 | 游戏 | 人数 |\n| :---: | --- | :---: |\n| <img src="../icons/斗地主.svg" alt="斗地主图标" width="40" height="40"> | 斗地主 | 3 |\n| <img src="../icons/花火.svg" alt="花火图标" width="40" height="40"> | 花火 | 2～5 |';
  images = await Promise.all(docsMarkdownImages(markdown).map(async image => ({ name: decodeURIComponent(image.url.split('/').pop()!), mimeType: 'image/svg+xml', buffer: reference ? await readFile(path.resolve(path.dirname(reference), image.url)) : Buffer.from(staticSvg) })));
  const bundle = await build({ entryPoints: ['admin/worker/local.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
  runtime = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-10-14', r2Buckets: ['PRIVATE', 'PUBLIC'], bindings: { ADMIN_ORIGIN: origin, ACCESS_AUD: 'local-test', ACCESS_ISSUER: 'https://local.invalid', ADMIN_EMAILS: 'local-admin@example.invalid' } }));
  await runtime.ready; await mkdir(artifactDir, { recursive: true });
});
test.afterAll(async () => { await runtime?.dispose(); });

test.beforeEach(async ({ page }) => {
  for (const name of ['PRIVATE', 'PUBLIC']) { const bucket = await runtime.getR2Bucket(name); const objects = (await bucket.list()).objects; if (objects.length) await bucket.delete(objects.map(object => object.key)); }
  const work = makeWork(); work.project.slug = 'svg-table'; work.project.type = 'datapacks'; work.project.title = { zh: 'SVG 表格作品' }; work.project.platform = ['Minecraft Java'];
  await (await runtime.getR2Bucket('PRIVATE')).put('state/library.json', JSON.stringify({ schemaVersion: 1, works: [work] }));
  await (await runtime.getR2Bucket('PUBLIC')).put('data/works.json', JSON.stringify({ schemaVersion: 2, publicationId: 'fixture', projects: [], releases: {} }));
  const category = makeDocsCategory(); category.slug = 'fimel-card'; category.title = 'Fimel Card';
  const doc = makeDoc(category.id); doc.slug = 'svg-table-doc'; doc.title = 'SVG 表格文档'; doc.body = { zh: '原文' };
  await (await runtime.getR2Bucket('PRIVATE')).put('state/docs.json', JSON.stringify({ schemaVersion: 1, categories: [category], documents: [doc] }));
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const response = await runtime.dispatchFetch(`http://127.0.0.1${url.pathname}${url.search}`, { method: request.method(), headers: { ...request.headers(), origin, connection: 'close' }, ...(request.postDataBuffer() ? { body: request.postDataBuffer()! } : {}) });
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
  });
  await page.route('https://download.studiofimel.com/**', async route => {
    const url = new URL(route.request().url()), object = await (await runtime.getR2Bucket('PUBLIC')).get(decodeURIComponent(url.pathname.slice(1)));
    await route.fulfill(object ? { status: 200, headers: { 'Content-Type': object.httpMetadata?.contentType ?? 'application/json', 'Access-Control-Allow-Origin': '*' }, body: Buffer.from(await object.arrayBuffer()) } : { status: 404, body: '' });
  });
  await page.route('**/works/catalogue.json', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: await (await (await runtime.getR2Bucket('PUBLIC')).get('data/works.json'))!.text() });
  });
  await page.route('https://studiofimel.com/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/assets/')) { try { return await route.fulfill({ status: 200, body: await readFile(path.join('public', url.pathname)), contentType: url.pathname.endsWith('.svg') ? 'image/svg+xml' : 'image/png' }); } catch { /* Inert missing artwork. */ } }
    await route.fulfill({ status: 404, body: '' });
  });
  await page.route('http://127.0.0.1:5174/assets/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    try { await route.fulfill({ status: 200, body: await readFile(path.join('public', pathname)), contentType: pathname.endsWith('.woff') ? 'font/woff' : 'image/svg+xml' }); } catch { await route.fulfill({ status: 404, body: '' }); }
  });
});

async function inspectTables(page: Page, scope: string) {
  const icons = page.locator(`${scope} td img`);
  await expect(icons).toHaveCount(images.length);
  for (let index = 0; index < images.length; index++) await icons.nth(index).evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect.poll(async () => icons.evaluateAll(nodes => nodes.every(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)), { timeout: 30000 }).toBe(true);
  const sizes = await icons.evaluateAll(nodes => nodes.map(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height, handlers: node.getAttribute('onerror') })));
  expect(sizes).toEqual(Array.from({ length: images.length }, () => ({ width: 40, height: 40, handlers: null })));
  await expect(page.locator(`${scope} .project-gallery`)).toHaveCount(0);
  return sizes;
}

test('作品粘贴表格再批量导入 SVG，私有保存到公开正文的尺寸与桌面手机效果一致', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.locator('.work-row').filter({ hasText: 'SVG 表格作品' }).click(); await page.getByRole('button', { name: '正文与预览', exact: true }).click();
  const editor = page.getByLabel('Markdown 正文', { exact: true }); await editor.fill(markdown);
  await editor.evaluate((node, files) => {
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(new File([new Uint8Array(file.bytes)], file.name, { type: 'image/svg+xml' }));
    node.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, images.map(image => ({ name: image.name, bytes: [...image.buffer] })));
  await expect.poll(async () => (await editor.inputValue()).match(/fimel-asset:/g)?.length ?? 0, { timeout: 120000 }).toBe(images.length);
  await expect(editor).toBeEditable(); const preview = await inspectTables(page, '.markdown-editor');
  const value = await editor.inputValue(); expect(value.match(/width="40" height="40"/g)).toHaveLength(images.length);
  await page.screenshot({ path: `${artifactDir}/admin-work-desktop.png`, fullPage: true });
  await page.getByRole('button', { name: '保存草稿', exact: true }).first().click(); await expect(page.getByRole('status').filter({ hasText: '草稿已保存到私有存储' })).toBeVisible();
  await page.getByRole('button', { name: '发布预览', exact: true }).click(); const dialog = page.getByRole('dialog', { name: '发布预览', exact: true });
  await inspectTables(page, '.publication-canvas'); await dialog.getByRole('button', { name: '确认发布', exact: true }).click(); await expect(dialog).toHaveCount(0);
  const bucket = await runtime.getR2Bucket('PUBLIC'); expect((await bucket.list({ prefix: 'images/' })).objects).toHaveLength(images.length);
  await page.goto('http://127.0.0.1:5173/#/works/svg-table'); expect(await inspectTables(page, '.project-markdown')).toEqual(preview);
  await page.screenshot({ path: `${artifactDir}/public-work-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await inspectTables(page, '.project-markdown');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${artifactDir}/public-work-mobile.png`, fullPage: true }); expect(errors).toEqual([]);
});

test('文档表格 SVG 自动绑定相对路径，保存发布再读取可见且清空正文不会恢复配图', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.getByRole('button', { name: '文档中心', exact: true }).click(); await page.locator('.docs-file-open').filter({ hasText: 'SVG 表格文档' }).click();
  const editor = page.getByLabel('文档 Markdown 正文', { exact: true }); await editor.fill(markdown);
  await page.getByLabel('选择文档正文图片', { exact: true }).setInputFiles(images);
  await expect.poll(async () => (await editor.inputValue()).match(/fimel-doc-image:/g)?.length ?? 0, { timeout: 120000 }).toBe(images.length);
  await expect(editor).toBeEditable(); const preview = await inspectTables(page, '.docs-rendered-preview');
  await page.screenshot({ path: `${artifactDir}/admin-doc-desktop.png`, fullPage: true });
  await page.getByLabel('文档状态', { exact: true }).selectOption('ready'); await page.getByRole('button', { name: '保存文档草稿', exact: true }).click(); await expect(page.getByRole('status')).toContainText('文档草稿已保存');
  await page.getByRole('button', { name: '预览文档发布', exact: true }).click(); const dialog = page.getByRole('dialog', { name: '确认文档发布差异' }); await dialog.getByRole('button', { name: '确认发布文档', exact: true }).click(); await expect(dialog).toHaveCount(0);
  const manifest = await (await (await runtime.getR2Bucket('PUBLIC')).get('data/docs.json'))!.text(); expect(manifest).not.toContain('fimel-doc-image:');
  await page.goto('http://127.0.0.1:5173/#/docs/svg-table-doc'); expect(await inspectTables(page, '.documentation-body')).toEqual(preview);
  await page.screenshot({ path: `${artifactDir}/public-doc-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await inspectTables(page, '.documentation-body'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${artifactDir}/public-doc-mobile.png`, fullPage: true });
  await page.goto('http://127.0.0.1:5174/'); await page.getByRole('button', { name: '文档中心', exact: true }).click(); await page.locator('.docs-file-open').filter({ hasText: 'SVG 表格文档' }).click();
  await expect(editor).toHaveValue(new RegExp('fimel-doc-image:')); await editor.fill('配图已从正文移除。'); await expect(page.locator('.docs-rendered-preview img')).toHaveCount(0);
  await page.getByRole('button', { name: '保存文档草稿', exact: true }).click(); await expect(page.getByRole('status')).toContainText('文档草稿已保存');
  const saved = await (await (await runtime.getR2Bucket('PRIVATE')).get('state/docs.json'))!.json<DocsLibrary>(); expect(saved.documents[0].images).toHaveLength(images.length); expect(saved.documents[0].body.zh).toBe('配图已从正文移除。');
  await page.getByLabel('选择文档正文图片', { exact: true }).setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') });
  await expect(page.getByRole('alert')).toContainText('SVG 仅支持静态'); await expect(editor).toBeEditable(); await expect(editor).toHaveValue('配图已从正文移除。'); expect(errors).toEqual([]);
});

test('仅转换图片标签，脚本与事件不执行，表格普通图片与原有轮播互不干扰', async ({ page }) => {
  await page.goto('/'); await page.locator('.work-row').click(); await page.getByRole('button', { name: '正文与预览', exact: true }).click();
  const editor = page.getByLabel('Markdown 正文', { exact: true });
  await editor.fill('| 图标 | 名称 |\n| --- | --- |\n| <img src="javascript:alert(1)" width="40" onerror="window.__bad=1"> | 不可信图片 |\n\n<script>window.__bad=1</script>\n<iframe src="https://example.com"></iframe>');
  expect(await page.evaluate(() => '__bad' in window)).toBe(false); await expect(page.locator('.project-markdown script, .project-markdown iframe')).toHaveCount(0); await expect(page.locator('.project-markdown img[onerror]')).toHaveCount(0);
  await editor.fill('![普通一](https://studiofimel.com/assets/brand/fimel-logo.svg)\n![普通二](https://studiofimel.com/assets/brand/fimel-logo.svg)'); await expect(page.locator('.project-gallery-slide')).toHaveCount(2);
  await editor.fill('原正文'); await page.getByLabel('选择正文图片', { exact: true }).setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') });
  await expect(page.getByRole('alert')).toContainText('SVG 仅支持静态'); await expect(editor).toHaveValue('原正文');
  const objects = await (await runtime.getR2Bucket('PRIVATE')).list({ prefix: 'uploads/' }); expect(objects.objects).toHaveLength(0);
});
