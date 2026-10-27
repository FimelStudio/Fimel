import { expect, test, type APIResponse, type Page } from '@playwright/test';
import { makeWork } from '../shared/model';
import type { Library, PublicManifest, Work } from '../shared/model';
import type { Project } from '../../src/content/projects';
import type { SiteContent } from '../../src/content/site-content';

type LibraryState = { library: Library; public: PublicManifest; etag: string; publicEtag: string };
type SiteState = { site: SiteContent; etag: string; publicEtag: string; publicProjects: Project[] };
const writeHeaders = { 'X-Fimel-CSRF': '1', Origin: 'http://127.0.0.1:5174' };

async function success(response: APIResponse) {
  expect(response.status(), await response.text()).toBe(200);
}

async function libraryState(page: Page) {
  const response = await page.request.get('/api/library'); await success(response);
  return response.json() as Promise<LibraryState>;
}

async function siteState(page: Page) {
  const response = await page.request.get('/api/site'); await success(response);
  return response.json() as Promise<SiteState>;
}

async function addWork(page: Page, type: Project['type'], status: Project['status'], publish = false) {
  const work = makeWork();
  const slug = `featured-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  work.project = { ...work.project, slug, type, status, title: { zh: `精选回归 ${slug}` } };
  work.markdown.description.zh = '# 本地精选回归\n\n通过真实本地 Worker 保存与发布。';
  const response = await page.request.put(`/api/works/${work.id}`, { headers: writeHeaders, data: { base: null, work } });
  await success(response);
  const saved = (await response.json() as LibraryState).library.works.find(item => item.id === work.id)!;
  if (publish) await publishWork(page, saved);
  return saved;
}

async function publishWork(page: Page, work: Work) {
  const state = await libraryState(page);
  await success(await page.request.post(`/api/publish/${work.id}`, {
    headers: { ...writeHeaders, 'If-Match': state.etag, 'X-Public-ETag': state.publicEtag }, data: {},
  }));
}

async function siteDraft(page: Page, featured: SiteContent['featured']) {
  const before = await siteState(page);
  const site: SiteContent = { ...structuredClone(before.site), studio: {}, featured, updates: [] };
  const response = await page.request.put('/api/site', {
    headers: { ...writeHeaders, 'If-Match': before.etag }, data: { site },
  });
  await success(response);
  return site;
}

async function openSite(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '网站内容', exact: true }).click();
  await expect(page.getByRole('heading', { name: '首页精选与推荐顺序', exact: true })).toBeVisible();
}

function group(page: Page, heading: string) {
  return page.locator('.site-featured-group').filter({ has: page.getByRole('heading', { name: heading, exact: true }) });
}

async function saveSite(page: Page) {
  const response = page.waitForResponse(value => new URL(value.url()).pathname === '/api/site' && value.request().method() === 'PUT');
  await page.getByRole('button', { name: '保存网站草稿', exact: true }).click();
  await success(await response);
  await expect(page.getByText('网站内容草稿已保存，官网尚未更新。', { exact: true })).toBeVisible();
}

test('已公开的数据包放错精选地图时明确指出分类错误，移动去重后可真实发布且不重发作品', async ({ page }) => {
  const work = await addWork(page, 'datapacks', 'released', true);
  const slug = work.project.slug;
  await siteDraft(page, { maps: [slug], released: [slug], development: [slug] });
  const before = await libraryState(page);
  await openSite(page);
  const maps = group(page, '精选地图');
  await expect(maps.getByText('作品已公开，但分类不适合“精选地图”', { exact: false })).toBeVisible();
  await expect(maps).not.toContainText('作品尚未公开');
  const select = maps.getByRole('combobox');
  await expect(select).toHaveValue(slug);
  await expect(select.locator(`option[value="${slug}"]`)).toHaveCount(1);
  await maps.getByRole('button', { name: '移至已发行作品', exact: true }).click();
  await expect(maps.getByRole('combobox')).toHaveCount(0);
  await expect(group(page, '制作中的作品').getByRole('combobox')).toHaveCount(0);
  await expect(group(page, '已发行作品').getByRole('combobox')).toHaveCount(1);
  await expect(group(page, '已发行作品').getByRole('combobox')).toHaveValue(slug);
  // Moving only edits the local website draft; it cannot silently write or publish.
  expect((await siteState(page)).site.featured).toEqual({ maps: [slug], released: [slug], development: [slug] });
  expect((await libraryState(page)).public).toEqual(before.public);
  await saveSite(page);
  await page.getByRole('button', { name: '预览网站发布', exact: true }).click();
  await expect(page.locator('.site-publish-preview')).toBeVisible();
  const published = page.waitForResponse(response => new URL(response.url()).pathname === '/api/site/publish' && response.request().method() === 'POST');
  await page.getByRole('button', { name: '确认发布网站内容', exact: true }).click();
  await success(await published);
  await expect(page.getByText('网站内容已发布，官网现有区块和近期更新将读取新内容。', { exact: true })).toBeVisible();
  const after = await libraryState(page);
  expect(after.public.site?.featured).toEqual({ maps: [], released: [slug], development: [] });
  expect(after.public.projects).toEqual(before.public.projects);
  expect(after.public.releases).toEqual(before.public.releases);
  expect(after.public.publicationStates).toEqual(before.public.publicationStates);
  expect(after.library).toEqual(before.library);
});

test('未公开作品提示确实未公开，错分类不出现在可选列表，预览前阻止但允许保存草稿', async ({ page }) => {
  const map = await addWork(page, 'bedrock', 'released', true);
  const privatePack = await addWork(page, 'datapacks', 'released');
  const developing = await addWork(page, 'tools', 'development');
  await siteDraft(page, { maps: [map.project.slug], released: [privatePack.project.slug], development: [] });
  await openSite(page);
  const maps = group(page, '精选地图').getByRole('combobox');
  await expect(maps.locator(`option[value="${privatePack.project.slug}"]`)).toHaveCount(0);
  await expect(maps.locator(`option[value="${developing.project.slug}"]`)).toHaveCount(0);
  const released = group(page, '已发行作品');
  await expect(released.locator('.featured-warning')).toContainText(/尚未公开|作品未公开/);
  await expect(released.getByRole('combobox').locator(`option[value="${privatePack.project.slug}"]`)).toHaveCount(1);
  await expect(released.getByRole('combobox').locator(`option[value="${developing.project.slug}"]`)).toHaveCount(0);
  await page.getByLabel('工作室标题', { exact: true }).fill('未公开引用仍可保存为草稿');
  await saveSite(page);
  let publicationRequests = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/site/publish' && request.method() === 'POST') publicationRequests++; });
  await page.getByRole('button', { name: '预览网站发布', exact: true }).click();
  await expect(page.locator('.site-publish-preview')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText(/尚未公开|作品未公开/);
  expect(publicationRequests).toBe(0);
});

test('精选依据真实公开快照校验，不会把私有草稿中未发布的状态当成官网状态', async ({ page }) => {
  const work = await addWork(page, 'bedrock', 'released', true);
  const changed: Work = { ...work, project: { ...work.project, status: 'development' } };
  await success(await page.request.put(`/api/works/${work.id}`, { headers: writeHeaders, data: { base: work, work: changed } }));
  await siteDraft(page, { maps: [work.project.slug], released: [], development: [] });
  const current = await libraryState(page);
  expect(current.library.works.find(item => item.id === work.id)?.project.status).toBe('development');
  expect(current.public.projects.find(item => item.slug === work.project.slug)?.status).toBe('released');
  await openSite(page);
  const maps = group(page, '精选地图');
  await expect(maps.getByRole('combobox')).toHaveValue(work.project.slug);
  await expect(maps.getByText('作品已公开，但分类不适合“精选地图”', { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: '预览网站发布', exact: true }).click();
  await expect(page.locator('.site-publish-preview')).toBeVisible();
});

test('刷新公开状态保留未保存的标题，同时保留网站保存基线并拒绝覆盖其他管理员修改', async ({ page }) => {
  const work = await addWork(page, 'datapacks', 'development');
  await siteDraft(page, { maps: [], released: [], development: [work.project.slug] });
  await openSite(page);
  const developing = group(page, '制作中的作品');
  await expect(developing.locator('.featured-warning')).toContainText(/尚未公开|作品未公开/);
  await page.getByLabel('工作室标题', { exact: true }).fill('本机标题必须保留');
  // A different administrator publishes this work and saves website copy while
  // this tab still owns unsaved website edits and the old conditional revision.
  await publishWork(page, work);
  const remote = await siteState(page);
  await success(await page.request.put('/api/site', {
    headers: { ...writeHeaders, 'If-Match': remote.etag },
    data: { site: { ...remote.site, studio: { ...remote.site.studio, title: { zh: '另一管理员已保存标题' } } } },
  }));
  const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === '/api/site' && response.request().method() === 'GET');
  await page.getByRole('button', { name: '刷新作品公开状态', exact: true }).click();
  await success(await refreshed);
  await expect(page.getByLabel('工作室标题', { exact: true })).toHaveValue('本机标题必须保留');
  await expect(developing.locator('.featured-warning')).toHaveCount(0);
  await expect(developing.locator('.featured-selection > p.hint')).toHaveText('已公开 · 数据包 · 制作中');
  const rejected = page.waitForResponse(response => new URL(response.url()).pathname === '/api/site' && response.request().method() === 'PUT');
  await page.getByRole('button', { name: '保存网站草稿', exact: true }).click();
  expect((await rejected).status()).toBe(409);
  await expect(page.getByRole('alert')).toContainText('其他窗口修改');
  await expect(page.getByLabel('工作室标题', { exact: true })).toHaveValue('本机标题必须保留');
  expect((await siteState(page)).site.studio.title).toEqual({ zh: '另一管理员已保存标题' });
});
