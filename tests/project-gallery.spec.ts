import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const pictures = [
  { alt: '场景一', path: 'assets/images/works/island-escape-before-dawn/cover.png' },
  { alt: '场景二', path: 'assets/images/works/amethyst-salvation/cover.png' },
  { alt: '场景三', path: 'assets/images/works/werewolf-f-town/cover.png' },
];
const pictureMarkdown = pictures.map(picture => `![${picture.alt}](../../${picture.path})`).join('\n');
const multiImageMarkdown = `## 图库示例\n\n${pictureMarkdown}\n\n图片之后的正文仍可阅读。`;
const gallery = '.project-gallery';
const track = '.project-gallery-track';
const slides = '.project-gallery-slide';

async function mockDescription(page: Page, markdown: string) {
  await page.route('**/works/fimel-card/description.*.md', route => route.fulfill({
    status: 200, contentType: 'text/markdown; charset=utf-8', body: markdown,
  }));
}

async function touchSwipeLeft(page: Page) {
  const viewport = page.locator(track).first();
  await viewport.scrollIntoViewIfNeeded();
  const bounds = await viewport.boundingBox();
  expect(bounds).not.toBeNull();
  const cdp = await page.context().newCDPSession(page);
  const y = bounds!.y + bounds!.height / 2;
  const startX = bounds!.x + bounds!.width * 0.86;
  const endX = bounds!.x + bounds!.width * 0.14;
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y }] });
    for (let step = 1; step <= 10; step++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: [{ x: startX + (endX - startX) * step / 10, y }],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('fimel_intro_seen', '1');
    if (!localStorage.getItem('fimel_user_lang')) localStorage.setItem('fimel_user_lang', 'zh');
    if (!localStorage.getItem('fimel_theme')) localStorage.setItem('fimel_theme', 'light');
  });
});

test('consecutive Markdown image lines form one semantic gallery without converting prose or code', async ({ page }) => {
  const markupWarnings: string[] = [];
  page.on('console', message => {
    if (/cannot be a descendant|cannot contain a nested|hydration error/i.test(message.text())) markupWarnings.push(message.text());
  });
  await mockDescription(page, `${multiImageMarkdown}\n\n普通文字 ![内联插图](../../${pictures[0].path}) 仍应保持在段落里。\n\n\`\`\`md\n![代码示例](../../${pictures[1].path})\n\`\`\``);
  await page.goto('/#/works/fimel-card');
  await expect(page.locator(gallery)).toHaveCount(1);
  await expect(page.getByRole('region', { name: '作品图片', exact: true })).toBeVisible();
  await expect(page.locator(slides)).toHaveCount(pictures.length);
  await expect(page.locator(`${gallery} figcaption`)).toContainText(/第\s*1\s*张，共\s*3\s*张/);
  await expect(page.locator('.project-markdown p').filter({ hasText: '普通文字' })).toContainText('仍应保持在段落里');
  await expect(page.locator('.project-markdown p').filter({ hasText: '普通文字' }).getByRole('img', { name: '内联插图', exact: true })).toHaveCount(1);
  await expect(page.locator('.project-markdown pre')).toContainText('![代码示例]');
  expect(markupWarnings).toEqual([]);
});

