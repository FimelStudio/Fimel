import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Project } from '../src/content/projects';
import type { SiteContent } from '../src/content/site-content';
import { DEFAULT_SITE_CONTENT } from '../src/content/site-content';

const baseCatalogue = JSON.parse(readFileSync('public/works/catalogue.json', 'utf8')) as { projects: Project[] };
const featuredImage = 'https://download.studiofimel.com/images/home-review/featured.png';
const imagePath = 'assets/images/home/fimel-card-scene.png';
// Isolate the captured section; all layout checks run with normal page chrome.
const sectionScreenshotStyle = 'header, a[href="#main-content"], [style*="Toast_advancement.png"], button[aria-label*="M-HUD"], #home-tooltip-follower { visibility: hidden !important; }';
const languages = ['zh', 'en', 'ja'] as const;
const copy = {
  zh: { quick: '选择下一段冒险', maps: ['地图推荐', '探索 Java 海岛', '与朋友一起踏入新的地图冒险。'], mods: ['模组推荐', '让对局更有变化', '寻找支持多人游玩的新规则。'], tools: ['创作工具', '把想法变成作品', '为 Minecraft 创作准备实用工具。'] },
  en: { quick: 'Choose your next adventure', maps: ['Map pick', 'Explore a Java island', 'Start a new map adventure with friends.'], mods: ['Mod pick', 'Change the rules', 'Find new ideas for multiplayer sessions.'], tools: ['Creator tools', 'Turn ideas into works', 'Practical tools for Minecraft creators.'] },
  ja: { quick: '次の冒険を選ぼう', maps: ['おすすめマップ', 'Javaの島を探検', '友だちと新しいマップの冒険へ。'], mods: ['おすすめMOD', '対戦に新しいルールを', 'マルチプレイを広げるアイデア。'], tools: ['制作ツール', 'アイデアを作品に', 'Minecraftの制作に役立つツール。'] },
};

function catalogue(configured: boolean) {
  const projects = structuredClone(baseCatalogue.projects);
  const get = (slug: string) => projects.find(project => project.slug === slug)!;
  get('island-escape-java').status = 'released';
  get('fimel-card').status = 'released';
  for (const slug of ['island-escape-before-dawn', 'bingo-but-dont-do-it', 'minecraft-explorer']) get(slug).featuredImage = featuredImage;
  const site: SiteContent = { ...structuredClone(DEFAULT_SITE_CONTENT), featured: {
    // The public reader must still filter an incorrectly grouped data pack.
    maps: ['island-escape-before-dawn', 'island-escape-java', 'fimel-card'],
    released: ['minecraft-explorer', 'minecraft-obj-cubizer'], development: ['spoiler-rpg'],
  }, studio: { title: { zh: '从地图开始，继续创造', en: 'From maps to new ideas', ja: 'マップから、新しい創作へ' }, description: { zh: '我们制作地图、模组、数据包与创作工具。', en: 'We make maps, mods, data packs and creator tools.', ja: 'マップ、MOD、データパックと制作ツールを作っています。' } } };
  if (configured) {
    const localized = (field: 'quick' | 'maps' | 'mods' | 'tools', index = 0) => Object.fromEntries(languages.map(language => [language, field === 'quick' ? copy[language].quick : copy[language][field][index]]));
    site.home = { quickTitle: localized('quick'), spotlights: {
      maps: { workSlug: 'island-escape-java', label: localized('maps'), title: localized('maps', 1), summary: localized('maps', 2) },
      mods: { workSlug: 'bingo-but-dont-do-it', label: localized('mods'), title: localized('mods', 1), summary: localized('mods', 2) },
      tools: { workSlug: 'minecraft-explorer', label: localized('tools'), title: localized('tools', 1), summary: localized('tools', 2) },
    } };
  }
  return { schemaVersion: 2, projects, releases: {}, site };
}

async function fixture(page: Page, language: typeof languages[number], configured = true) {
  const data = catalogue(configured);
  await page.addInitScript(locale => {
    sessionStorage.setItem('fimel_intro_seen', '1'); localStorage.setItem('fimel_user_lang', locale); localStorage.setItem('fimel_theme', 'dark');
  }, language);
  await page.route('https://download.studiofimel.com/**', route => route.abort());
  await page.route(featuredImage, route => route.fulfill({ contentType: 'image/png', path: `public/${imagePath}` }));
  await page.route('**/works/catalogue.json', route => route.fulfill({ json: data }));
  await page.route('https://download.studiofimel.com/data/works.json', route => route.fulfill({ json: data }));
  await page.goto('/#/');
  await expect(page.locator('[data-home-featured]')).toBeAttached();
  return data;
}

const overflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
const card = (page: Page, title: string) => page.locator('#quick-entry a').filter({ has: page.getByRole('heading', { level: 3, name: title, exact: true }) });

