import { expect, test, type APIResponse, type Page } from '@playwright/test';
import { makeWork } from '../shared/model';
import type { Library, PublicManifest } from '../shared/model';
import type { SiteContent } from '../../src/content/site-content';

const headers = { 'X-Fimel-CSRF': '1', Origin: 'http://127.0.0.1:5174' };
async function success(response: APIResponse) { expect(response.status(), await response.text()).toBe(200); }
async function libraryState(page: Page) {
  const response = await page.request.get('/api/library'); await success(response);
  return response.json() as Promise<{ library: Library; public: PublicManifest; etag: string; publicEtag: string }>;
}
async function siteState(page: Page) {
  const response = await page.request.get('/api/site'); await success(response);
  return response.json() as Promise<{ site: SiteContent; etag: string; published: SiteContent | null }>;
}
async function create(page: Page, published: boolean) {
  const work = makeWork();
  work.project = { ...work.project, slug: `home-content-${published ? 'public' : 'private'}-${crypto.randomUUID()}`, type: 'java', status: 'released', title: { zh: '首页推荐 Java 地图', en: 'Homepage Java map', ja: 'ホームのJavaマップ' } };
  work.markdown.description.zh = '# 本地首页推荐验收';
  const response = await page.request.put(`/api/works/${work.id}`, { headers, data: { base: null, work } }); await success(response);
  if (published) {
    const current = await libraryState(page);
    await success(await page.request.post(`/api/publish/${work.id}`, { headers: { ...headers, 'If-Match': current.etag, 'X-Public-ETag': current.publicEtag }, data: {} }));
  }
  return work;
}
async function save(page: Page) {
  const response = page.waitForResponse(item => new URL(item.url()).pathname === '/api/site' && item.request().method() === 'PUT');
  await page.getByRole('button', { name: '保存网站草稿', exact: true }).click(); await success(await response);
  await expect(page.getByText('网站内容草稿已保存，官网尚未更新。', { exact: true })).toBeVisible();
}

test('首页快速推荐三语编辑保存与预览使用真实本地草稿，私有引用受阻且不会自动公开', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const published = await create(page, true), privateWork = await create(page, false);
  const current = await siteState(page);
  const initial: SiteContent = { ...current.site, home: undefined, featured: { maps: [], released: [], development: [] }, updates: [] };
  await success(await page.request.put('/api/site', { headers: { ...headers, 'If-Match': current.etag }, data: { site: initial } }));
  const before = await libraryState(page);
  let sitePublications = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/site/publish' && request.method() === 'POST') sitePublications++; });
  await page.goto('/'); await page.getByRole('button', { name: '网站内容', exact: true }).click();
  await expect(page.getByRole('heading', { name: '首页快速推荐 · zh', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: '地图推荐卡关联作品', exact: true }).selectOption(privateWork.project.slug);
  for (const locale of ['zh', 'en', 'ja'] as const) {
    await page.locator('.site-editor .locale-tabs').getByRole('button', { name: locale, exact: true }).click();
    await page.getByLabel('首页快速推荐区标题', { exact: true }).fill(`首页推荐标题 ${locale}`);
    for (const card of ['地图推荐卡', '模组推荐卡', '工具推荐卡']) {
      await page.getByLabel(`${card}分类短文`, { exact: true }).fill(`${card}分类 ${locale}`);
      await page.getByLabel(`${card}标题`, { exact: true }).fill(`${card}自定义标题 ${locale}`);
      await page.getByLabel(`${card}介绍`, { exact: true }).fill(`${card}自定义介绍 ${locale}`);
    }
  }
  await save(page);
  const stored = await siteState(page);
  expect(stored.site.home?.quickTitle).toEqual({ zh: '首页推荐标题 zh', en: '首页推荐标题 en', ja: '首页推荐标题 ja' });
  for (const [key, name] of [['maps', '地图推荐卡'], ['mods', '模组推荐卡'], ['tools', '工具推荐卡']] as const) {
    expect(stored.site.home?.spotlights?.[key]?.summary).toEqual({ zh: `${name}自定义介绍 zh`, en: `${name}自定义介绍 en`, ja: `${name}自定义介绍 ja` });
  }
  expect((await libraryState(page)).public).toEqual(before.public);
  await page.getByRole('button', { name: '预览网站发布', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(`尚未公开：${privateWork.project.slug}`);
  await expect(page.locator('.site-publish-preview')).toHaveCount(0);
  await page.getByRole('combobox', { name: '地图推荐卡关联作品', exact: true }).selectOption(published.project.slug);
  await save(page);
  for (const locale of ['zh', 'en', 'ja'] as const) {
    await page.locator('.site-editor .locale-tabs').getByRole('button', { name: locale, exact: true }).click();
    await page.getByRole('button', { name: '预览网站发布', exact: true }).click();
    const preview = page.getByRole('region', { name: '首页快速推荐发布预览', exact: true });
    await expect(preview).toContainText(`首页推荐标题 ${locale}`);
    for (const card of ['地图推荐卡', '模组推荐卡', '工具推荐卡']) {
      await expect(preview).toContainText(`${card}自定义标题 ${locale}`);
      await expect(preview).toContainText(`${card}自定义介绍 ${locale}`);
    }
    await expect(preview).toContainText(`/works/${published.project.slug}`);
    await expect(preview).toContainText('沿用原分类入口');
    await expect(preview.locator('article').filter({ hasText: '工具推荐卡' })).not.toContainText('关联作品：');
    await page.getByRole('button', { name: '返回网站编辑', exact: true }).click();
  }
  expect(sitePublications).toBe(0);
  expect((await libraryState(page)).public).toEqual(before.public);
  expect((await siteState(page)).site.studio).toEqual(initial.studio);
  expect((await siteState(page)).site.contact).toEqual(initial.contact);
  expect(errors).toEqual([]);
});
