# 后台真实域名统计接入

现有 `fimel-admin` 的 `/api/analytics` 已接通真实数据，仅展示 `studiofimel.com`、`www.studiofimel.com`、`download.studiofimel.com` 和 `admin.studiofimel.com` 的聚合数据。用户在控制台创建只读 Token 并通过本机脚本验证；2026-10-15 00:45 激活 Secret 版本 `16896dc1-1655-4a1c-8129-7e7a345115cd`。真实登录浏览器的 7 天查询已返回 200，后续后台版本保留两项分析 Secrets。下面的设置步骤也供到期轮换使用；不必重复创建 Token。

## 本次变更范围

- 新建专用 Token `Fimel Admin Analytics`，权限选择 **Zone → Analytics → Read**，资源选择 **Include → Specific zone → studiofimel.com**。只选这一项权限，不添加 DNS、Workers、R2、Token 管理或写权限。建议有效期 90 天，届时轮换。
- 在现有 `fimel-admin` 添加 `CF_ANALYTICS_TOKEN`、`CF_ANALYTICS_ZONE` 两个服务端 Secrets。Token 不进浏览器、源码、命令参数或本地凭据文件。
- 本地脚本先用 Token 验证当前域名的真实只读 GraphQL 查询，再通过 stdin 暂存 Secret 版本；由 Codex 核对版本及绑定后激活。本次不改官网、Access、DNS、正式作品内容或存储绑定。
- 本轮同时发布已验收的后台代码：官网 28 个作品的追加导入预览、上传期间导航保护、恢复记录的字段差异。导入按钮只生成编辑区预览，用户仍需点击保存，保存前自动备份。

根据最初开发任务书，这涉及新增凭据及生产 Worker 设置，执行前需要用户明确确认。

## 当前能力核实

Cloudflare MCP 的账号 Token 列表及账号/用户权限组接口返回 `9109 Unauthorized`。不扩大 MCP/OAuth 权限，也不申请 Token 管理或全局 API Key。创建专用 Token 需要账号所有者在 Cloudflare 控制台完成。Zone Analytics Read 的官方模板见 [API Token templates](https://developers.cloudflare.com/fundamentals/api/reference/template/)。

Cloudflare 新增的 [Analytics SQL binding](https://developers.cloudflare.com/analytics/sql-api/workers-binding/) 可避免 Token，但绑定权限是账号范围，当前 MCP SQL 发现接口无法提供可核验的结果。此轮延续已通过真实只读查询的 GraphQL 方案，不把未验证的新绑定作为上线前提。

## 用户确认后执行

1. 打开 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)，创建自定义 Token，按上述权限和资源检查摘要后创建。若使用账号 Token，也必须只授予该域名的 Analytics Read。
2. 在项目 PowerShell 运行：

   ```powershell
   .\scripts\admin-analytics-setup.ps1 -StageSecretVersion
   ```

   脚本以隐藏输入读取 Token，先验证只读查询，再暂存 Secret 版本。不要把 Token 粘贴到聊天、命令行参数或 `.env` 中。

   如果终端的隐藏输入无法粘贴，在 Cloudflare 的 Token 创建完成页点击复制后，改为运行：

   ```powershell
   .\scripts\admin-analytics-setup.ps1 -StageSecretVersion -FromClipboard
   ```

   这个选项仅由用户在本机运行时读取剪贴板，不显示或保存其内容。Token 仅在创建完成页显示一次；列表里的名称、ID 或遮蔽星号不是 Token。如果已离开完成页且没有保存，需要在该专用 Token 的菜单中 Roll／重新生成，再复制新的完整 Token。参见 [Cloudflare 创建 Token 说明](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)。
3. 只向 Codex 提供成功提示与版本 ID。Codex 检查新版本保留身份 Secrets、R2 绑定、Access 和域名，再激活并验证统计页面。配置失败时保留原线上版本，不把模拟数据当作真实统计。

不带参数运行脚本仅显示配置范围，不请求凭据或修改云端。

## 数据含义

日期按 UTC 日，最多缓存 5 分钟；可选择 1、7、30 天。访问次数使用 Cloudflare visits，独立 IP 是整个域名区域的每日去重值，包含子域名，不能当成某一个子域名的用户人数或跨天相加。下载统计是成功的文件 GET 请求（200/206），包含 Range、重试与续传，不代表完整下载人数。原有下载点击计数和 Supabase/D1 迁移仍是另一项工作。
