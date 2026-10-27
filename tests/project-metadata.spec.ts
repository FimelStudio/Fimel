import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Project } from '../src/content/projects';
import type { DownloadRelease } from '../src/content/releases';

function project(slug: string, changes: Partial<Project> = {}): Project {
  return {
    slug, type: 'datapacks', title: { zh: slug, en: slug, ja: slug }, image: 'assets/brand/fimel-logo.svg',
    status: 'released', platform: ['Minecraft Java'], creators: [{ name: 'Fimel Studio' }], tags: [],
    updated: '2026-10-27', content: { description: 'works/fimel-card/description.zh.md' }, ...changes,
  };
}

function release(slug: string, id: string, date: string): DownloadRelease {
  return {
    id, label: id, date, status: 'released', gameVersions: ['1.21.11'], files: [{
      id: `${id}-file`, name: `${id}.zip`, size: 64, mime: 'application/zip', sha256: 'a'.repeat(64),
      publicUrl: `https://download.studiofimel.com/works/datapacks/${slug}/${id}/${id}.zip`,
    }],
  };
}

async function fixture(page: Page, item: Project, releases: DownloadRelease[] = [], language = 'zh') {
  await page.addInitScript(locale => {
    sessionStorage.setItem('fimel_intro_seen', '1');
    localStorage.setItem('fimel_user_lang', locale);
    localStorage.setItem('fimel_theme', 'light');
  }, language);
  const catalogue = { schemaVersion: 2, projects: [item], releases: { [item.slug]: releases } };
  await page.route('**/works/catalogue.json', route => route.fulfill({ json: catalogue }));
  // A locally configured remote source also stays inside this read-only fixture.
  await page.route('https://download.studiofimel.com/data/works.json', route => route.fulfill({ json: catalogue }));
  await page.goto(`/#/works/${item.slug}`);
  await expect(page.getByRole('heading', { level: 1, name: item.slug, exact: true })).toBeVisible();
}

const firstPublished = (page: Page) => page.locator('aside dt').filter({ hasText: /^首次发布$/ }).locator('..').locator('dd');

for (const [slug, dates, expected] of [
  ['fimel-card', ['2026-10-27', '2026-10-26'], '2026年10月26日'],
  ['simple-replay-datapack', ['2026-10-27'], '2026年10月27日'],
] as const) {
  test(`${slug} 缺少首发字段时在项目侧栏显示最早公开发行版本日期`, async ({ page }) => {
    const item = project(slug);
    await fixture(page, item, dates.map((date, index) => release(slug, `v${index + 1}`, date)));
    await expect(firstPublished(page)).toHaveText(expected);
    await expect(page.locator('aside dt').filter({ hasText: /^上次更新$/ }).locator('..').locator('dd')).toHaveText('2026年10月27日');
  });
}

test('明确的历史首发日期优先于版本列表', async ({ page }) => {
  const item = project('explicit-history', { published: '2020-05-01' });
  await fixture(page, item, [release(item.slug, 'v2', '2026-10-27')]);
  await expect(firstPublished(page)).toHaveText('2020年5月1日');
});

test('制作中的作品不会用更新时间猜测首发日期', async ({ page }) => {
  const developing = project('development-metadata', { status: 'development' });
  await fixture(page, developing);
  await expect(firstPublished(page)).toHaveText('尚未公布');
  await expect(page.locator('aside dt').filter({ hasText: /^上次更新$/ }).locator('..').locator('dd')).toHaveText('2026年10月27日');
});

for (const [language, label] of [
  ['zh', '项目仓库'], ['en', 'Project repository'], ['ja', 'プロジェクトリポジトリ'],
] as const) {
  test(`${language} 项目仓库名称适用于通用仓库地址并安全打开新标签页`, async ({ page }) => {
    const repository = 'https://codeberg.org/fimel/resource-project';
    await fixture(page, project('generic-repository', { repository }), [], language);
    const link = page.getByRole('link', { name: label, exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', repository);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /\bnoopener\b/);
    await expect(link).toHaveAttribute('rel', /\bnoreferrer\b/);
    await link.focus();
    await expect(link).toBeFocused();
  });
}

test('没有项目仓库地址时不显示仓库入口', async ({ page }) => {
  await fixture(page, project('without-repository'));
  await expect(page.getByRole('link', { name: '项目仓库', exact: true })).toHaveCount(0);
});
