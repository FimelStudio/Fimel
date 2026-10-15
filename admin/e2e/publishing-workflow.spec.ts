import {expect,test} from '@playwright/test';
test('恢复未保存编辑，合并远端独立修改，查看实际发布预览与待发布状态',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const slug=`recover-${Date.now()}`;
  await page.goto('/');await page.getByRole('button',{name:'新建作品',exact:true}).click();await page.getByLabel('作品名称',{exact:true}).fill('编辑恢复验收');await page.getByLabel('稳定 slug').fill(slug);
  await page.getByRole('button',{name:'保存草稿',exact:true}).first().click();await expect(page.getByText('草稿已保存到私有存储。',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'正文与预览',exact:true}).click();await page.getByLabel('Markdown 正文',{exact:true}).fill('本机恢复后的正文');await expect(page.getByText('本机恢复记录：',{exact:false})).toBeVisible();
  // A clean second tab must not clear the first tab's debounced IndexedDB recovery.
  const other=await page.context().newPage();await other.goto('/');await expect(other.getByRole('button',{name:'恢复编辑',exact:true})).toBeVisible();await other.waitForTimeout(1100);await other.close();
  const server=await(await page.request.get('/api/library')).json();const work=server.library.works.find((w:{project:{slug:string}})=>w.project.slug===slug);
  const changed={...work,project:{...work.project,summary:'其他管理员更新的介绍'}};expect((await page.request.put(`/api/works/${work.id}`,{headers:{'X-Fimel-CSRF':'1',Origin:'http://127.0.0.1:5174'},data:{base:work,work:changed}})).status()).toBe(200);
  page.once('dialog',d=>d.accept());await page.reload();await expect(page.getByRole('button',{name:'恢复编辑',exact:true})).toBeVisible();await page.getByRole('button',{name:'恢复编辑',exact:true}).click();await page.getByRole('button',{name:'正文与预览',exact:true}).click();await expect(page.getByLabel('Markdown 正文',{exact:true})).toHaveValue('本机恢复后的正文');
  await page.getByRole('button',{name:'保存草稿',exact:true}).first().click();await expect(page.getByText('草稿已保存到私有存储。',{exact:false})).toBeVisible();
  const after=await(await page.request.get('/api/library')).json();const saved=after.library.works.find((w:{id:string})=>w.id===work.id);expect(saved.project.summary).toBe('其他管理员更新的介绍');expect(saved.markdown.description.zh).toBe('本机恢复后的正文');
  await page.getByRole('button',{name:'发布预览',exact:true}).click();const dialog=page.getByRole('dialog',{name:'发布预览',exact:true});await expect(dialog.locator('.publication-article')).toContainText('本机恢复后的正文');await dialog.getByLabel('预览宽度').selectOption('mobile');await expect(dialog.locator('.publication-canvas')).toHaveClass(/is-mobile/);await dialog.getByRole('button',{name:'确认发布',exact:true}).click();await expect(page.getByText('发布成功，公开 manifest 已更新。')).toBeVisible();await expect(page.locator('.publish-bar strong')).toHaveText('已公开 · 已同步');
  await page.getByLabel('Markdown 正文',{exact:true}).fill('又一次修改，仍未发布');await expect(page.locator('.publish-bar strong')).toHaveText('已公开 · 有修改待发布');await page.getByRole('button',{name:'保存草稿',exact:true}).first().click();await page.getByRole('button',{name:'发布预览',exact:true}).click();await dialog.getByRole('button',{name:'当前官网',exact:true}).click();await expect(dialog.locator('.publication-article')).toContainText('本机恢复后的正文');await expect(dialog.locator('.publication-article')).not.toContainText('又一次修改，仍未发布');await dialog.getByRole('button',{name:'返回编辑',exact:true}).click();
  await page.screenshot({path:'.artifacts/admin-screenshots/publication-state.png',fullPage:true});expect(errors).toEqual([]);
});

test('逐字输入多项版本兼容信息，保留逗号并按数组保存',async({page})=>{
  const slug=`compat-${Date.now()}`;await page.goto('/');await page.getByRole('button',{name:'新建作品',exact:true}).click();await page.getByLabel('作品名称',{exact:true}).fill('版本兼容输入验收');await page.getByLabel('稳定 slug').fill(slug);
  await page.getByRole('button',{name:'发行版本',exact:true}).click();await page.getByRole('button',{name:'添加版本',exact:true}).click();await page.getByLabel('版本号',{exact:true}).fill('1.0');
  await page.getByLabel('适用游戏版本',{exact:true}).pressSequentially('1.21.1, 1.21.4');await expect(page.getByLabel('适用游戏版本',{exact:true})).toHaveValue('1.21.1, 1.21.4');
  await page.getByLabel('加载器（可留空，逗号分隔）',{exact:true}).pressSequentially('Fabric, Forge');await expect(page.getByLabel('加载器（可留空，逗号分隔）',{exact:true})).toHaveValue('Fabric, Forge');
  await page.getByLabel('本版本运行平台（留空沿用作品平台）',{exact:true}).pressSequentially('Windows, Linux');await page.getByRole('button',{name:'保存草稿',exact:true}).first().click();await expect(page.getByText('草稿已保存到私有存储。',{exact:false})).toBeVisible();
  const server=await(await page.request.get('/api/library')).json();const release=server.library.works.find((w:{project:{slug:string}})=>w.project.slug===slug).versions[0];expect(release.gameVersions).toEqual(['1.21.1','1.21.4']);expect(release.loaders).toEqual(['Fabric','Forge']);expect(release.platforms).toEqual(['Windows','Linux']);
});
test('后台管理网站文案和近期更新，保存与发布独立且移动布局正常',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'网站内容',exact:true}).click();await expect(page.getByRole('heading',{name:'首页精选与推荐顺序',exact:true})).toBeVisible();
  while(await page.getByRole('button',{name:'移除推荐',exact:true}).count())await page.getByRole('button',{name:'移除推荐',exact:true}).first().click();
  await page.getByLabel('工作室介绍',{exact:true}).fill('通过后台维护的工作室介绍');await page.getByRole('button',{name:'添加近期更新',exact:true}).click();await page.getByLabel('更新标题',{exact:true}).first().fill('本地近期更新验收');await page.getByLabel('更新摘要',{exact:true}).first().fill('仅本地模拟 R2，不修改线上内容。');
  await page.getByRole('button',{name:'保存网站草稿',exact:true}).click();await expect(page.getByText('网站内容草稿已保存，官网尚未更新。')).toBeVisible();await page.getByRole('button',{name:'预览网站发布',exact:true}).click();await expect(page.locator('.site-publish-preview')).toContainText('本地近期更新验收');await page.getByRole('button',{name:'确认发布网站内容',exact:true}).click();await expect(page.getByText('网站内容已发布，官网现有区块和近期更新将读取新内容。')).toBeVisible();
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.artifacts/admin-screenshots/site-content-mobile.png',fullPage:true});expect(errors).toEqual([]);
});
