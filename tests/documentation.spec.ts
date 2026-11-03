import { expect, test, type Page } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { documentationFixture, docsFixtureOrigin } from './fixtures/documentation';
import type { DocsManifest } from '../src/content/docs';

const artifactRoot = '.artifacts/documentation-review/public';
let fixture: DocsManifest;
test.beforeAll(async () => { fixture = await documentationFixture(); await mkdir(artifactRoot, { recursive: true }); });

async function setup(page: Page, options: { theme?: string; language?: string; response?: DocsManifest; status?: number } = {}) {
  await page.addInitScript(({ theme, language }) => {
    sessionStorage.setItem('fimel_intro_seen', '1'); localStorage.setItem('fimel_user_lang', language); localStorage.setItem('fimel_theme', theme);
  }, { theme: options.theme ?? 'dark', language: options.language ?? 'zh' });
  await page.route('https://download.studiofimel.com/data/docs.json', route => route.fulfill({ status: options.status ?? 200, json: options.response ?? fixture }));
  await page.route(`${docsFixtureOrigin}**`, async route => {
    const filename = new URL(route.request().url()).pathname.split('/').pop()!;
    await route.fulfill({ contentType: 'image/png', body: await readFile(`admin/examples/docs-example/images/${filename}`) });
  });
  // Other catalogue/analytics reads are isolated from production in these documentation checks.
  await page.route('https://download.studiofimel.com/data/works.json', route => route.fulfill({ json: { schemaVersion: 2, projects: [] } }));
  await page.route('https://download.studiofimel.com/data/site.json', route => route.fulfill({ status: 404, body: '' }));
  await page.route('**/api/work-events', route => route.fulfill({ status: 204, body: '' }));
}

test('23 规则目录、独立分类、标题和正文全文搜索均可导航', async ({ page }) => {
  await setup(page);
  await page.goto('/#/docs');
  await expect(page.getByRole('heading', { level: 1, name: '文档', exact: true })).toBeVisible();
  await expect(page.locator('.docs-index-list > a')).toHaveCount(24);
  await page.locator('.docs-category-title').filter({ hasText: 'Fimel Card' }).click();
  await expect(page).toHaveURL(/category=fimel-card/);
  await expect(page.locator('.docs-index-list > a')).toHaveCount(23);
  const search = page.getByRole('searchbox', { name: '搜索文档标题与正文' });
  await search.fill('四张同点数牌＋小丑牌');
  await expect(page.locator('.docs-search-results a')).toHaveCount(1);
  await expect(page.locator('.docs-search-results a')).toHaveText('Fast Card');
  await page.locator('.docs-search-results a').click();
  await expect(page.locator('.docs-document-header h1')).toHaveText('Fast Card');
  await page.getByRole('button', { name: '清除搜索', exact: true }).click();
  await search.fill('不存在的游戏规则abc123');
  await expect(page.locator('.docs-search-results')).toHaveText('没有找到匹配的文档');
  await page.getByRole('button', { name: '清除搜索', exact: true }).click();
  await page.locator('.docs-category-title').filter({ hasText: '使用指南' }).click();
  await expect(page.locator('.docs-index-list > a')).toHaveCount(1);
  await expect(page.locator('.docs-index-list h2')).toHaveText('排版与安全示例');
});

