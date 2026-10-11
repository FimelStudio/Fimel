import { test, expect } from '@playwright/test';

const addedItemIds = [
  '4646512948266854981', '4649725567306540590', '4649651119622229329',
  '4646050867772266368', '4647154283526030957', '4648967044809257014',
  '4649240382612267969', '4648994215119378218', '4648967718332648481',
  '4648788016015567149', '4648775938384483560', '4649193987275973018',
  '4649390432729817156',
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('fimel_intro_seen', '1');
    localStorage.setItem('fimel_user_lang', 'zh');
    localStorage.setItem('fimel_theme', 'dark');
  });
});

test('all supplied NetEase resources have clean source links, local covers and readable descriptions', async ({ request }) => {
  const catalogue = await (await request.get('/works/catalogue.json')).json();
  for (const id of addedItemIds) {
    const entries = catalogue.projects.filter((project: { store?: string }) =>
      project.store && new URLSearchParams(new URL(project.store).hash.split('?')[1]).get('id') === id);
    expect(entries, `NetEase item ${id}`).toHaveLength(1);
    const project = entries[0];
    expect(project.status).toBe('released');
    expect(project.store).not.toContain('channel=');
    expect(project.source.url).toBe(project.store);
    expect(project.source.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(project.image).not.toMatch(/^https?:/);
    expect(project.image).not.toContain('textures/');
    expect(project.image).toMatch(new RegExp(`^assets/images/works/${project.slug}/cover\\.`));
    const cover = await request.get(`/${project.image}`);
    expect(cover.ok()).toBe(true);
    expect(cover.headers()['content-type']).toMatch(/^image\//);
    expect((await cover.body()).byteLength).toBeGreaterThan(500);
    const description = await request.get(`/${project.content.description.zh}`);
    expect(project.content.description.zh).toBe(`works/${project.slug}/description.zh.md`);
    expect(description.ok()).toBe(true);
    const markdown = await description.text();
    expect(markdown.trim().length).toBeGreaterThan(40);
    expect(markdown).not.toMatch(/<!doctype|<script|class="ql-/i);
  }
});

test('an imported project can be searched, opened, refreshed and visited without requesting NetEase APIs', async ({ page, request }) => {
  const catalogue = await (await request.get('/works/catalogue.json')).json();
  const project = catalogue.projects.find((entry: { store?: string }) => entry.store?.includes(addedItemIds[1]));
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    if (/netease\.com|nie\.163\.com|h5\.163\.com/.test(request.url())) externalRequests.push(request.url());
  });
  await page.goto('/#/works');
  await page.getByRole('searchbox', { name: '搜索作品' }).fill('中庭决战');
  const row = page.locator(`.work-row[href="#/works/${project.slug}"]`);
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('中庭决战');
  await expect(page.locator('.project-markdown')).toBeVisible();
  const gallery = page.getByRole('region', { name: '作品图片', exact: true });
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery.locator('.project-gallery-slide')).toHaveCount(3);
  await expect(gallery.locator('.project-gallery-slide[data-active="true"] img')).toHaveAttribute('src', new RegExp(`/assets/images/works/${project.slug}/gallery-01\\.webp$`));
  await expect.poll(() => gallery.locator('.project-gallery-slide[data-active="true"] img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('link', { name: '前往网易资源中心' })).toHaveAttribute('href', project.store);
  await expect.poll(() => page.locator(`header img[src$="${project.image}"]`).evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.reload();
  await expect(page.locator('.project-markdown')).toBeVisible();
  await page.getByRole('tab', { name: '版本', exact: true }).click();
  await expect(page.locator('.project-markdown')).toContainText('本站不根据平台内部字段推测版本');
  expect(externalRequests).toEqual([]);
});

test('music stays in the NetEase category and only source-confirmed work versions are shown', async ({ page, request }) => {
  const catalogue = await (await request.get('/works/catalogue.json')).json();
  const music = catalogue.projects.find((project: { slug: string }) => project.slug === 'music-command-pack');
  expect(music.type).toBe('bedrock');
  expect(music.version).toBe('0.0.4');
  expect(music.tags).toEqual(['music', 'creator-tools']);
  const confirmedVersions: Record<string, string> = {
    'music-command-pack': '0.0.4',
    'werewolf-town-assassination': '2.0',
  };
  for (const project of catalogue.projects.filter((project: { type: string }) => project.type === 'bedrock')) {
    expect(project.version).toBe(confirmedVersions[project.slug]);
  }
  await page.goto('/#/works?type=bedrock&q=音乐');
  await expect(page.locator('.work-row[href="#/works/music-command-pack"]')).toContainText('音乐');
  await page.locator('.work-row[href="#/works/music-command-pack"]').click();
  await page.getByRole('tab', { name: '版本', exact: true }).click();
  await expect(page.locator('.project-markdown')).toContainText('2021-06-06');
});

test('compatibility warning and real 2.0 changes survive the import', async ({ page }) => {
  await page.goto('/#/works/chinese-chess-cb');
  await expect(page.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) })).toContainText('兼容性待确认');
  await expect(page.locator('.project-markdown blockquote').first()).toContainText('无法游玩');
  await page.goto('/#/works/werewolf-town-assassination?tab=changelog');
  await expect(page.locator('.project-markdown')).toContainText('三点单向传送');
  await expect(page.locator('.project-markdown')).toContainText('原文未标注 2.0 的准确发布日期');
});
