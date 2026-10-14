import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Project } from '../src/content/projects';

const catalogueProjects: Project[] = JSON.parse(readFileSync(new URL('../public/works/catalogue.json', import.meta.url), 'utf8')).projects;
const projectCount = catalogueProjects.length;
const bedrockCount = catalogueProjects.filter(project => project.type === 'bedrock').length;
const modCount = catalogueProjects.filter(project => project.type === 'mods').length;

async function useLegacyGitHubCatalogue(page: Page) {
  // Keep the old latest-release/fallback behavior covered for unmigrated data.
  await page.route('**/works/catalogue.json', route => route.fulfill({ json: {
    schemaVersion: 1,
    projects: catalogueProjects.map(project => project.slug === 'bingo-but-dont-do-it' ? { ...project, downloadUrl: undefined } : project),
  } }));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('fimel_intro_seen', '1');
    if (!localStorage.getItem('fimel_user_lang')) localStorage.setItem('fimel_user_lang', 'zh');
    if (!localStorage.getItem('fimel_theme')) localStorage.setItem('fimel_theme', 'light');
  });
});

test('three visible navigation links, category search, tabs and browser return', async ({ page }) => {
  await page.goto('/#/works');
  const navigation = page.getByRole('navigation', { name: '主导航' });
  await expect(navigation.getByRole('link')).toHaveText(['主页', '作品', '关于我们']);
  await expect(page.locator('.work-row')).toHaveCount(projectCount);
  await page.getByRole('navigation', { name: '作品', exact: true }).getByRole('link', { name: /^模组/ }).click();
  await expect(page.locator('.work-row')).toHaveCount(modCount);
  await page.getByRole('searchbox', { name: '搜索作品' }).fill('Bingo');
  await page.locator('.work-row').click();
  await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText("Bingo But Don't Do It");
  await expect(page.locator('.project-markdown')).toContainText('队伍共享生命');
  await page.getByRole('tab', { name: '概述' }).press('ArrowRight');
  await expect(page.getByRole('tab', { name: '更新日志' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.project-markdown')).toContainText('2026-09-26');
  await page.getByRole('tab', { name: '版本', exact: true }).click();
  await expect(page.locator('.project-markdown')).toContainText('Fabric Loader');
  await expect(page.getByRole('link', { name: '返回作品', exact: true })).toHaveAttribute('href', '#/works?type=mods&q=Bingo');
  await page.reload();
  await expect(page.getByRole('tab', { name: '版本', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.project-markdown')).toContainText('Fabric Loader');
  await page.goBack();
  await expect(page.getByRole('searchbox', { name: '搜索作品' })).toHaveValue('Bingo');
  await expect(page.locator('.work-row')).toHaveCount(1);
});

test('all NetEase maps have original description, creators and correct outbound link', async ({ page }) => {
  await page.goto('/#/works?type=bedrock');
  await expect(page.locator('.work-row')).toHaveCount(bedrockCount);
  await page.getByRole('link').filter({ has: page.getByRole('heading', { name: '饥饿游戏：旧城迷行', exact: true }) }).click();
  await expect(page.locator('.project-markdown')).toContainText('天赋');
  await expect(page.getByRole('link', { name: '前往网易资源中心' })).toHaveAttribute('href', 'https://resource-minecraft.h5.163.com/#/detail?id=4657291854883079467');
  await page.getByRole('tab', { name: '更新日志' }).click();
  await expect(page.locator('.project-markdown')).toContainText('2.0');
  await page.getByRole('tab', { name: '版本', exact: true }).click();
  await expect(page.locator('.project-markdown')).toContainText('作品版本号暂未确认');
  await expect(page.locator('.project-markdown')).toContainText('v2.0');
});

test('latest-release failure automatically downloads the local JAR', async ({ page }) => {
  await useLegacyGitHubCatalogue(page);
  await page.route('https://api.github.com/repos/FimelStudio/bingo-but-dont-do-it/releases/latest', (route) => route.fulfill({ status: 403, body: '{}' }));
  await page.route('**/mods/bingo-but-dont-do-it-1.21.11-v1.0.jar', (route) => route.fulfill({
    status: 200, contentType: 'application/java-archive', body: Buffer.from('fallback-download-test'),
  }));
  await page.goto('/#/works/bingo-but-dont-do-it');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载最新版' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('bingo-but-dont-do-it-1.21.11-v1.0.jar');
  await expect(page.getByRole('button', { name: '下载最新版' })).toBeEnabled();
});

test('latest release downloads the published JAR rather than source archives', async ({ page }) => {
  await useLegacyGitHubCatalogue(page);
  const jarUrl = 'https://github.com/FimelStudio/bingo-but-dont-do-it/releases/download/test/latest.jar';
  await page.route('https://api.github.com/repos/FimelStudio/bingo-but-dont-do-it/releases/latest', (route) => route.fulfill({
    json: { assets: [
      { name: 'bingo-sources.jar', state: 'uploaded', browser_download_url: 'https://github.com/unwanted-sources.jar' },
      { name: 'bingo-latest.jar', state: 'uploaded', browser_download_url: jarUrl },
    ] },
  }));
  await page.route(jarUrl, (route) => route.fulfill({ status: 200, contentType: 'application/java-archive', headers: { 'Content-Disposition': 'attachment; filename="latest.jar"' }, body: Buffer.from('latest-download-test') }));
  await page.goto('/#/works/bingo-but-dont-do-it');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载最新版' }).click();
  expect((await downloaded).suggestedFilename()).toBe('latest.jar');
});

test('catalogue and Markdown failure states can be retried without a blank page', async ({ page }) => {
  let catalogueRequests = 0;
  await page.route('**/works/catalogue.json', (route) => ++catalogueRequests === 1 ? route.fulfill({ status: 503, body: '{}' }) : route.continue());
  await page.goto('/#/works');
  await expect(page.getByRole('alert')).toContainText('作品暂时无法加载');
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.locator('.work-row')).toHaveCount(projectCount);
  let markdownFails = true;
  await page.route('**/works/bingo-but-dont-do-it/description.zh.md', (route) => markdownFails ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><html>fallback</html>' }) : route.continue());
  await page.goto('/#/works/bingo-but-dont-do-it');
  await expect(page.getByRole('alert')).toContainText('内容暂时无法加载');
  markdownFails = false;
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.locator('.project-markdown')).toContainText('队伍共享生命');
});

test('home entry links and contact deep links remain usable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link')).toHaveCount(3);
  await expect(page.locator('#hero')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('#hero a[href="#/"]').click();
  await expect(page.locator('#quick-entry')).toBeInViewport();
  await page.locator('#quick-entry a[href="#/works?type=mods"]').click();
  await expect(page.locator('.work-row')).toHaveCount(modCount);
  await page.goto('/#/contact');
  await expect(page).toHaveURL(/#\/studio#contact$/);
  await expect(page.locator('#contact')).toBeInViewport();
});

test('mobile categories, project Markdown and merged contacts fit 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/#/works');
  const nav = page.getByRole('navigation', { name: '主导航' });
  for (const label of ['主页', '作品', '关于我们']) await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
  await expect(page.locator('.work-row')).toHaveCount(projectCount);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '.artifacts/works-mobile.png', fullPage: true });
  await page.goto('/#/works/bingo-but-dont-do-it?tab=versions');
  await expect(page.locator('.project-markdown')).toContainText('Fabric Loader');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '.artifacts/project-mobile.png', fullPage: true });
  await nav.getByRole('link', { name: '关于我们', exact: true }).click();
  await expect(page.locator('#contact a[href="https://discord.gg/X9aVJJVvA"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('language and theme remain usable after refresh and legacy URLs redirect', async ({ page }) => {
  await page.goto('/#/works/mods');
  await expect(page).toHaveURL(/#\/works\?type=mods$/);
  await page.getByRole('button', { name: '切换语言' }).click();
  await page.getByRole('button', { name: '日本語' }).click();
  await expect(page.getByRole('searchbox', { name: '作品を検索' })).toBeVisible();
  await page.getByRole('button', { name: 'ダークテーマに変更' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.getByRole('searchbox', { name: '作品を検索' })).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.goto('/#/works/bingo-but-dont-do-it');
  await expect(page.locator('.project-markdown')).toContainText('チームでライフを共有');
  await page.getByRole('tab', { name: 'バージョン', exact: true }).click();
  await expect(page.locator('.project-markdown')).toContainText('依存関係');
  await page.getByRole('tab', { name: '更新履歴', exact: true }).click();
  await expect(page.locator('.project-markdown')).toContainText('リリースノート');
});

test('desktop views stay legible in light and dark themes', async ({ page }) => {
  await page.goto('/#/works');
  await expect(page.locator('.work-row')).toHaveCount(projectCount);
  await page.screenshot({ path: '.artifacts/works-desktop.png', fullPage: true });
  await page.getByRole('button', { name: '切换至暗色' }).click();
  await page.screenshot({ path: '.artifacts/works-dark.png', fullPage: true });
  await page.goto('/#/works/minecraft-obj-cubizer');
  await expect(page.locator('.project-markdown')).toContainText('功能');
  await page.screenshot({ path: '.artifacts/project-desktop.png', fullPage: true });
});

test('GitHub-like dark palette and light palette apply across every main page', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await page.goto('/#/works');
    if (theme === 'dark') await page.getByRole('button', { name: '切换至暗色' }).click();
    for (const path of ['/#/works', '/#/works/bingo-but-dont-do-it?tab=versions', '/#/studio', '/']) {
      await page.goto(path);
      await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
      const colors = await page.evaluate(() => ({
        background: getComputedStyle(document.body).backgroundColor,
        scheme: getComputedStyle(document.documentElement).colorScheme,
      }));
      expect(colors.background).toBe(theme === 'dark' ? 'rgb(13, 17, 23)' : 'rgb(244, 244, 245)');
      expect(colors.scheme).toBe(theme);
    }
    await page.goto('/#/works/hunger-games-old-city');
    const storeButton = page.getByRole('link', { name: '前往网易资源中心' });
    await expect(storeButton).toBeVisible();
    const buttonColors = await storeButton.evaluate(element => ({
      background: getComputedStyle(element).backgroundColor,
      color: getComputedStyle(element).color,
    }));
    expect(buttonColors.background).toBe(theme === 'dark' ? 'rgb(0, 210, 211)' : 'rgb(10, 10, 10)');
    expect(buttonColors.color).toBe(theme === 'dark' ? 'rgb(10, 10, 10)' : 'rgb(255, 255, 255)');
  }
  await page.goto('/#/works');
  await expect(page.locator('.work-row').first()).toBeVisible();
  expect(await page.locator('.work-row').first().evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(21, 27, 35)');
  expect(await page.locator('.work-row').first().evaluate(element => getComputedStyle(element).borderTopColor)).toBe('rgb(61, 68, 77)');
  await page.screenshot({ path: '.artifacts/works-github-dark.png', fullPage: true });
});
