import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import worker from '../src/worker';
import type { Project } from '../src/content/projects';

const catalogue = JSON.parse(readFileSync('public/works/catalogue.json', 'utf8'));
const releases: Project[] = catalogue.projects.filter((project: Project) => project.downloadUrl);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('fimel_intro_seen', '1');
    localStorage.setItem('fimel_user_lang', 'zh');
  });
});

test('all three hosted release files use their own versioned R2 URL', async ({ page }) => {
  expect(releases).toHaveLength(3);
  expect(releases.map(project => project.slug).sort()).toEqual(['bingo-but-dont-do-it', 'minecraft-explorer', 'minecraft-obj-cubizer']);
  for (const project of releases) {
    const folder = project.slug === 'bingo-but-dont-do-it' ? '1.21.11-v1.0' : project.version;
    expect(project.downloadUrl).toContain(`/works/${project.type}/${project.slug}/${folder}/`);
  }
  const invalid = structuredClone(catalogue);
  invalid.projects[0].downloadUrl = 'https://untrusted.example/installer.exe';
  await page.goto('/#/works');
  const validation = await page.evaluate(async ({ releases, invalid }) => {
    const modulePath = '/src/content/projects.ts';
    const { parseCatalogue, projectDownloadUrl } = await import(modulePath);
    let rejected = false;
    try { parseCatalogue(invalid); } catch { rejected = true; }
    return { rejected, urls: releases.map(project => projectDownloadUrl(project)) };
  }, { releases, invalid });
  expect(validation.rejected).toBe(true);
  expect(validation.urls).toEqual(releases.map(project => project.downloadUrl));
});

for (const slug of ['minecraft-explorer', 'minecraft-obj-cubizer', 'bingo-but-dont-do-it']) {
  test(`${slug} downloads directly from R2 without fetching GitHub latest`, async ({ page }) => {
    const project = releases.find(project => project.slug === slug)!;
    const fileName = decodeURIComponent(new URL(project.downloadUrl!).pathname.split('/').pop()!);
    const requests: string[] = [];
    page.on('request', request => { if (request.url().includes('api.github.com')) requests.push(request.url()); });
    await page.route(project.downloadUrl!, route => route.fulfill({ status: 200, contentType: 'application/octet-stream', headers: { 'Content-Disposition': `attachment; filename="${fileName}"` }, body: 'R2 download test' }));
    await page.goto(`/#/works/${slug}`);
    const button = page.getByRole('link', { name: '下载', exact: true });
    await expect(button).toHaveAttribute('href', project.downloadUrl!);
    const downloading = page.waitForEvent('download');
    await button.click();
    expect((await downloading).suggestedFilename()).toBe(fileName);
    expect(requests).toEqual([]);
  });
}

test('Worker redirects legacy GET/HEAD downloads and rejects unsafe destinations', async () => {
  for (const project of releases) {
    const legacy = project.download ?? project.fallbackDownload!;
    const pathname = `/${legacy}`;
    const env = { ASSETS: { fetch: async () => Response.json({ [pathname]: project.downloadUrl }) } };
    for (const method of ['GET', 'HEAD']) {
      const response = await worker.fetch(new Request(`https://studiofimel.com${pathname}`, { method }), env);
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe(project.downloadUrl);
    }
    expect((await worker.fetch(new Request(`https://studiofimel.com${pathname}`, { method: 'POST' }), env)).status).toBe(405);
    const unsafe = { ASSETS: { fetch: async () => Response.json({ [pathname]: 'https://untrusted.example/file.zip' }) } };
    expect((await worker.fetch(new Request(`https://studiofimel.com${pathname}`), unsafe)).status).toBe(502);
  }
});

test('Worker leaves ordinary assets and Supabase scheduled behavior untouched', async () => {
  const response = await worker.fetch(new Request('https://studiofimel.com/works/catalogue.json'), { ASSETS: { fetch: async () => new Response('normal asset') } });
  expect(await response.text()).toBe('normal asset');
  expect(worker.scheduled).toBeDefined();
});
