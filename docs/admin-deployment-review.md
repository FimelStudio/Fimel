# Admin 生产变更审阅清单

2026-10-14。用户已确认旧 R2 Token 撤销并更换新凭据，也已指定两名管理员和邮箱一次性验证码登录。实际邮箱只保留在会话及未来服务端 Secret，不写 Git。本文件不是生产授权。

## 当前状态（2026-10-15 更新）

用户已明确授权本轮后台代码更新及专用只读统计凭据配置。2026-10-14 23:55（Asia/Shanghai）发布源码 `c1f951a`，线上版本 `04dd9b40-e9ab-4025-aa22-c6b1e5607e57`，部署 `966af472-ab78-4416-95d0-db51686d4996`，100% 流量。代码回滚版本为 `a8adc16d-52b0-40ea-a205-490fec3f0ab0`。

本轮已上线官网 28 个作品的追加导入预览、上传期间导航保护、恢复作品库的审计字段差异。用户点击导入并检查后保存才写私有库；没有自动写入正式作品或发布公开内容。已复核首页、5 类管理接口、导入 JSON、新版 JS 和伪造邮箱头，共 9 项匿名请求全部跳转 Access。

通过现有 MCP 只读查询验证 1、7、30 天真实分析数据均可用，但 MCP 无权访问 Token 管理和权限组（9109），不扩大权限。已提供专用 Zone Analytics Read Token 的本机隐藏输入/验证/暂存脚本，等待用户完成；截至本条记录，未创建 Token、未设置分析 Secrets 或激活统计。详见 [统计接入步骤](admin-analytics-setup.md)。

已准备保留窗口、明确命令控制的真实私有上传验收；等待测试窗口登录，尚未开始真实大文件传输。正式作品迁移、公开发布、官网切换、Git 推送与 D1 仍未执行。

## 2026-10-14 首批与界面修复记录

用户确认第一批后，已创建 `fimel-private`、独立 Worker `fimel-admin`、域名 `admin.studiofimel.com` 和 Worker 级 Access 邮箱验证码保护，并设置服务端身份 Secrets。私有桶没有公开域名，r2.dev 未启用；Worker 的 workers.dev 和预览地址禁用。原官网 Worker、正式下载文件与公开 manifest 未修改，没有 Git 推送或 D1 激活。

真实邮箱登录及作品库显示已由用户确认，私有验收草稿保存成功。线上黑屏已通过静态 AJV 校验器修复，保存冲突已通过 JSON 强版本号修复。当前线上版本为 `a8adc16d-52b0-40ea-a205-490fec3f0ab0`；前一版本 `0fb44988-0918-490a-972e-64bc9fac5bb0` 可作为本次代码发布的回滚版本。真实 100 MiB / 1 GiB 上传验收尚未完成，不能以本地上传测试代替。

已发布新增：窗口自适应、右上角当前用户名、管理员操作日志、访问与下载统计页面。用户名从已验证身份提取邮箱前缀；日志用私有存储记录操作者标识和字段变化，只能可靠识别更新后的新操作。统计连接需要单独确认服务端 Analytics 只读凭据，尚未创建或设置该凭据，页面保留未连接提示。

用户已明确确认发布上述后台更新。2026-10-14 23:20（Asia/Shanghai）仅更新现有 `fimel-admin` 的代码与静态资源，源码提交 `c3139a4`，部署 ID `7d54bd9e-c042-45db-8129-2de5eafd1e71`，新版占 100% 流量。未改 Access、DNS、R2 绑定、官网、正式内容或现有身份 Secrets。发布后使用全新未登录 Edge 验证首页、session、library、audit、analytics、新版静态脚本及伪造邮箱请求头，共 7 项均跳转 Access。workers.dev 和预览继续禁用，Access 仍仅两名管理员且要求 OTP。登录后的新版界面已通过本地生产 CSP 验收，发布后的真实登录界面仍待用户刷新核对；未复用或导出用户登录 Cookie。

## 第一批执行前的只读盘点（历史记录）

- `fimel-downloads` 存在，`download.studiofimel.com` 的 SSL/ownership active，r2.dev 未启用。桶目前没有 CORS 配置。
- `fimel-private` 不存在；无 Admin Worker、Admin DNS 或 Access 应用。Zero Trust 已有组织与 Cloudflare 身份提供商。
- 现有 Worker 为 `fimel`，当前 Worker 自定义域名包含 `studiofimel.com`。本地 GitHub Pages workflow 同样存在，因此“官网当前一定仅由 GitHub Pages 提供”不能从任务背景推断。不会把新后台绑定到官网 Worker，也不会移除现有官网域名或工作流。
- R2 只读对象列表为三个既有正式发行文件和一个上传 smoke ZIP；没有 `data/works.json`。正式文件仍为 Bingo `1.21.11-v1.0`、Explorer `1.0.2`、OBJ Cubizer `1.4.0`，不重上传、不覆盖、不删除。
- 当前 zone rulesets 未列出缓存阶段规则；发布 JSON 写 Cache-Control:no-store，仍须实测 CDN 行为。MCP 能读取所需资源；没有以写请求验证生产权限或提升任何权限。

## 第一批拟申请的生产变更

