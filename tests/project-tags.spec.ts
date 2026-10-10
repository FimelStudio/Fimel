import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Project } from '../src/content/projects';

const projectTags: Record<string, Record<string, string>> = JSON.parse(readFileSync(new URL('../src/content/project-tags.json', import.meta.url), 'utf8'));
const catalogueProjects: Project[] = JSON.parse(readFileSync(new URL('../public/works/catalogue.json', import.meta.url), 'utf8')).projects;
const projectCount = catalogueProjects.length;
const bedrockCount = catalogueProjects.filter(project => project.type === 'bedrock').length;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('fimel_intro_seen', '1');
    localStorage.setItem('fimel_user_lang', 'zh');
    localStorage.setItem('fimel_theme', 'dark');
  });
});

test('every work uses explicit genre IDs, not feature translation keys', async ({ request }) => {
  const response = await request.get('/works/catalogue.json');
  const catalogue = await response.json();
  expect(catalogue.projects).toHaveLength(projectCount);
  for (const project of catalogue.projects) {
    expect(Array.isArray(project.tags)).toBe(true);
    expect(project.tags.length).toBeLessThanOrEqual(4);
    expect(new Set(project.tags).size).toBe(project.tags.length);
    expect(project.translations?.tags).toBeUndefined();
    for (const tag of project.tags) expect(Object.hasOwn(projectTags, tag)).toBe(true);
  }
  expect(catalogue.projects.find((project: { slug: string }) => project.slug === 'power-on-2-snow-crisis').tags).toEqual([]);
});

test('cards show actual gameplay and tool categories without feature snippets', async ({ page }) => {
  await page.goto('/#/works');
  await expect(page.locator('.work-row')).toHaveCount(projectCount);
  await expect(page.locator('.work-row[href="#/works/island-escape-before-dawn"] li')).toHaveText([
    '网易基岩版地图', 'PvP', '非对称竞技', '合作', '逃生',
  ]);
  await expect(page.locator('.work-row[href="#/works/amethyst-salvation"] li')).toHaveText([
    '网易基岩版地图', 'PvE', '角色扮演', '冒险',
  ]);
  await expect(page.locator('.work-row[href="#/works/minecraft-obj-cubizer"] li')).toHaveText([
    '插件与工具', '3D 建模', '格式转换', '创作辅助',
  ]);
  await expect(page.locator('.work-row[href="#/works/power-on-2-snow-crisis"] li')).toHaveText(['网易基岩版地图']);
  expect(await page.locator('.work-row ul').allTextContents()).not.toEqual(expect.arrayContaining([
    expect.stringMatching(/五座信号塔|职业选择|装备升级|独立菜单|356 条词条/),
  ]));
  await page.locator('.work-row[href="#/works/island-escape-before-dawn"]').click();
  await expect(page.locator('aside > ul li')).toHaveText(['PvP', '非对称竞技', '合作', '逃生']);
});

test('genre search accepts Chinese and English names across projects', async ({ page }) => {
  await page.goto('/#/works');
  await expect(page.locator('.work-row')).toHaveCount(projectCount);
  // Search also includes localized titles/summaries and every language's genre
  // labels, so counting only projects with a particular tag would be incorrect.
  const displayedProjects = await page.locator('.work-row').evaluateAll(rows => rows.map(row => ({
    slug: row.getAttribute('href')!.split('/').pop()!,
    title: row.querySelector('h2')?.textContent ?? '',
    summary: row.querySelectorAll('p')[1]?.textContent ?? '',
    tags: Array.from(row.querySelectorAll('li')).slice(1).map(tag => tag.textContent ?? ''),
  })));
  const searchEntries = displayedProjects.map(display => {
    const project = catalogueProjects.find(entry => entry.slug === display.slug)!;
    const translatedGenres = project.tags.flatMap(tag => [tag, ...Object.values(projectTags[tag])]).join(' ');
    return {
      slug: project.slug,
      text: `${display.title} ${display.summary} ${display.tags.join(' ')} ${translatedGenres} ${project.platform.join(' ')} ${project.slug} ${project.creators.map(creator => creator.name).join(' ')}`.toLocaleLowerCase(),
    };
  });
  for (const query of ['角色扮演', 'RPG', '非对称竞技']) {
    const expectedSlugs = searchEntries.filter(entry => entry.text.includes(query.toLocaleLowerCase())).map(entry => entry.slug);
    expect(expectedSlugs.length).toBeGreaterThan(0);
    await page.getByRole('searchbox', { name: '搜索作品' }).fill(query);
    await expect(page.locator('.work-row')).toHaveCount(expectedSlugs.length);
    await expect.poll(async () => page.locator('.work-row').evaluateAll(rows => rows.map(row => row.getAttribute('href')!.split('/').pop()!)))
      .toEqual(expectedSlugs);
  }
});

test('genre labels switch language without maintaining duplicate project arrays', async ({ page }) => {
  await page.goto('/#/works?type=bedrock');
  await expect(page.locator('.work-row')).toHaveCount(bedrockCount);
  await page.getByRole('button', { name: '切换语言' }).click();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('.work-row[href="#/works/amethyst-salvation"] li')).toHaveText([
    'NetEase Bedrock Maps', 'PvE', 'RPG', 'Adventure',
  ]);
  await page.getByRole('button', { name: 'Change language' }).click();
  await page.getByRole('button', { name: '日本語', exact: true }).click();
  await expect(page.locator('.work-row[href="#/works/amethyst-salvation"] li')).toHaveText([
    'NetEase 統合版マップ', 'PvE', 'ロールプレイ', 'アドベンチャー',
  ]);
});

test('home uses the official Bingo name and the same historical metrics as project details', async ({ page, request }) => {
  const catalogue = await (await request.get('/works/catalogue.json')).json();
  await page.goto('/');
  const bingo = page.locator('#works a[href="#/works/bingo-but-dont-do-it"]');
  await expect(bingo).toContainText('Bingo But Don\'t Do It');
  await expect(bingo.locator('img')).toHaveAttribute('alt', 'Bingo But Don\'t Do It');
  for (const slug of ['island-escape-before-dawn', 'amethyst-salvation', 'werewolf-f-town']) {
    const project = catalogue.projects.find((entry: { slug: string }) => entry.slug === slug);
    await expect(page.locator(`#works a[href="#/works/${slug}"]`)).toContainText(project.downloads.toLocaleString('en-US'));
  }
  await expect(page.locator('#works')).toContainText('商店数据为已收录的历史记录，请以平台最新信息为准。');
});

test('Java project descriptions describe development without claiming unverified authorization', async ({ request }) => {
  const description = await (await request.get('/works/spoiler-rpg/description.md')).text();
  expect(description).toContain('正在制作');
  expect(description).not.toContain('授权');
});
