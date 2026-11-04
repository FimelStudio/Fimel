import {expect,test} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import type {Page} from '@playwright/test';
import type {Project} from '../src/content/projects';
import type {DownloadRelease} from '../src/content/releases';
test.beforeEach(async({page})=>{await page.addInitScript(()=>{sessionStorage.setItem('fimel_intro_seen','1');localStorage.setItem('fimel_user_lang','zh');});});

function release(files=1):DownloadRelease {
  return {id:'current',label:'v1.0',date:'2026-11-05',status:'released',gameVersions:['1.21.11'],platforms:['Minecraft Java'],files:Array.from({length:files},(_,index)=>({
    id:`file-${index}`,name:`package-${index}.zip`,size:1024,mime:'application/zip',sha256:'a'.repeat(64),primary:index===0,
    publicUrl:`https://download.studiofimel.com/works/datapacks/fimel-card/v1.0/package-${index}.zip`,
  }))};
}

async function fixture(page:Page,releases:DownloadRelease[],language='zh') {
  const catalogue=JSON.parse(await readFile('public/works/catalogue.json','utf8'));
  const source=catalogue.projects.find((project:Project)=>project.slug==='fimel-card');
  const data={schemaVersion:2,projects:[{...source,status:'released'}],releases:{'fimel-card':releases}};
  await page.addInitScript(locale=>{localStorage.setItem('fimel_user_lang',locale);localStorage.setItem('fimel_theme','light');},language);
  await page.route('**/works/catalogue.json',route=>route.fulfill({json:data}));
  await page.route('https://download.studiofimel.com/data/works.json',route=>route.fulfill({json:data}));
  await page.goto('/#/works/fimel-card');
  return page.locator('header').filter({has:page.getByRole('heading',{level:1})});
}

test('单个有文件的发布直接下载并注明适用环境，空发布不产生多版本入口',async({page})=>{
  const current=release();const header=await fixture(page,[{...current,id:'empty',files:[]},current]);
  await expect(header.getByRole('link',{name:'下载',exact:true})).toHaveAttribute('href',current.files[0].publicUrl);
  await expect(header).toContainText('适用：Minecraft Java · 1.21.11');
  await expect(header.getByRole('button',{name:'选择版本下载',exact:true})).toHaveCount(0);
});

test('标准动效下选择版本也能正确定位，不被平滑滚动覆盖',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:390,height:844});
  const header=await fixture(page,[release(2)]);
  await header.getByRole('button',{name:'选择版本下载',exact:true}).click();
  const tab=page.getByRole('tab',{name:'版本与下载',exact:true});await expect(tab).toBeFocused();
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(0);
  await expect.poll(()=>tab.evaluate(element=>{const bounds=element.getBoundingClientRect();return bounds.top>=100&&bounds.bottom<innerHeight;})).toBe(true);
  await page.screenshot({path:'.artifacts/download-selection-normal-motion.png',animations:'disabled'});
});

for(const [language,button,tab]of [
  ['zh','选择版本下载','版本与下载'],['en','Choose a version','Versions & downloads'],['ja','バージョンを選んでダウンロード','バージョンとダウンロード'],
]as const)test(`${language} 单版本多文件进入文件列表，手机与桌面布局及键盘焦点正常`,async({page})=>{
  await page.setViewportSize({width:320,height:844});
  const header=await fixture(page,[release(2)],language);
  const choose=header.getByRole('button',{name:button,exact:true});await expect(choose).toBeVisible();await expect(header.getByRole('link',{name:/下载|Download|ダウンロード/})).toHaveCount(0);
  await page.screenshot({path:`.artifacts/download-selection-${language}-mobile-header.png`,fullPage:true});
  await choose.click();const versionsTab=page.getByRole('tab',{name:tab,exact:true});await expect(versionsTab).toBeFocused();await expect(versionsTab).toHaveAttribute('aria-selected','true');
  await expect(page.locator('.project-versions .version-row')).toHaveCount(1);
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.screenshot({path:`.artifacts/download-selection-${language}-desktop.png`,fullPage:true});
});

