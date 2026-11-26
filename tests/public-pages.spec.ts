import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

let runtime: Miniflare;
let base: string;
const published = { schemaVersion: 2, projects: [{ slug: 'readable-work', type: 'datapacks', title: { zh: '无需脚本的作品', en: 'Readable project' }, summary: '真实公开目录正文', image: 'assets/brand/fimel-logo.png', status: 'released', tags: [], platform: ['Minecraft Java'], creators: [{ name: 'Fimel Studio' }], content: { description: 'https://download.studiofimel.com/content/readable-work/rev/description.zh.md' } }] };
const docManifest = { schemaVersion: 1, publicationId: 'published-rules', publishedAt: '2026-11-26T00:00:00.000Z', categories: [], documents: [{ id: 'rules', slug: 'readable-rules', categoryId: '', title: '无需脚本的规则', summary: '', order: 0, updatedAt: '2026-11-26T00:00:00.000Z', sourceRevision: 'a'.repeat(64), body: { zh: ':::image-left\n![图标](https://download.studiofimel.com/images/diagram.svg)\n\n这里是规则正文。\n:::\n\n| 图标 | 说明 |\n| --- | --- |\n| <img src="https://download.studiofimel.com/images/diagram.svg" width="40"> | 图文表格 |' } }] };
const markdown = '# 作品具体玩法\n\n不运行 JavaScript 也能读取这一段。';

test.beforeAll(async () => {
  const bundle = await build({ entryPoints: ['src/worker.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
  const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
  runtime = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: config.compatibility_date, r2Buckets: ['PUBLIC'], assets: {
    directory: path.resolve('dist'), binding: 'ASSETS', run_worker_first: config.assets.run_worker_first,
    routerConfig: { has_user_worker: true },
    assetConfig: { html_handling: config.assets.html_handling, not_found_handling: config.assets.not_found_handling },
  } }));
  base = (await runtime.ready).origin;
  const bucket = await runtime.getR2Bucket('PUBLIC');
  await bucket.put('data/works.json', JSON.stringify(published));
  await bucket.put('data/docs.json', JSON.stringify(docManifest));
  await bucket.put('content/readable-work/rev/description.zh.md', markdown);
});
test.afterAll(async () => { await runtime?.dispose(); });

test('关闭JavaScript仍能阅读作品、图片表格与文档，手机不会横向溢出', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route('https://download.studiofimel.com/images/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="teal"/></svg>' }));
  await page.goto(base + '/works/readable-work');
  await expect(page.getByRole('heading', { name: '无需脚本的作品', exact: true })).toBeVisible();
  await expect(page.locator('article')).toContainText('不运行 JavaScript 也能读取这一段');
  await page.goto(base + '/docs/readable-rules');
  await expect(page.locator('.public-split-left')).toContainText('这里是规则正文');
  await expect(page.locator('table')).toContainText('图文表格');
  await expect(page.locator('table img')).toHaveAttribute('width', '40');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});

test('同一HTML加载现有交互界面，直达和刷新可用，旧哈希链接转换后仍能前进后退', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { sessionStorage.setItem('fimel_intro_seen', '1'); localStorage.setItem('fimel_user_lang', 'zh'); });
  await page.route('https://download.studiofimel.com/data/works.json', route => route.fulfill({ json: published }));
  await page.route('https://download.studiofimel.com/data/docs.json', route => route.fulfill({ json: docManifest }));
  await page.route('https://download.studiofimel.com/content/**', route => route.fulfill({ contentType: 'text/markdown', body: markdown }));
  await page.route('**/api/work-events', route => route.fulfill({ status: 204, body: '' }));
  await page.route('**/api/work-downloads**', route => route.fulfill({ status: 503, body: '' }));
  await page.goto(base + '/works/readable-work');
  await expect(page.locator('.project-markdown')).toContainText('作品具体玩法');
  await expect(page.locator('.public-reader')).toHaveCount(0);
  await page.reload(); await expect(page.locator('.project-markdown')).toContainText('作品具体玩法');
  await page.goto(base + '/#/works/readable-work?tab=versions');
  await expect(page).toHaveURL(base + '/works/readable-work?tab=versions');
  await expect(page.locator('.project-versions')).toBeVisible();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '作品', exact: true }).click();
  await expect(page).toHaveURL(base + '/works');
  await page.goBack(); await expect(page).toHaveURL(base + '/works/readable-work?tab=versions');
  await page.evaluate(() => { window.location.hash = '#/docs/readable-rules'; });
  await expect(page).toHaveURL(base + '/docs/readable-rules');
  await expect(page.locator('.docs-document-header h1')).toHaveText('无需脚本的规则');
  expect(errors).toEqual([]);
});

test('公开目录请求失败时交互界面不会用Git旧快照复活作品', async ({ page }) => {
  let fallbackRequested = false;
  await page.route('https://download.studiofimel.com/data/works.json', route => route.fulfill({ status: 503, body: '' }));
  await page.route('**/works/catalogue.json', route => { fallbackRequested = true; return route.fulfill({ json: published }); });
  await page.goto(base + '/works');
  await expect(page.locator('.public-reader')).toHaveCount(0);
  await expect(page.locator('.work-row')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /重试/ })).toBeVisible();
  expect(fallbackRequested).toBe(false);
});
