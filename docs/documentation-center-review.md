# 文档中心开发与交付审阅

2026-11-03。代码基线 `578d2c4`，开发分支 `feat/documentation-center`，回滚标签 `baseline/documentation-center-20261103`。用户已授权完成后直接合并、推送，不再询问 Git 确认；main 推送会触发现有官网构建。两份用户交接文件保持未跟踪。本轮未执行独立 Admin 生产 Worker 部署，也未写入或发布正式文档数据。

## 已核实与方案

旧交接中“没有 Admin”的描述已经过时。当前是 React／Vite／HashRouter 官网、独立 Access 保护的 Admin Worker，以及 PUBLIC／PRIVATE R2。文档使用独立 `state/docs.json` 与 `data/docs.json`，不挤入作品或网站内容索引，不改作品上传归属。

先采用 `studiofimel.com/#/docs` 和 `#/docs/<稳定 slug>`，兼容现有 Cloudflare 与 GitHub Pages。新增文档导航，不改已有地址。分类与文档名称可修改；分类不进入文章 URL。以后如采用 docs 子域，再独立处理入口和路由。

公开阅读参考 Animated Java 的手册导航、香草图书馆的分组索引、Jupyter 的搜索与页内目录。采用保留式调整，沿用 Geist／品牌字、Lucide、青色与语义深浅色，细边框和小圆角。文档页的视觉变化／动效／密度为 4／2／5；以阅读为主，不引入第二套 UI 库。

## 开发计划

1. 独立分类与文档模型、严格验证、并发保存、备份与审计。分类合并在一次草稿保存中完成；非空分类不能直接删除。文档删除采用可恢复归档。
2. Admin 文档增删查改、重命名、分类创建／修改／删除／合并、移动／排序、搜索、草稿导出、恢复与发布差异预览。所有草稿和未引用图片保持私有。
3. 共享安全 Markdown，增加 `:::image-left` 与 `:::image-right` 块；图片与文字左右排版，手机自动改为上下，代码块中的同名标记保持代码。预览和公开阅读使用同一组件。
4. 官网文档目录、搜索、分类导航、正文、页内目录、上一篇／下一篇，处理空态、404、读取失败及三语回退。
5. 从用户指定的本机游戏规则目录生成受保护的导入样例，保留 23 篇规则、25 张配图、原表格与代码块，归入 Fimel Card。保留 69 处原有文字截图占位，不伪造截图；SVG 示例图转换为 PNG，源文件不变。
6. 使用本地 Worker／R2 和浏览器验收，覆盖草稿隔离、发布失败／冲突、分类合并、归档恢复、图片归属、特殊格式安全、23 篇导入、双主题与手机。完成后按用户授权提交、合并并推送；独立 Admin 部署和正式内容发布保留原有确认边界。

## 实现接口约定

文档库 `DocsLibrary` 为 `{schemaVersion:1,categories:DocsCategory[],documents:DocDraft[]}`。分类 `{id,slug,title,summary,order,workSlug?}`；文档 `{id,slug,categoryId,title,summary,body,order,workflow,images,createdAt,updatedAt}`。title／summary 使用现有 LocalizedText，body 为 zh／en／ja 可选字符串，workflow 为 draft／ready／archived，images 复用 Asset 结构但仅使用独立 docs 私有对象。ID 和 slug 保存后固定。

公开 `DocsManifest` 为 `{schemaVersion:1,publicationId,publishedAt,categories,documents}`。公开文档仅包含 `{id,slug,categoryId,title,summary,body,order,updatedAt,sourceRevision}`，body 内私有图片标记替换为公开 URL。不序列化 images、privateKey 或工作流。全文保存在有上限的独立索引，支持全文搜索；先写不可变发布快照，再 CAS 切换公开索引。

- `GET /api/docs` → `{library,published,publicEtag,updatedAt}` + JSON etag。
- `PUT /api/docs`，`If-Match`，`{library}` → 同上；全库 JSON 上限 4 MiB，分类最多 50、文档最多 300、单语正文最多 120000 字符，每篇最多 40 图。
- `POST /api/docs/preview`，`If-Match`，`X-Public-ETag` → `{added,changed,removed,categoriesChanged}`（文章数组含 id／slug／title）。只读取，不公开草稿。仅 ready 文档进入后续公开索引，draft／archived 不进入。
- `POST /api/docs/publish`，同双版本条件，`{}` → `{published:true,publicationId}` + 新公开 etag。必须预览清楚本次将新增、修改、下架哪些文章；只改分类不自动公开 draft。
- `POST /api/docs/images/:docId`，PNG／JPEG／WebP ≤10 MiB，body 为图片二进制；`X-File-Name` 为 encodeURIComponent 原名，`X-Image-SHA256` 为完整 hash → `{asset}`。文档须先保存，校验签名／大小／hash，存于 `docs/uploads/<docId>/<assetId>/<name>`。私有正文标记 `fimel-doc-image:<assetId>`。
- `GET /api/docs/media/:docId/:assetId/:name`：仅已登录预览，核验 docId／assetId 元数据后流式读取。
- `GET /api/docs/example`：受保护导入清单。`POST /api/docs/import-example/:slug`，`If-Match`：一次仅追加一篇与其配图，已有 slug 拒绝覆盖，返回新草稿库及 etag。UI 逐篇确认导入，可在中断后跳过已存在项继续。

