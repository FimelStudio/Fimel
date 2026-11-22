import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { makeWork } from '../shared/model';

let runtime: Miniflare;
let orphan:string,protectedKey:string;
const origin='http://127.0.0.1:5174';
const dir='.artifacts/storage-cleanup-20261120';
test.beforeAll(async()=>{
  const bundled=await build({stdin:{contents:`import local from './admin/worker/local';const now=Date.now;Date.now=()=>now()+366*86400000;export default {fetch(request,env,ctx){return local.fetch(request,{...env,ASSETS:{fetch:async()=>Response.json({schemaVersion:1,works:[]})}},ctx);}};`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
  runtime=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-10-12',r2Buckets:['PRIVATE','PUBLIC'],bindings:{ADMIN_ORIGIN:origin,ACCESS_AUD:'local-test',ACCESS_ISSUER:'https://local.invalid',ADMIN_EMAILS:'local-admin@example.invalid'}}));await runtime.ready;await mkdir(dir,{recursive:true});
});
test.afterAll(async()=>{await runtime?.dispose();});
test.beforeEach(async({page})=>{
  const priv=await runtime.getR2Bucket('PRIVATE'),pub=await runtime.getR2Bucket('PUBLIC');for(const store of [priv,pub]){const page=await store.list();if(page.objects.length)await store.delete(page.objects.map(value=>value.key));}
  const w=makeWork();w.project.slug='storage-test';w.project.title='存储测试';const assetId=crypto.randomUUID();protectedKey=`uploads/verified/${assetId}/cover.png`;w.gallery=[{id:assetId,name:'cover.png',size:4,mime:'image/png',sha256:'a'.repeat(64),privateKey:protectedKey}];
  orphan=`uploads/temporary/${crypto.randomUUID()}/unused.zip`;await priv.put('state/library.json',JSON.stringify({schemaVersion:1,works:[w]}));await pub.put('data/works.json',JSON.stringify({schemaVersion:2,publicationId:'test',projects:[],releases:{}}));await priv.put(orphan,'orphan');await priv.put(protectedKey,'image');
  await page.route('**/assets/{brand,fonts}/**',async route=>{const file=path.resolve('public','.'+new URL(route.request().url()).pathname);if(!file.startsWith(path.resolve('public')+path.sep))return route.abort();try{await route.fulfill({body:await readFile(file),contentType:file.endsWith('.svg')?'image/svg+xml':'font/woff'});}catch{await route.fulfill({status:404,body:''});}});
  await page.route('**/api/**',async route=>{const req=route.request(),url=new URL(req.url());const response=await runtime.dispatchFetch('http://127.0.0.1'+url.pathname+url.search,{method:req.method(),headers:{...req.headers(),origin,connection:'close'},...(req.postDataBuffer()?{body:req.postDataBuffer()!}:{})});await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});});
  await page.goto('/');await expect(page.getByRole('heading',{name:'作品库',exact:true})).toBeVisible();await page.getByRole('button',{name:'存储与清理',exact:true}).click();await expect(page.getByRole('heading',{name:'R2 存储管理'})).toBeVisible();
});
test('扫描显示候选与保护原因，确认框可取消并限制确认文字，删除只影响选中文件',async({page})=>{
  await page.evaluate(()=>document.documentElement.classList.add('dark'));
  const button=page.getByRole('button',{name:'开始扫描',exact:true});await expect(button).toBeEnabled();await expect(page.getByLabel('启用服务器自动清理（默认关闭）')).not.toBeChecked();await button.click();await expect(page.getByRole('status')).toContainText('扫描完成');
  await expect(page.locator('.storage-table')).toContainText(orphan);await expect(page.locator('.storage-table')).not.toContainText(protectedKey);
  await page.getByLabel('存储状态筛选').selectOption('kept');await expect(page.locator('.storage-table')).toContainText(protectedKey);await expect(page.getByLabel('选择 '+protectedKey,{exact:true})).toBeDisabled();await page.getByLabel('存储状态筛选').selectOption('candidate');
  await page.getByLabel('选择 '+orphan,{exact:true}).check();await page.getByRole('button',{name:'清理选中（1）'}).click();let dialog=page.getByRole('dialog',{name:'确认永久清理'});await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:'确认永久删除',exact:true})).toBeDisabled();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);expect(await (await runtime.getR2Bucket('PRIVATE')).head(orphan)).not.toBeNull();
  await page.getByRole('button',{name:'清理选中（1）'}).click();dialog=page.getByRole('dialog',{name:'确认永久清理'});await dialog.getByLabel('清理确认文字').fill('永久删除');await page.screenshot({path:dir+'/delete-confirmation.png',fullPage:false});await dialog.getByRole('button',{name:'确认永久删除',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.getByRole('status')).toContainText('已确认删除 1 个对象');expect(await (await runtime.getR2Bucket('PRIVATE')).head(orphan)).toBeNull();expect(await (await runtime.getR2Bucket('PRIVATE')).head(protectedKey)).not.toBeNull();
});
test('自动清理需显式确认且保留期下限固定，设置后要求重新扫描',async({page})=>{
  await expect(page.getByRole('button',{name:'保存清理策略',exact:true})).toBeDisabled();await page.getByLabel('启用服务器自动清理（默认关闭）').check();page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'保存清理策略',exact:true}).click();expect(await (await runtime.getR2Bucket('PRIVATE')).head('maintenance/policy.json')).toBeNull();
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'保存清理策略',exact:true}).click();await expect(page.getByRole('status')).toContainText('清理策略已保存');const stored=await (await (await runtime.getR2Bucket('PRIVATE')).get('maintenance/policy.json'))!.json() as {enabled:boolean;assets:boolean;publicAssets:boolean};expect(stored).toMatchObject({enabled:true,assets:false,publicAssets:false});
  await page.screenshot({path:dir+'/storage-desktop.png',fullPage:true});
});
test('窄屏与浅色主题布局无全页横向溢出，扫描报告可导出',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'开始扫描',exact:true}).click();await expect(page.getByRole('status')).toContainText('扫描完成');
  await page.evaluate(()=>{document.documentElement.classList.remove('dark');});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出扫描报告',exact:true}).click();expect((await download).suggestedFilename()).toMatch(/^fimel-storage-/);await page.screenshot({path:dir+'/storage-mobile-light.png',fullPage:true});
});

