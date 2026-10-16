# Admin 生产变更审阅清单

2026-10-14。用户已确认旧 R2 Token 撤销并更换新凭据，也已指定两名管理员和邮箱一次性验证码登录。实际邮箱只保留在会话及未来服务端 Secret，不写 Git。本文件不是生产授权。

## 当前状态（2026-10-16 更新）

### 版本列表与转换器内容已发布

经用户确认，官网和 Admin 已发布版本列表调整，顶部恢复直接下载按钮，版本选择移入“版本”页；Minecraft OBJ 方块转换器的三语内容、历史下载记录与更新时间已单独更新并发布。实际官网、GitHub Pages 与后台预览均通过线上验收，其他作品和网站文案未变；版本、发布记录、校验值与回滚点见 [版本页交付记录](version-page-review.md)。

### 下载区与后台六项完善已上线

本轮经用户明确确认后快进合并 main、推送并发布，详情与回滚点见 [下载区与后台交付记录](admin-improvements-review.md)。包含网站内容／近期更新编辑、发布差异、恢复草稿、多人冲突、图片用途和按作品统计；官网已启用现有 R2 桶与限流绑定。公开作品目录前后哈希一致，未代为保存或发布真实作品和网站文案。后台手机统计筛选溢出也已补测并修复。

### 封面与正文用途分离（2026-10-15 09:40 已发布）

用户要求封面界面导入的图片不自动充当正文截图。根因是上一版的 `appendGallery` 会在预览和发布时把未明确引用的上传图片补到详情末尾，导致正文删除后再次出现。现已删除自动补图逻辑，预览与发布均以原始 Markdown 为准；正文上传也不再自动设为封面。图片选择和复用必须是管理员的明确操作。

发布仅复制被选为封面或被正文引用的图片；其余封面候选保持私有，原有公开文件与历史快照保留。删除正文引用后无需删除资源或取消封面即可正常保存、重载和重新发布；封面不受影响。已公开的旧正文需再次经管理员确认发布，系统不自动重发草稿。

真实本地 R2 验证了 2→1→0 张正文图片连续发布，封面保持、未使用候选图未公开、历史对象保留；浏览器验证封面导入不进入预览、正文删除后保存重载不复现，拖入/粘贴及中断重试保持。线上只读定向核对没有匹配到“已保存正文未引用封面、公开正文却包含该封面”的记录；这不代表已读取或否定用户当前未保存页面的情况。

用户确认后，源码 `3d3f4ff` 于 2026-10-15 09:40（Asia/Shanghai）发布到 `fimel-admin`，版本 `6764bd5d-0b35-4330-8332-a26ebfdf1b7e`，部署 `747654ab-a33c-4190-8a54-bddeca44de10`，100% 流量。此前版本 `fe1e0e3e-4252-45bc-8d55-c62e7e5664d2` 可回滚。5 项 Secret 名称/类型、两个原桶绑定和公开的 Admin Origin 逐项一致，未修改 Access、DNS 或凭据。

线上匿名保护 10/10；用已登录浏览器的临时未保存表单验证封面候选不进入正文、明确插入才显示、删除后保持消失、封面选择保留。该表单和图片响应采用验收夹具，未保存或上传到生产；所有非只读 API 请求被预先禁止，实际请求写入计数 0、页面错误 0。作品库 hash/ETag、公开 ETag 发布前后一致，仍为 32 条私有记录、28 条公开作品。本轮只更新代码并按确认推送源码，不自动重发作品或删除历史图片。

### 正文图片直接导入与封面保存修复（2026-10-15 09:11 已发布）

用户报告选择上传封面后清空旧地址仍不能保存。根因是私有 Project 直接复用公开目录的必填非空 image 规则。现仅允许已选择有效上传封面的私有记录保留空 image；缺少两种封面来源时给出中文提示。公开目录和 legacy 校验保持严格，发布时使用已验证上传图片作为真实公开封面。

正文现可直接拖入图片文件、粘贴剪贴板中的图片或选择本机图片，沿用已验证上传流程自动插入光标处；批量连续导入形成轮播。新作品先校验并保存基本信息；上传只进入私有库，不会自动发布。已有封面地址、其他语言正文与原文字保留，失败重试仅处理剩余文件。右侧预览与官网复用同一 Markdown/轮播组件及正文样式，图片在正文中的位置保留，发布时不重复追加。手机端 fieldset 最小宽度也已修正。

用户已明确确认发布。源码 `935968d` 于 2026-10-15 09:11（Asia/Shanghai）发布到 `fimel-admin`，版本 `fe1e0e3e-4252-45bc-8d55-c62e7e5664d2`，部署 `296a9052-2901-4a8d-b83c-68dfe9eb2637`，100% 流量。此前版本 `20f2c38d-28d0-4c03-8894-c50f4246a700` 保留作为回滚点；新版本逐项保留 5 个 Secret 名称/类型和两个原 R2 绑定，未改 DNS、Access、凭据或新增资源。

