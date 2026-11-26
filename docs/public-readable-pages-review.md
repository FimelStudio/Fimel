# 官网作品与文档直读验收

日期：2026-11-26。开发分支：`feat/public-readable-pages-20261126`。

## 问题与结果

原官网采用 HashRouter：`/#/works/...` 的片段不会发送给服务器。初始 HTML 只有空的 `#root`，作品、文档靠浏览器运行 JavaScript 后读取公开 R2 目录。不执行 JavaScript 的阅读工具无法从初始页面取得正文。

本轮让现有官网 Worker 在 `/`、`/works`、`/works/:slug`、`/docs`、`/docs/:slug` 直接返回可阅读的 HTML。浏览器随后加载现有 React 界面；不区分 AI、搜索机器人和普通访客的 User-Agent。无需公开任何后台数据库或管理接口。

- 作品正文、更新日志、版本文件、平台入口和仓库地址可直接读取。
- 文档目录、分类、独立文档、SVG 图片、图文表格和左右图文可直接读取。
- 独立标题、摘要、分享元信息、规范地址和实时站点地图；`robots.txt` 提供站点地图地址。
- 原 `/#/works/...`、`/#/docs/...` 链接继续兼容；官网主域名使用普通路径。
- GitHub Pages 项目子目录继续使用 HashRouter，不迁移部署方式。
- 原 `/works/catalogue.json` 和静态 Markdown 仍交给静态资源绑定，保留旧下载跳转和统计接口。
- 由页面处理器统一规范页面地址；静态资源 `html_handling: none` 确保内部读取 `index.html` 模板不被重定向，避免模板读取失败或循环跳转。

## 发布数据与边界

仅通过已有 `PUBLIC` 绑定读取 `fimel-downloads` 中的 `data/works.json`、`data/docs.json`、目录明确引用的 `content/**/*.md`，以及版本内打包的公开静态正文。没有 PRIVATE 绑定、后台登录依赖或任意外部抓取。

每次请求重新检查已发布目录。Admin 后续发布、改名、更新和下架，直接反映到新地址，无需提交正文到 Git 或重新部署。该实现不改变 Admin 的保存草稿／发布流程。

下架或未知地址返回 404；目录、正文或应用模板读取失败返回 503、`Retry-After: 60` 和明确的重试提示。失败时不返回旧 Git 目录、不伪造空数据；收到服务器公开页面的浏览器也禁用 Git 快照回退。错误页不加载可能覆盖错误状态的应用脚本。

Markdown 禁止任意作者 HTML，仅重建安全图片属性；链接禁止危险协议、凭据和私有上传路径。服务器读取限定为公开目录与公开正文，设置对象大小上限；不存在任意 URL 服务端请求。仅浏览 HTML 不写入下载／浏览事件。

## 验证记录

所有浏览器检查使用独立的无界面测试进程，不控制用户日常 Edge 页面。

- 16 项 Worker／下载统计检查通过，包括真实 workerd 中的 HTML、发布更新、下架、目录损坏、过大对象、请求方法、HEAD、站点地图、安全图片和旧链接。
- 官网完整回归首次执行 137 项：131 项通过，6 项暴露了自定义首页卡片链接、静态正文路由和旧断言兼容问题；修正后重跑相关 34 项，全部通过。此前的文档／版本／导航专项 36 项也通过。
- 新增的浏览器验收覆盖关闭 JavaScript 阅读正文、SVG 图文表格、390px 排版、正常应用接管、直接刷新、历史跳转，以及公开目录失败时禁止旧快照复活作品。
- 最后使用 Miniflare 原生静态资源路由及与生产一致的 `run_worker_first`／HTML 配置重跑这 3 项浏览器验收，全部通过；没有用模拟文件服务代替最终静态资源路由。
- Cloudflare 隔离远程预览逐一读取当前线上 **30 个作品、23 篇文档**，连同首页、目录、版本和站点地图共 **58 个地址，全部 HTTP 200**，响应正文直接包含作品／文章内容。最大文档为璀璨宝石，当前正文最长语言 27,705 字符。预览仅允许公开对象 `get/head`，不绑定私有桶，禁止任何存储写入。
- GitHub Pages `/Fimel/` 实际子目录构建和无界面浏览器导航／刷新通过，本地 Git 快照的 28 个作品保持可用。
- 官网构建、官网及 Admin TypeScript、相关 ESLint、Worker dry-run 打包和差异空白检查通过。Worker 打包约 138 KiB，gzip 约 38 KiB。

诊断证据在本地忽略目录 `.artifacts/public-readable-20261126/`；不提交凭据、诊断能力头或线上内容快照。

## 待确认的上线范围

合并并推送本分支，发布现有官网 Worker `fimel` 的代码和静态资源。现有 GitHub Pages 流程仍保留。无需部署 Admin，不代为保存、重发或删除作品／文档。

正式构建继续按现有规范设置 `VITE_CATALOGUE_URL=https://download.studiofimel.com/data/works.json`，保证从工作室等普通静态入口进入的浏览器也读取已发布目录。

官网页面请求现在经过现有 Worker，并读取公开 R2 根目录；会增加 Worker 请求和 R2 读取次数。没有新增付费服务或资源绑定。启用 10% 日志和 1% 链路采样；应用异常仅记录公开页面类型，不记录正文、身份、会话或环境值。

不修改 DNS、Access、凭据、桶绑定或存储数据。上线前保留现有 `fimel` 版本与部署记录，异常时回滚至该版本。此次尚未进行生产部署。

本轮修复网页本身对无 JavaScript 阅读的兼容性。特定 AI 工具自己的联网限制或站点外的抓取策略仍需使用具体工具复核，不能仅凭其“无法访问”提示推断网站被 Cloudflare 封禁。

实现依据：[Cloudflare 静态资源与 Worker 路由](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)、[R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)、[Marked 自定义渲染器](https://marked.js.org/using_pro)。
