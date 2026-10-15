import {expect,test} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test.beforeEach(async({page})=>{await page.addInitScript(()=>{sessionStorage.setItem('fimel_intro_seen','1');localStorage.setItem('fimel_user_lang','zh');});});
test('版本选择显示真实兼容信息，历史多文件可下载且手机不溢出',async({page})=>{
  const catalogue=JSON.parse(await readFile('public/works/catalogue.json','utf8'));const project=catalogue.projects.find((p:{slug:string})=>p.slug==='bingo-but-dont-do-it');
  const file=(id:string,name:string,primary=false)=>({id,name,size:2*1024**2,mime:'application/java-archive',sha256:'a'.repeat(64),primary,publicUrl:`https://download.studiofimel.com/works/mods/${project.slug}/test/${name}`});
  catalogue.schemaVersion=2;catalogue.releases={[project.slug]:[{id:'latest',label:'2.0',date:'2026-10-16',status:'released',gameVersions:['1.21.1'],loaders:['Fabric'],platforms:['Minecraft Java'],files:[file('new','latest.jar',true),file('extra','resources.zip')]},{id:'previous',label:'1.0',date:'2026-10-15',status:'released',gameVersions:['1.20.1'],loaders:['Forge'],files:[file('old','previous.jar',true)]}]};
  await page.route('**/works/catalogue.json',route=>route.fulfill({json:catalogue}));
  await page.route('https://download.studiofimel.com/works/mods/**',route=>route.fulfill({status:200,contentType:'application/java-archive',headers:{'Content-Disposition':'attachment; filename="previous.jar"'},body:Buffer.from('PK-test')}));
  await page.goto(`/#/works/${project.slug}`);const downloads=page.getByRole('region',{name:'下载文件',exact:true});await expect(downloads).toContainText('Fabric');await expect(downloads).toContainText('1.21.1');await expect(downloads.getByRole('link')).toHaveCount(2);
  await downloads.getByRole('combobox').selectOption('previous');await expect(downloads).toContainText('Forge');await expect(downloads).toContainText('1.20.1');await expect(downloads.getByRole('link')).toHaveCount(1);await expect(downloads).not.toContainText('latest.jar');
  const pending=page.waitForEvent('download');await downloads.getByRole('link').click();expect((await pending).suggestedFilename()).toBe('previous.jar');
  await downloads.getByText('查看 SHA-256 校验值',{exact:true}).click();await expect(downloads.locator('code')).toHaveText('a'.repeat(64));
  await page.setViewportSize({width:320,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('旧目录无版本记录时保留原下载入口，不虚构兼容版本和加载器',async({page})=>{
  await page.goto('/#/works/minecraft-explorer');await expect(page.getByRole('link',{name:'下载',exact:true})).toHaveAttribute('href',/download\.studiofimel\.com/);await expect(page.getByRole('combobox',{name:'下载版本'})).toHaveCount(0);
});