for (const language of languages) {
  test(`${language} 首页使用网站草稿三语推荐与精选图，Java地图分类和两种主题各尺寸保持正确`, async ({ page }) => {
    test.setTimeout(120000);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const data = await fixture(page, language);
    await expect(page.locator('#quick-entry h2')).toHaveText(copy[language].quick);
    for (const [key, slug] of [['maps', 'island-escape-java'], ['mods', 'bingo-but-dont-do-it'], ['tools', 'minecraft-explorer']] as const) {
      const link = card(page, copy[language][key][1]);
      await expect(link).toContainText(copy[language][key][0]); await expect(link).toContainText(copy[language][key][2]);
      await expect(link).toHaveAttribute('href', `#/works/${slug}`);
      const project = data.projects.find(project => project.slug === slug)!;
      await expect(link.locator('img')).toHaveAttribute('src', project.featuredImage || `/${project.image}`);
    }
    const maps = page.locator('[data-featured-group="maps"]');
    await expect(maps.locator('a')).toHaveCount(2);
    await expect(maps.locator('a[href="#/works/island-escape-before-dawn"] img')).toHaveAttribute('src', featuredImage);
    await expect(maps.locator('a[href="#/works/island-escape-java"]')).toBeAttached();
    await expect(maps.locator('a[href="#/works/fimel-card"]')).toHaveCount(0);
    await expect(page.locator('[data-featured-group="released"] a[href="#/works/minecraft-explorer"] img')).toHaveAttribute('src', featuredImage);
    await expect(page.locator('[data-featured-group="released"] a[href="#/works/minecraft-obj-cubizer"] img')).toHaveAttribute('src', `/${data.projects.find(project => project.slug === 'minecraft-obj-cubizer')!.image}`);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), theme === 'dark');
      for (const width of [1440, 390, 320]) { await page.setViewportSize({ width, height: 900 }); await overflow(page); }
      await page.setViewportSize({ width: 390, height: 900 });
      await page.locator('#quick-entry').screenshot({ path: `.artifacts/home-refresh-review/quick-${language}-${theme}-390.png`, style: sectionScreenshotStyle });
      await page.locator('#about').screenshot({ path: `.artifacts/home-refresh-review/about-${language}-${theme}-390.png`, style: sectionScreenshotStyle });
      if (language === 'zh') for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.locator('[data-featured-group="released"]').screenshot({ path: `.artifacts/home-refresh-review/released-zh-${theme}-${width}.png`, style: sectionScreenshotStyle });
      }
    }
    expect(errors).toEqual([]);
  });
}

test('未配置首页文案沿用原卡片，精选封图不改变作品目录和详情主封面，工作室图像静态且真实加载', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const data = await fixture(page, 'zh', false);
  await expect(page.locator('#quick-entry h2')).toHaveText('地图、数据包、模组和创作工具');
  for (const [title, href] of [['海岛逃生：黎明前夕', '#/works?type=bedrock'], ["Bingo But Don't Do It", '#/works?type=mods'], ['Minecraft OBJ Cubizer', '#/works?type=tools']]) await expect(card(page, title)).toHaveAttribute('href', href);
  const about = page.locator('#about');
  const studioImage = about.locator('[data-studio-visual] img');
  await studioImage.scrollIntoViewIfNeeded();
  await expect(studioImage).toHaveAttribute('src', `/${imagePath}`);
  await expect.poll(() => studioImage.evaluate(image => ({ width: (image as HTMLImageElement).naturalWidth, height: (image as HTMLImageElement).naturalHeight }))).toEqual({ width: 3840, height: 2160 });
  expect(await about.locator('canvas').count()).toBe(0);
  const textBounds = await about.locator('h2').boundingBox(), imageBounds = await studioImage.boundingBox();
  expect(textBounds!.x + textBounds!.width).toBeLessThanOrEqual(imageBounds!.x);
  expect((await about.boundingBox())!.height).toBeLessThan(850);
  const visual = page.locator('[data-studio-visual]>div');
  const transform = await visual.evaluate(element => getComputedStyle(element).transform);
  await visual.hover({ position: { x: 20, y: 20 } });
  await expect(visual).toHaveCSS('transform', transform);
  await about.screenshot({ path: '.artifacts/home-refresh-review/about-desktop-static.png', style: sectionScreenshotStyle });
  const ordinary = data.projects.find(project => project.slug === 'minecraft-explorer')!;
  await page.goto('/#/works?type=tools');
  const row = page.locator('.work-row[href="#/works/minecraft-explorer"]');
  await expect(row.locator('img')).toHaveAttribute('src', `/${ordinary.image}`);
  await row.click();
  const projectHeader = page.locator('header').filter({ has: page.getByRole('heading', { level: 1, name: 'Minecraft Explorer', exact: true }) });
  await expect(projectHeader.locator('img')).toHaveAttribute('src', `/${ordinary.image}`);
  expect(errors).toEqual([]);
});

test.describe('工作室场景的鼠标视差', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('精细鼠标移动时图像产生轻微转动，移出后回到静态', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await fixture(page, 'zh');
    const visual = page.locator('[data-studio-visual]>div');
    await visual.scrollIntoViewIfNeeded();
    const bounds = (await visual.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width * 0.2, bounds.y + bounds.height * 0.2);
    await expect.poll(() => visual.evaluate(element => getComputedStyle(element).transform)).not.toBe('none');
    const first = await visual.evaluate(element => getComputedStyle(element).transform);
    await page.mouse.move(bounds.x + bounds.width * 0.8, bounds.y + bounds.height * 0.7);
    await expect.poll(() => visual.evaluate(element => getComputedStyle(element).transform)).not.toBe(first);
    await visual.screenshot({ path: '.artifacts/home-refresh-review/studio-pointer-active.png', style: sectionScreenshotStyle });
    await page.mouse.move(0, 0);
    await expect.poll(() => visual.evaluate(element => getComputedStyle(element).transform), { timeout: 10000 }).toBe('none');
    expect(errors).toEqual([]);
  });
});
