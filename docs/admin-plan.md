# Admin 开发基线与实施计划

2026-10-14，代码基线 `e018113`，保留分支 `baseline/admin-20261014`，开发分支 `feat/fimel-admin`。用户两份任务文档不修改、不提交。基线 content/lint/build 均通过。回滚时切回基线分支，不对当前工作树执行 reset；R2 数据不随 Git 回滚。

## 核实结果

交接说明的 28 条 catalogue、241 个路径、21 份来源、HashRouter、三语、主题 token、R2 下载优先和 GitHub Pages 工作流与实际一致。Supabase 客户端/cron 仍存在，交接中的“以后不再用”是后续要求。README 关于 Bingo 分片的文字已经过时，实际构建只生成跳转映射。

## 架构与目录

- `admin/` 独立 Vite 入口、React 表单、原生滚动，复用 `src/index.css`、Geist、品牌字体和 logo。不进入官网路由或构建入口。
- `admin/shared/` JSON Schema/AJV 校验和可扩展私有作品/版本模型。完整保留现有 Project 字段和三语，workflow 与作品发行 status 分离。
- `admin/worker/` 同源 API，Access 身份验证、Origin/CSRF 校验，R2 私有库条件更新。生产入口不包含本地身份模拟。
- 私有库 `state/library.json` 保存草稿；全库 ETag 防止多人覆盖。备份、上传会话和审核记录仅在私有桶。
- 发布先验证并复制资源、写不可变 Markdown/公开快照和私有恢复快照，最后 CAS 更新 `data/works.json`。manifest 是公开发布事实来源；没有跨桶事务，不伪称原子多对象写入。
- Multipart 16 MiB/分片，经 Access Worker 有界缓冲校验后写私有 R2，不使用 S3 密钥。浏览器后台线程计算完整 SHA-256，完成后通过 R2 条件写入+sha256 校验流式复制到私有 verified 对象。发布时再校验，绝不相信前端完成通知。限定 1 GiB、会话期限、对象范围和不可变随机 key。
- `scripts/admin-migration.ts` 仅生成本地预览，解析 i18n 指针为真实三语并记录原值。官网 hook 增加显式启用的 R2 接口和重验证，默认仍读当前 catalogue。
- Cloudflare D1 点击统计作为独立公开 API 接入，数据库迁移和启用均保留为生产确认步骤。

## 顺序与验收

1. 独立前端/Worker、列表编辑、草稿、发布预览、新建/复制/下架/恢复、条件更新。
2. 图片、多版本、多文件、真实 multipart、取消/重试/续传/清理、大小与哈希校验。
3. JSON 导入导出、差异、备份恢复、审计、迁移预览、官网数据适配和缓存。
4. 构建/类型/lint、真实本地 R2 runtime 测试、权限和并发/失败测试、浏览器闭环和官网回归、根路径与 GitHub Pages 子目录构建。
5. 提交可审阅的部署/迁移清单后统一请求生产确认。私有桶、Worker、Access、DNS、D1、CORS/缓存和真实对象写入此时均不执行。

## API 约定

2026-10-14 追加：首批独立 Admin 已上线，正式内容迁移与官网切换仍待授权。管理员操作日志和 Cloudflare 域名统计页面已开发；日志写私有 R2，记录验证过的操作者标识和字段差异。统计只用服务端限定查询读取 Cloudflare，新增只读凭据需单独确认。用户要求的窗口自适应和右上角用户名已通过生产 CSP 浏览器验收，用户集中确认后发布至现有 Worker；统计连接仍未启用。

`GET /api/session`；`GET/PUT /api/library`（If-Match）；`POST /api/publish/:id`；`POST /api/unpublish/:id`（If-Match 与 X-Public-ETag）；`GET /api/history`；`POST /api/restore/:snapshot`；`POST /api/uploads`；`GET/DELETE /api/uploads/:id`；`PUT /api/uploads/:id/parts/:number`；`POST /api/uploads/:id/complete`；`GET /api/media/:id`。所有管理路由和静态文件先鉴权。错误包括 401/403、404、405、409、413、422、428，客户端明确显示。

生产白名单、Access AUD/issuer 用 Secret；无默认管理员。静态资源内部路由可能不传递 ctx.access，因此验证 Access JWT（签名/issuer/aud/有效期），不信任 email Header。ctx.access 可用时验证 aud 与身份。workers.dev/preview 默认禁用，仍要求 Worker 级 Access。
