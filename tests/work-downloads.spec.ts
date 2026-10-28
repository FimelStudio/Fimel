import {expect,test} from '@playwright/test';
import type {Page} from '@playwright/test';
import type {Project} from '../src/content/projects';
import {build} from 'esbuild';
import {encodeHistoryCursor} from '../src/lib/work-download-cursor';

const project=(slug:string,changes:Partial<Project>={}):Project=>({
  slug,type:'datapacks',title:{zh:slug,en:slug,ja:slug},summary:{zh:'测试作品说明',en:'A resource project',ja:'作品紹介'},
  image:'assets/brand/fimel-logo.svg',status:'released',platform:['Minecraft Java'],creators:[{name:'Fimel Studio'}],tags:[],
  updated:'2026-10-27',content:{description:'works/fimel-card/description.zh.md'},...changes,
});
const projects=[project('downloaded-work'),project('no-records',{downloads:39999}),project('zero-clicks',{status:'development'})];
const feed={generatedAt:'2026-10-28T12:00:00.000Z',scope:'all-time',revision:'public-revision-1',segment:{objects:4,records:4,complete:true},works:{'downloaded-work':{downloadClicks:1234},'no-records':{downloadClicks:null},'zero-clicks':{downloadClicks:0}}};

async function setup(page:Page,language='zh'){
  await page.addInitScript(lang=>{sessionStorage.setItem('fimel_intro_seen','1');localStorage.setItem('fimel_user_lang',lang);localStorage.setItem('fimel_theme','light');},language);
  const catalogue={schemaVersion:2,projects};
  await page.route('**/works/catalogue.json',route=>route.fulfill({json:catalogue}));
  await page.route('https://download.studiofimel.com/data/works.json',route=>route.fulfill({json:catalogue}));
}

test('每个作品显示累计总下载数，全部历史段完成才显示数字，列表和详情共享请求且历史商店数据另列',async({page})=>{
  await setup(page);let requests=0;
  let allowSecond:()=>void=()=>{};const continuation=new Promise<void>(resolve=>{allowSecond=resolve;});
  const cursor=await encodeHistoryCursor('second-history-page');
  await page.route('**/api/work-downloads*',async route=>{
    requests++;
    if(!new URL(route.request().url()).searchParams.has('cursor'))return route.fulfill({json:{...feed,segment:{objects:200,records:200,complete:false,nextCursor:cursor},works:{...feed.works,'downloaded-work':{downloadClicks:17}}}});
    await continuation;return route.fulfill({json:{...feed,works:{...feed.works,'downloaded-work':{downloadClicks:1217}}}});
  });
  await page.goto('/#/works');
  await expect(page.locator('.work-row .work-download-metric')).toHaveCount(3);
  await expect.poll(()=>requests).toBe(2);
  await expect(page.locator('.work-row .work-download-metric dd')).toHaveText(['加载中…','加载中…','加载中…']);
  allowSecond();
  await expect(page.locator('.work-row .work-download-metric dd')).toHaveText(['1,234','暂无记录','0']);
  await expect(page.locator('.work-row .work-download-metric dt')).toHaveText(['总下载数','总下载数','总下载数']);
  await expect(page.locator('.work-row').nth(1)).toContainText('39,999 商店下载量');
  await page.locator('.work-row').first().click();
  await expect(page.locator('aside .work-download-metric dd')).toHaveText('1,234');
  await expect(page.locator('aside .work-download-metric')).toContainText('不代表完整下载人数');
  expect(requests).toBe(2);
});

test('统计服务失败显示不可用，不将失败伪装成零下载',async({page})=>{
  await setup(page);await page.route('**/api/work-downloads',route=>route.fulfill({status:503,json:{error:'unavailable'}}));
  await page.goto('/#/works');
  await expect(page.locator('.work-download-metric dd')).toHaveText(['暂不可用','暂不可用','暂不可用']);
});

