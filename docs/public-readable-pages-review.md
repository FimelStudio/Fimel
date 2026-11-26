# 官网作品与文档直读验收

日期：2026-11-26。开发提交：`e3cdf8a`；已合并并推送 `main`，合并提交：`eab242f`。

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

## 已确认的上线范围

用户确认后已合并并推送本分支，发布现有官网 Worker `fimel` 的代码和静态资源。现有 GitHub Pages 流程仍保留。没有部署 Admin，没有代为保存、重发或删除作品／文档。

正式构建继续按现有规范设置 `VITE_CATALOGUE_URL=https://download.studiofimel.com/data/works.json`，保证从工作室等普通静态入口进入的浏览器也读取已发布目录。

官网页面请求现在经过现有 Worker，并读取公开 R2 根目录；会增加 Worker 请求和 R2 读取次数。没有新增付费服务或资源绑定。启用 10% 日志和 1% 链路采样；应用异常仅记录公开页面类型，不记录正文、身份、会话或环境值。

没有修改 DNS、Access、凭据、桶绑定或存储数据。部署前后核对 PUBLIC、ASSETS、限流绑定、定时任务、自定义域名和 workers.dev 设置，均与原配置一致。

## 生产发布验收

- 官网 Worker：`fimel`；版本：`83223a0b-a74f-4ba0-a42d-ffb36ab3fb82`，已接收 100% 流量；部署：`ac9493db-dada-491d-8ad7-debc0307617b`。发布时间：2026-11-26 16:26（北京时间）。
- 回滚基线：版本 `cad9a391-84d7-4035-846c-c8b342e91934`；部署 `0b287134-2db4-483d-990e-243e5fe6d774`。回滚只涉及代码与静态资源，不会恢复或覆盖 R2 内容。
- 正式域名逐一读取当前 30 个作品、23 篇文档及目录／版本／语言入口，共 60 个页面，全部 HTTP 200，原始 HTML 直接包含正文；另核对站点地图、robots、未知作品 404、旧 JSON／Markdown 和旧下载 302。
- 独立无界面浏览器验证真实界面接管、直接刷新、版本页、旧哈希链接、璀璨宝石文档、手机排版和关闭 JavaScript 的阅读；从 `/studio` 进入作品目录仍显示全部 30 个公开作品，未落回 Git 快照。无未捕获浏览器错误，验收拦截了 14 次统计写请求，避免污染访问数据。
- 机器人 User-Agent `GPTBot` 的普通 HTTP 请求同样收到可读正文。当前内置联网工具对该域名仍返回不带具体原因的“not accessible”；不能据此声称所有 AI 已可访问，也未据此修改防护策略。
- 合并提交对应的 [GitHub Pages 构建与部署](https://github.com/FimelStudio/Fimel/actions/runs/45782734567) 已成功。
- 线上验收与回滚记录在本地忽略目录 `.artifacts/public-readable-20261126/production/` 和 `site-control-before.json`／`site-control-after.json`。

本轮修复网页本身对无 JavaScript 阅读的兼容性。特定 AI 工具自己的联网限制或站点外的抓取策略仍需使用具体工具复核，不能仅凭其“无法访问”提示推断网站被 Cloudflare 封禁。

实现依据：[Cloudflare 静态资源与 Worker 路由](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)、[R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)、[Marked 自定义渲染器](https://marked.js.org/using_pro)。
