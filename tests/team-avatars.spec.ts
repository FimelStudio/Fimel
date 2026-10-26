import { test, expect } from '@playwright/test';

const members = [
  { name: 'Ylong', filename: 'YYYlong.png', profileUrl: 'https://space.bilibili.com/313686648' },
  { name: 'TreeHey', filename: 'TreeHey.png', profileUrl: 'https://space.bilibili.com/106320936' },
  { name: 'crystal215', filename: 'crystal215.png', profileUrl: 'https://space.bilibili.com/437420546' },
  { name: 'chengzi', filename: 'chengzi_bucheng.png', profileUrl: 'https://space.bilibili.com/516536087' },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('fimel_intro_seen', '1');
    localStorage.setItem('fimel_user_lang', 'zh');
    localStorage.setItem('fimel_theme', 'dark');
  });
});

test('member names link to their Bilibili profiles in roster order', async ({ page }) => {
  await page.goto('/#/studio');

  const rows = page.locator('[data-team-member]');
  await expect(rows).toHaveCount(members.length);

  for (const [index, member] of members.entries()) {
    const row = rows.nth(index);
    await expect(row).toHaveAttribute('data-team-member', member.name);
    const link = row.getByRole('link', { name: member.name, exact: true });
    await expect(link).toHaveAttribute('href', member.profileUrl);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
});

test('all four member portraits use their own pixel PNGs in both desktop themes', async ({ page, request }) => {
  await page.goto('/#/studio');
  await expect(page.locator('[data-team-member]')).toHaveCount(4);
  for (const member of members) {
    const response = await request.get(`/assets/images/team/${member.filename}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
    const bytes = await response.body();
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(bytes.readUInt32BE(16)).toBe(64);
    expect(bytes.readUInt32BE(20)).toBe(64);
  }
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') await page.getByRole('button', { name: '切换至亮色' }).click();
    for (const member of members) {
      const row = page.locator(`[data-team-member="${member.name}"]`);
      await row.scrollIntoViewIfNeeded();
      const image = row.getByRole('img', { name: member.name, exact: true });
      await expect(image).toHaveAttribute('src', `/assets/images/team/${member.filename}`);
      await expect(image).toHaveAttribute('loading', 'lazy');
      await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBe(64);
      const dimensions = await image.evaluate(element => {
        const image = element as HTMLImageElement;
        const rect = image.getBoundingClientRect();
        return { naturalHeight: image.naturalHeight, width: rect.width, height: rect.height, rendering: getComputedStyle(image).imageRendering };
      });
      expect(dimensions.naturalHeight).toBe(64);
      expect(dimensions.width).toBe(dimensions.height);
      expect(dimensions.width).toBeGreaterThanOrEqual(48);
      expect(dimensions.rendering).toBe('pixelated');
      await expect(row.getByRole('heading', { name: member.name, exact: true })).toBeVisible();
      await expect(row.locator('p')).not.toBeEmpty();
    }
  }
});

test('320px team rows keep names, translated roles and avatars within the row in both themes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/#/studio');
  for (const language of ['zh', 'en', 'ja']) {
    if (language !== 'zh') {
      await page.reload();
      await page.getByRole('button', { name: '切换语言' }).click();
      await page.getByRole('button', { name: language === 'en' ? 'English' : '日本語', exact: true }).click();
    }
    for (const theme of ['dark', 'light']) {
      // Change the rendered theme through its normal accessible control.
      const desiredDark = theme === 'dark';
      const currentlyDark = await page.locator('html').evaluate(element => element.classList.contains('dark'));
      if (currentlyDark !== desiredDark) {
        const labels = language === 'zh' ? ['切换至暗色', '切换至亮色'] : language === 'en' ? ['Use dark theme', 'Use light theme'] : ['ダークテーマに変更', 'ライトテーマに変更'];
        await page.getByRole('button', { name: labels[desiredDark ? 0 : 1], exact: true }).click();
      }
      for (const member of members) {
        const row = page.locator(`[data-team-member="${member.name}"]`);
        await row.scrollIntoViewIfNeeded();
        await expect(row.getByRole('img', { name: member.name, exact: true })).toBeVisible();
        const layout = await row.evaluate(element => {
          const rowRect = element.getBoundingClientRect();
          const image = element.querySelector('img') as HTMLImageElement;
          const imageRect = image.getBoundingClientRect();
          const textRects = Array.from(element.querySelectorAll('h3, p')).flatMap(text => {
            const range = document.createRange();
            range.selectNodeContents(text);
            return Array.from(range.getClientRects()).map(rect => ({ left: rect.left, right: rect.right }));
          });
          return {
            rowLeft: rowRect.left, rowRight: rowRect.right, imageLeft: imageRect.left, imageRight: imageRect.right,
            imageWidth: imageRect.width, imageHeight: imageRect.height, imageLoaded: image.naturalWidth === 64,
            textRects, viewport: window.innerWidth, pageWidth: document.documentElement.scrollWidth,
          };
        });
        expect(layout.rowLeft).toBeGreaterThanOrEqual(0);
        expect(layout.rowRight).toBeLessThanOrEqual(layout.viewport);
        expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewport);
        expect(layout.imageLoaded).toBe(true);
        expect(layout.imageLeft).toBeGreaterThanOrEqual(layout.rowLeft);
        expect(layout.imageRight).toBeLessThanOrEqual(layout.rowRight);
        expect(layout.imageWidth).toBe(layout.imageHeight);
        expect(layout.imageWidth).toBeGreaterThanOrEqual(32);
        for (const rect of layout.textRects) {
          expect(rect.left).toBeGreaterThanOrEqual(layout.rowLeft);
          expect(rect.right).toBeLessThanOrEqual(layout.rowRight + 1);
        }
      }
    }
  }
});

test('one unavailable portrait falls back to its letter without hiding the team', async ({ page }) => {
  await page.route('**/assets/images/team/TreeHey.png', route => route.fulfill({ status: 404, body: 'Not found' }));
  await page.goto('/#/studio');
  const failedRow = page.locator('[data-team-member="TreeHey"]');
  await failedRow.scrollIntoViewIfNeeded();
  await expect(failedRow.getByRole('img', { name: 'TreeHey', exact: true })).toHaveCount(0);
  await expect(failedRow.locator('span[aria-hidden="true"]')).toHaveText('T');
  await expect(failedRow.getByRole('heading', { name: 'TreeHey', exact: true })).toBeVisible();
  await expect(failedRow.locator('p')).not.toBeEmpty();
  for (const member of members.filter(member => member.name !== 'TreeHey')) {
    const row = page.locator(`[data-team-member="${member.name}"]`);
    await row.scrollIntoViewIfNeeded();
    await expect.poll(() => row.getByRole('img', { name: member.name, exact: true }).evaluate(element => (element as HTMLImageElement).naturalWidth)).toBe(64);
  }
});
