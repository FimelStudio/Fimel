import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Project, ProjectTab } from '../src/content/projects';
import { contentMessages } from '../src/content/messages';

const expectedTypes = ['bedrock', 'java', 'datapacks', 'tools', 'mods'];
const projects: Project[] = JSON.parse(readFileSync(new URL('../public/works/catalogue.json', import.meta.url), 'utf8')).projects;
const countFor = (type: string) => projects.filter(project => project.type === type).length;
const card = projects.find(project => project.slug === 'fimel-card')!;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('fimel_intro_seen', '1');
    if (!localStorage.getItem('fimel_user_lang')) localStorage.setItem('fimel_user_lang', 'zh');
    if (!localStorage.getItem('fimel_theme')) localStorage.setItem('fimel_theme', 'light');
  });
});

test('Java maps and data packs share a consistent but separate catalogue contract', async ({ request }) => {
  const schema = await (await request.get('/works/catalogue.schema.json')).json();
  expect(schema.$defs.project.properties.type.enum).toEqual(expectedTypes);
  expect(countFor('java')).toBeGreaterThan(0);
  expect(countFor('datapacks')).toBeGreaterThan(0);
  expect(projects.filter(project => project.type === 'java').map(project => project.slug)).not.toContain('fimel-card');
  expect(card.type).toBe('datapacks');
  expect(card.status).toBe('development');
  expect(card.repository).toBe('https://github.com/FimelStudio/fimelcard-dp');
  for (const field of ['downloadUrl', 'download', 'downloadSlug', 'latestReleaseRepo', 'releasePage', 'fallbackDownload', 'version', 'published'] as const) {
    expect(card[field]).toBeUndefined();
  }
  // A command pack distributed through NetEase remains in its actual platform
  // category rather than being moved into Java data packs by its name alone.
  expect(projects.find(project => project.slug === 'music-command-pack')?.type).toBe('bedrock');
});

test('Java and data-pack filters preserve search, sort and browser return state', async ({ page }) => {
  await page.goto('/#/works?type=java');
  await expect(page.locator('.work-row')).toHaveCount(countFor('java'));
  await expect(page.locator('.work-row[href="#/works/fimel-card"]')).toHaveCount(0);
  const categoryNav = page.getByRole('navigation', { name: '作品', exact: true });
  const dataPacks = categoryNav.getByRole('link', { name: /^数据包/ });
  await dataPacks.focus();
  await dataPacks.press('Enter');
  await expect(dataPacks).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.work-row')).toHaveCount(countFor('datapacks'));
  await page.getByRole('searchbox', { name: '搜索作品' }).fill('Fimel Card');
  await page.getByLabel('排序', { exact: true }).selectOption('updated');
  await page.locator('.work-row[href="#/works/fimel-card"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Fimel Card');
  const back = page.getByRole('link', { name: '返回作品', exact: true });
  await expect(back).toHaveAttribute('href', '#/works?type=datapacks&q=Fimel+Card&sort=updated');
  await back.click();
  await expect(page.getByRole('searchbox', { name: '搜索作品' })).toHaveValue('Fimel Card');
  await expect(page.getByLabel('排序', { exact: true })).toHaveValue('updated');
  await page.reload();
  await expect(dataPacks).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.work-row')).toHaveCount(1);
});