示例清单 `admin/examples/docs-example.json` 为 `{schemaVersion:1,category:DocsCategory,documents:[{id,slug,title,summary,body,order,images:[{id,name,displayName,size,mime,sha256,url}]}]}`。图片 url 指向受保护的 `/migration/docs-example/images/...`；body 中使用 `fimel-doc-image:<示例图片id>`，导入服务端替换成新 owner 的实际 assetId。导入文档默认 draft。admin-assets 脚本仅复制到 Admin dist，不放进官网 public。

## 使用方式

后台部署本轮代码后，侧栏进入“文档中心”。“管理分类”可以创建、重命名、调整顺序、关联作品与合并分类；非空分类不能直接删除，先合并或移动文章。文档可新增、改名、移动、排序、搜索，归档后保留图片和正文并可恢复，地址不随改名或分类变化。

页面底部“预览示例导入”列出 23 篇 Fimel Card 规则。确认后只追加私有草稿，已有 slug 跳过。导入中断或响应丢失时，再次继续会先读取最新草稿，不重复覆盖已导入的文章。使用“选择当前筛选文档”可批量设置状态；初始没有默认选中。

保存与公开分两步：编辑后“保存文档草稿”；需要展示的文档设为“待发布”，保存，再点击“预览文档发布”，检查新增、修改和下架清单，最后“确认发布文档”。这是整套文档库的独立发布，公开中的文章应继续保留为参与发布状态；改为私有草稿或归档，会在下一次确认发布时下架。作品发布和网站文案发布不受影响。

编辑器支持直接选图、拖入图片、粘贴截图，自动私有上传并插入 Markdown；在“已上传图片”中可以明确复用。删除正文图片引用不会被图库自动补回，也不会删除历史图片文件。左右排版可点“插入图左文右”／“插入文左图右”，或从已上传图片直接插入分栏：

```markdown
:::image-left
![图片说明](图片地址)

## 小标题
这里是图片右侧的文字，可用列表、表格等 Markdown。
:::
```

改为 `:::image-right` 即交换左右；手机自动上下排列。图片地址由上传／复用操作生成，无需寻找服务器路径。代码块中的同名语法保留为代码，不会误排版。预览和官网采用同一渲染组件；HTML 与危险链接不会执行。

文档支持中文、English、日本語。没有译文时，官网按现有回退规则显示已填写的正文，并明确提示；不会伪造翻译。公开文档页支持标题与全文搜索、分类导航、页内目录、上一篇／下一篇，按分钟或回到前台时检查更新。

## 示例来源与复现

源目录为用户指定的 `C:\Users\柳浪一\Desktop\卡牌数据包资源包发布版\游戏规则`，整个生成过程只读。23 篇首标题转为文章名称，真实图片与 README 内链转换为文档引用，首张图标和信息表放入图左文右容器；其余规则文字可逆还原核对。69 处“截图位”原文保留，没有生成虚假截图。24 张 PNG 逐字节复制，卡坦 SVG 在禁脚本、禁网络的本地浏览器中转换为 PNG，合计 25 张。

重新生成命令：`npx tsx scripts/docs-example-import.ts "<游戏规则源目录>"`。脚本验证所有源文件前后 SHA-256、所有图片存在、正文转换可逆和重复生成一致性。已有生成资产随源码提交，正常构建和部署不依赖本机桌面目录，也不需要重新执行转换器。

## 验证与上线边界

本地文档单元／真实 Miniflare 检查 25 项通过，覆盖身份与 CSRF、草稿 CAS、备份、跨文档图片归属、图片签名与 SHA-256、并发发布、失败保留旧公开索引、审计准备失败阻止写入、空译文回退以及 23 篇规则完整导入。公开阅读页浏览器检查 13 项通过，Admin 文档浏览器流程 10 项通过；全部使用本地或隔离内存存储。桌面／390px 手机、亮色／暗色截图已检查。后台 23 篇规则用例曾遇到一次 Windows 测试进程在启动时异常退出，独立重跑通过，没有遗留产品断言失败。

独立复核追加了损坏 IndexedDB 恢复记录的结构校验、上传／导入时的刷新关闭保护、空译文显示已有语言但不擅自填入翻译的回归检查。文档公开状态区分已同步、待更新和待下架，不把已经公开的内容统一误标为待发布。

补测原有品牌导航、作品列表和路由返回共 25 项；新增文档后导航变为四项。补测发现旧转换器断言仍查找已经更名的“功能”小节，现改为核实真实正文标题，不修改作品内容。

官网构建、Admin 构建及类型生成、全仓 ESLint、Git 差异检查均通过；两套 Wrangler 生产配置仅执行本地 dry-run 打包验证，没有上传或切换线上版本。Admin 的文档编辑器独立懒加载，受保护样例包含 23 篇与 25 张图片（1,651,490 字节），构建后图片大小与 hash 一一匹配，官网 dist 不包含这套私有导入样例。构建保留原有大体积主包提示，未新增运行时依赖。

`download.studiofimel.com` 已是现有公开 R2 自定义域，无对象路径白名单，现有 CORS 覆盖官网、www 和 GitHub Pages；新索引和图片不需要新绑定、凭据、DNS 或 Access 变更。当前正式 `data/docs.json` 尚不存在，因此新官网入口会显示待整理空态。23 篇规则随 Admin 构建作为受保护的导入样例，独立后台完成部署后才能在正式后台使用；正式导入和公开发布由管理员明确操作。

回滚代码可回到基线 `578d2c4`；Worker 代码回滚不会回滚 R2 数据。每次文档草稿保存、导入或公开发布均在私有桶保留独立快照，历史公开图片和不可变索引也保留；本轮没有覆盖或删除既有作品数据。
