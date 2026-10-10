import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

// Run against a production preview, including a GitHub Pages subdirectory build.
const expectedProjectCount = JSON.parse(readFileSync(new URL('../public/works/catalogue.json', import.meta.url), 'utf8')).projects.length;
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
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  console.log(JSON.stringify({ base, rows: expectedProjectCount, lazyWorkMedia: 'passed', detailRefresh: 'passed', errors: errors.length }));
} finally {
  await browser.close();
}
