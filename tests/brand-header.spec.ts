import { test, expect } from '@playwright/test';
import { readFileSync, statSync } from 'node:fs';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('fimel_intro_seen', '1');
    localStorage.setItem('fimel_user_lang', 'zh');
    localStorage.setItem('fimel_theme', 'light');
  });
});

test('navigation uses a real vector mark and a small local pixel font', async ({ page, request }) => {
  const svg = await request.get('/assets/brand/fimel-logo.svg');
  expect(svg.headers()['content-type']).toContain('image/svg+xml');
  const artwork = await svg.text();
  expect(artwork).toContain('viewBox="0 0 824 825"');
  expect(artwork).not.toMatch(/<image|data:image|<script|foreignObject/);
  expect(statSync('public/assets/brand/fimel-logo.svg').size).toBeLessThan(12000);
  expect(statSync('public/assets/fonts/minecraft-seven/minecraft-seven-latin.woff').size).toBeLessThan(12000);
  expect(readFileSync('public/assets/fonts/minecraft-seven/OFL.txt', 'utf8')).toContain('SIL OPEN FONT LICENSE');
  const fontResponse = await request.get('/assets/fonts/minecraft-seven/minecraft-seven-latin.woff');
  expect(fontResponse.ok()).toBe(true);
  expect((await fontResponse.body()).subarray(0, 4).toString()).toBe('wOFF');
  await page.goto('/#/works');
  await page.evaluate(() => document.fonts.ready);
  const brand = page.locator('.brand-link');
  await expect(brand).toHaveAccessibleName('Fimel Studio / 主页');
  await expect(brand.locator('.brand-wordmark')).toHaveText('Fimel Studio');
  await expect(brand.locator('img')).toHaveAttribute('src', '/assets/brand/fimel-logo.svg');
  expect(await page.evaluate(() => Array.from(document.fonts).some(font => font.family === 'Fimel Pixel' && font.status === 'loaded'))).toBe(true);
  await brand.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#hero')).toBeVisible();
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`brand and three visible navigation links fit ${width}px in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#/works');
    await page.evaluate(() => document.fonts.ready);
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.getByRole('button', { name: '切换至暗色', exact: true }).click();
      const brand = page.locator('.brand-link');
      const nav = page.getByRole('navigation', { name: '主导航' });
      await expect(brand.locator('.brand-wordmark')).toBeVisible();
      await expect(nav.getByRole('link')).toHaveText(['主页', '作品', '关于我们']);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const mark = await brand.locator('.brand-mark').boundingBox();
      expect(mark!.width).toBe(width >= 1024 ? 56 : width >= 768 ? 52 : 44);
      const dimensions = await page.evaluate(() => {
        const brand = document.querySelector('.brand-link')!.getBoundingClientRect();
        const nav = document.querySelector('header nav')!.getBoundingClientRect();
        const controls = document.querySelector('header nav')!.nextElementSibling!.getBoundingClientRect();
        const word = document.querySelector('.brand-wordmark')!.getBoundingClientRect();
        return { brandRight: brand.right, navLeft: nav.left, navRight: nav.right, controlsLeft: controls.left, wordHeight: word.height, headerHeight: document.querySelector('header')!.getBoundingClientRect().height };
      });
      if (width >= 768) {
        expect(dimensions.brandRight).toBeLessThanOrEqual(dimensions.navLeft);
        expect(dimensions.navRight).toBeLessThanOrEqual(dimensions.controlsLeft);
        expect(dimensions.headerHeight).toBeLessThanOrEqual(80);
        expect(Math.abs((dimensions.navLeft + dimensions.navRight) / 2 - width / 2)).toBeLessThan(2);
      } else expect(dimensions.brandRight).toBeLessThanOrEqual(dimensions.controlsLeft);
      expect(dimensions.wordHeight).toBeLessThan(32);
      await page.locator('header').first().screenshot({ path: `.artifacts/brand-${width}-${theme}.png` });
    }
  });
}

test('longer English and Japanese menus stay centered and clear of the wordmark at 768px', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/#/works');
  for (const language of ['English', '日本語']) {
    await page.locator('header button[aria-controls="language-options"]').click();
    await page.getByRole('button', { name: language, exact: true }).click();
    const positions = await page.evaluate(() => {
      const brand = document.querySelector('.brand-link')!.getBoundingClientRect();
      const nav = document.querySelector('header nav')!.getBoundingClientRect();
      const controls = document.querySelector('header nav')!.nextElementSibling!.getBoundingClientRect();
      return { brand: brand.right, navStart: nav.left, navEnd: nav.right, controls: controls.left };
    });
    expect(positions.brand).toBeLessThanOrEqual(positions.navStart);
    expect(positions.navEnd).toBeLessThanOrEqual(positions.controls);
    expect(Math.abs((positions.navStart + positions.navEnd) / 2 - 384)).toBeLessThan(2);
  }
});

test('a missing SVG falls back to the original PNG without losing the studio name', async ({ page }) => {
  await page.route('**/assets/brand/fimel-logo.svg', route => route.abort());
  await page.goto('/#/works');
  await expect(page.locator('.brand-mark')).toHaveAttribute('src', '/assets/brand/fimel-logo.png');
  await expect.poll(() => page.locator('.brand-mark').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(824);
  await expect(page.locator('.brand-wordmark')).toHaveText('Fimel Studio');
});

test('image and font failures retain an accessible clickable brand without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.route('**/assets/brand/fimel-logo.*', route => route.abort());
  await page.route('**/assets/fonts/minecraft-seven/*.woff', route => route.abort());
  await page.goto('/#/works');
  await expect(page.locator('.brand-mark-fallback')).toHaveText('F');
  await expect(page.locator('.brand-wordmark')).toHaveText('Fimel Studio');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.brand-link').click();
  await expect(page.locator('#hero')).toBeVisible();
});

test('wordmark changes gradients on hover and keyboard focus in both themes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#/works');
  const brand = page.locator('.brand-link');
  const wordmark = page.locator('.brand-wordmark');
  for (const dark of [false, true]) {
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
    await page.mouse.move(700, 600);
    await brand.evaluate(element => (element as HTMLElement).blur());
    await expect.poll(() => wordmark.evaluate(element => getComputedStyle(element, '::after').opacity)).toBe('0');
    const styles = await wordmark.evaluate(element => ({
      resting: getComputedStyle(element).backgroundImage,
      hover: getComputedStyle(element, '::after').backgroundImage,
      transition: getComputedStyle(element, '::after').transitionDuration,
    }));
    expect(styles.resting).toContain('linear-gradient');
    expect(styles.hover).not.toBe(styles.resting);
    expect(styles.transition).toBe('0.18s');
    await brand.hover();
    await expect.poll(() => wordmark.evaluate(element => getComputedStyle(element, '::after').opacity)).toBe('1');
    await page.mouse.move(700, 600);
    await brand.focus();
    await expect.poll(() => wordmark.evaluate(element => getComputedStyle(element, '::after').opacity)).toBe('1');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // The global reduced-motion reset may use 0.01ms !important instead of 0.
  expect(await wordmark.evaluate(element => parseFloat(getComputedStyle(element, '::after').transitionDuration))).toBeLessThanOrEqual(0.001);
  await page.emulateMedia({ forcedColors: 'active' });
  expect(await wordmark.evaluate(element => getComputedStyle(element).color)).not.toBe('rgba(0, 0, 0, 0)');
  expect(await wordmark.evaluate(element => getComputedStyle(element, '::after').content)).toBe('none');
});
