# Fimel Studio Admin 本地交付说明

本次实现保留官网路由、视觉组件、GitHub Pages 工作流和既有下载地址。Admin 位于独立 `admin/` 构建边界，不加入官网 App。第一批独立后台已上线并通过真实邮箱登录，私有库目前有验收草稿；正式作品迁移和公开发布尚未执行。准确线上状态见 [生产审阅清单](admin-deployment-review.md)。

已发布的最新界面随窗口宽度展开，右上角用户名使用服务端验证身份的邮箱前缀，不硬编码管理员邮箱。手机宽度缩短显示，悬停显示完整用户名；读取身份失败时明确提示。管理员日志可查看更新后新操作的操作者、作品、变更字段和成功/失败结果；旧记录不会虚构操作者。域名统计凭据尚未配置，未连接时提示错误，不生成模拟统计。请使用普通浏览器刷新查看；旧验收窗口可能仍受启动时固定视口影响。

`npm run admin:test:production` 构建后在实际生产 CSP 下验收页面启动、窗口适配、身份显示、保存版本号与报表页面。校验器由 `npm run admin:generate` 预生成，浏览器运行时无需动态编译或放宽 CSP。

## Windows 本地启动

在项目根目录执行：

```powershell
npm ci
npm run admin:migration
npm run admin:build
```

两个终端分别运行：

```powershell
npm run admin:api
```

```powershell
npm run admin:dev
```

打开 `http://127.0.0.1:5174`。API 为 `127.0.0.1:8788`；仅本地配置使用测试身份，数据持久化在忽略的 `.artifacts/admin-local/`。桶标识 `admin-local-private` / `admin-local-public` 均为本地模拟，绑定 `remote:false`。**不要部署 `wrangler.local.jsonc`**。生产入口没有本地身份开关，并默认关闭 workers.dev 和预览地址。

API 启动后，可在第三个终端运行 `npm run admin:seed`，把 28 个现有作品的迁移预览追加到本地模拟库。它固定访问 loopback，不提供远程目标参数；按 ID/slug 去重，不覆盖已有本地记录，也不发布作品。既有线上安装包没有复制到本地桶，因此相关作品的本地发布会按设计拒绝缺失下载对象。

生产配置日期为 2026-10-14。本地 workerd 1.20261012.1 仅支持到 2026-10-12，故本地配置使用该日期。构建依赖沿用项目版本范围升级，并升级 Wrangler 以支持新后台；锁文件保留精确版本。

## 日常操作

1. 作品库支持搜索、分类/状态筛选、排序和每页 20 条。新建作品后填写名称、稳定 slug、分类、平台与作者；保存后 slug/分类固定，避免改动历史资源地址。
2. 基本信息和正文支持 `zh/en/ja`。未提供的翻译不自动生成，官网继续按原语言回退规则显示。编辑状态（草稿/待发布/归档）与作品发行状态（制作中/计划中/已发行）分开。
3. 正文编辑器提供 Markdown 输入与实时安全预览，HTML 不执行。三个原页签保留。完整记录 JSON 可编辑原始商店来源、历史指标、作者链接、旧下载链接和所有版本字段；先应用再保存。
4. 添加版本，填写标签、日期、适用游戏版本及三语日志；先保存版本，再上传文件。各版本可关联多个文件，选主下载项、调整最新版本顺序。未发行版本不公开。
5. 图片支持 PNG/JPEG/WebP，最多 10 MiB/张，批量上传、封面选择、前移排序、移除关联。图片和安装包首先进入私有桶。移除关联不删除历史对象。
6. 发布前先保存，再打开发布预览检查正文、图片和已发行版本。正式发布会检查资源归属、大小、校验值和下载对象；最后更新公开 manifest。发布不是“保存草稿”。
7. 下架从公开 manifest 移除作品，文件和草稿保留。重新发布即可恢复。归档是软删除；已公开作品应先下架。界面不提供永久删除作品或安装包、清空桶的入口。
8. 复制创建新 ID，复制文本和元数据；版本文件与私有图片需重新上传/关联，不能把其他作品的私有资源冒用为自己的资源。
9. JSON 导入先进入编辑区，校验后人工检查并保存；导出保留完整私有记录。备份与恢复可恢复作品库或公开目录，恢复前再次备份。公开恢复只引用保留的不可变历史资源。
10. 多标签页使用全库 ETag 进行条件保存。遇到 409，当前修改仍保留；先导出，再重新加载并合并。全库并发控制偏保守：编辑不同作品也可能发生冲突。

