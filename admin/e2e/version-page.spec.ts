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
