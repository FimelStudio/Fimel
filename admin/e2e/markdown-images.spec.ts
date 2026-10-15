import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function transfer(page: Page, kind: 'drop' | 'paste', names: string[], bytes: Buffer, mime = 'image/png') {
  return page.getByLabel('Markdown 正文', { exact: true }).evaluate((node, input) => {
    const data = new DataTransfer();
    for (const name of input.names) data.items.add(new File([new Uint8Array(input.bytes)], name, { type: input.mime }));
    const event = input.kind === 'drop' ? new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data })
      : new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data });
    return node.dispatchEvent(event);
  }, { kind, names, bytes: [...bytes], mime });
}

test('drop and paste image files upload through real R2, retain prose and match the public gallery preview', async ({ page }) => {
  const errors:string[]=[];page.on('pageerror', error=>errors.push(error.message));
  const slug = `inline-images-${Date.now()}`;const png = await readFile('public/assets/brand/fimel-logo.png');
  await page.goto('/');await page.getByRole('button', { name: '新建作品', exact: true }).click();
  await page.getByLabel('作品名称', { exact: true }).fill('直接导入图片');await page.getByLabel('稳定 slug').fill(slug);
  await page.getByRole('button', { name: '正文与预览', exact: true }).click();const editor = page.getByLabel('Markdown 正文', { exact: true });
  await editor.fill('Before\n\nAfter');await editor.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(6, 6));
  // No manual draft save or trip to the cover tab is needed.
  expect(await transfer(page, 'drop', ['拖入一.png', '拖入二.png'], png)).toBe(false);
  await expect(page.locator('.project-gallery-slide')).toHaveCount(2, { timeout: 30000 });
  await expect(editor).toBeEditable();const text = await editor.inputValue();
  expect(text).toMatch(/Before[\s\S]*fimel-asset:[\s\S]*fimel-asset:[\s\S]*After/);
  await expect(page.getByRole('region', { name: '作品图片', exact: true })).toHaveCount(1);
  await expect(page.locator('.project-gallery img').first()).toBeVisible();
  await page.getByRole('button', { name: '下一张图片', exact: true }).click();await expect(page.locator('.project-gallery [role=status]')).toContainText('第 2 张');
  await editor.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(node.value.length, node.value.length));
  expect(await transfer(page, 'paste', ['clipboard-image'], png)).toBe(false);
  await expect(page.locator('.project-gallery-slide')).toHaveCount(3, { timeout: 30000 });await expect(editor).toBeEditable();
  expect(await editor.inputValue()).toContain('After');
  await page.getByRole('button', { name: 'English', exact: true }).click();await expect(editor).toHaveValue('');
  await page.getByRole('button', { name: '中文', exact: true }).click();expect((await editor.inputValue()).match(/fimel-asset:/g)).toHaveLength(3);
  await page.getByRole('button', { name: '保存草稿', exact: true }).first().click();await expect(page.getByText('草稿已保存到私有存储。')).toBeVisible();
  const state = await (await page.request.get('/api/library')).json();const work = state.library.works.find((item: { project: { slug: string } }) => item.project.slug === slug);
  expect(work.gallery).toHaveLength(3);expect(work.project.image).toBe('assets/brand/fimel-logo.svg');expect(work.coverId).toBeUndefined();
  expect(state.public.projects.some((item: { slug: string }) => item.slug === slug)).toBe(false);
  await page.screenshot({ path: '.artifacts/admin-screenshots/inline-images-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.artifacts/admin-screenshots/inline-images-mobile.png', fullPage: true });
  await expect.poll(()=>page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);expect(errors).toEqual([]);
  await editor.fill('Images removed; keep this text.');await expect(page.locator('.project-gallery')).toHaveCount(0);
  await page.getByRole('button',{name:'保存草稿',exact:true}).first().click();await expect(page.getByText('草稿已保存到私有存储。')).toBeVisible();
  const after=await(await page.request.get('/api/library')).json();const retained=after.library.works.find((item:{project:{slug:string}})=>item.project.slug===slug);
  expect(retained.gallery).toHaveLength(3);expect(retained.markdown.description.zh).toBe('Images removed; keep this text.');
  await page.reload();await page.getByLabel('搜索作品',{exact:true}).fill(slug);await page.locator('.work-row').click();await page.getByRole('button',{name:'正文与预览',exact:true}).click();
  await expect(page.getByLabel('Markdown 正文',{exact:true})).toHaveValue('Images removed; keep this text.');await expect(page.locator('.project-gallery')).toHaveCount(0);
});

test('failed image batches retry only remaining files; unsupported files and normal text do not destroy prose', async ({ page }) => {
  const png = await readFile('public/assets/brand/fimel-logo.png');await page.goto('/');await page.getByRole('button', { name: '新建作品', exact: true }).click();
  await page.getByLabel('作品名称', { exact: true }).fill('图片重试');await page.getByLabel('稳定 slug').fill(`inline-retry-${Date.now()}`);
  await page.getByRole('button', { name: '正文与预览', exact: true }).click();const editor = page.getByLabel('Markdown 正文', { exact: true });await editor.fill('保留这段文字');
  expect(await transfer(page, 'paste', ['bad.gif'], png, 'image/gif')).toBe(false);await expect(page.getByRole('alert')).toContainText('仅支持 PNG');await expect(editor).toHaveValue('保留这段文字');
  expect(await editor.evaluate(node => node.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true })))).toBe(true);
  let created = 0;
  await page.route('**/api/uploads', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    created++;if (created === 2) return route.fulfill({ status: 503, json: { error: '故意中断第二张图片' } });return route.continue();
  });
  await transfer(page, 'drop', ['retry-one.png', 'retry-two.png'], png);
  await expect(page.getByRole('alert')).toContainText('故意中断第二张图片');expect((await editor.inputValue()).match(/fimel-asset:/g)).toHaveLength(1);
  await page.getByRole('button', { name: '重试续传', exact: true }).click();await expect(page.locator('.project-gallery-slide')).toHaveCount(2, { timeout: 30000 });
  await expect(editor).toBeEditable();expect(created).toBe(3);expect((await editor.inputValue()).match(/fimel-asset:/g)).toHaveLength(2);expect(await editor.inputValue()).toContain('保留这段文字');
});
