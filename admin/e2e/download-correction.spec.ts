import { expect, test, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { makeWork } from '../shared/model';
import type { Library, PublicManifest, Work } from '../shared/model';
import type { DownloadCorrectionState } from '../../src/content/download-corrections';
import { DOWNLOAD_CORRECTIONS_KEY } from '../../src/content/download-corrections';
import { workEventKey } from '../../src/content/work-events';

// Browser UI plus the real Admin Worker, collector and isolated in-memory R2.
// No test route or privileged seed endpoint is added to the shipped Workers.
let runtime: Miniflare;
let work: Work;
let privateWork: Work;
let bedrock: Work;
let originalLibrary: Library;
const origin = 'http://127.0.0.1:5174';
const today = new Date().toISOString().slice(0, 10);
test.beforeAll(async () => {
  const bundle = await build({ stdin: { contents: `import local from './admin/worker/local';
    import {collectWorkEvent} from './src/lib/work-event-worker';
    export default{fetch(request,env,ctx){
      if(new URL(request.url).pathname==='/__collect')return collectWorkEvent(request,env.PUBLIC,env.METRICS_LIMITER);
      return local.fetch(request,env,ctx);
    }}`, resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'browser' });
  runtime = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-10-12', r2Buckets: ['PRIVATE', 'PUBLIC'],
    bindings: { ADMIN_ORIGIN: origin, ACCESS_AUD: 'local-test', ACCESS_ISSUER: 'https://local.invalid', ADMIN_EMAILS: 'local-admin@example.invalid' },
    ratelimits: { METRICS_LIMITER: { namespace_id: '12010', simple: { limit: 45, period: 60 } } } }));
  await runtime.ready;
});
test.afterAll(async () => { await runtime?.dispose(); });
test.beforeEach(async ({ page }) => {
  const privateBucket = await runtime.getR2Bucket('PRIVATE'), publicBucket = await runtime.getR2Bucket('PUBLIC');
  for (const bucket of [privateBucket, publicBucket]) { const objects = (await bucket.list()).objects; if (objects.length) await bucket.delete(objects.map(object => object.key)); }
  const fixture = (slug: string, type: Work['project']['type'] = 'datapacks') => {
    const value = makeWork(); value.project.slug = slug; value.project.type = type; value.project.title = { zh: `本地校正作品 ${slug}` }; value.project.status = 'released';
    value.project.download = `https://example.invalid/${slug}.zip`; value.markdown.description.zh = '# 校正验收正文'; return value;
  };
  work = fixture('correction-browser'); privateWork = fixture('correction-private'); bedrock = fixture('correction-bedrock', 'bedrock');
  bedrock.project.downloads = 123456;
  originalLibrary = { schemaVersion: 1, works: [work, privateWork, bedrock] };
  const manifest: PublicManifest = { schemaVersion: 2, publicationId: crypto.randomUUID(), projects: [work.project, bedrock.project], releases: {} };
  await privateBucket.put('state/library.json', JSON.stringify(originalLibrary));
  await publicBucket.put('data/works.json', JSON.stringify(manifest));
  await publicBucket.put(workEventKey('2020-01-01'), JSON.stringify({ date: '2020-01-01', works: { [work.project.slug]: { views: 2, downloadClicks: 999 } } }));
  await publicBucket.put(workEventKey(today), JSON.stringify({ date: today, works: { [work.project.slug]: { views: 9, downloadClicks: 7 } } }));
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const response = await runtime.dispatchFetch(`http://127.0.0.1${url.pathname}${url.search}`, {
      method: request.method(), headers: { ...request.headers(), origin, connection: 'close' },
      ...(request.postDataBuffer() ? { body: request.postDataBuffer()! } : {}),
    });
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
  });
});

