import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function savedWork(page:Page){
  const slug=`publish-reliability-${Date.now()}`;
  await page.goto('/');await page.getByRole('button',{name:'新建作品',exact:true}).click();
  await page.getByLabel('作品名称',{exact:true}).fill('发布故障验收');await page.getByLabel('稳定 slug').fill(slug);
  await page.getByRole('button',{name:'正文与预览',exact:true}).click();await page.getByLabel('Markdown 正文',{exact:true}).fill('已经保存的正文，不应因发布故障丢失。');
  await page.getByRole('button',{name:'保存草稿',exact:true}).first().click();await expect(page.getByText('草稿已保存到私有存储。',{exact:false})).toBeVisible();
  const state=await(await page.request.get('/api/library')).json();return state.library.works.find((w:{project:{slug:string}})=>w.project.slug===slug);
}

test('发布断网时弹窗内可见提示并恢复按钮，等待期间 Esc 不会关闭，草稿保留且可重试',async({page})=>{
  const work=await savedWork(page);let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route(`**/api/publish/${work.id}`,async route=>{await gate;await route.abort('connectionreset');});
  await page.getByRole('button',{name:'发布预览',exact:true}).click();const modal=page.getByRole('dialog',{name:'发布预览',exact:true});
  await modal.getByRole('button',{name:'确认发布',exact:true}).click();await expect(modal.getByRole('status')).toContainText('正在发布');
  await page.keyboard.press('Escape');await expect(modal).toBeVisible();await expect(modal.getByRole('button',{name:'返回编辑',exact:true})).toBeDisabled();
  release();await expect(modal.getByRole('alert')).toContainText('发布结果尚未确认，草稿已保存');
  await expect(modal.getByRole('button',{name:'确认发布',exact:true})).toBeEnabled();
  await expect(modal.locator('.publication-article')).toContainText('已经保存的正文');
  await page.screenshot({path:'.artifacts/admin-screenshots/publication-recoverable-error.png',fullPage:true});
  await page.unroute(`**/api/publish/${work.id}`);await modal.getByRole('button',{name:'确认发布',exact:true}).click();
  await expect(modal).not.toBeVisible();await expect(page.getByText('发布成功，公开 manifest 已更新。',{exact:true})).toBeVisible();
  await expect(page.locator('.publish-bar strong')).toHaveText('已公开 · 已同步');
});

test('公开提交后响应丢失，通过服务端指纹确认成功而不重复发布',async({page})=>{
  const work=await savedWork(page);let writes=0;
  await page.route(`**/api/publish/${work.id}`,async route=>{writes++;const response=await route.fetch();expect(response.status()).toBe(200);await route.abort('connectionreset');});
  await page.getByRole('button',{name:'发布预览',exact:true}).click();const modal=page.getByRole('dialog',{name:'发布预览',exact:true});
  await modal.getByRole('button',{name:'确认发布',exact:true}).click();await expect(modal).not.toBeVisible();
  await expect(page.getByText('发布成功，公开 manifest 已更新。',{exact:true})).toBeVisible();expect(writes).toBe(1);
  await expect(page.getByLabel('Markdown 正文',{exact:true})).toHaveValue('已经保存的正文，不应因发布故障丢失。');
});

test('发布后其他管理员更新草稿，保留本页与旧编辑基线，再保存仍检测冲突',async({page})=>{
  const work=await savedWork(page);
  await page.route(`**/api/publish/${work.id}`,async route=>{
    const response=await route.fetch();expect(response.status()).toBe(200);
    const current=await(await page.request.get('/api/library')).json();const base=current.library.works.find((w:{id:string})=>w.id===work.id);
    const changed={...base,markdown:{...base.markdown,description:{zh:'另一个管理员已更新的正文'}}};
    expect((await page.request.put(`/api/works/${work.id}`,{headers:{Origin:'http://127.0.0.1:5174','X-Fimel-CSRF':'1'},data:{base,work:changed}})).status()).toBe(200);
    await route.fulfill({response});
  });
  await page.getByRole('button',{name:'发布预览',exact:true}).click();await page.getByRole('dialog',{name:'发布预览',exact:true}).getByRole('button',{name:'确认发布',exact:true}).click();
  await expect(page.getByText('发布已确认。服务器草稿随后有更新，已保留本页内容，请导出或重新读取后核对。',{exact:true})).toBeVisible();
  const input=page.getByLabel('Markdown 正文',{exact:true});await expect(input).toHaveValue('已经保存的正文，不应因发布故障丢失。');await input.fill('本页的后续修改，应当检测冲突');
  await page.getByRole('button',{name:'保存草稿',exact:true}).first().click();await expect(page.getByRole('dialog',{name:'此作品存在编辑冲突',exact:true})).toBeVisible();
  const current=await(await page.request.get('/api/library')).json();expect(current.library.works.find((w:{id:string})=>w.id===work.id).markdown.description.zh).toBe('另一个管理员已更新的正文');
});
