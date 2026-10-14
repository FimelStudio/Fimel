import { expect, test } from '@playwright/test';
import {makeWork} from '../shared/model';
test('production CSP permits startup and editing; weakened CDN ETag does not cause false conflicts',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const response=await page.goto('/');expect(response?.headers()['content-security-policy']).not.toContain('unsafe-eval');
  await expect(page.getByRole('heading',{name:'作品库',exact:true})).toBeVisible();
  await expect(page.getByLabel('当前登录用户')).toHaveText('预览账号');
  for (const width of [2560,1920,1440,768,390,320]) {
    await page.setViewportSize({width,height:1080});
    expect(await page.locator('.admin-header').evaluate(element=>Math.round(element.getBoundingClientRect().width))).toBe(width);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.getByLabel('当前登录用户')).toBeVisible();
    const main=await page.locator('.admin-main').boundingBox();expect(Math.round(main!.x+main!.width)).toBe(width);
  }
  await page.setViewportSize({width:1920,height:1080});
  await page.getByRole('button',{name:'新建作品',exact:true}).click();
  await page.getByLabel('作品名称',{exact:true}).fill('生产策略下的草稿');await page.getByLabel('稳定 slug').fill('csp-draft');
  await page.getByRole('button',{name:'保存草稿',exact:true}).first().click();
  await expect(page.getByText('草稿已保存到私有存储。')).toBeVisible();
  expect(errors).toEqual([]);
});

test('identity loading failure is visible and never pretends to be another administrator',async({page})=>{
  await page.route('**/api/session',route=>route.fulfill({status:503,json:{error:'身份不可用'}}));
  await page.goto('/');await expect(page.getByLabel('当前登录用户')).toHaveText('身份读取失败');
});

test('administrator log shows identity, work and before/after fields with honest results',async({page})=>{
  await page.route('**/api/audit?days=7',route=>route.fulfill({json:{currentActorId:'test-admin',actors:{'test-admin':'测试管理员'},truncated:false,events:[{schemaVersion:2,id:'event1',actorId:'test-admin',operation:'save-library',time:'2026-10-14T10:00:00Z',status:'success',changes:[{workId:'work1',slug:'test-work',title:'测试作品',action:'updated',fields:[{name:'作品名称',before:'旧名称',after:'新名称'}]}]}]}}));
  await page.goto('/');await page.getByRole('button',{name:'管理员日志',exact:true}).click();
  await expect(page.getByRole('heading',{name:'管理员日志',exact:true})).toBeVisible();
  await expect(page.locator('.audit-heading p')).toContainText('测试管理员（你）');await page.locator('summary').click();
  await expect(page.getByRole('cell',{name:'旧名称',exact:true})).toBeVisible();await expect(page.getByRole('cell',{name:'新名称',exact:true})).toBeVisible();await expect(page.locator('.audit-heading .badge')).toHaveText('已完成');
  await page.getByLabel('搜索日志中的作品或字段').fill('不匹配');await expect(page.getByText('暂无匹配的操作记录')).toBeVisible();
});

test('domain statistics distinguish visits, whole-zone IPs and file requests; no overflow on mobile',async({page})=>{
  await page.route('**/api/analytics?days=7',route=>route.fulfill({json:{generatedAt:'2026-10-14T10:00:00Z',from:'2026-10-14T00:00:00Z',to:'2026-10-15T00:00:00Z',timeZone:'UTC',domains:[{date:'2026-10-14',host:'studiofimel.com',requests:12,visits:4,bytes:1024}],zoneVisitors:[{date:'2026-10-14',requests:20,uniqueIPs:8}],downloadDays:[{date:'2026-10-14',requests:3,bytes:10000}],files:[{date:'2026-10-14',path:'/works/tools/example/1.0/tool.zip',slug:'example',requests:3,bytes:10000}],filesTruncated:false}}));
  await page.goto('/');await page.getByRole('button',{name:'访问与下载统计',exact:true}).click();
  await expect(page.getByRole('heading',{name:'访问与下载统计',exact:true})).toBeVisible();await expect(page.getByRole('columnheader',{name:'全站独立 IP',exact:true})).toBeVisible();await expect(page.getByRole('cell',{name:'/works/tools/example/1.0/tool.zip',exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('unconnected analytics shows an explicit error instead of invented traffic',async({page})=>{
  await page.route('**/api/analytics?days=7',route=>route.fulfill({status:503,json:{error:'域名统计尚未连接'}}));
  await page.goto('/');await page.getByRole('button',{name:'访问与下载统计',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('域名统计尚未连接');await expect(page.locator('.metrics-grid')).toHaveCount(0);
});

test('official import previews all 28 works, keeps existing edits and saves only after explicit review',async({page})=>{
  const saved=makeWork();saved.project.slug='existing-private';saved.project.title='保留的私有草稿';let writes=0;
  await page.route('**/api/library',async route=>{
    if(route.request().method()==='PUT'){writes++;const input=route.request().postDataJSON();expect(input.works).toHaveLength(29);expect(input.works[0]).toEqual(saved);await route.fulfill({json:{saved:true,etag:'"after-import"'}});return;}
    await route.fulfill({json:{library:{schemaVersion:1,works:[saved]},public:{schemaVersion:2,publicationId:'empty',projects:[],releases:{}},publicEtag:'"empty"',etag:'"before-import"'}});
  });
  await page.goto('/');await page.getByRole('button',{name:'导入现有作品',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'导入作品预览'});await expect(dialog).toContainText('新增 28 个作品');await expect(dialog.getByRole('row')).toHaveCount(29);expect(writes).toBe(0);
  await dialog.getByRole('button',{name:'合并到编辑区'}).click();await expect(page.getByText('29 个在用作品 · 0 个后台已发布',{exact:true})).toBeVisible();expect(writes).toBe(0);
  await page.getByRole('button',{name:'保存草稿',exact:true}).click();await expect(page.getByText('草稿已保存到私有存储。')).toBeVisible();expect(writes).toBe(1);
});