test('gallery buttons and keyboard use bounded native scrolling and resolve images relative to Markdown', async ({ page }) => {
  await mockDescription(page, multiImageMarkdown);
  await page.goto('/#/works/fimel-card');
  await page.locator(gallery).scrollIntoViewIfNeeded();
  const previous = page.getByRole('button', { name: '上一张图片', exact: true });
  const next = page.getByRole('button', { name: '下一张图片', exact: true });
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();
  await expect(page.locator(slides).nth(0)).toHaveAttribute('data-active', 'true');
  await expect(page.locator(`${slides}[data-active="true"] img`)).toHaveAttribute('src', new RegExp(`/${pictures[0].path}$`));
  await expect.poll(() => page.locator(`${slides}[data-active="true"] img`).evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await next.click();
  await expect(page.locator(slides).nth(1)).toHaveAttribute('data-active', 'true');
  await expect(previous).toBeEnabled();
  await previous.click();
  await expect(page.locator(slides).nth(0)).toHaveAttribute('data-active', 'true');
  const viewport = page.locator(track);
  await viewport.focus();
  await viewport.press('End');
  await expect(page.locator(slides).last()).toHaveAttribute('data-active', 'true');
  await expect(next).toBeDisabled();
  await viewport.press('ArrowRight');
  await expect(page.locator(slides).last()).toHaveAttribute('data-active', 'true');
  await viewport.press('ArrowLeft');
  await expect(page.locator(slides).nth(1)).toHaveAttribute('data-active', 'true');
  await viewport.press('Home');
  await expect(page.locator(slides).first()).toHaveAttribute('data-active', 'true');
  await expect(previous).toBeDisabled();
  await expect(page.locator('.project-markdown')).toContainText('图片之后的正文仍可阅读');
});

test('a single Markdown image has no carousel controls or counter', async ({ page }) => {
  await mockDescription(page, `## 单张图片\n\n![单张场景](../../${pictures[0].path})\n\n单图之后的正文。`);
  await page.goto('/#/works/fimel-card');
  await expect(page.locator(gallery)).toHaveCount(1);
  await page.locator(gallery).scrollIntoViewIfNeeded();
  await expect(page.locator(slides)).toHaveCount(1);
  await expect(page.locator(gallery).getByRole('button')).toHaveCount(0);
  await expect(page.locator(gallery).getByRole('status')).toHaveCount(0);
  await expect(page.locator(gallery).getByRole('img', { name: '单张场景', exact: true })).toHaveAttribute('loading', 'lazy');
  await expect(page.locator('.project-markdown')).toContainText('单图之后的正文');
});

test('malformed Markdown URLs and executable links leave project text usable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await mockDescription(page, '## 安全正文\n\n[无效地址](https://[broken)\n\n[危险地址](javascript:alert%281%29)\n\n文字 ![无效图片](https://[broken) 保持可读。\n\n<script>window.markdownExecuted=true</script>');
  await page.goto('/#/works/fimel-card');
  await expect(page.locator('.project-markdown')).toContainText('保持可读');
  await expect(page.locator('.project-markdown a[href]')).toHaveCount(0);
  expect(await page.evaluate(() => Object.hasOwn(window, 'markdownExecuted'))).toBe(false);
  expect(errors).toEqual([]);
});

test('one failed gallery image leaves the description, repository and remaining slides usable', async ({ page }) => {
  await mockDescription(page, multiImageMarkdown);
  await page.route(`**/${pictures[0].path}`, route => route.fulfill({ status: 404, body: 'missing gallery frame' }));
  await page.goto('/#/works/fimel-card');
  await page.locator(gallery).scrollIntoViewIfNeeded();
  await expect(page.locator('.project-gallery-error')).toContainText('图片暂时无法加载');
  await expect(page.locator('.project-markdown')).toContainText('图片之后的正文仍可阅读');
  await expect(page.getByRole('link', { name: '项目仓库', exact: true })).toHaveAttribute('href', 'https://github.com/FimelStudio/fimelcard-dp');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: '下一张图片', exact: true }).click();
  const active = page.locator(`${slides}[data-active="true"] img`);
  await expect(active).toHaveAttribute('alt', pictures[1].alt);
  await expect.poll(() => active.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});

