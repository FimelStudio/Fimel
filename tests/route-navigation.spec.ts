import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const projectCount = JSON.parse(readFileSync(new URL('../public/works/catalogue.json', import.meta.url), 'utf8')).projects.length;
const homeModule = /\/(?:src\/pages\/Home\.tsx|assets\/Home-[^/]+\.js)(?:\?.*)?$/;

test.use({ reducedMotion: 'no-preference' });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fimel_user_lang', 'zh');
    localStorage.setItem('fimel_theme', 'dark');
    sessionStorage.setItem('fimel_intro_seen', '1');
  });
});

test('returning to works during a stalled home import must not wait for home or an exit animation', async ({ page }) => {
  let requested = false;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(homeModule, async route => {
    requested = true;
    await gate;
    await route.continue().catch(() => {});
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('/#/works');
    await expect(page.locator('.work-row')).toHaveCount(projectCount);
    const nav = page.getByRole('navigation', { name: '主导航' });
    await nav.getByRole('link', { name: '主页', exact: true }).click();
    await expect.poll(() => requested).toBe(true);
    await nav.getByRole('link', { name: '作品', exact: true }).click();
    await expect(page).toHaveURL(/#\/works$/);
    await expect(page.locator('.work-row')).toHaveCount(projectCount, { timeout: 2500 });
    await expect(page.getByRole('searchbox', { name: '搜索作品' })).toBeVisible();
    await expect.poll(() => page.locator('#page-content-wrapper').evaluate(element => Number(getComputedStyle(element).opacity))).toBe(1);
    await expect(page.locator('#hero')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('rapid repeated navigation ends on the latest page with visible usable content', async ({ page }) => {
  await page.goto('/#/works');
  await expect(page.locator('.work-row')).toHaveCount(projectCount);
  for (let round = 0; round < 4; round++) {
    await page.evaluate(async () => {
      const click = (href: string) => (document.querySelector(`header nav a[href="${href}"]`) as HTMLAnchorElement).click();
      for (const href of ['#/', '#/studio', '#/works']) {
        click(href);
        await new Promise(resolve => setTimeout(resolve, 40));
      }
    });
    await expect(page.locator('.work-row')).toHaveCount(projectCount, { timeout: 2500 });
    await expect.poll(() => page.locator('#page-content-wrapper').evaluate(element => Number(getComputedStyle(element).opacity))).toBe(1);
  }
  await page.getByRole('searchbox', { name: '搜索作品' }).fill('Bingo');
  await expect(page.locator('.work-row')).toHaveCount(1);
});

test('an interrupted curtain animation cannot leave the latest route covered indefinitely', async ({ page }) => {
  await page.addInitScript(() => {
    const nativeFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => nativeFrame(time => {
      const paused = Boolean((window as Window & { pauseRouteMotion?: boolean }).pauseRouteMotion);
      // Suspend animation frames while timers, React and networking keep working.
      if (!paused || callback.name === '_tick' || callback.name === '_rafBugFix') callback(time);
    });
  });
  await page.goto('/#/works');
  await expect(page.locator('.work-row')).toHaveCount(projectCount);
  await expect.poll(() => page.locator('#page-content-wrapper').evaluate(element => Number(getComputedStyle(element).opacity))).toBe(1);
  // Background throttling or a stalled animation must not own router progress.
  // Deliberately suppress completion of the decorative curtain animation.
  await page.evaluate(() => {
    (window as Window & { pauseRouteMotion?: boolean }).pauseRouteMotion = true;
    const originalAnimate = Element.prototype.animate;
    Element.prototype.animate = function (...args: Parameters<Element['animate']>) {
      const animation = originalAnimate.apply(this, args);
      if (this.matches('#main-content .fixed.inset-0')) animation.pause();
      return animation;
    };
  });
  const nav = page.getByRole('navigation', { name: '主导航' });
  await nav.getByRole('link', { name: '主页', exact: true }).click();
  await nav.getByRole('link', { name: '关于我们', exact: true }).click();
  await expect(page.locator('#contact')).toBeVisible({ timeout: 2500 });
  await nav.getByRole('link', { name: '作品', exact: true }).click();
  await expect(page.locator('.work-row')).toHaveCount(projectCount, { timeout: 2500 });
  await expect.poll(() => page.locator('#main-content .fixed.inset-0').evaluateAll(elements => elements.every(element => {
    const style = getComputedStyle(element);
    const scaleY = new DOMMatrixReadOnly(style.transform).m22;
    return style.display === 'none' || Number(style.opacity) === 0 || Math.abs(scaleY) < 0.01;
  })), { timeout: 2500 }).toBe(true);
  await page.getByRole('searchbox', { name: '搜索作品' }).fill('Bingo');
  await expect(page.locator('.work-row')).toHaveCount(1);
});

test('a frozen curtain is removed by its deadline even if animation completion never fires', async ({ page }) => {
  await page.goto('/#/works');
  await expect(page.locator('.work-row')).toHaveCount(projectCount);
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '关于我们', exact: true }).click();
  await page.locator('#main-content .fixed.inset-0').evaluateAll(elements => {
    for (const element of elements) {
      const curtain = element as HTMLElement;
      curtain.style.animationPlayState = 'paused';
      curtain.style.setProperty('transform', 'scaleY(1)', 'important');
    }
  });
  await expect(page.locator('#contact')).toBeVisible();
  await expect(page.locator('#main-content .fixed.inset-0')).toHaveCount(0, { timeout: 1500 });
});

test('works remain usable after a simulated thirty-minute background idle and home round trip', async ({ page }) => {
  let catalogueRequests = 0;
  page.on('request', request => { if (request.url().endsWith('/works/catalogue.json')) catalogueRequests++; });
  await page.goto('/#/works?type=mods');
  await expect(page.locator('.work-row')).toHaveCount(1);
  await expect.poll(() => page.locator('#page-content-wrapper').evaluate(element => Number(getComputedStyle(element).opacity))).toBe(1);
  await page.clock.install();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward('30:00');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.resume();
  const nav = page.getByRole('navigation', { name: '主导航' });
  await nav.getByRole('link', { name: '主页', exact: true }).click();
  await expect(page.locator('#hero')).toBeVisible();
  await nav.getByRole('link', { name: '作品', exact: true }).click();
  await expect(page.locator('.work-row')).toHaveCount(projectCount, { timeout: 2500 });
  await expect(page.locator('#main-content canvas')).toHaveCount(0);
  await expect(page.locator('#main-content .fixed.inset-0')).toHaveCount(0, { timeout: 1500 });
  expect(catalogueRequests).toBe(1);
});
