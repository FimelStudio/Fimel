import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function editingWork(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '新建作品', exact: true }).click();
  await page.getByLabel('作品名称', { exact: true }).fill('草稿保存故障验收');
  await page.getByLabel('稳定 slug').fill(`save-reliability-${Date.now()}`);
  await page.getByRole('button', { name: '正文与预览', exact: true }).click();
  await page.getByLabel('Markdown 正文', { exact: true }).fill('本地编辑内容，应在网络故障后保留。');
}

test('保存连接中断时恢复按钮并保留正文，重新保存可成功', async ({ page }) => {
  await editingWork(page);
  await page.route('**/api/works/*', route => route.abort('connectionreset'));
  await page.getByRole('button', { name: '保存草稿', exact: true }).first().click();
  await expect(page.getByRole('alert')).toContainText('暂时无法确认草稿保存结果');
  await expect(page.getByLabel('Markdown 正文', { exact: true })).toHaveValue('本地编辑内容，应在网络故障后保留。');
  await expect(page.getByRole('button', { name: '保存草稿', exact: true }).first()).toBeEnabled();
  await expect(page.getByRole('button', { name: '导出当前修改', exact: true })).toBeEnabled();
  await page.unroute('**/api/works/*');
  await page.getByRole('button', { name: '保存草稿', exact: true }).first().click();
  await expect(page.getByText('草稿已保存到私有存储。', { exact: false })).toBeVisible();
});

test('服务器已保存但响应丢失时确认成功，仅写入一次且官网不变', async ({ page }) => {
  await editingWork(page);
  const before = await (await page.request.get('/api/library')).json();
  let writes = 0;
  await page.route('**/api/works/*', async route => {
    writes++; const response = await route.fetch(); expect(response.status()).toBe(200); await route.abort('connectionreset');
  });
  await page.getByRole('button', { name: '保存草稿', exact: true }).first().click();
  await expect(page.getByText('草稿已保存到私有存储。', { exact: false })).toBeVisible();
  expect(writes).toBe(1);
  const after = await (await page.request.get('/api/library')).json();
  expect(after.publicEtag).toBe(before.publicEtag);
  await expect(page.getByLabel('Markdown 正文', { exact: true })).toHaveValue('本地编辑内容，应在网络故障后保留。');
});

test('保存和核对都悬挂时按时恢复，等待时仍可导出，不丢失编辑', async ({ page }) => {
  await editingWork(page); await page.clock.install();
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/works/*', async route => { await gate; await route.abort('connectionreset').catch(() => {}); });
  await page.route('**/api/library', async route => { await gate; await route.abort('connectionreset').catch(() => {}); });
  await page.getByRole('button', { name: '保存草稿', exact: true }).first().click();
  await expect(page.getByRole('status').filter({ hasText: '正在保存草稿' })).toBeVisible();
  await expect(page.getByRole('button', { name: '导出当前修改', exact: true })).toBeEnabled();
  await page.clock.fastForward(30_100);
  await expect(page.getByRole('status').filter({ hasText: '正在核对服务器' })).toBeVisible();
  await page.clock.fastForward(15_100);
  await expect(page.getByRole('alert')).toContainText('暂时无法确认草稿保存结果');
  await expect(page.getByRole('button', { name: '保存草稿', exact: true }).first()).toBeEnabled();
  await expect(page.getByLabel('Markdown 正文', { exact: true })).toHaveValue('本地编辑内容，应在网络故障后保留。');
  await page.screenshot({ path: '.artifacts/save-hang-20261119/save-recovered.png', fullPage: true });
  release();
});
