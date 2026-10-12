import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const repository = 'https://github.com/Ylong4004/Minecraft-Explorer';
const fileName = 'MinecraftExplorer-1.0-win-x64.exe';
const filePath = `plugins/minecraft-explorer/${fileName}`;

test('Explorer is discoverable in tools and downloads exactly the published EXE', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('fimel_intro_seen', '1');
    localStorage.setItem('fimel_user_lang', 'zh');
  });
  await page.goto('/#/works?type=tools');
  await page.getByRole('searchbox', { name: '搜索作品' }).fill('Minecraft Explorer');
  await expect(page.locator('.work-row')).toHaveCount(1);
  await page.locator('.work-row').click();
  await expect(page.getByRole('heading', { name: 'Minecraft Explorer', level: 1 }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'GitHub 仓库', exact: true })).toHaveAttribute('href', repository);
  await expect(page.locator('.project-markdown')).toContainText('添加 Minecraft 根目录');
  const link = page.getByRole('link', { name: '下载', exact: true });
  await expect(link).toHaveAttribute('href', `/${filePath}`);
  const downloads: string[] = [];
  page.on('download', download => downloads.push(download.suggestedFilename()));
  const started = page.waitForEvent('download');
  await link.click();
  const download = await started;
  expect(download.suggestedFilename()).toBe(fileName);
  const received = await readFile((await download.path())!);
  const published = await readFile(new URL(`../public/${filePath}`, import.meta.url));
  expect(received.subarray(0, 2).toString()).toBe('MZ');
  expect(createHash('sha256').update(received).digest('hex')).toBe(createHash('sha256').update(published).digest('hex'));
  expect(downloads).toEqual([fileName]);
  await page.getByRole('tab', { name: '版本', exact: true }).click();
  await expect(page.locator('.project-markdown')).toContainText('1.0.1');
  await expect(page.locator('.project-markdown')).toContainText(fileName);
});

for (const [language, guide, versions] of [
  ['zh', '第一次使用', '版本与下载'],
  ['en', 'First use', 'Version and download'],
  ['ja', '最初の使い方', 'バージョンとダウンロード'],
]) {
  test(`Explorer ${language} guide, all screenshots and mobile detail remain usable`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.addInitScript(locale => {
      sessionStorage.setItem('fimel_intro_seen', '1');
      localStorage.setItem('fimel_user_lang', locale);
      localStorage.setItem('fimel_theme', locale === 'en' ? 'light' : 'dark');
    }, language);
    await page.goto('/#/works/minecraft-explorer');
    await expect(page.locator('.project-markdown')).toContainText(guide);
    await expect(page.locator('.project-gallery-slide')).toHaveCount(3);
    await page.locator('.project-gallery').scrollIntoViewIfNeeded();
    for (let position = 0; position < 3; position++) {
      if (position) await page.locator('.project-gallery button').last().click();
      const active = page.locator('.project-gallery-slide[data-active="true"] img');
      await expect(active).toHaveAttribute('src', new RegExp(`gallery-0${position + 1}\\.png$`));
      await expect.poll(() => active.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('tab').nth(2).click();
    await expect(page.locator('.project-markdown')).toContainText(versions);
    await expect(page.locator('.project-markdown')).toContainText(fileName);
    await page.reload();
    await expect(page.getByRole('tab').nth(2)).toHaveAttribute('aria-selected', 'true');
  });
}
