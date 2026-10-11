import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const projectCount = JSON.parse(readFileSync(new URL('../public/works/catalogue.json', import.meta.url), 'utf8')).projects.length;

const particleModule = /\/(?:src\/components\/ParticleBackground\.tsx|assets\/ParticleBackground-[^/]+\.js)(?:\?.*)?$/;
const background = '[data-deferred-scene="particles"]';

test.use({ reducedMotion: 'no-preference', launchOptions: { args: ['--enable-unsafe-swiftshader'] } });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fimel_user_lang', 'zh');
    localStorage.setItem('fimel_theme', 'light');
  });
});

test('home paints before a slow 3D module; navigation never waits for it', async ({ page }) => {
  let requested = false;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(particleModule, async route => {
    requested = true;
    await gate;
    await route.abort().catch(() => {});
  });
  try {
    await page.goto('/');
    await expect(page.locator('#hero')).toBeVisible();
    await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
    expect(requested).toBe(false);
    await expect.poll(() => requested, { timeout: 6000 }).toBe(true);
    await expect(page.locator(background)).toHaveAttribute('data-scene-state', 'loading');
    await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '作品', exact: true }).click();
    await expect(page.locator('.work-row')).toHaveCount(projectCount);
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('a failed 3D chunk falls back locally instead of blanking the page', async ({ page }) => {
  await page.route(particleModule, route => route.abort());
  await page.goto('/');
  await expect(page.locator(background)).toHaveAttribute('data-scene-state', 'fallback', { timeout: 12000 });
  await expect(page.locator('#hero')).toBeVisible();
  await expect(page.locator('#hero canvas')).toHaveCount(0);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '作品', exact: true }).click();
  await expect(page.locator('.work-row')).toHaveCount(projectCount);
});

test('a hanging texture times out locally while foreground controls stay usable', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/assets/textures/minecraft/block_side.png', async route => {
    await gate;
    await route.abort().catch(() => {});
  });
  try {
    await page.goto('/');
    await expect(page.locator(background)).toHaveAttribute('data-scene-state', 'loading', { timeout: 10000 });
    await page.getByRole('button', { name: '切换至暗色', exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator(background)).toHaveAttribute('data-scene-state', 'fallback', { timeout: 16000 });
    await expect(page.locator('#hero')).toBeVisible();
    await expect(page.locator('#hero canvas')).toHaveCount(0);
    await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '作品', exact: true }).click();
    await expect(page.locator('.work-row')).toHaveCount(projectCount);
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('missing WebGL2 uses a static background without importing the 3D module', async ({ page }) => {
  let requests = 0;
  await page.route(particleModule, route => { requests++; return route.continue(); });
  await page.addInitScript(() => {
    const native = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        return type.startsWith('webgl') ? null : Reflect.apply(native, this, [type, ...args]);
      },
    });
  });
  await page.goto('/');
  await expect(page.locator(background)).toHaveAttribute('data-scene-state', 'fallback', { timeout: 6000 });
  expect(requests).toBe(0);
  await expect(page.locator('#hero')).toBeVisible();
  await expect(page.locator('#hero canvas')).toHaveCount(0);
});

test('reduced motion avoids the expensive automatic scene download', async ({ page }) => {
  let requests = 0;
  await page.route(particleModule, route => { requests++; return route.continue(); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator(background)).toHaveAttribute('data-scene-state', 'static');
  await page.waitForTimeout(1800);
  expect(requests).toBe(0);
  await expect(page.locator('#hero canvas')).toHaveCount(0);
  await expect(page.locator('#hero')).toBeVisible();
});

test('navigating away before scene startup cancels the deferred request', async ({ page }) => {
  let requests = 0;
  await page.route(particleModule, route => { requests++; return route.continue(); });
  await page.goto('/');
  await expect(page.locator('#hero')).toBeVisible();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '作品', exact: true }).click();
  await expect(page.locator('.work-row')).toHaveCount(projectCount);
  await page.waitForTimeout(1800);
  expect(requests).toBe(0);
});

test('context loss removes only the canvas and keeps the site usable', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/');
  await expect(page.locator(background)).toHaveAttribute('data-scene-state', 'ready', { timeout: 45000 });
  await page.locator('#hero canvas').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  await expect(page.locator(background)).toHaveAttribute('data-scene-state', 'fallback');
  await expect(page.locator('#hero canvas')).toHaveCount(0);
  await expect(page.locator('#hero')).toBeVisible();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '作品', exact: true }).click();
  await expect(page.locator('.work-row')).toHaveCount(projectCount);
});