test('损坏或负数统计不能进入官网指标',async({page})=>{
  await setup(page);await page.route('**/api/work-downloads',route=>route.fulfill({json:{...feed,works:{'downloaded-work':{downloadClicks:-1}}}}));
  await page.goto('/#/works/downloaded-work');
  await expect(page.locator('aside .work-download-metric dd')).toHaveText('暂不可用');
});

for(const [language,label]of [['en','Total downloads'],['ja','総ダウンロード数']]as const){
  test(`${language} 下载指标本地化并保留数字格式`,async({page})=>{
    await setup(page,language);await page.route('**/api/work-downloads',route=>route.fulfill({json:feed}));
    await page.goto('/#/works/downloaded-work');
    await expect(page.locator('aside .work-download-metric dt')).toHaveText(label);
    await expect(page.locator('aside .work-download-metric dd')).toHaveText('1,234');
  });
}

test('移动端作品列表和详情指标完整可见，无横向溢出',async({page})=>{
  await page.setViewportSize({width:375,height:812});await setup(page);
  await page.route('**/api/work-downloads',route=>route.fulfill({json:feed}));
  await page.goto('/#/works');
  await expect(page.locator('.work-download-metric').first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await page.locator('.work-row').first().click();
  await expect(page.locator('aside .work-download-metric dd')).toHaveText('1,234');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});

test('后续历史段失败时不显示第一段的部分下载数',async({page})=>{
  await setup(page);const cursor=await encodeHistoryCursor('second-history-page');
  await page.route('**/api/work-downloads*',route=>new URL(route.request().url()).searchParams.has('cursor')?
    route.fulfill({status:503,json:{error:'unavailable'}}):route.fulfill({json:{...feed,segment:{objects:200,records:200,complete:false,nextCursor:cursor}}}));
  await page.goto('/#/works/downloaded-work');
  await expect(page.locator('aside .work-download-metric dd')).toHaveText('暂不可用');
  await expect(page.locator('aside .work-download-metric dd')).not.toHaveText('1,234');
});

test('GitHub查询失败后的备用发行入口只回调一次下载点击',async({page,context})=>{
  const bundled=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
    import {useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {createInstance} from 'i18next';
    import {I18nextProvider} from 'react-i18next';
    import {ProjectDownload} from './src/components/ProjectDownload';
    const i18n=createInstance();
    function Probe(){const [count,setCount]=useState(0);return <><ProjectDownload project={{slug:'download-probe',type:'mods',status:'released',latestReleaseRepo:'test-owner/resource',releasePage:'https://example.invalid/releases'}} onDownload={()=>setCount(value=>value+1)}/><output aria-label="点击次数">{count}</output></>;}
    i18n.init({lng:'zh',resources:{zh:{translation:{project:{download_latest:'下载最新版',downloading:'查询中',release_error:'暂不可用',releases:'查看发行'}}}}}).then(()=>createRoot(document.getElementById('probe')).render(<I18nextProvider i18n={i18n}><Probe/></I18nextProvider>));
  `},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','import.meta.env.BASE_URL':'"/"'}});
  await page.route('https://api.github.com/repos/test-owner/resource/releases/latest',route=>route.fulfill({status:503,json:{}}));
  await context.route('https://example.invalid/releases',route=>route.fulfill({body:'release page'}));
  await page.setContent('<main id="probe"></main>');
  await page.addScriptTag({content:bundled.outputFiles[0].text});
  await page.getByRole('button',{name:'下载最新版',exact:true}).click();
  const link=page.getByRole('link',{name:'查看发行',exact:true});await expect(link).toBeVisible();
  await expect(page.getByRole('status',{name:'点击次数'})).toHaveText('0');
  const opened=page.waitForEvent('popup');await link.click();const popup=await opened;
  await expect(page.getByRole('status',{name:'点击次数'})).toHaveText('1');await popup.close();
});