## 网页上传协议

浏览器线程计算分片及完整 SHA-256，页面仍可交互。16 MiB/片，最多 1 GiB，单请求远低于普通 Worker 请求体上限，不发送完整 1 GiB POST，也不使用浏览器长期 S3 密钥。

会话仅限一个作品、一个版本、一个随机对象；有效期 24 小时。同时活动会话最多约 10 个。分片请求通过 Access、同源校验和 CSRF Header；固定编号、长度、MIME、分片 SHA-256 和首片签名均由服务端校验。分片只有已完成 R2 uploadPart 后才记录 receipt，重试必须保持原内容。

暂停保留会话，重新选择同一文件可续传，服务器 receipts 为进度依据。客户端只有 hash/会话 ID 存在本机，不存任何凭据。取消终止未完成 multipart；已验证对象不能通过取消接口删除。

中文/日文原始文件名保留在 `displayName`，下载响应使用 UTF-8 Content-Disposition；对象 Key 使用受约束的 ASCII 文件名。两者分别校验，避免原始文件名变成对象路径。

完成时先锁定会话，检查所有 receipts，R2 complete 后核对实际大小，再流式写入私有 verified 对象，使用 Binding `sha256` 做完整对象校验；正确后才返回可关联的 Asset。失败保留 verifying 状态，可重试完成。R2 multipart ETag 不当作完整文件 MD5。发布复制再次使用 SHA-256 并拒绝覆盖不同内容。

“备份与恢复”页面可管理上传会话，清理已完成/已取消/过期会话的 temporary 对象；需要明确二次确认。清理不删除 verified 文件、公开文件、作品库或备份。R2 自动终止长期未完成 multipart 是最后保障，不能代替临时对象维护。

隔离验收可向 cleanup API 传 `{ "sessionIds": ["指定会话 ID"] }`，仅处理本批生成的会话，保留其他上传与全部 verified 对象。省略该字段时仍按界面的全体合格会话清理；空数组不清理任何会话。

格式签名检查不是恶意软件扫描。安装包是否安全仍需工作室审核。

## 数据模型、存储和 API

`admin/shared/model.ts` 定义私有 Library v1、Work、Release、Asset、Upload。`admin/shared/validation.ts` 在现有 catalogue Schema 上构建 AJV 2020 校验，拒绝未知字段、非法语言、重复 ID/slug/版本、危险 URL、非法 Key 和未发行下载。运行 `admin:migration` 会输出可审阅的 `library.schema.json`。

私有桶：`state/library.json`、`backups/library/`、`backups/public/`、`snapshots/`、`audit/`、`uploads/sessions/`、`uploads/active/`、`uploads/receipts/`、`uploads/temporary/`、`uploads/verified/`。公开桶：`data/works.json`（兼容 Project 的 v2 manifest）、`data/snapshots/`（仅公开内容）、`content/{slug}/{publicationId}/`、`images/{type}/{slug}/{assetId}/`、`works/{type}/{slug}/{version}-{assetId}/`。

所有管理 API 同域名且先鉴权：