test('far-below-fold gallery media wait for visibility and only current or adjacent frames are mounted', async ({ page }) => {
  const requestedPictures: string[] = [];
  page.on('request', request => {
    for (const picture of pictures) if (new URL(request.url()).pathname.endsWith(`/${picture.path}`)) requestedPictures.push(picture.path);
  });
  const opening = Array.from({ length: 75 }, (_, index) => `这是图片之前的正文第 ${index + 1} 段，用于检查首屏不会提前加载远处的作品媒体。`).join('\n\n');
  await mockDescription(page, `## 首屏正文\n\n${opening}\n\n${multiImageMarkdown}`);
  await page.goto('/#/works/fimel-card');
  await expect(page.locator('.project-markdown')).toContainText('首屏正文');
  await expect(page.locator(gallery)).toHaveCount(1);
  expect(await page.locator(gallery).evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThan(4000);
  expect(requestedPictures).toEqual([]);
  await page.locator(gallery).scrollIntoViewIfNeeded();
  await expect(page.locator(`${slides}[data-active="true"] img`)).toHaveAttribute('loading', 'lazy');
  await expect.poll(() => requestedPictures.includes(pictures[0].path)).toBe(true);
  expect(requestedPictures).not.toContain(pictures[2].path);
  await page.locator(track).focus();
  await page.locator(track).press('End');
  await expect(page.locator(slides).last()).toHaveAttribute('data-active', 'true');
  await expect.poll(() => requestedPictures.includes(pictures[2].path)).toBe(true);
});

test('reduced motion keeps slide changes direct and the gallery never advances automatically', async ({ page }) => {
  await mockDescription(page, multiImageMarkdown);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/works/fimel-card');
  await page.locator(gallery).scrollIntoViewIfNeeded();
  const scrolling = await page.locator(track).evaluate(element => getComputedStyle(element).scrollBehavior);
  expect(scrolling).toBe('auto');
  await page.locator(track).focus();
  await page.locator(track).press('End');
  await expect(page.locator(slides).last()).toHaveAttribute('data-active', 'true');
  await page.locator(track).press('Home');
  await expect(page.locator(slides).first()).toHaveAttribute('data-active', 'true');
  // Wait for visible image decoding and two browser frames, without inserting an
  // arbitrary timer or enabling a global autoplay policy in the implementation.
  await expect.poll(() => page.locator(`${slides}[data-active="true"] img`).evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator(slides).first()).toHaveAttribute('data-active', 'true');
});

const galleryLabels = {
  zh: { region: '作品图片', previous: '上一张图片', next: '下一张图片' },
  en: { region: 'Project images', previous: 'Previous image', next: 'Next image' },
  ja: { region: '作品画像', previous: '前の画像', next: '次の画像' },
};

test.describe('mobile touch galleries', () => {
  test.use({ hasTouch: true });
  for (const language of ['zh', 'en', 'ja'] as const) {
  test(`320px ${language} light and dark galleries support touch scrolling without page overflow`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await mockDescription(page, multiImageMarkdown);
    await page.goto('/#/works/fimel-card');
    if (language !== 'zh') {
      await page.getByRole('button', { name: /^切换语言/ }).click();
      await page.getByRole('button', { name: language === 'en' ? 'English' : '日本語', exact: true }).click();
    }
    const labels = galleryLabels[language];
    await expect(page.getByRole('region', { name: labels.region, exact: true })).toHaveCount(1);
    const darkLabel = language === 'zh' ? '切换至暗色' : language === 'en' ? 'Use dark theme' : 'ダークテーマに変更';
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.getByRole('button', { name: darkLabel, exact: true }).click();
      await page.locator(track).scrollIntoViewIfNeeded();
      await page.locator(track).focus();
      await page.locator(track).press('Home');
      await expect(page.locator(slides).first()).toHaveAttribute('data-active', 'true');
      await touchSwipeLeft(page);
      await expect(page.locator(slides).first()).toHaveAttribute('data-active', 'false');
      await expect(page.getByRole('button', { name: labels.previous, exact: true })).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const bounds = await page.locator(track).boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
      await page.getByRole('button', { name: labels.previous, exact: true }).click();
      await page.locator(track).focus();
      await page.locator(track).press('Home');
      await expect(page.locator(slides).first()).toHaveAttribute('data-active', 'true');
      await page.screenshot({ path: `.artifacts/gallery-${language}-${theme}-320.png`, fullPage: true });
    }
  });
  }
});
