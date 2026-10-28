import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { Library, PublicManifest } from '../shared/model';

async function state(page: Page) { return (await page.request.get('/api/library')).json() as Promise<{ library: Library; public: PublicManifest }>; }
async function create(page: Page) {
  const slug = `featured-cover-${Date.now()}`;
  await page.goto('/'); await page.getByRole('button', { name: '新建作品', exact: true }).click();
  await page.getByLabel('作品名称', { exact: true }).fill('独立精选封图验收'); await page.getByLabel('稳定 slug').fill(slug);
  await page.getByRole('button', { name: '正文与预览', exact: true }).click(); await page.getByLabel('Markdown 正文', { exact: true }).fill('原有正文，不自动追加封面或精选图。');
  await page.getByRole('button', { name: '封面与截图', exact: true }).click();
  return slug;
}
async function save(page: Page) {
  const response = page.waitForResponse(item => /\/api\/works\/[^/]+$/.test(new URL(item.url()).pathname) && item.request().method() === 'PUT');
  await page.getByRole('button', { name: '保存草稿', exact: true }).first().click(); expect((await response).status()).toBe(200);
  await expect(page.getByText('草稿已保存到私有存储。', { exact: false })).toBeVisible();
}
async function publish(page: Page) {
  await page.getByRole('button', { name: '发布预览', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '发布预览', exact: true }); await expect(dialog.getByRole('region', { name: '首页精选封图预览', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '确认发布', exact: true }).click(); await expect(page.getByText('发布成功，公开 manifest 已更新。', { exact: true })).toBeVisible();
}

test('独立精选上传自动保存新作品且不改主封面或正文，刷新发布与清除回退均生效', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const slug = await create(page); const png = await readFile('public/assets/brand/fimel-logo.png');
  await page.getByLabel('选择精选封图文件', { exact: true }).setInputFiles({ name: 'featured-only.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByRole('region', { name: '精选封图', exact: true })).toContainText('当前精选封图：featured-only.png', { timeout: 30000 });
  await expect(page.locator('.gallery-grid>div')).toHaveCount(1);
  await save(page);
  const before = await state(page); const work = before.library.works.find(item => item.project.slug === slug)!;
  expect(work.featuredCoverId).toBe(work.gallery[0].id); expect(work.coverId).toBeUndefined(); expect(work.project.image).toBe('assets/brand/fimel-logo.svg'); expect(work.markdown.description.zh).toBe('原有正文，不自动追加封面或精选图。');
  expect(before.public.projects.some(item => item.slug === slug)).toBe(false);
  await page.reload(); await page.getByLabel('搜索作品', { exact: true }).fill(slug); await page.locator('.work-row').click(); await page.getByRole('button', { name: '封面与截图', exact: true }).click();
  await expect(page.getByRole('combobox', { name: '选择精选封图', exact: true })).toHaveValue(work.featuredCoverId!);
  await page.getByRole('button', { name: '正文与预览', exact: true }).click(); await expect(page.locator('.project-gallery')).toHaveCount(0);
  await publish(page);
  const published = (await state(page)).public.projects.find(item => item.slug === slug)!;
  expect(published.featuredImage).toContain(work.featuredCoverId!); expect(published.image).toBe(work.project.image);
  await page.getByRole('button', { name: '封面与截图', exact: true }).click(); await page.getByRole('button', { name: '清除精选封图', exact: true }).click();
  await expect(page.getByRole('region', { name: '精选封图', exact: true })).toContainText('当前沿用作品封面。');
  await save(page); await publish(page);
  const cleared = (await state(page)).public.projects.find(item => item.slug === slug)!;
  expect(cleared).not.toHaveProperty('featuredImage'); expect(cleared.image).toBe(work.project.image);
  expect(errors).toEqual([]);
});

test('已有图片可独立设为精选，移除候选会清理引用，复制不继承精选资源且390px正常', async ({ page }) => {
  const slug = await create(page); await save(page);
  const png = await readFile('public/assets/brand/fimel-logo.png');
  await page.getByLabel('选择图片', { exact: true }).setInputFiles([{ name: 'main.png', mimeType: 'image/png', buffer: png }, { name: 'second.png', mimeType: 'image/png', buffer: png }]);
  await expect(page.locator('.gallery-grid>div')).toHaveCount(2, { timeout: 30000 });
  const second = page.locator('.gallery-grid>div').filter({ has: page.getByText('second.png', { exact: true }) });
  await second.getByRole('button', { name: '设为精选封图', exact: true }).click();
  await save(page);
  const work = (await state(page)).library.works.find(item => item.project.slug === slug)!;
  expect(work.featuredCoverId).not.toBe(work.coverId);
  page.once('dialog', dialog => dialog.accept()); await second.getByRole('button', { name: '移除', exact: true }).click();
  await expect(page.getByRole('region', { name: '精选封图', exact: true })).toContainText('当前沿用作品封面。');
  await save(page);
  const removed = (await state(page)).library.works.find(item => item.id === work.id)!;
  expect(removed.featuredCoverId).toBeUndefined(); expect(removed.coverId).toBe(work.coverId); expect(removed.gallery).toHaveLength(1);
  await page.locator('.gallery-grid>div').getByRole('button', { name: '设为精选封图', exact: true }).click(); await save(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('region', { name: '精选封图', exact: true }).screenshot({ path: '.artifacts/featured-cover-review/mobile.png' });
  await page.getByRole('button', { name: '复制', exact: true }).click(); await page.getByRole('button', { name: '完整字段', exact: true }).click();
  const copy = JSON.parse(await page.locator('textarea.json-editor').inputValue());
  expect(copy).not.toHaveProperty('featuredCoverId'); expect(copy.project).not.toHaveProperty('featuredImage'); expect(copy.gallery).toEqual([]);
});