async function openWork(page: Page, slug = work.project.slug) {
  await page.goto('/'); await page.getByLabel('搜索作品', { exact: true }).fill(slug); await page.locator('.work-row').click();
}
function section(page: Page) { return page.getByRole('region', { name: '校正下载数', exact: true }); }
async function confirm(page: Page, target: string) {
  await section(page).getByLabel('希望显示的下载数', { exact: true }).fill(target);
  await section(page).getByRole('button', { name: '校正下载数', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '确认校正下载数', exact: true }); await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '确认修改下载数', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
async function correctionState() {
  const response = await runtime.dispatchFetch(`http://127.0.0.1/api/download-corrections/${work.id}`);
  expect(response.status).toBe(200); return response.json() as Promise<DownloadCorrectionState>;
}
async function clickDownload() {
  const response = await runtime.dispatchFetch('https://studiofimel.com/__collect', { method: 'POST', headers: { Origin: 'https://studiofimel.com', 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.9' }, body: JSON.stringify({ slug: work.project.slug, kind: 'download' }) });
  expect(response.status).toBe(204);
}

test('独立校正真实R2下载数，后续点击继续增加，刷新保留且不保存作品正文，日志可见', async ({ page }) => {
  await openWork(page); const panel = section(page);
  await expect(panel.getByTestId('current-download-count')).toHaveText('1,006');
  await expect(panel).toContainText('独立修改统计，确认后直接更新官网，无需重新发布作品。');
  await page.getByLabel('简短介绍', { exact: true }).fill('尚未保存的正文关联字段');
  await panel.getByLabel('校正原因', { exact: true }).fill('补录历史下载量');
  await confirm(page, '5000');
  await expect(panel.getByRole('status')).toContainText('下载数已校正');
  await expect(panel.getByTestId('current-download-count')).toHaveText('5,000');
  const stored = await (await runtime.getR2Bucket('PRIVATE')).get('state/library.json'); expect(await stored!.json()).toEqual(originalLibrary);
  const anchor = (await correctionState()).correction!; expect(anchor.value).toBe(5000); expect(anchor.anchorClicks).toBe(7);
  await clickDownload(); await panel.getByRole('button', { name: '重新读取下载数', exact: true }).click();
  await expect(panel.getByTestId('current-download-count')).toHaveText('5,001');
  const publicBucket = await runtime.getR2Bucket('PUBLIC');
  const todayRecord = await (await publicBucket.get(workEventKey(today)))!.json<{ works: Record<string, { downloadClicks: number }> }>();
  expect(todayRecord.works[work.project.slug].downloadClicks).toBe(8);
  const originalDay = await (await publicBucket.get(workEventKey('2020-01-01')))!.json<{ works: Record<string, { downloadClicks: number }> }>();
  expect(originalDay.works[work.project.slug].downloadClicks).toBe(999);
  await page.getByRole('button', { name: '保存草稿', exact: true }).first().click();
  await expect(page.getByText('草稿已保存到私有存储。', { exact: false })).toBeVisible();
  await openWork(page); await expect(section(page).getByTestId('current-download-count')).toHaveText('5,001');
  await page.getByRole('button', { name: '管理员日志', exact: true }).click();
  const audit = page.locator('.audit-list article').filter({ has: page.getByText('校正下载量', { exact: true }) });
  await expect(audit).toHaveCount(1); await expect(audit).toContainText('已完成');
  await audit.locator('summary').click(); await expect(audit).toContainText('补录历史下载量'); await expect(audit).toContainText('5000');
});

test('零值与非法输入，校正输入不会被保存草稿吞掉，移动端和确认对话框不溢出', async ({ page }) => {
  await openWork(page); const panel = section(page); await expect(panel.getByTestId('current-download-count')).toHaveText('1,006');
  let requests = 0; page.on('request', request => { if (request.method() === 'PUT' && request.url().includes('/api/download-corrections/')) requests++; });
  const input = panel.getByLabel('希望显示的下载数', { exact: true });
  for (const target of ['-1', '1.5', '1e3', '9007199254740992', '']) {
    await input.fill(target); await panel.getByRole('button', { name: '校正下载数', exact: true }).click();
    await expect(input).toHaveAttribute('aria-invalid', 'true'); await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  expect(requests).toBe(0);
  await input.fill('0'); await page.getByRole('button', { name: '保存草稿', exact: true }).first().click();
  await expect(input).toHaveValue('0'); expect((await correctionState()).correction).toBeNull();
  await page.getByRole('button', { name: '正文与预览', exact: true }).click(); await page.getByRole('button', { name: '基本信息', exact: true }).click();
  await expect(input).toHaveValue('0');
  await page.getByRole('button', { name: '切换主题', exact: true }).click();
  await panel.screenshot({ path: '.artifacts/download-correction-review/editor-desktop-dark.png' });
  await panel.getByRole('button', { name: '校正下载数', exact: true }).click();
  const desktopDialog = page.getByRole('dialog', { name: '确认校正下载数', exact: true });
  await expect(desktopDialog).toBeVisible(); await desktopDialog.screenshot({ path: '.artifacts/download-correction-review/confirm-desktop-dark.png' });
  await desktopDialog.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '切换主题', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await panel.screenshot({ path: '.artifacts/download-correction-review/editor-mobile.png' });
  await panel.getByRole('button', { name: '校正下载数', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '确认校正下载数', exact: true });
  await expect(dialog).toContainText('0（官网隐藏）'); await expect.poll(() => dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await dialog.screenshot({ path: '.artifacts/download-correction-review/confirm-mobile.png' });
  await dialog.getByRole('button', { name: '确认修改下载数', exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(panel.getByTestId('current-download-count')).toHaveText('0');
  await clickDownload(); await panel.getByRole('button', { name: '重新读取下载数', exact: true }).click();
  await expect(panel.getByTestId('current-download-count')).toHaveText('1');
});

test('并发校正冲突保留输入，刷新核对再确认不会覆盖旧状态，导航有保护', async ({ page }) => {
  await openWork(page); const panel = section(page); await expect(panel.getByTestId('current-download-count')).toHaveText('1,006');
  const state = await correctionState();
  const other = await runtime.dispatchFetch(`http://127.0.0.1/api/download-corrections/${work.id}`, { method: 'PUT', headers: { Origin: origin, 'X-Fimel-CSRF': '1', 'Content-Type': 'application/json', 'If-Match': state.etag }, body: JSON.stringify({ value: 300, operationId: crypto.randomUUID() }) });
  expect(other.status).toBe(200);
  await confirm(page, '700'); await expect(panel.getByRole('alert')).toContainText('输入已保留');
  await expect(panel.getByLabel('希望显示的下载数', { exact: true })).toHaveValue('700');
  await expect(panel.getByRole('button', { name: '校正下载数', exact: true })).toBeDisabled();
  page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: '返回', exact: true }).click(); await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: '重新读取下载数', exact: true }).click(); await expect(panel.getByTestId('current-download-count')).toHaveText('300');
  await confirm(page, '700'); await expect(panel.getByTestId('current-download-count')).toHaveText('700');
  await expect(panel.getByLabel('希望显示的下载数', { exact: true })).toHaveValue('');
});

test('网络响应丢失后重试沿用操作ID，不重复锚定新点击；校正中阻止保存和导航', async ({ page }) => {
  await openWork(page); const panel = section(page); await expect(panel.getByTestId('current-download-count')).toHaveText('1,006');
  let lost = false; const operations: string[] = []; let release: (() => void) | undefined;
  await page.route(`**/api/download-corrections/${work.id}`, async route => {
    if (route.request().method() !== 'PUT') { await route.fallback(); return; }
    const request = route.request(); operations.push(request.postDataJSON().operationId);
    const response = await runtime.dispatchFetch(`http://127.0.0.1/api/download-corrections/${work.id}`, { method: 'PUT', headers: { ...request.headers(), origin }, body: request.postData()! });
    if (!lost) { lost = true; await new Promise<void>(resolve => { release = resolve; }); await route.abort('failed'); return; }
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
  });
  await panel.getByLabel('希望显示的下载数', { exact: true }).fill('100'); await panel.getByRole('button', { name: '校正下载数', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '确认校正下载数', exact: true }); await dialog.getByRole('button', { name: '确认修改下载数', exact: true }).click();
  await expect.poll(() => !!release).toBe(true); await expect(page.getByRole('button', { name: '返回', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '处理中', exact: true }).first()).toBeDisabled(); await expect(page.getByRole('button', { name: '管理员日志', exact: true })).toBeDisabled();
  await clickDownload(); const originalOperation = (await correctionState()).correction!; expect(originalOperation.anchorClicks).toBe(7);
  release!(); await expect(dialog).toHaveCount(0); await expect(panel.getByRole('alert')).toContainText('结果尚未确认');
  await confirm(page, '100'); await expect(panel.getByTestId('current-download-count')).toHaveText('101');
  expect(operations).toHaveLength(2); expect(operations[0]).toBe(operations[1]); expect((await correctionState()).correction).toEqual(originalOperation);
});

for (const preserveNewInput of [false, true]) test(`响应丢失后重新读取确认成功${preserveNewInput ? '保留不同新输入且标明未应用' : '清除原输入，不重复锚定新增点击'}`, async ({ page }) => {
  await openWork(page); const panel = section(page); await expect(panel.getByTestId('current-download-count')).toHaveText('1,006');
  let writes = 0;
  await page.route(`**/api/download-corrections/${work.id}`, async route => {
    if (route.request().method() !== 'PUT') { await route.fallback(); return; }
    writes++;
    const request = route.request(); const response = await runtime.dispatchFetch(`http://127.0.0.1/api/download-corrections/${work.id}`, { method: 'PUT', headers: { ...request.headers(), origin }, body: request.postData()! });
    expect(response.status).toBe(200); await route.abort('failed');
  });
  await panel.getByLabel('校正原因', { exact: true }).fill('此前的校正');
  await confirm(page, '100'); await expect(panel.getByRole('alert')).toContainText('结果尚未确认');
  await clickDownload();
  const original = (await correctionState()).correction!;
  if (preserveNewInput) { await panel.getByLabel('希望显示的下载数', { exact: true }).fill('200'); await panel.getByLabel('校正原因', { exact: true }).fill('新的校正意图'); }
  await panel.getByRole('button', { name: '重新读取下载数', exact: true }).click();
  await expect(panel.getByTestId('current-download-count')).toHaveText('101');
  await expect(panel.getByRole('status')).toContainText('已确认上次校正成功');
  await expect(panel.getByLabel('希望显示的下载数', { exact: true })).toHaveValue(preserveNewInput ? '200' : '');
  await expect(panel.getByLabel('校正原因', { exact: true })).toHaveValue(preserveNewInput ? '新的校正意图' : '');
  if (preserveNewInput) await expect(panel.getByRole('status')).toContainText('当前的新输入尚未应用');
  else { await panel.getByRole('button', { name: '校正下载数', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); }
  expect(writes).toBe(1); expect((await correctionState()).correction).toEqual(original);
});

test('作品草稿正在保存时校正入口禁用，不和真实内容写入并发', async ({ page }) => {
  await openWork(page); const panel = section(page); await expect(panel.getByTestId('current-download-count')).toHaveText('1,006');
  let release: (() => void) | undefined;
  await page.route(`**/api/works/${work.id}`, async route => {
    await new Promise<void>(resolve => { release = resolve; }); await route.fallback();
  });
  await page.getByLabel('简短介绍', { exact: true }).fill('保持草稿保存与校正互斥');
  await page.getByRole('button', { name: '保存草稿', exact: true }).first().click();
  await expect.poll(() => !!release).toBe(true);
  await expect(panel.getByRole('button', { name: '校正下载数', exact: true })).toBeDisabled();
  await expect(panel.getByRole('button', { name: '重新读取下载数', exact: true })).toBeDisabled();
  await expect(panel.getByLabel('希望显示的下载数', { exact: true })).toBeDisabled();
  release!(); await expect(page.getByText('草稿已保存到私有存储。', { exact: false })).toBeVisible();
  await expect(panel.getByRole('button', { name: '校正下载数', exact: true })).toBeEnabled();
  expect((await correctionState()).correction).toBeNull();
});

test('未公开作品解释先公开且不请求校正，基岩版保留历史下载量流程，不显示新入口', async ({ page }) => {
  await openWork(page, privateWork.project.slug); await expect(section(page)).toContainText('作品尚未公开，请先发布作品');
  await expect(page.getByLabel('希望显示的下载数', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '返回', exact: true }).click(); await page.getByLabel('搜索作品', { exact: true }).fill(bedrock.project.slug); await page.locator('.work-row').click();
  await expect(page.getByRole('region', { name: '校正下载数', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '完整字段', exact: true }).click(); await expect(page.locator('.json-editor')).toHaveValue(/123456/);
  expect(await (await runtime.getR2Bucket('PUBLIC')).get(DOWNLOAD_CORRECTIONS_KEY)).toBeNull();
});

test('当前统计读取失败不当作零值，重新读取成功才允许确认', async ({ page }) => {
  let unavailable = true; await page.route('**/api/work-downloads*', async route => { if (unavailable) await route.fulfill({ status: 503, json: { error: '本地模拟统计读取失败' } }); else await route.fallback(); });
  await openWork(page); const panel = section(page); await expect(panel.getByTestId('current-download-count')).toHaveText('读取失败');
  await expect(panel.getByRole('button', { name: '校正下载数', exact: true })).toBeDisabled();
  unavailable = false; await panel.getByRole('button', { name: '重新读取下载数', exact: true }).click(); await expect(panel.getByTestId('current-download-count')).toHaveText('1,006');
  await expect(panel.getByRole('button', { name: '校正下载数', exact: true })).toBeEnabled();
});