生产匿名保护 10/10；同一浏览器无需 OTP 即可打开新标签，真实编辑入口、官网同组件的三张图片轮播及空图片选择提示可用，页面错误 0。本轮线上验收仅只读，专用标签阻止所有非 GET/HEAD/OPTIONS 管理请求，实际阻止计数 0；没有线上文件上传、保存或发布。私有库 hash/ETag 与公开 ETag 前后一致（32 条私有记录，公开目录 28 条）。拖入、粘贴和保存发布的写入闭环使用真实本地 R2 验收，不能把生产只读检查描述为真实生产新图片上传。随后按确认推送源码与交付记录，原有官网/GitHub Pages 自动构建沿用。操作方法见 [使用说明](admin-guide.md)、测试证据见 [验证记录](admin-verification.md)。

### 2026-10-15 上午公开目录和官网接入

用户在核对“待发布”后明确要求继续公开发布、官网数据源接入和 Git 发布，并要求保持登录。已将现有 Access 应用会话从 8h 改为 720h（30 天）；两名管理员、同一 OTP IdP、require、Worker 目的地及 AUD 逐项保持一致，未修改组织全局会话。正常浏览器保留 Cookie 时在有效期内复用登录；退出、清除 Cookie、无痕窗口或会话到期后仍需验证码。

用户完成验收窗口登录后，已用隔离 22 字节有效 ZIP 验证私有上传、公开发布、官网 Origin 下的真实 CORS 下载及完整 SHA-256 回读、下架和归档。随后按原顺序发布 28 个现有作品；公开目录准确为 28 条，正式私有记录逐字段未变。新增公开内容/快照均为不可变路径，原有 3 个安装包没有覆盖。首轮迁移 manifest ETag 为 `f5a5d8f02383ecbd80442cab36aaed34`；后续不改内容的重发布验收会生成新版本号。

公开桶已配置 GET/HEAD CORS，仅允许官网、已存在的 www 和 GitHub Pages Origin，允许 If-None-Match/Range，并暴露 ETag 等必要响应头。GitHub Actions 仓库变量与现有 Cloudflare Builds 触发器均配置公开的 VITE_CATALOGUE_URL；没有迁移官网托管，未改 DNS。源码 `7089752` 已快进推送 main 及 feat/fimel-admin；GitHub Pages run `38657008275` 和现有 Cloudflare Build `b7151d24-ce53-4b6f-8e6e-4f7cb7b223a3` 均成功。官网功能发布版本 `6ce2f6f7-a9a7-47ea-ae3d-a0b60efd9c81`，此前官网版本 `ddbf5ee8-d4d1-4d74-832d-8be5da287c0b` 保留为回滚对象。

官网及 GitHub Pages 均由全新浏览器验证实际请求 R2：28 个作品、三语详情和移动布局正常，页面错误 0。R2 中 104 份正文逐一真实 CORS 读取成功，manifest no-store 且条件请求返回 304。原有 3 个下载 URL 保持。

1 GiB 已从 19 个旧分片恢复并完成 64 片：实际 1,073,741,824 字节，R2 完整 SHA-256 验证成功，关联保存、归档和本会话临时对象清理成功。verified 对象保留，公开目录未改变。新增私有下载入口及 Range 后端/本地浏览器测试通过；源码 `3d6f48e` 已上线后台版本 `20f2c38d-28d0-4c03-8894-c50f4246a700`，部署 `a977f039-ed3c-49b3-9461-a4967b13a9b1`，5 项 Secrets/两个桶绑定保留，匿名保护 10/10 通过。

后续报表验收的选择器等待触发了验收驱动未处理 Promise 超时，临时浏览器因此关闭；已修正选择器及 Promise 等待，失败会保留窗口并明确记录失败。新验收窗口使用浏览器自身管理的专用保留档案，不读取、复制或导出 Cookie；档案仅位于忽略的 .artifacts。用户再次登录后，1、7、30 天统计实际 API 均返回 200 并正确显示页面，管理员日志可见，新标签和刷新复用登录；1 GiB 通过“下载私有文件”完整回读并核对 SHA-256 成功。默认显示 28 条正式作品，4 条测试记录已归档。

