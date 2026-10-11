import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

// Run against a production preview, including a GitHub Pages subdirectory build.
const projects = JSON.parse(readFileSync(new URL('../public/works/catalogue.json', import.meta.url), 'utf8')).projects;
const expectedProjectCount = projects.length;
const origin = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const base = process.env.TEST_BASE_PATH || '/';
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : undefined, headless: true });
const page = await browser.newPage({ reducedMotion: 'reduce' });
const errors = [];
const requests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => requests.push(request.url()));
try {
  await page.goto(`${origin}${base}#/works`);
  await page.locator('.work-row').first().waitFor();
  assert.equal(await page.locator('.work-row').count(), expectedProjectCount);
  assert.ok(!requests.some(url => /vendor-three|useWorksData|ParticleBackground|Float-|ProjectMarkdown/.test(url)), 'Works must not eagerly load the 3D engine or Markdown renderer');
  await page.locator('.work-row[href="#/works/bingo-but-dont-do-it"]').click();
  await page.locator('.project-markdown').waitFor();
  assert.ok((await page.locator('.project-markdown').innerText()).includes('队伍共享生命'));
  await page.reload();
  await page.locator('.project-markdown').waitFor();
  const imageUrl = await page.locator('header img').first().getAttribute('src');
  assert.ok(imageUrl.startsWith(base), 'Logo must use the deployment base');
  for (const project of projects) {
    const response = await page.request.get(`${origin}${base}${project.image}`);
    assert.ok(response.ok() && response.headers()['content-type'].startsWith('image/'), `Missing real cover: ${project.slug}`);
  }
  for (const type of ['bedrock', 'java', 'datapacks', 'tools', 'mods']) {
    await page.goto(`${origin}${base}#/works?type=${type}`);
    await page.locator('.work-row').first().waitFor();
    assert.equal(await page.locator('.work-row').count(), projects.filter(project => project.type === type).length);
  }
  await page.goto(`${origin}${base}#/works/fimel-card`);
  await page.locator('.project-markdown').waitFor();
  assert.ok((await page.locator('.project-markdown').innerText()).includes('暂未发布'));
  await page.reload();
  await page.locator('.project-markdown').waitFor();
  await page.screenshot({ path: `.artifacts/fimel-card-${base === '/' ? 'root' : 'github'}.png`, fullPage: true });
  for (const project of projects.filter(project => project.download || project.fallbackDownload)) {
    const response = await page.request.head(`${origin}${base}${project.download || project.fallbackDownload}`);
    assert.ok(response.ok() && !response.headers()['content-type'].includes('text/html'), `Broken existing download: ${project.slug}`);
  }
  // A moved image must not change a featured work's detail URL.
  await page.goto(`${origin}${base}`);
  await page.locator('#works').waitFor();
  for (const slug of ['island-escape-before-dawn', 'amethyst-salvation', 'werewolf-f-town']) {
    assert.equal(await page.locator(`#works a[href="#/works/${slug}"]`).count(), 1);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(`${origin}${base}#/works?type=datapacks`);
  await page.locator('.work-row').first().waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile document overflows');
  await page.screenshot({ path: `.artifacts/datapacks-mobile-${base === '/' ? 'root' : 'github'}.png`, fullPage: true });
  let screenshots = 0;
  for (const project of projects.filter(project => project.type === 'bedrock')) {
    const source = JSON.parse(readFileSync(new URL(`../content-sources/netease/${project.slug}.json`, import.meta.url), 'utf8'));
    for (const image of source.gallery?.images ?? []) {
      const response = await page.request.get(`${origin}${base}${image.localPath}`);
      assert.ok(response.ok() && response.headers()['content-type'].startsWith('image/'), `Broken project screenshot: ${image.localPath}`);
      screenshots += 1;
    }
  }
  await page.goto(`${origin}${base}#/works/es-atrium-showdown`);
  const gallery = page.locator('.project-gallery').first();
  await gallery.waitFor();
  await gallery.scrollIntoViewIfNeeded();
  await gallery.locator('[data-active="true"] img').waitFor();
  await gallery.locator('.project-gallery-button').last().click();
  await page.waitForFunction(() => document.querySelector('.project-gallery-slide:nth-child(2)')?.getAttribute('data-active') === 'true');
  await page.waitForFunction(() => {
    const image = document.querySelector('.project-gallery [data-active="true"] img');
    return image?.complete && image.naturalWidth > 0;
  });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Gallery overflows mobile document');
  await page.screenshot({ path: `.artifacts/gallery-mobile-${base === '/' ? 'root' : 'github'}.png`, fullPage: true });
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  console.log(JSON.stringify({ base, rows: expectedProjectCount, categories: 5, screenshots, galleryNavigation: 'passed', covers: 'passed', stableDownloads: 'passed', featuredLinks: 'passed', mobileOverflow: false, lazyWorkMedia: 'passed', detailRefresh: 'passed', errors: errors.length }));
} finally {
  await browser.close();
}