test('扫描步骤已提交但响应丢失，自动恢复进度并读完报告',async({page})=>{
  let lost=false;
  await page.route('**/api/storage/scan/*',async route=>{
    if(lost)return route.fallback();lost=true;
    const request=route.request(),url=new URL(request.url());
    const response=await runtime.dispatchFetch('http://127.0.0.1'+url.pathname,{method:'POST',headers:{...request.headers(),origin,connection:'close'},body:request.postDataBuffer()!});
    expect(response.status).toBe(200);await response.arrayBuffer();
    await route.fulfill({status:503,contentType:'text/html',body:'temporarily unavailable'});
  });
  await page.getByRole('button',{name:'开始扫描',exact:true}).click();
  await expect(page.locator('.storage-manager .success')).toContainText('扫描完成');
  expect(lost).toBe(true);await expect(page.locator('.storage-manager .error')).toHaveCount(0);
  await expect(page.locator('.storage-table')).toContainText(orphan);
});

test('不存在的规则链接显示警告，仍能完成引用校验',async({page})=>{
  const w=makeWork();w.project.slug='warning-source';w.project.title='链接测试作品';w.project.content.description='https://download.studiofimel.com/content/readme.md';
  const pub=await runtime.getR2Bucket('PUBLIC');await pub.put('data/works.json',JSON.stringify({schemaVersion:2,publicationId:'test',projects:[w.project],releases:{}}));await pub.put('content/readme.md','[规则](rules/README.md)');
  await page.getByRole('button',{name:'开始扫描',exact:true}).click();await expect(page.locator('.storage-manager .success')).toContainText('扫描完成');
  await expect(page.locator('summary').filter({hasText:'1 个失效正文链接'})).toBeVisible();
  await page.locator('summary').filter({hasText:'失效正文链接'}).click();await expect(page.locator('.storage-manager')).toContainText('content/rules/README.md');
});

test('报告某一分页暂时断网不会丢掉完整扫描结果',async({page})=>{
  let attempts=0;
  await page.route('**/api/storage/items/*/0',async route=>{if(++attempts===1)return route.abort('failed');return route.fallback();});
  await page.getByRole('button',{name:'开始扫描',exact:true}).click();await expect(page.locator('.storage-manager .success')).toContainText('扫描完成');
  expect(attempts).toBe(2);await expect(page.locator('.storage-table')).toContainText(orphan);await expect(page.getByRole('button',{name:'导出扫描报告',exact:true})).toBeEnabled();
});

test('暂停时响应中断，刷新后从服务端最新进度继续',async({page})=>{
  let release:()=>void=()=>{},committed:()=>void=()=>{};
  const held=new Promise<void>(resolve=>{release=resolve;}),saved=new Promise<void>(resolve=>{committed=resolve;});let first=true;
  await page.route('**/api/storage/scan/*',async route=>{
    if(!first)return route.fallback();first=false;const req=route.request(),url=new URL(req.url());
    const response=await runtime.dispatchFetch('http://127.0.0.1'+url.pathname,{method:'POST',headers:{...req.headers(),origin,connection:'close'},body:req.postDataBuffer()!});await response.arrayBuffer();committed();await held;await route.abort('failed');
  });
  await page.getByRole('button',{name:'开始扫描',exact:true}).click();await saved;await page.getByRole('button',{name:'暂停扫描',exact:true}).click();release();
  await expect(page.locator('.storage-manager .success')).toContainText('扫描已暂停');
  await page.reload();await page.getByRole('button',{name:'存储与清理',exact:true}).click();await page.getByRole('button',{name:'继续扫描',exact:true}).click();
  await expect(page.locator('.storage-manager .success')).toContainText('扫描完成');await expect(page.locator('.storage-table')).toContainText(orphan);
});