test('选择版本和筛选不回调下载计数，具体文件下载仅回调一次，预览入口禁用',async({page})=>{
  const current=release(),previous={...release(),id:'previous',label:'v0.9',gameVersions:['1.20.1']};
  const bundled=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
    import {useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {createInstance} from 'i18next';
    import {I18nextProvider} from 'react-i18next';
    import {ProjectDownloads} from './src/components/ProjectDownloads';
    import {ProjectVersions} from './src/components/ProjectVersions';
    import {contentMessages} from './src/content/messages';
    const releases=${JSON.stringify([current,previous])};
    const project={slug:'fimel-card',type:'datapacks',status:'released',platform:['Minecraft Java']};
    const i18n=createInstance();
    function Probe(){const [downloads,setDownloads]=useState(0),[selected,setSelected]=useState(0);const record=()=>setDownloads(value=>value+1);return <>
      <ProjectDownloads project={project} releases={releases} onSelectVersion={()=>setSelected(value=>value+1)} onDownload={record}/>
      <ProjectVersions project={project} releases={releases} onDownload={record}/>
      <section aria-label="预览"><ProjectDownloads project={project} releases={releases} preview/></section>
      <output aria-label="下载计数">{downloads}</output><output aria-label="版本选择次数">{selected}</output>
    </>;}
    i18n.init({lng:'zh',resources:{zh:{translation:contentMessages.zh}}}).then(()=>createRoot(document.getElementById('probe')).render(<I18nextProvider i18n={i18n}><Probe/></I18nextProvider>));
  `},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','import.meta.env.BASE_URL':'"/"'}});
  await page.route(current.files[0].publicUrl,route=>route.fulfill({contentType:'application/zip',headers:{'Content-Disposition':'attachment; filename="package.zip"'},body:'test package'}));
  await page.setContent('<main id="probe"></main>');await page.addScriptTag({content:bundled.outputFiles[0].text});
  await expect(page.getByRole('region',{name:'预览',exact:true}).getByRole('button',{name:'选择版本下载',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'选择版本下载',exact:true}).filter({visible:true}).first().click();
  await page.getByRole('combobox',{name:'游戏版本',exact:true}).selectOption('1.20.1');
  await expect(page.getByRole('status',{name:'版本选择次数',exact:true})).toHaveText('1');await expect(page.getByRole('status',{name:'下载计数',exact:true})).toHaveText('0');
  const pending=page.waitForEvent('download');await page.getByRole('link',{name:'下载',exact:true}).click();await pending;
  await expect(page.getByRole('status',{name:'下载计数',exact:true})).toHaveText('1');
});
test('多版本入口先进入版本页并定位焦点，筛选后下载对应文件',async({page})=>{
  const catalogue=JSON.parse(await readFile('public/works/catalogue.json','utf8'));const project=catalogue.projects.find((p:{slug:string})=>p.slug==='bingo-but-dont-do-it');
  const file=(id:string,name:string,primary=false)=>({id,name,size:2*1024**2,mime:'application/java-archive',sha256:'a'.repeat(64),primary,publicUrl:`https://download.studiofimel.com/works/mods/${project.slug}/test/${name}`});
  catalogue.schemaVersion=2;catalogue.releases={[project.slug]:[{id:'latest',label:'2.0',date:'2026-10-16',status:'released',gameVersions:['1.21.1'],loaders:['Fabric'],platforms:['Minecraft Java'],files:[file('new','latest.jar',true),file('extra','resources.zip')]},{id:'previous',label:'1.0',date:'2026-10-15',status:'released',gameVersions:['1.20.1'],loaders:['Forge'],files:[file('old','previous.jar',true)]}]};
  await page.route('**/works/catalogue.json',route=>route.fulfill({json:catalogue}));
  await page.route('https://download.studiofimel.com/works/mods/**',route=>route.fulfill({status:200,contentType:'application/java-archive',headers:{'Content-Disposition':'attachment; filename="previous.jar"'},body:Buffer.from('PK-test')}));
  await page.goto(`/#/works/${project.slug}`);const header=page.locator('header').filter({has:page.getByRole('heading',{level:1})});
  const started:string[]=[];page.on('download',download=>started.push(download.suggestedFilename()));
  const choose=header.getByRole('button',{name:'选择版本下载',exact:true});
  await expect(choose).toBeVisible();await expect(header.getByRole('link',{name:'下载',exact:true})).toHaveCount(0);await expect(header.getByRole('combobox')).toHaveCount(0);await expect(page.locator('.project-versions')).toHaveCount(0);
  const metadata=page.locator('aside dl').filter({hasText:'上次更新'});
  await expect(metadata).toContainText('2026年10月16日');await expect(metadata).toContainText('2.0 MiB');
  await choose.focus();await choose.press('Enter');
  const tab=page.getByRole('tab',{name:'版本与下载',exact:true});await expect(tab).toBeFocused();await expect(tab).toHaveAttribute('aria-selected','true');await expect(page).toHaveURL(/\?tab=versions$/);
  await expect.poll(()=>tab.evaluate(element=>element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(100);
  // Short pages may reach the document's scroll limit before the 112px margin.
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(0);
  await expect.poll(()=>tab.evaluate(element=>element.getBoundingClientRect().bottom<innerHeight)).toBe(true);
  const downloads=page.getByRole('region',{name:'版本与下载',exact:true});await expect(downloads.locator('.version-row')).toHaveCount(2);await expect(downloads).toContainText('Fabric');await expect(downloads).toContainText('Forge');await expect(downloads.getByRole('link',{name:'下载',exact:true})).toHaveCount(2);
  await downloads.getByRole('combobox',{name:'加载器',exact:true}).selectOption('Forge');await expect(downloads.locator('.version-row')).toHaveCount(1);await expect(downloads).toContainText('1.20.1');
  await choose.click();await expect(tab).toBeFocused();await expect(downloads.getByRole('combobox',{name:'加载器',exact:true})).toHaveValue('Forge');expect(started).toEqual([]);
  const pending=page.waitForEvent('download');await downloads.getByRole('link',{name:'下载',exact:true}).click();expect((await pending).suggestedFilename()).toBe('previous.jar');
  await downloads.getByRole('combobox',{name:'加载器',exact:true}).selectOption('');const latest=downloads.locator('.version-row').first();await latest.locator('summary').filter({hasText:'文件与更新说明'}).click();await expect(latest.getByRole('link',{name:'下载',exact:true})).toHaveCount(2);await latest.getByText('SHA-256 校验值',{exact:true}).first().click();await expect(latest.locator('code').first()).toHaveText('a'.repeat(64));
  await downloads.getByRole('combobox',{name:'加载器',exact:true}).selectOption('Forge');await downloads.getByRole('combobox',{name:'游戏版本',exact:true}).selectOption('1.21.1');await expect(downloads.getByText('没有符合筛选条件的版本。')).toBeVisible();await downloads.getByRole('button',{name:'清除筛选',exact:true}).click();
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.screenshot({path:'.artifacts/version-page-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'.artifacts/version-page-desktop.png',fullPage:true});
});
test('旧目录无版本记录时保留原下载入口，不虚构兼容版本和加载器',async({page})=>{
  await page.goto('/#/works/minecraft-explorer');await expect(page.getByRole('link',{name:'下载',exact:true})).toHaveAttribute('href',/download\.studiofimel\.com/);await expect(page.getByRole('combobox',{name:'下载版本'})).toHaveCount(0);
  await page.getByRole('tab',{name:'版本与下载',exact:true}).click();const versions=page.getByRole('region',{name:'版本与下载',exact:true});
  await expect(versions.locator('.version-row')).toHaveCount(1);await expect(versions.getByRole('heading',{name:'1.0.2',exact:true})).toBeVisible();await expect(versions.getByRole('link',{name:'下载',exact:true})).toHaveAttribute('href',/MinecraftExplorer-1\.0-win-x64\.exe$/);await expect(versions).not.toContainText('SHA-256');
});

test('全部现有作品的版本页使用统一列表或空状态，保留原下载与平台地址',async({page})=>{
  test.setTimeout(180000);const catalogue=JSON.parse(await readFile('public/works/catalogue.json','utf8'));delete catalogue.releases;
  await page.route('**/works/catalogue.json',route=>route.fulfill({json:catalogue}));const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  for(const project of catalogue.projects as Project[]){
    await page.goto(`/#/works/${project.slug}?tab=versions`);const versions=page.getByRole('region',{name:'版本与下载',exact:true});await expect(versions,project.slug).toBeVisible();
    const direct=project.downloadUrl||project.download;const existing=!!(direct||project.latestReleaseRepo||project.store||project.releasePage);
    await expect(versions.locator('.version-row'),project.slug).toHaveCount(existing?1:0);await expect(versions.getByRole('combobox')).toHaveCount(0);await expect(versions).not.toContainText('SHA-256');
    if(direct){await expect(versions.getByRole('link',{name:'下载',exact:true})).toHaveAttribute('href',direct);if(project.version)await expect(versions.getByRole('heading',{name:project.version,exact:true})).toBeVisible();}
    else if(project.store){await expect(versions.getByRole('link',{name:'前往平台',exact:true})).toHaveAttribute('href',project.store);await expect(versions.getByRole('link',{name:'下载',exact:true})).toHaveCount(0);if(!project.version)await expect(versions).toContainText('版本号未标注');}
    else if(!existing)await expect(versions).toContainText(project.status==='released'?'暂未提供下载或获取入口。':'尚未发布可下载的公开版本。');
  }
  expect(errors).toEqual([]);
});

test('平台分发与未发行版在三语和手机布局中保持明确的入口和状态',async({browser})=>{
  const catalogue=JSON.parse(await readFile('public/works/catalogue.json','utf8'));
  for(const [language,theme,button,empty]of [['zh','dark','前往平台','尚未发布可下载的公开版本。'],['en','light','Open platform','No public download has been released yet.'],['ja','dark','配信ページへ','ダウンロード可能な公開版はまだありません。']]){
    const context=await browser.newContext();const page=await context.newPage();await page.route('**/works/catalogue.json',route=>route.fulfill({json:catalogue}));
    await page.addInitScript(({language,theme})=>{sessionStorage.setItem('fimel_intro_seen','1');localStorage.setItem('fimel_user_lang',language);localStorage.setItem('fimel_theme',theme);},{language,theme});
    await page.goto('/#/works/chinese-chess-cb?tab=versions');await expect(page.locator('.version-row').getByRole('link',{name:button,exact:true})).toBeVisible();await page.locator('.project-versions>details summary').click();await expect(page.getByRole('tabpanel')).toContainText('兼容性提醒');
    for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
    await page.screenshot({path:`.artifacts/all-versions-${language}-${theme}-mobile.png`,fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:`.artifacts/all-versions-${language}-${theme}-desktop.png`,fullPage:true});
    await page.goto('/#/works/island-escape-java?tab=versions');await expect(page.locator('.project-versions')).toContainText(empty);await expect(page.locator('.project-versions .version-row')).toHaveCount(0);
    await page.locator('.project-versions>details summary').click();const contact=page.locator('.project-versions').getByRole('link',{name:'联系 Fimel',exact:true});await expect(contact).toHaveAttribute('href','#/studio');await contact.click();await expect(page).toHaveURL(/#\/studio$/);
    await context.close();
  }
});
