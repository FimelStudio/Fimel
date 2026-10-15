import {expect,test} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {DEFAULT_SITE_CONTENT} from '../src/content/site-content';
test('公开的网站文案、精选顺序和近期更新通过同一目录生效，旧布局与三语保留',async({page})=>{
  const catalogue=JSON.parse(await readFile('public/works/catalogue.json','utf8'));const site=structuredClone(DEFAULT_SITE_CONTENT);
  site.featured.maps=[...site.featured.maps].reverse();site.studio.title={zh:'本地工作室标题',en:'Local studio headline'};site.studio.description={zh:'本地维护的介绍'};site.contact.email='public-contact@example.invalid';site.contact.qqGroup='123456789';site.updates=[{id:'real-update',title:{zh:'工具更新记录',en:'Tool update'},summary:{zh:'仅本地浏览器验收'},date:'2026-10-16',workSlug:'minecraft-explorer'}];
  catalogue.site=site;catalogue.schemaVersion=2;catalogue.releases={};
  await page.addInitScript(()=>{sessionStorage.setItem('fimel_intro_seen','1');localStorage.setItem('fimel_user_lang','zh');});
  await page.route('**/works/catalogue.json',route=>route.fulfill({json:catalogue}));
  await page.goto('/');await expect(page.locator('#recent-updates')).toContainText('工具更新记录');await expect(page.locator('#works a[href="#/works/es-atrium-showdown"]').first()).toBeVisible();
  await page.locator('#recent-updates').getByRole('link',{name:'工具更新记录'}).click();await expect(page.getByRole('heading',{name:'Minecraft Explorer',exact:true}).first()).toBeVisible();
  await page.goto('/#/studio');await expect(page.getByRole('heading',{name:'本地工作室标题',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'public-contact@example.invalid',exact:true})).toHaveAttribute('href','mailto:public-contact@example.invalid');await expect(page.getByText('123456789',{exact:true})).toBeVisible();
  await page.setViewportSize({width:320,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
