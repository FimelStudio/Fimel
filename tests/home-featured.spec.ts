import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { HOME_FEATURED } from '../src/content/home-featured';
import type { Project } from '../src/content/projects';

const catalogue = JSON.parse(readFileSync('public/works/catalogue.json', 'utf8'));
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('fimel_intro_seen', '1');
    localStorage.setItem('fimel_user_lang', 'zh');
    localStorage.setItem('fimel_theme', 'dark');
  });
});

test('curation references real projects and separates released work from development', () => {
  const slugs = Object.values(HOME_FEATURED).flat();
  expect(new Set(slugs).size).toBe(slugs.length);
  for (const [group, entries] of Object.entries(HOME_FEATURED)) {
    for (const slug of entries) {
      const project = catalogue.projects.find((project: Project) => project.slug === slug);
      expect(project).toBeDefined();
      if (group === 'development') expect(project.status).not.toBe('released');
      else expect(project.status).toBe('released');
      if (group === 'maps') expect(project.type).toBe('bedrock');
    }
  }
});

test('Home features current tools and data packs using the catalogue, not legacy duplicate arrays', async ({ page }) => {
  const custom = structuredClone(catalogue);
  const explorer = custom.projects.find((project: Project) => project.slug === 'minecraft-explorer');
  explorer.title = 'Explorer catalogue title';
  explorer.summary = 'Catalogue-only summary';
  let requests = 0;
  await page.route('**/works/catalogue.json', route => {
    requests++;
    return route.fulfill({ json: custom });
  });
  await page.goto('/#/');
  for (const [group, slugs] of Object.entries(HOME_FEATURED)) {
    const container = page.locator(`[data-featured-group="${group}"]`);
    await expect(container.locator('a')).toHaveCount(slugs.length);
    for (const slug of slugs) await expect(container.locator(`a[href="#/works/${slug}"]`)).toBeAttached();
  }
  const feature = page.locator('#works a[href="#/works/minecraft-explorer"]');
  await expect(feature).toContainText('Explorer catalogue title');
  await expect(feature).toContainText('Catalogue-only summary');
  await expect(feature.locator('img')).toHaveAttribute('src', `/${explorer.image}`);
  await expect(page.locator('[data-featured-group="development"]')).toContainText('Fimel Card');
  await expect(page.locator('[data-featured-group="development"]')).not.toContainText('已发布');
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '作品', exact: true }).click();
  await expect(page.locator('.work-row')).toHaveCount(catalogue.projects.length);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '主页', exact: true }).click();
  await expect(feature).toContainText('Explorer catalogue title');
  expect(requests).toBe(1);
});

test('a stalled catalogue does not block the hero, and a failed request can retry', async ({ page }) => {
  let resolveRequest!: () => void;
  const gate = new Promise<void>(resolve => { resolveRequest = resolve; });
  let requests = 0;
  await page.route('**/works/catalogue.json', async route => {
    requests++;
    if (requests === 1) {
      await gate;
      await route.fulfill({ status: 503, body: 'Unavailable' });
    } else await route.fulfill({ json: catalogue });
  });
  await page.goto('/#/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#hero')).toBeVisible();
  await expect(page.locator('#works')).toContainText('正在读取作品');
  resolveRequest();
  await expect(page.locator('#works')).toContainText('作品暂时无法加载');
  await page.locator('#works').getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.locator('[data-featured-group="maps"] a')).toHaveCount(3);
});

test('new Home showcases fit a small screen in both themes and localize the group headings', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/#/');
  await expect(page.locator('[data-home-featured]')).toBeAttached();
  for (const dark of [false, true]) {
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const images = page.locator('[data-home-featured] img');
    await expect(images).toHaveCount(9);
    for (const image of await images.all()) await expect(image).toHaveAttribute('loading', 'lazy');
  }
  await page.locator('header button[aria-controls="language-options"]').click();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('[data-home-featured]')).toContainText('In development');
  await page.locator('header button[aria-controls="language-options"]').click();
  await page.getByRole('button', { name: '日本語', exact: true }).click();
  await expect(page.locator('[data-home-featured]')).toContainText('制作中の作品');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
