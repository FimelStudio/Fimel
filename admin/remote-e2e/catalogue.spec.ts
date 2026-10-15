import {expect,test} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const catalogue=JSON.parse(await readFile('public/works/catalogue.json','utf8'));
const endpoint='https://download.studiofimel.com/data/works.json';
const cors={'Access-Control-Allow-Origin':'http://127.0.0.1:5175','Access-Control-Allow-Headers':'If-None-Match','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Expose-Headers':'ETag'};
test('published JSON replaces local snapshot; unpublish/empty is authoritative without resurrecting old data',async({page})=>{
  let projects=catalogue.projects.slice(0,2);let offline=false;let revision=1;
  await page.route(endpoint,async route=>{if(offline){await route.abort();return;}if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:cors});return;}await route.fulfill({json:{schemaVersion:2,publicationId:String(revision),projects,releases:{}},headers:{...cors,ETag:`"r${revision}"`}});});
  await page.clock.install();await page.goto('/#/works');await expect(page.locator('.work-row')).toHaveCount(2);
  projects=[];revision++;await page.clock.fastForward(61000);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('.work-row')).toHaveCount(0);
  offline=true;await page.clock.fastForward(61000);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('.work-row')).toHaveCount(0);await expect(page.getByText('在线作品库暂不可用，当前显示随网站发布的只读快照。')).toHaveCount(0);
});
test('invalid remote JSON shows explicit fallback, then accepts new public data',async({page})=>{
  let invalid=true;
  await page.route(endpoint,async route=>{if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:cors});return;}await route.fulfill({json:invalid?{schemaVersion:99,projects:[]}:{schemaVersion:2,publicationId:'new',projects:[],releases:{}},headers:cors});});
  await page.clock.install();await page.goto('/#/works');await expect(page.locator('.work-row')).toHaveCount(28);await expect(page.getByText('在线作品库暂不可用，当前显示随网站发布的只读快照。')).toBeVisible();
  invalid=false;await page.clock.fastForward(61000);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('.work-row')).toHaveCount(0);await expect(page.getByText('在线作品库暂不可用，当前显示随网站发布的只读快照。')).toHaveCount(0);
});

test('the first minute tick revalidates without a focus event after a delayed initial read',async({page})=>{
  let projects=catalogue.projects.slice(0,2);let initial=true;
  await page.route(endpoint,async route=>{
    if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:cors});return;}
    if(initial){initial=false;await page.clock.runFor(3000);}
    await route.fulfill({json:{schemaVersion:2,projects,releases:{}},headers:cors});
  });
  await page.clock.install();await page.goto('/#/works');await expect(page.locator('.work-row')).toHaveCount(2);
  projects=[];await page.clock.runFor(60000);await expect(page.locator('.work-row')).toHaveCount(0);
});

test('malformed localized fields and content paths fall back instead of crashing the public site',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const variants=[{title:{zh:42}},{content:{description:{zh:42}}},{content:{description:'https://[broken'}},{creators:[null]}];
  let index=0;
  await page.route(endpoint,async route=>{if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers:cors});return;}await route.fulfill({json:{schemaVersion:2,projects:[{...catalogue.projects[0],...variants[index]}]},headers:cors});});
  for(index=0;index<variants.length;index++){
    await page.goto(`/?invalid=${index}#/works`);await expect(page.locator('.work-row')).toHaveCount(28);await expect(page.getByText('在线作品库暂不可用，当前显示随网站发布的只读快照。')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