| 对象 | 拟变更与影响 |
| --- | --- |
| R2 `fimel-private` | 新建私有 Standard 桶，不绑定域名，不启用 r2.dev；供草稿、备份和上传暂存 |
| Worker `fimel-admin` | 部署独立后台产物与同源 API；PRIVATE→fimel-private，PUBLIC→fimel-downloads；不修改现有 fimel Worker |
| 域名 `admin.studiofimel.com` | 添加 Worker Custom Domain 与对应 DNS/证书；不改官网及下载域名 |
| Access 应用 `Fimel Studio Admin` | Worker 级保护整个 fimel-admin，包括所有路径、备用路由及预览；OTP 登录，只允许用户确认的两名管理员 |
| Worker Secrets | 设置 ACCESS_AUD、ACCESS_ISSUER、ADMIN_EMAILS；不新增 S3 密钥，不给浏览器写 Token；不在命令参数/日志/仓库记录值 |
| 日志/Traces | 启用 Worker 观测，记录操作/状态/随机 requestId；不记录 Token、Cookie、正文或邮箱 |
| 隔离验收对象 | 仅在新私有桶的 uploads 前缀创建 100 MiB/1 GiB 验收文件，验证分片、完整哈希、断线续传和失败恢复；清理本批自己创建的 temporary 对象，保留 verified 验收对象以供复核 |

先新建私有桶和受控 Worker，身份配置缺失时服务端 fail closed；配置 Worker 级 Access、Secrets 和域名后，测试真实 OTP 登录及匿名 401/403/Access 拒绝。workers.dev 和 preview_urls 始终 false，同时检查 alternate routes。任何缺失权限都停止该线上操作并报告，不扩大 Token 或启用付费服务。

第一批不写公开桶，不创建/更新 `data/works.json`，不切换官网环境变量，不推送 Git。第一批验证私有上传、Access 和 CPU 额度；公开发布、下载回读、CORS/CDN 的真实验收留待第二批授权。

通过隔离验收后，下一批内容迁移与官网切换仍需确认：

1. 审查 `.artifacts/admin-migration/library.json` 与 `report.json`（28 个作品，完整原始 legacy 保留）。通过受保护接口写私有作品库，备份当前状态。
2. 按原作品顺序发布，生成新不可变 Markdown/快照，最终更新新 `data/works.json`。三个已有下载 URL 与 82,127,618 字节正式文件保持原样；原图片仍由官网原路径提供。制作中作品公开介绍，不虚构下载。
3. 为公开桶设置最小 CORS：Origin `https://studiofimel.com`，GET/HEAD，允许 If-None-Match，Expose ETag；不开放写方法/通配符。迁移 Markdown 与图片也需要公开读取/展示。部署前重新检查 www/GitHub Pages 实际 Origin，再决定是否追加已验证 Origin。
4. 设置 GitHub Actions repository variable `VITE_CATALOGUE_URL=https://download.studiofimel.com/data/works.json`。本地已为工作流增加变量接入，尚未设置远端值。
5. 审核并批准推送/合并 `feat/fimel-admin` 及现有官网构建发布流程，核对当前 Worker Builds/GitHub Pages 实际线上发布通道；不擅自迁移官网托管或替换现有域名绑定。
6. 实测首页、目录、详情、三語、图片、下载、发布后一分钟重验证与下架空目录。失败时恢复私有保存的公开 manifest；不删除已发布资源。

第二批公开验收先使用专用测试作品及不可变测试文件前缀，验证发布、下架与公开完整哈希回读；测试作品不混入正式迁移后的目录。具体测试 Key、manifest 前后差异和备份先给出审阅，不覆盖正式发行文件。

## D1 统计作为后续单独确认对象

代码和本地 D1 测试已准备好。若启用：新建 D1 `fimel-statistics`、独立 Worker `fimel-statistics`、Custom Domain `api.studiofimel.com`，仅绑定公开桶与 D1。配置 API RateLimit namespace 11001（部署前检查账户不重复）和 Origin `https://studiofimel.com`。

在导出、审阅并批准导入现有 Supabase 点击计数后，执行增量 CREATE IF NOT EXISTS 迁移、导入经核验的计数，再设置 `VITE_ANALYTICS_URL=https://api.studiofimel.com/api/download-counts`，停止旧 keepalive cron。不会自动重跑旧 Supabase drop-table 迁移，也不会删除旧库、清零或自动将网易商店历史下载量当作点击计数。上述历史统计迁移没有被本次凭据确认授权。

## 免费额度与实际风险

默认使用 Standard R2，未启用付费 Worker、付费图像服务、Queues 或其他收费功能。R2 月度免费额度为 10 GB-month、100 万 Class A 和 1000 万 Class B；超额可能计费，不能保证长期零费用。1 GiB 文件在 temporary、verified 和公开桶合计最多约 3 GiB，清理已验证后的 temporary 可降到约 2 GiB；历史版本长期保留也占空间。参见 [R2 官方价格](https://developers.cloudflare.com/r2/pricing/)。

64 个 16 MiB 分片每个独立请求；含 SHA-256、JSON receipts/会话/备份等，会有额外操作数。Workers Free 当前有 10 ms CPU/请求、100,000 请求/天限制，本地不强制这些线上额度；必须在隔离上线验收中测量 CPU、并发、限流和上传恢复，超限时先报告再决定方案，不能自行切收费套餐。参见 [Workers 官方限制](https://developers.cloudflare.com/workers/platform/limits/)。

D1 Free 当前每日 500 万 rows read、10 万 rows written、账户总 5 GB；统计请求受到限流且只是点击量，非完成下载/用户去重。若需要启用，部署时再次核对账户的实际免费能力与限额。[D1 官方价格](https://developers.cloudflare.com/d1/platform/pricing/)。

## 回滚对象

代码基线为 `baseline/admin-20261014` / e018113。内容回滚为 `backups/public/*.json` → 条件更新 data/works.json。静态快照回滚为清空 VITE_CATALOGUE_URL 后按原通道构建。恢复前先备份；不删除桶或历史安装包。Worker 代码回滚不会回滚 R2/D1 数据，不能用一次版本 rollback 代替内容恢复。
