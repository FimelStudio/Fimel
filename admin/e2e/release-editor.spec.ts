import { expect, test, type Page } from '@playwright/test';
import { crc32 } from 'node:zlib';
import type { Library, Upload, Work } from '../shared/model';

// A complete, small ZIP with one stored text file; requests still use the real
// local Worker, multipart R2 storage, and whole-file SHA-256 verification.
function zipFixture(name: string) {
  const filename = Buffer.from('readme.txt');
  const content = Buffer.from(`Release editor regression: ${name}\n`);
  const checksum = crc32(content);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4);
  local.writeUInt32LE(checksum, 14); local.writeUInt32LE(content.length, 18);
  local.writeUInt32LE(content.length, 22); local.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
  central.writeUInt32LE(checksum, 16); central.writeUInt32LE(content.length, 20);
  central.writeUInt32LE(content.length, 24); central.writeUInt16LE(filename.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + filename.length, 12);
  end.writeUInt32LE(local.length + filename.length + content.length, 16);
  return { name, mimeType: 'application/zip', buffer: Buffer.concat([local, filename, content, central, filename, end]) };
}

async function createWork(page: Page, title = '发行版本回归验收') {
  const slug = `release-editor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await page.goto('/');
  await page.getByRole('button', { name: '新建作品', exact: true }).click();
  await page.getByLabel('作品名称', { exact: true }).fill(title);
  await page.getByLabel('稳定 slug').fill(slug);
  return slug;
}

async function openReleases(page: Page) {
  await page.getByRole('button', { name: '发行版本', exact: true }).click();
}

async function addRelease(page: Page, label = '') {
  await page.getByRole('button', { name: '添加版本', exact: true }).click();
  await expect(page.locator('.release-editor')).toHaveCount(1);
  await expect(page.getByLabel('版本号', { exact: true })).toHaveValue('');
  if (label) await page.getByLabel('版本号', { exact: true }).fill(label);
}

async function saveDraft(page: Page) {
  const saved = page.waitForResponse(response => /\/api\/works\/[^/]+$/.test(new URL(response.url()).pathname) && response.request().method() === 'PUT');
  await page.getByRole('button', { name: '保存草稿', exact: true }).first().click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByText('草稿已保存到私有存储。', { exact: false })).toBeVisible();
}

async function uploadFile(page: Page, fixtures: ReturnType<typeof zipFixture> | ReturnType<typeof zipFixture>[]) {
  const files = Array.isArray(fixtures) ? fixtures : [fixtures];
  const input = page.getByLabel('选择发行文件', { exact: true });
  await expect(input).toBeEnabled();
  await input.setInputFiles(files);
  await expect(page.getByText('文件已验证并关联，请保存作品草稿。', { exact: true })).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.release-editor .file-row')).toHaveCount(files.length);
  for (const file of files) await expect(page.locator('.release-editor')).toContainText(file.name);
}

async function storedWork(page: Page, slug: string) {
  const response = await page.request.get('/api/library');
  expect(response.status()).toBe(200);
  const { library } = await response.json() as { library: Library };
  const work = library.works.find(item => item.project.slug === slug);
  expect(work, `服务器应保留作品 ${slug}`).toBeTruthy();
  return work!;
}

async function reopenWork(page: Page, slug: string) {
  await page.reload();
  await page.getByLabel('搜索作品', { exact: true }).fill(slug);
  await page.locator('.work-row').click();
  await openReleases(page);
}

function watchUploadSessions(page: Page) {
  const sessions: { workId: string; versionId: string }[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/uploads' && request.method() === 'POST') {
      const body = request.postDataJSON() as { workId: string; versionId: string };
      sessions.push({ workId: body.workId, versionId: body.versionId });
    }
  });
  return sessions;
}

async function expectVersionError(page: Page) {
  const input = page.getByLabel('版本号', { exact: true });
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  const description = await input.getAttribute('aria-describedby');
  expect(description).toBeTruthy();
  const inlineError = page.locator(`[id="${description}"]`);
  await expect(inlineError).toContainText('版本号');
  await expect(inlineError).not.toContainText(/must match|pattern/);
}

test('连续新增版本即可真实上传，文件关联独立且空版本号草稿可在刷新后保留', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const sessions = watchUploadSessions(page);
  const slug = await createWork(page);
  const first = zipFixture('first-release.zip'); const second = zipFixture('second-release.zip'); const extra = zipFixture('second-extra.zip');
  await openReleases(page);
  await addRelease(page, '1.0');
  // Neither the new work nor its first release has been manually saved.
  await uploadFile(page, first);
  await addRelease(page);
  await uploadFile(page, [second, extra]);
  await expect(page.locator('.release-editor .file-row')).toHaveCount(2);
  await expect(page.locator('.release-editor')).not.toContainText(first.name);
  await saveDraft(page);

  const work = await storedWork(page, slug);
  expect(work.versions).toHaveLength(2);
  expect(work.versions.map(version => version.label)).toEqual(['', '1.0']);
  expect(work.versions.map(version => version.files.map(file => file.displayName ?? file.name))).toEqual([[second.name, extra.name], [first.name]]);
  expect(work.versions[0].files.map(file => file.primary)).toEqual([true, false]);
  expect(sessions).toEqual([work.versions[1], work.versions[0], work.versions[0]].map(version => ({ workId: work.id, versionId: version.id })));
  for (const [index, fixtures] of [[second, extra], [first]].entries()) {
    for (const [fileIndex, fixture] of fixtures.entries()) {
      const file = work.versions[index].files[fileIndex];
      expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
      const download = await page.request.get(`/api/files/${file.id}`);
      expect(download.status()).toBe(200);
      expect(await download.body()).toEqual(fixture.buffer);
    }
  }

  await reopenWork(page, slug);
  const list = page.getByRole('navigation', { name: '发行版本列表', exact: true });
  await expect(list.getByRole('button')).toHaveCount(2);
  await list.getByRole('button').first().click();
  await expect(page.getByLabel('版本号', { exact: true })).toHaveValue('');
  await expect(page.locator('.release-editor .file-row')).toHaveCount(2);
  await expect(page.locator('.release-editor .file-row').first()).toContainText(second.name);
  await expect(page.locator('.release-editor .file-row').last()).toContainText(extra.name);
  await list.getByRole('button').last().click();
  await expect(page.getByLabel('版本号', { exact: true })).toHaveValue('1.0');
  await expect(page.locator('.release-editor .file-row')).toContainText(first.name);
  expect(errors).toEqual([]);
});

test('多个未命名私有版本可保存和恢复，切换已发行时给出版本号中文提示', async ({ page }) => {
  const slug = await createWork(page);
  await openReleases(page); await addRelease(page); await addRelease(page);
  await saveDraft(page);
  expect((await storedWork(page, slug)).versions.map(version => ({ label: version.label, status: version.status })))
    .toEqual([{ label: '', status: 'draft' }, { label: '', status: 'draft' }]);
  await reopenWork(page, slug);
  await expect(page.getByRole('navigation', { name: '发行版本列表', exact: true }).getByRole('button')).toHaveCount(2);
  await page.getByRole('combobox', { name: '发行状态', exact: true }).selectOption('released');
  await page.getByRole('button', { name: '保存草稿', exact: true }).first().click();
  await expectVersionError(page);
  expect((await storedWork(page, slug)).versions.every(version => version.status === 'draft')).toBe(true);
});

test('非法版本号不创建上传会话，修正后可重新选择同一文件上传', async ({ page }) => {
  const sessions = watchUploadSessions(page);
  await createWork(page); await openReleases(page); await addRelease(page, '1.0 中文');
  const fixture = zipFixture('same-file-retry.zip');
  await page.getByLabel('选择发行文件', { exact: true }).setInputFiles(fixture);
  await expectVersionError(page);
  await expect(page.getByRole('button', { name: '重试续传', exact: true })).toBeVisible();
  expect(sessions).toHaveLength(0);
  await page.getByLabel('版本号', { exact: true }).fill('1.0.0+fabric');
  await uploadFile(page, fixture);
  expect(sessions).toHaveLength(1);
});

test('真实并发保存冲突阻止上传，关闭冲突对话框仍保留本机作品和新版本', async ({ page }) => {
  const slug = await createWork(page, '冲突开始前');
  await saveDraft(page);
  const base = await storedWork(page, slug);
  await page.getByLabel('作品名称', { exact: true }).fill('本机修改仍须保留');
  await openReleases(page); await addRelease(page, '2.0');
  const remote: Work = { ...base, project: { ...base.project, title: { zh: '其他管理员已保存' } } };
  const changed = await page.request.put(`/api/works/${base.id}`, {
    headers: { 'X-Fimel-CSRF': '1', Origin: 'http://127.0.0.1:5174' }, data: { base, work: remote },
  });
  expect(changed.status()).toBe(200);
  const sessions = watchUploadSessions(page);
  await page.getByLabel('选择发行文件', { exact: true }).setInputFiles(zipFixture('conflict-must-not-upload.zip'));
  const conflict = page.getByRole('dialog', { name: '此作品存在编辑冲突', exact: true });
  await expect(conflict).toBeVisible();
  expect(sessions).toHaveLength(0);
  await expect(conflict).toContainText('本机修改仍须保留');
  await conflict.getByRole('button', { name: '保留编辑，稍后处理', exact: true }).click();
  await expect(page.getByLabel('版本号', { exact: true })).toHaveValue('2.0');
  await page.getByRole('button', { name: '基本信息', exact: true }).click();
  await expect(page.getByLabel('作品名称', { exact: true })).toHaveValue('本机修改仍须保留');
  const server = await storedWork(page, slug);
  expect(server.project.title).toEqual({ zh: '其他管理员已保存' });
  expect(server.versions).toHaveLength(0);
});

test('取消正在上传的真实会话不会重复创建会话或丢失当前版本', async ({ page }) => {
  const sessions = watchUploadSessions(page);
  const slug = await createWork(page); await openReleases(page); await addRelease(page, '3.0');
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  let partRequested = false;
  await page.route('**/api/uploads/*/parts/1', async route => {
    partRequested = true; await gate;
    try { await route.continue(); } catch { /* The browser can abort the held request when cancellation wins. */ }
  });
  try {
    await page.getByLabel('选择发行文件', { exact: true }).setInputFiles(zipFixture('cancel-release.zip'));
    await expect.poll(() => partRequested, { timeout: 30000 }).toBe(true);
    const cancelled = page.waitForResponse(response => /\/api\/uploads\/[^/]+$/.test(new URL(response.url()).pathname) && response.request().method() === 'DELETE');
    await page.getByRole('button', { name: '取消会话', exact: true }).click();
    expect((await cancelled).ok()).toBe(true);
    await expect(page.getByText('会话已取消，未发布文件。', { exact: true })).toBeVisible();
    release();
    expect(sessions).toHaveLength(1);
    await expect(page.getByLabel('版本号', { exact: true })).toHaveValue('3.0');
    await expect(page.locator('.release-editor .file-row')).toHaveCount(0);
    const work = await storedWork(page, slug);
    const uploaded = await (await page.request.get('/api/uploads')).json() as { uploads: Upload[] };
    expect(uploaded.uploads.filter(upload => upload.workId === work.id)).toEqual([
      expect.objectContaining({ status: 'cancelled', versionId: work.versions[0].id }),
    ]);
  } finally { release(); await page.unroute('**/api/uploads/*/parts/1'); }
});

test('版本列表可用键盘切换，明暗主题和390像素布局都保留单个编辑面板且无横向溢出', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await createWork(page); await openReleases(page); await addRelease(page, '1.0'); await addRelease(page, '2.0');
  const list = page.getByRole('navigation', { name: '发行版本列表', exact: true });
  const newest = list.getByRole('button').first(); const previous = list.getByRole('button').last();
  await newest.focus(); await page.keyboard.press('Tab'); await expect(previous).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(previous).toHaveAttribute('aria-current', 'true');
  await expect(page.getByLabel('版本号', { exact: true })).toHaveValue('1.0');
  await newest.focus(); await page.keyboard.press('Space');
  await expect(newest).toHaveAttribute('aria-current', 'true');
  await expect(page.getByLabel('版本号', { exact: true })).toHaveValue('2.0');
  for (const dark of [false, true]) {
    if (await page.locator('html').evaluate(node => node.classList.contains('dark')) !== dark) {
      await page.getByRole('button', { name: '切换主题', exact: true }).click();
    }
    await expect(page.locator('.release-editor')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`release-editor-${dark ? 'dark' : 'light'}-desktop.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByLabel('选择发行文件', { exact: true })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('release-editor-dark-mobile.png'), fullPage: true });
  expect(errors).toEqual([]);
});