test('阅读页共用 Markdown 表格、代码、左图右文，TOC 和上一篇下一篇可靠', async ({ page }) => {
  await setup(page);
  await page.goto('/#/docs/fimel-card-fast-card');
  await expect(page.locator('.docs-document-header h1')).toHaveText('Fast Card');
  await expect(page.locator('.documentation-body h1')).toHaveCount(0);
  await expect(page.locator('.docs-image-left')).toHaveCount(1);
  const image = page.locator('.docs-image-column img');
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(256);
  await expect(page.locator('.docs-text-column table')).toContainText('支持人数');
  await expect(page.locator('.documentation-body pre')).toContainText('/function fast_card:admin/start');
  await expect(page.locator('.documentation-body')).toContainText('截图位：游戏全景');
  await page.locator('.docs-toc button').filter({ hasText: /^游戏设置$/ }).click();
  await expect(page).toHaveURL(/section=%E6%B8%B8%E6%88%8F%E8%AE%BE%E7%BD%AE/);
  await expect(page.locator('#游戏设置')).toBeInViewport();
  await page.locator('.docs-pagination a').click();
  await expect(page.locator('.docs-document-header h1')).toHaveText('赌命德州扑克');
  await expect(page.locator('.docs-pagination a')).toHaveCount(2);
  await page.locator('.docs-pagination a').first().click();
  await expect(page.locator('.docs-document-header h1')).toHaveText('Fast Card');
  await page.getByRole('link', { name: '返回游戏规则目录', exact: true }).click();
  await expect(page).toHaveURL(/#\/docs\?category=fimel-card$/);
});

test('右图左文与重复标题定位正确，HTML 和危险链接不会执行', async ({ page }) => {
  await setup(page);
  await page.goto('/#/docs/layout-guide');
  await expect(page.locator('.docs-image-right')).toHaveCount(1);
  await expect(page.locator('#重复标题')).toHaveCount(1);
  await expect(page.locator('#重复标题-2')).toHaveCount(1);
  await expect(page.locator('.docs-toc')).not.toContainText('代码中的标题');
  await expect(page.locator('.documentation-body pre')).toContainText(':::image-left');
  const left = await page.locator('.docs-text-column').boundingBox();
  const right = await page.locator('.docs-image-column').boundingBox();
  expect(left && right && left.x < right.x).toBe(true);
  expect(await page.evaluate(() => '__docsUnsafe' in window)).toBe(false);
  const unsafe = page.locator('.documentation-body a').filter({ hasText: /^危险链接$/ });
  await expect(unsafe).not.toHaveAttribute('href', /javascript:/i);
  await page.getByRole('link', { name: 'Fast Card 规则', exact: true }).click();
  await expect(page.locator('.docs-document-header h1')).toHaveText('Fast Card');
});

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} 桌面阅读与手机图文自适应，没有水平溢出`, async ({ page }) => {
    await setup(page, { theme });
    await page.goto('/#/docs/fimel-card-fast-card');
    await expect(page.locator('.docs-document-header h1')).toHaveText('Fast Card');
    await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
    await expect(page.locator('.docs-sidebar')).toBeVisible();
    await expect(page.locator('.docs-toc')).toBeVisible();
    await page.screenshot({ path: `${artifactRoot}/desktop-${theme}.png`, fullPage: false });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/docs/layout-guide');
    await expect(page.locator('.docs-image-column img')).toBeVisible();
    await expect(page.locator('.docs-sidebar')).not.toBeVisible();
    const image = await page.locator('.docs-image-column').boundingBox();
    const text = await page.locator('.docs-text-column').boundingBox();
    expect(image && text && image.y + image.height <= text.y + 1).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: `${artifactRoot}/mobile-${theme}.png`, fullPage: false });
    await page.getByRole('button', { name: '文档分类', exact: true }).click();
    await expect(page.locator('.docs-sidebar')).toBeVisible();
    await page.getByRole('searchbox', { name: '搜索文档标题与正文' }).fill('UNO');
    await page.locator('.docs-search-results a').filter({ hasText: /^UNO$/ }).click();
    await expect(page.locator('.docs-document-header h1')).toHaveText('UNO');
    await expect(page.locator('.docs-sidebar')).not.toBeVisible();
  });
}

for (const [language, notice] of [['en', 'This document is not available in the current language.'], ['ja', 'この言語の翻訳はまだありません。']] as const) {
  test(`${language} 界面有明确语言回退，仍可阅读原中文`, async ({ page }) => {
    await setup(page, { language });
    await page.goto('/#/docs/fimel-card-fast-card');
    await expect(page.locator('.docs-notice')).toContainText(notice);
    await expect(page.locator('.documentation-body')).toContainText('游戏设置');
    await expect(page.locator('.docs-meta a')).toHaveAttribute('href', '#/works/fimel-card');
  });
}

for (const [kind, empty] of [['空字符串', ''], ['纯空白', ' \n\t ']] as const) {
  test(`en ${kind}译文的分类、标题、简介和正文全部回退为已有中文`, async ({ page }) => {
    const response = structuredClone(fixture);
    const doc = response.documents[0];
    doc.title = { zh: 'Fast Card', en: empty };
    doc.summary = { zh: 'Fast Card 游戏规则、操作流程与设置说明。', en: empty };
    doc.body.en = empty;
    const category = response.categories[0];
    category.title = { zh: 'Fimel Card 中文规则', en: empty };
    category.summary = { zh: '这里收录全部中文游戏规则。', en: empty };
    await setup(page, { language: 'en', response });
    await page.goto('/#/docs?category=fimel-card');
    await expect(page.locator('.docs-document-header h1')).toHaveText('Fimel Card 中文规则');
    await expect(page.locator('.docs-document-header > p')).toHaveText('这里收录全部中文游戏规则。');
    await expect(page.locator('.docs-index-list > a').first()).toContainText('Fast Card 游戏规则、操作流程与设置说明。');
    await page.locator('.docs-index-list > a').first().click();
    await expect(page.locator('.docs-document-header h1')).toHaveText('Fast Card');
    await expect(page.locator('.docs-document-header > p')).toHaveText('Fast Card 游戏规则、操作流程与设置说明。');
    await expect(page.locator('.docs-breadcrumb')).toContainText('Fimel Card 中文规则');
    await expect(page.locator('.docs-notice')).toContainText('This document is not available in the current language.');
    await expect(page.locator('.documentation-body')).toContainText('游戏设置');
    await expect(page.locator('.docs-text-column table')).toContainText('支持人数');
  });
}

test('Ctrl K 在桌面和手机都打开导航并聚焦搜索框', async ({ page }) => {
  await setup(page);
  await page.goto('/#/docs');
  const search = page.getByRole('searchbox', { name: '搜索文档标题与正文' });
  await expect(search).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(search).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/docs/fimel-card-uno');
  await page.reload();
  await expect(page.locator('.docs-sidebar')).not.toBeVisible();
  await page.locator('.docs-document-header h1').click();
  await page.keyboard.press('Control+k');
  await expect(page.locator('.docs-sidebar')).toBeVisible();
  await expect(search).toBeFocused();
});

test('文档 section 深链接首开、刷新和历史返回后保持正确定位', async ({ page }) => {
  await setup(page);
  const section = '管理员命令与对局恢复';
  await page.goto(`/#/docs/fimel-card-fast-card?section=${encodeURIComponent(section)}`);
  await expect(page.locator(`#${section}`)).toBeInViewport();
  await expect.poll(() => page.locator(`#${section}`).evaluate(element => Math.round(element.getBoundingClientRect().top))).toBeGreaterThanOrEqual(100);
  await page.reload();
  await expect(page.locator(`#${section}`)).toBeInViewport();
  await page.locator('.docs-pagination a').click();
  await expect(page.locator('.docs-document-header h1')).toHaveText('赌命德州扑克');
  await page.goBack();
  await expect(page).toHaveURL(/fimel-card-fast-card\?section=/);
  await expect(page.locator(`#${section}`)).toBeInViewport();
});