最终回归：官网 82/82、远端目录适配 4/4；新增私有下载真实本地 runtime 与 100 MiB 浏览器场景通过。官网构建、Admin 构建、lint、部署 dry-run 和隐私扫描通过。真实官网重发布同步检查发现，原首次读取耗时会错过第一分钟计时，约 119.5 秒才读取新目录；已修正为可见页面每分钟直接重验证，并添加延迟读取测试。线上保存 CPU 的 3 个样本全部成功，中位 14 ms、最大 35 ms；原生分片样本约 4 ms。此数据不能保证免费额度下每次保存均低于 CPU 预算；未启用付费服务。观测窗口中的聚合请求为 174 次成功、0 个错误，不代表无限期可用性保证。

以下为此前私有库阶段的历史状态，后续以本节和最新验证记录为准。

用户已授权后台更新、只读统计凭据配置，并在睡前明确授权导入现有作品、完善增删查改。当前源码 `dc3c3a9`；2026-10-15 01:43（Asia/Shanghai）发布版本 `845e22c6-17ad-49e1-a32d-7ea2be594f1f`，部署 `e948cb20-c1d5-4260-9083-3eb5a3170da3`，100% 流量。上一版 `2d631823-08a2-43d0-af58-09b06ba2f37d` 可回滚；它包含首轮原生校验修复。更早的 `16896dc1-1655-4a1c-8129-7e7a345115cd` 上传实现曾超限，不建议为大文件上传回退至该版本。

已通过真实登录浏览器的导入预览追加保存官网 28 个作品：私有库从 1 条变为 29 条；原验收草稿逐字段一致、其已验证文件保留、公开 ETag 仍为 empty，导入前自动创建备份。随后隔离验收新增/三语修改/安全正文预览/搜索/分类筛选/复制/归档/恢复与过期版本拒绝均通过；只操作新建测试记录，28 条正式导入记录逐字段一致。两个 CRUD 测试记录最终归档，总计 31 条，其中 29 条在用（28 个官网作品和 1 个上传验收草稿）、2 条已归档。默认列表隐藏已归档记录，状态筛选仍可恢复。删除沿用软删除，不永久移除真实作品或文件。

用户已在控制台创建专用分析 Token，并在本机验证后暂存两个 Secrets；2026-10-15 00:45 激活 `16896dc1-1655-4a1c-8129-7e7a345115cd`，此后的后台版本保留全部 5 个 Secrets。真实登录浏览器的 `/api/analytics?days=7` 返回 200（29 组域名、5 组文件）；现有 MCP 的 1、7、30 天同一查询亦通过。尚未完成最终版本的三种范围逐项登录页面验收，不用只读 MCP 结果替代它。Token 只保留在服务端，值未导出、未进 Git；实际到期日未读取，轮换步骤见 [统计接入说明](admin-analytics-setup.md)。

真实 100 MiB 私有上传已通过，7 片，主动断网后续传，完整 SHA-256 与已保存私有关联一致。已按原授权只清理该会话的临时对象，验证 verified 文件仍在。真实 1 GiB 首轮因 Worker 资源超限失败；修复后从旧 10 片续传至 19 片，随后验收浏览器连接结束，未完成上传、完整校验或保存关联。会话有效期为创建起 24 小时；若下次登录时仍有效，可重新选择同一文件从服务器分片恢复，否则重新开始。本地 1 GiB 完整校验与回读通过不替代此项线上验收。

逐片校验改由 R2 原生 SHA-256 暂存后流式传入 multipart，不在 Worker 缓冲并哈希 16 MiB。线上原实现约 230–328 ms CPU 且出现 exceededResources；首轮修复的分片 14、17 样本均为 3 ms、outcome ok。完整库 PUT 样本中位 18 ms、最大 31 ms，虽成功仍有免费额度风险，因此最终版复用一次库读取、请求解析和验证，并按字段比较审计，不再重复序列化整篇正文。该最终保存优化的线上 CPU 尚待登录实测；没有启用付费套餐。

最终版本的全新未登录 Edge 9/9 保护检查通过；Access 仍仅两名管理员、仅 OTP IdP，require 引用同一 OTP IdP，无 bypass；workers.dev/预览关闭，私有桶无公开域名且 r2.dev 关闭。官网域名仍归 `fimel`。公开桶仍无 data/works.json，三个原下载对象存在，本轮没有写公开桶。官网接入后台数据源、公开发布、Git 推送和 D1 仍待单独授权。验收细节见 [验证记录](admin-verification.md)。

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
2. 按原作品顺序发布，生成新不可变 Markdown/快照，最终更新新 `data/works.json`。三个已有下载 URL 和正式文件保持原样；2026-10-15 实际 R2 大小分别为 Bingo 59,689,247、Explorer 22,384,640、OBJ Cubizer 53,731 字节，之前本清单的微小字节数不符合当前对象，已更正。原图片仍由官网原路径提供。制作中作品公开介绍，不虚构下载。
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