test('unreleased Fimel Card has its own cover, repository and keyboard-accessible Markdown tabs without a download', async ({ page, request }) => {
  const cover = await request.get(`/${card.image}`);
  expect(cover.ok()).toBe(true);
  expect(cover.headers()['content-type']).toMatch(/^image\//);
  expect(card.image).toMatch(/^assets\/images\/works\/fimel-card\/cover\./);
  await page.goto('/#/works/fimel-card');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Fimel Card');
  await expect(page.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) })).toContainText('制作中');
  await expect(page.getByRole('link', { name: '项目仓库', exact: true })).toHaveAttribute('href', card.repository!);
  await expect(page.locator('a[download]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^下载/ })).toHaveCount(0);
  await expect(page.locator('.project-markdown')).toContainText('卡牌');
  await expect.poll(() => page.locator(`header img[src$="${card.image}"]`).evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  for (const tab of ['description', 'changelog', 'versions'] as ProjectTab[]) {
    const source = card.content[tab];
    const path = typeof source === 'string' ? source : source?.zh ?? '';
    expect(path).toMatch(new RegExp(`^works/fimel-card/${tab}(?:\\.zh)?\\.md$`));
    const response = await request.get(`/${path}`);
    expect(response.ok()).toBe(true);
    expect((await response.text()).trim().length).toBeGreaterThan(20);
  }
  await page.getByRole('tab', { name: '概述', exact: true }).press('ArrowRight');
  await expect(page.getByRole('tab', { name: '更新日志', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.project-markdown')).toContainText('暂未发布版本更新记录');
  await page.getByRole('tab', { name: '更新日志', exact: true }).press('End');
  await expect(page.getByRole('tab', { name: '版本', exact: true })).toBeFocused();
  await page.getByRole('tabpanel').locator('details > summary').click();
  await expect(page.locator('.project-markdown')).toContainText('暂未发布可下载的版本');
  await page.reload();
  await expect(page.getByRole('tab', { name: '版本', exact: true })).toHaveAttribute('aria-selected', 'true');
  // Version notes now live in the shared list's collapsed supplementary section.
  await page.getByRole('tabpanel').locator('details > summary').click();
  await expect(page.locator('.project-markdown')).toBeVisible();
  await expect(page.getByRole('link', { name: '返回作品', exact: true })).toHaveAttribute('href', '#/works?type=datapacks');
  await page.getByRole('tab', { name: '版本', exact: true }).press('Home');
  await expect(page.getByRole('tab', { name: '概述', exact: true })).toBeFocused();
});

for (const language of ['zh', 'en', 'ja'] as const) {
  test(`separate categories remain usable at 320px in ${language}, light and dark`, async ({ page }) => {
    const messages = contentMessages[language];
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/#/works');
    if (language !== 'zh') {
      await page.getByRole('button', { name: /^切换语言/ }).click();
      await page.getByRole('button', { name: language === 'en' ? 'English' : '日本語', exact: true }).click();
    }
    const categoryNav = page.getByRole('navigation', { name: messages.catalogue.title, exact: true });
    await expect(categoryNav.getByRole('link')).toHaveCount(expectedTypes.length + 1);
    const java = categoryNav.getByRole('link', { name: new RegExp(`^${messages.catalogue.types.java}`) });
    const dataPacks = categoryNav.getByRole('link', { name: new RegExp(`^${messages.catalogue.types.datapacks}`) });
    const themeLabels = language === 'zh' ? ['切换至暗色', '切换至亮色'] : language === 'en' ? ['Use dark theme', 'Use light theme'] : ['ダークテーマに変更', 'ライトテーマに変更'];
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.getByRole('button', { name: themeLabels[0], exact: true }).click();
      await java.focus();
      await java.press('Tab');
      await expect(dataPacks).toBeFocused();
      await dataPacks.press('Enter');
      await expect(dataPacks).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('.work-row')).toHaveCount(countFor('datapacks'));
      await expect(page.locator('.work-row[href="#/works/fimel-card"]')).toContainText(messages.catalogue.types.datapacks);
      const height = await dataPacks.evaluate(element => element.getBoundingClientRect().height);
      expect(height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `.artifacts/datapacks-${language}-${theme}-320.png`, fullPage: true });
      await java.focus();
      await java.press('Enter');
      await expect(java).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('.work-row')).toHaveCount(countFor('java'));
      await expect(page.locator('.work-row[href="#/works/fimel-card"]')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.goto('/#/works/fimel-card');
    const projectHeader = page.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) });
    await expect(projectHeader).toContainText(messages.catalogue.types.datapacks);
    await expect(projectHeader).toContainText(messages.catalogue.development);
    await expect(page.getByRole('link', { name: messages.project.repository, exact: true })).toHaveAttribute('href', card.repository!);
    await expect(page.getByRole('tab', { name: messages.project.description, exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.project-markdown')).toBeVisible();
    await expect(page.getByText(messages.project.translation_notice, { exact: true })).toHaveCount(0);
    for (const tab of ['changelog', 'versions'] as const) {
      await page.getByRole('tab', { name: messages.project[tab], exact: true }).click();
      if (tab === 'versions') await page.getByRole('tabpanel').locator('details > summary').click();
      await expect(page.locator('.project-markdown')).toBeVisible();
      await expect(page.getByText(messages.project.translation_notice, { exact: true })).toHaveCount(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // Capture the actual top-of-page view, not the scroll position used while
    // exercising tabs; full-page screenshots otherwise relocate fixed UI.
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    const advancement = page.locator('[style*="Toast_advancement.png"]');
    await expect.poll(() => advancement.evaluate(element => element.getBoundingClientRect().left > window.innerWidth)).toBe(true);
    await page.screenshot({ path: `.artifacts/fimel-card-${language}-dark-320.png`, fullPage: true });
  });
}
