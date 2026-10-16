import {expect,test} from '@playwright/test';
import {makeWork} from '../shared/model';

test('后台正文及发布预览共用版本列表，顶部仍是单个下载且预览不下载',async({page})=>{
  const work=makeWork();work.project.slug=`version-preview-${Date.now()}`;work.project.status='released';work.project.title={zh:'版本列表验收'};work.markdown.description.zh='正文';work.markdown.versions.zh='## 自定义安装说明';
  work.versions=['2.0','1.0'].map((label,i)=>({id:`release-${i}`,label,date:'2026-10-16',gameVersions:['1.21'],platforms:['Windows'],status:'released',changelog:{zh:`${label} 更新内容`},files:[{id:`file-${i}`,name:`release-${i}.zip`,size:78929,mime:'application/zip',sha256:'a'.repeat(64),publicUrl:`https://download.studiofimel.com/works/${work.project.type}/${work.project.slug}/${label}/release-${i}.zip`,primary:true}]}));
  const saved=await page.request.put(`/api/works/${work.id}`,{headers:{Origin:'http://127.0.0.1:5174','X-Fimel-CSRF':'1'},data:{base:null,work}});expect(saved.status(),await saved.text()).toBe(200);
  const downloads:string[]=[];page.on('request',r=>{if(r.url().includes('/api/files/')||r.url().includes('/works/bedrock/')&&r.url().endsWith('.zip'))downloads.push(r.url());});
  await page.goto('/');await page.getByLabel('搜索作品').fill(work.project.slug);await page.locator('.work-row').click();await page.getByRole('button',{name:'正文与预览',exact:true}).click();await page.getByRole('button',{name:'版本说明',exact:true}).click();
  const editor=page.locator('.markdown-editor .project-versions');await expect(editor.locator('.version-row')).toHaveCount(2);for(const button of await editor.getByRole('button',{name:'下载',exact:true}).all())await expect(button).toBeDisabled();
  await page.getByRole('button',{name:'发布预览',exact:true}).click();const dialog=page.getByRole('dialog',{name:'发布预览',exact:true});await expect(dialog.locator('.project-versions')).toHaveCount(0);await expect(dialog.getByRole('button',{name:'下载',exact:true})).toBeDisabled();await dialog.locator('.content-tabs').getByRole('button',{name:'版本',exact:true}).click();
  await expect(dialog.locator('.version-row')).toHaveCount(2);await dialog.getByText('补充说明与历史记录',{exact:true}).click();await expect(dialog.getByRole('heading',{name:'自定义安装说明',exact:true})).toBeVisible();expect(downloads).toEqual([]);
  await page.screenshot({path:'.artifacts/admin-version-page-desktop.png'});await dialog.getByLabel('预览宽度').selectOption('mobile');await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.artifacts/admin-version-page-mobile.png'});
});

for(const kind of ['download','platform','pending']as const)test(`旧作品的${kind}入口在版本编辑、正文及发布预览中统一显示`,async({page})=>{
  const work=makeWork();work.project.slug=`existing-${kind}-${Date.now()}`;work.project.title={zh:`已有作品 ${kind}`};work.markdown.description.zh='[联系 Fimel](#/studio)';work.markdown.versions.zh='## 保留的安装和兼容说明\n\n[联系 Fimel](#/studio)';
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  if(kind==='download')Object.assign(work.project,{status:'released',version:'1.0',size:'128 KiB',downloadUrl:`https://download.studiofimel.com/works/bedrock/${work.project.slug}/1.0/release.zip`});
  if(kind==='platform')Object.assign(work.project,{status:'released',store:'https://resource-minecraft.h5.163.com/#/detail?id=123'});
  const saved=await page.request.put(`/api/works/${work.id}`,{headers:{Origin:'http://127.0.0.1:5174','X-Fimel-CSRF':'1'},data:{base:null,work}});expect(saved.status(),await saved.text()).toBe(200);
  const downloads:string[]=[];page.on('request',r=>{if(r.url().endsWith('release.zip')||r.url().includes('resource-minecraft.h5.163.com'))downloads.push(r.url());});
  await page.goto('/');await page.getByLabel('搜索作品').fill(work.project.slug);await page.locator('.work-row').click();
  const verify=async(scope:ReturnType<typeof page.locator>)=>{
    await expect(scope.locator('.version-row')).toHaveCount(kind==='pending'?0:1);
    if(kind==='pending')await expect(scope).toContainText('尚未发布可下载的公开版本。');else await expect(scope.getByRole('button',{name:kind==='download'?'下载':'前往平台',exact:true})).toBeDisabled();
    await expect(scope).not.toContainText('SHA-256');
  };
  await page.getByRole('button',{name:'发行版本',exact:true}).click();await verify(page.locator('.existing-version-preview .project-versions'));
  await page.getByRole('button',{name:'正文与预览',exact:true}).click();await page.getByRole('button',{name:'版本说明',exact:true}).click();await verify(page.locator('.markdown-editor .project-versions'));
  await page.getByRole('button',{name:'发布预览',exact:true}).click();const dialog=page.getByRole('dialog',{name:'发布预览',exact:true});await dialog.locator('.content-tabs').getByRole('button',{name:'版本',exact:true}).click();await verify(dialog.locator('.project-versions'));
  if(kind!=='pending')await expect(dialog.locator('.publication-changes')).toContainText('既有下载或平台入口继续保留');
  await dialog.getByText('补充说明与历史记录',{exact:true}).click();await expect(dialog.getByRole('heading',{name:'保留的安装和兼容说明',exact:true})).toBeVisible();const contact=dialog.getByRole('link',{name:'联系 Fimel',exact:true});await expect(contact).toHaveAttribute('href','https://studiofimel.com/#/studio');await contact.click();await expect(dialog).toBeVisible();expect(downloads).toEqual([]);expect(errors).toEqual([]);
  await dialog.getByLabel('预览宽度').selectOption('mobile');await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.artifacts/admin-existing-${kind}-mobile.png`});
});
