import { test, expect, type CDPSession } from '@playwright/test';
import { readFileSync } from 'node:fs';

const projects = JSON.parse(readFileSync(new URL('../public/works/catalogue.json', import.meta.url), 'utf8')).projects;

async function compose(cdp: CDPSession, text: string) {
  await cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('fimel_intro_seen', '1');
    localStorage.setItem('fimel_user_lang', 'zh');
  });
});

test('native IME preedit fuzhu stays intact and searches only after committing 辅助', async ({ page }) => {
  await page.goto('/#/works');
  await expect(page.locator('.work-row')).toHaveCount(projects.length);
  const input = page.getByRole('searchbox', { name: '搜索作品' });
  await input.focus();
  const cdp = await page.context().newCDPSession(page);
  for (const text of ['f', 'fu', 'fuz', 'fuzh', 'fuzhu']) {
    await compose(cdp, text);
    await expect(input).toHaveValue(text);
  }
  expect(new URLSearchParams(page.url().split('?')[1]).get('q')).toBeNull();
  await expect(page.locator('.work-row')).toHaveCount(projects.length);
  await cdp.send('Input.insertText', { text: '辅助' });
  await expect(input).toHaveValue('辅助');
  await expect.poll(() => new URLSearchParams(page.url().split('?')[1]).get('q')).toBe('辅助');
  await expect(page.locator('.work-row[href="#/works/minecraft-obj-cubizer"]')).toBeVisible();
});

test('native IME backspace, cancellation and committed-text deletion do not duplicate text', async ({ page }) => {
  await page.goto('/#/works?type=tools&sort=name');
  const input = page.getByRole('searchbox', { name: '搜索作品' });
  await expect(page.locator('.work-row')).toHaveCount(projects.filter((entry: { type: string }) => entry.type === 'tools').length);
  await input.focus();
  const cdp = await page.context().newCDPSession(page);
  for (const text of ['f', 'fu', 'fuz', 'fuzh', 'fuzhu', 'fuzh', 'fuz', 'fu', 'f', '']) {
    await compose(cdp, text);
    await expect(input).toHaveValue(text);
  }
  await expect(page).toHaveURL(/#\/works\?type=tools&sort=name$/);
  await compose(cdp, 'fuzhu');
  await cdp.send('Input.insertText', { text: '辅助' });
  await expect(input).toHaveValue('辅助');
  await input.press('Backspace');
  await expect(input).toHaveValue('辅');
  await input.press('Backspace');
  await expect(input).toHaveValue('');
  await expect(page).toHaveURL(/#\/works\?type=tools&sort=name$/);
});

test('clearing an active native composition cannot restore its pending text through URL navigation', async ({ page }) => {
  await page.goto('/#/works?type=tools&sort=name');
  const input = page.getByRole('searchbox', { name: '搜索作品' });
  await input.focus();
  const cdp = await page.context().newCDPSession(page);
  await compose(cdp, 'fuzhu');
  await expect(input).toHaveValue('fuzhu');
  await page.getByRole('button', { name: '清空搜索', exact: true }).click();
  await expect(input).toHaveValue('');
  await expect(page).toHaveURL(/#\/works\?type=tools&sort=name$/);
  await expect(page.locator('.work-row')).toHaveCount(projects.filter((entry: { type: string }) => entry.type === 'tools').length);
});

test('search draft follows clear, category changes, details return and browser history', async ({ page }) => {
  await page.goto('/#/works?q=Bingo');
  const input = page.getByRole('searchbox', { name: '搜索作品' });
  await expect(input).toHaveValue('Bingo');
  await page.getByRole('navigation', { name: '作品', exact: true }).getByRole('link', { name: /^模组/ }).click();
  await expect(input).toHaveValue('Bingo');
  await page.locator('.work-row').click();
  await page.getByRole('link', { name: '返回作品', exact: true }).click();
  await expect(input).toHaveValue('Bingo');
  await page.getByRole('button', { name: '清空搜索', exact: true }).click();
  await expect(input).toHaveValue('');
  await input.pressSequentially('Bingo', { delay: 15 });
  await expect(input).toHaveValue('Bingo');
  await input.press('Backspace');
  await expect(input).toHaveValue('Bing');
  await page.reload();
  await expect(input).toHaveValue('Bing');
  await page.evaluate(() => { location.hash = '/works?q=辅助'; });
  await expect(input).toHaveValue('辅助');
  await page.goBack();
  await expect(input).toHaveValue('Bing');
  await page.goForward();
  await expect(input).toHaveValue('辅助');
});