test('不存在的文档、空索引与服务失败分别展示真实状态，重试可以恢复', async ({ page }) => {
  await setup(page);
  await page.goto('/#/docs/not-a-published-document');
  await expect(page.getByRole('heading', { name: '没有找到这篇文档' })).toBeVisible();
  await expect(page.locator('.documentation-body')).toHaveCount(0);
  await page.route('https://download.studiofimel.com/data/docs.json', route => route.fulfill({ status: 404, body: '' }));
  await page.reload();
  await page.goto('/#/docs');
  await expect(page.getByRole('heading', { name: '文档正在整理中' })).toBeVisible();
  await expect(page.locator('.docs-index-list > a')).toHaveCount(0);
  await page.route('https://download.studiofimel.com/data/docs.json', route => route.fulfill({ status: 503, json: { error: 'unavailable' } }));
  await page.reload();
  await expect(page.getByRole('heading', { name: '暂时无法读取文档' })).toBeVisible();
  await expect(page.getByText('Fast Card', { exact: true })).toHaveCount(0);
  await page.route('https://download.studiofimel.com/data/docs.json', route => route.fulfill({ json: fixture }));
  await page.getByRole('button', { name: '重新读取', exact: true }).click();
  await expect(page.locator('.docs-index-list > a')).toHaveCount(24);
});

test('损坏索引或包含私有图片的公开正文会被拒绝，不暴露私有地址', async ({ page }) => {
  await setup(page);
  const malformed = structuredClone(fixture);
  malformed.documents[0].body.zh = '![私有草稿](/api/docs/media/secret/asset/example.png)';
  await page.route('https://download.studiofimel.com/data/docs.json', route => route.fulfill({ json: malformed }));
  await page.goto('/#/docs/fimel-card-fast-card');
  await expect(page.getByRole('heading', { name: '暂时无法读取文档' })).toBeVisible();
  await expect(page.locator('img[src*="/api/docs/media"]')).toHaveCount(0);
});