| API | 功能 |
| --- | --- |
| GET /api/session | 身份已核验 |
| GET /api/library | 私有库、公开目录及两个 ETag |
| PUT /api/library | If-Match 条件保存与备份 |
| GET /api/preview/:id | 已保存元数据对照 |
| POST /api/publish/:id | If-Match + X-Public-ETag 条件发布 |
| POST /api/unpublish/:id | 条件下架，保留文件 |
| GET /api/history | 私有历史快照 |
| POST /api/restore/:kind/:id | 恢复 library/public；恢复前备份 |
| GET /api/uploads | 会话列表 |
| POST /api/uploads | 申请限定上传会话 |
| GET /api/uploads/:id | 会话和已完成 receipts |
| PUT /api/uploads/:id/parts/:number | 分片数据、X-Part-SHA256 |
| POST /api/uploads/:id/complete | 完整 SHA-256 校验和完成 |
| DELETE /api/uploads/:id | 取消未完成会话 |
| POST /api/uploads/cleanup | 经确认清理临时对象 |
| GET /api/media/:id | 已验证私有图片预览 |

写请求需要 `Origin` 为 Admin 域名和 `X-Fimel-CSRF:1`。主要错误为 401/403、404、405、409、410（过期）、413、415、422、428（缺少版本条件）、429、503。响应 no-store、nosniff、frame-ancestors none；Markdown 不执行 HTML。审计 prepared 表示操作意图，真正保存/发布事实以 Library ETag 和 manifest/publicationId 为准，失败不会伪称提交已完成。

发布没有跨桶事务：资源/不可变正文 → 私有和公开快照 → 最后 CAS 更新 manifest。中途失败可能留下未引用的不可变对象，但不会切到不完整 manifest；重试可复用经过校验的相同资源。不得自动删除未引用的公开对象，因为旧快照/历史链接可能仍需要它们。

## 官网接入与回滚

`VITE_CATALOGUE_URL` 默认空，现有部署继续读 `public/works/catalogue.json`。批准迁移后才设置为 `https://download.studiofimel.com/data/works.json` 并按原流程发布官网。首次 R2 读取失败会显示明确的只读回退提示；成功读取过 R2 后，网络错误保留最近成功的远端数据，绝不把下架作品从 Git 快照重新带回来。页面每分钟/重新聚焦/恢复网络重验证，支持 ETag/304。Markdown 与资源使用不可变路径，自然绕开旧缓存。

代码回滚基线 `baseline/admin-20261014` 指向 `e018113`；不对当前工作树 reset。内容回滚在 Admin 恢复公开快照。要恢复静态目录，可清空 VITE_CATALOGUE_URL 后重新构建官网；已公开下载对象保持，不与代码回滚一起删除。

## Cloudflare D1 统计准备

独立 `admin/public-api/` 实现公开点击计数，不绑定私有桶。仅统计公开且已发行的下载目标，参数绑定 SQL、同源 CORS、RateLimit；不是完成下载计数或用户去重。迁移 SQL 为 CREATE IF NOT EXISTS，不 drop 任何表。现有网易历史指标保持独立。

`VITE_ANALYTICS_URL` 未启用时保留旧 Supabase 接口兼容；D1 创建、旧统计导出/审核/导入和公开 API 域名均需生产确认，完成后再切换并停用旧 cron。不会以新库的零计数覆盖旧的真实计数。API 配置当前是未部署模板，数据库 ID 为空占位。管理员邮箱/AUD/issuer 只作为服务端 Secret 设置，示例文件不包含真实值。

## 验证与限制

执行 `npm run lint`、`npm run build`、`npm run admin:build`、`npm run admin:migration`、`npm run admin:test`、`npm run admin:test:e2e`、`npm run admin:test:public`。单元/运行时测试使用真实本地 workerd R2/D1，包含 100 MiB 和 1 GiB 分片、完整校验、公开回读；浏览器使用真实 100 MiB ZIP。模拟身份、路由拦截和本地存储不证明线上 Access、R2、CDN、免费 CPU 额度或生产域名已验收。

Admin 构建约 630 KB JS / 196 KB gzip，目前保留 chunk 提示；没有加载官网 Three.js/GSAP/自定义指针。字体的绝对路径由构建后脚本复制正确资源。部署前应在获准的隔离资源测量 CPU 时间、上传中断、Access OTP、全部可达入口以及真实 CORS/缓存。生产操作清单见 [admin-deployment-review.md](admin-deployment-review.md)。

本次实测结果、修复与未完成的线上验收见 [admin-verification.md](admin-verification.md)。
