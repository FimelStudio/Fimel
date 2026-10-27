import { expect, test, type Page } from '@playwright/test';
import type { Library, PublicManifest } from '../shared/model';

type State = { library: Library; public: PublicManifest };

async function state(page: Page) {
  const response = await page.request.get('/api/library');
  expect(response.status(), await response.text()).toBe(200);
  return response.json() as Promise<State>;
}

async function createWork(page: Page) {
  const slug = `repository-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await page.goto('/');
  await page.getByRole('button', { name: '新建作品', exact: true }).click();
  await page.getByLabel('作品名称', { exact: true }).fill('项目仓库回归验收');
  await page.getByLabel('稳定 slug').fill(slug);
  await page.getByRole('button', { name: '正文与预览', exact: true }).click();
  await page.getByLabel('Markdown 正文', { exact: true }).fill('# 项目仓库\n\n通过本地 Worker 验证保存与发布，仓库不限制服务商。');
  await page.getByRole('button', { name: '基本信息', exact: true }).click();
  return slug;
}

async function saveDraft(page: Page) {
  const response = page.waitForResponse(value => /\/api\/works\/[^/]+$/.test(new URL(value.url()).pathname) && value.request().method() === 'PUT');
  await page.getByRole('button', { name: '保存草稿', exact: true }).first().click();
  const saved = await response;
  expect(saved.status(), await saved.text()).toBe(200);
  await expect(page.getByText('草稿已保存到私有存储。', { exact: false })).toBeVisible();
}

async function openPreview(page: Page) {
  await page.getByRole('button', { name: '发布预览', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '发布预览', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function publishPreview(page: Page) {
  const response = page.waitForResponse(value => /\/api\/publish\/[^/]+$/.test(new URL(value.url()).pathname) && value.request().method() === 'POST');
  await page.getByRole('dialog', { name: '发布预览', exact: true }).getByRole('button', { name: '确认发布', exact: true }).click();
  const published = await response;
  expect(published.status(), await published.text()).toBe(200);
  await expect(page.getByText('发布成功，公开 manifest 已更新。', { exact: true })).toBeVisible();
}

test('新作仓库与首次发布日期真实保存并跨刷新保留，三语预览不跳转，确认发布保留原值', async ({ page }) => {
  const slug = await createWork(page);
  const repository = 'https://gitee.com/fimelstudio/local-repository-regression';
  await page.getByLabel('项目仓库地址', { exact: true }).fill(repository);
  await page.getByLabel('首次发布日期', { exact: true }).fill('2024-05-01');
  const external = page.getByRole('link', { name: '打开项目仓库', exact: true });
  await expect(external).toHaveAttribute('href', repository);
  await expect(external).toHaveAttribute('target', '_blank');
  await expect(external).toHaveAttribute('rel', /noopener/);
  await saveDraft(page);
  const draft = await state(page);
  expect(draft.library.works.find(work => work.project.slug === slug)?.project.repository).toBe(repository);
  expect(draft.library.works.find(work => work.project.slug === slug)?.project.published).toBe('2024-05-01');
  expect(draft.public.projects.some(project => project.slug === slug)).toBe(false);
  await page.reload();
  await page.getByLabel('搜索作品', { exact: true }).fill(slug);
  await page.locator('.work-row').click();
  await expect(page.getByLabel('项目仓库地址', { exact: true })).toHaveValue(repository);
  await expect(page.getByLabel('首次发布日期', { exact: true })).toHaveValue('2024-05-01');
  const fields = page.locator('.project-metadata-fields');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await fields.screenshot({ path: '.artifacts/project-repository-review/basic-fields-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await fields.screenshot({ path: '.artifacts/project-repository-review/basic-fields-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });

  const outgoing: string[] = [];
  page.on('request', request => { if (request.url().startsWith(repository)) outgoing.push(request.url()); });
  const beforeUrl = page.url(); const beforePages = page.context().pages().length;
  const dialog = await openPreview(page);
  for (const [locale, label, dateLabel, date] of [
    ['zh', '项目仓库', '首次发布', '2024年5月1日'],
    ['en', 'Project repository', 'First published', 'May 1, 2024'],
    ['ja', 'プロジェクトリポジトリ', '初回公開', '2024年5月1日'],
  ]) {
    await dialog.getByLabel('正文语言').selectOption(locale);
    const button = dialog.getByRole('button', { name: label, exact: true });
    await expect(button).toBeDisabled();
    const publishedDate = dialog.locator('.publication-project-dates > div').filter({ has: page.locator('dt').filter({ hasText: new RegExp(`^${dateLabel}$`) }) });
    await expect(publishedDate.locator('dd')).toHaveText(date);
    await button.evaluate((node: HTMLButtonElement) => node.click());
    expect(page.url()).toBe(beforeUrl);
    expect(page.context().pages()).toHaveLength(beforePages);
  }
  expect(outgoing).toEqual([]);
  await publishPreview(page);
  const published = (await state(page)).public.projects.find(project => project.slug === slug);
  expect(published?.repository).toBe(repository);
  expect(published?.published).toBe('2024-05-01');
});

test('清空仓库先只修改草稿，发布预览记录移除并可对照官网，确认后公开目录删除字段', async ({ page }) => {
  const slug = await createWork(page);
  const repository = 'https://gitlab.com/fimelstudio/local-repository-removal';
  await page.getByLabel('项目仓库地址', { exact: true }).fill(repository);
  await saveDraft(page); await openPreview(page); await publishPreview(page);
  await page.getByLabel('项目仓库地址', { exact: true }).fill('');
  await expect(page.getByRole('link', { name: '打开项目仓库', exact: true })).toHaveCount(0);
  await saveDraft(page);
  const draft = await state(page);
  expect(draft.library.works.find(work => work.project.slug === slug)?.project).not.toHaveProperty('repository');
  expect(draft.public.projects.find(project => project.slug === slug)?.repository).toBe(repository);
  const dialog = await openPreview(page);
  await expect(dialog.locator('.publication-changes')).toContainText('项目仓库');
  await expect(dialog.getByRole('button', { name: '项目仓库', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: '当前官网', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '项目仓库', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: '即将发布', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '项目仓库', exact: true })).toHaveCount(0);
  await publishPreview(page);
  expect((await state(page)).public.projects.find(project => project.slug === slug)).not.toHaveProperty('repository');
});

test('不安全仓库地址提供行内提示且不生成外链或保存请求，修正为HTTPS后可保存', async ({ page }) => {
  const slug = await createWork(page); await saveDraft(page);
  const before = await state(page);
  const savedWork = before.library.works.find(work => work.project.slug === slug)!;
  const input = page.getByLabel('项目仓库地址', { exact: true });
  const saves: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === `/api/works/${savedWork.id}` && request.method() === 'PUT') saves.push(request.url());
  });
  for (const address of ['http://gitee.com/fimelstudio/local-unsafe', 'javascript:alert(1)', 'data:text/html,unsafe']) {
    await input.fill(address);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = await input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`[id="${describedBy}"]`)).toContainText(/HTTPS/i);
    await expect(page.getByRole('link', { name: '打开项目仓库', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '保存草稿', exact: true }).first().click();
    await expect(page.getByRole('alert')).toBeVisible();
    expect(saves).toHaveLength(0);
    expect((await state(page)).library.works.find(work => work.id === savedWork.id)).toEqual(savedWork);
  }
  const repository = 'https://gitlab.com/fimelstudio/local-safe-retry';
  await input.fill(repository); await expect(input).not.toHaveAttribute('aria-invalid', 'true');
  await saveDraft(page);
  expect(saves).toHaveLength(1);
  expect((await state(page)).library.works.find(work => work.id === savedWork.id)?.project.repository).toBe(repository);
});
