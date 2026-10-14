# R2 作品发行文件上传

这是本机维护脚本，不是网页后台。沿用已有 rclone remote `fimel-r2`、R2 桶 `fimel-downloads` 和公开域名 `https://download.studiofimel.com`。不引入数据库或额外后端；GitHub Pages 继续正常构建网站，发行文件通过独立的 R2 域名下载。现有 Cloudflare Worker 仅为三个旧下载路径提供 R2 跳转，Supabase 定时保活不变。

## 使用前提

- Windows PowerShell 5.1 或 PowerShell 7。
- 已安装并配置 rclone。脚本先查 PATH，再查 `%LOCALAPPDATA%\Programs\rclone\rclone.exe`；其他位置用 `-RclonePath` 指定。
- `fimel-r2` 有目标桶的读取与对象上传权限。配置文件留在用户目录，不复制进仓库。不要使用 `rclone config show`、`config dump`、`--dump auth` 或把密钥写入命令。
- 支持 ZIP、JAR、EXE、MCWORLD、MCPACK、MCTEMPLATE，大小为 1 字节至 1 GiB（1,073,741,824 字节），包括 100 MB～1 GB 的发行包，也包括较小插件。ZIP/JAR/地图包检查归档是否可读，EXE 检查 PE 格式但不执行。新发行文件放在项目目录之外，不放 `public/` 或提交 Git。

主入口是 `scripts/upload-r2.ps1`，实现与安全校验在 `scripts/R2Upload.psm1`。

## 路径规则

```text
works/{WorkType}/{WorkId}/{Version}/{发行文件名}
```

`WorkType` 与网站目录一致，只允许 `bedrock`、`java`、`datapacks`、`tools`、`mods`。`WorkId` 使用目录中的小写 slug，不使用中文标题；版本必须是单一安全路径片段，如 `1.0.0`、`1.0.0-beta.1`，不能是 `../1` 或绝对路径。文件名可包含空格与中文，下载 URL 按路径片段编码。不重新压缩已有 EXE/JAR，不改动发行文件内容。

## 先预检查，再确认上传

在项目根目录运行，替换示例文件路径与作品信息：

```powershell
.\scripts\upload-r2.ps1 `
  -FilePath 'D:\Releases\my-map-1.0.0.zip' `
  -WorkType java `
  -WorkId my-map `
  -Version 1.0.0 `
  -WhatIf
```

`-WhatIf` 会检查本地发行文件、桶连通性和目标是否存在，只读，不上传。随后去掉 `-WhatIf`：

```powershell
.\scripts\upload-r2.ps1 `
  -FilePath 'D:\Releases\my-map-1.0.0.zip' `
  -WorkType java `
  -WorkId my-map `
  -Version 1.0.0
```

默认会提示是否上传，确认后才发送文件。没有 `-Force`、`-Overwrite` 或删除选项；目标即使与本地内容完全相同，也直接拒绝。发现同名目标时使用新版本号或新文件名，不自行删除、覆盖原对象。`-Confirm:$false` 是 PowerShell 通用参数，仅在操作者明确批准该次上传后使用；不是代理擅自上传正式作品的许可。

## 进度、重试与校验

- 单文件 `copyto`，每 2 秒显示进度。不是 `sync`、`move` 或 `purge`。
- 默认 3 次高层重试、10 次底层请求重试，高层重试间隔 5 秒；可用 `-Retries 1..10` 调整。
- 超过 32 MiB 使用 multipart，16 MiB 分块、4 块并发，块缓冲约 64 MiB。无需把整个 1 GiB ZIP 读进内存。
- 上传前两次检查目标（确认后再次检查），同时使用 `--immutable` 与 `--ignore-existing`。权限/网络/JSON 错误一律停止，不当成目标不存在。
- 使用本机命名互斥锁，防止本脚本在同一机器并行写相同 key；源文件保持只读共享锁，防止上传过程中被修改。
- 校验远端大小和 MD5。rclone 会为 multipart 上传保留校验元数据；不把 multipart ETag 当作文件 MD5。
- `-FullVerification` 额外完整下载远端对象并流式计算 SHA-256。远端没有 MD5 时也会自动使用此方式。这会增加一次完整下载和等待时间，不落地远端副本。
- 哈希不符、无法回读或传输失败，不输出成功下载结果；保留远端对象供人工核查，不自动删除或覆盖。重新运行前先确认远端状态。
- 新对象上传时设置 `Content-Disposition: attachment`、对应 MIME 类型及一年不可变缓存。版本路径不可覆盖，浏览器可直接下载跨域文件，无需让网页读取 R2 凭据或修改 CORS。
- 脚本使用 `--s3-provider Cloudflare`，仅对该次命令生效；不修改已有 rclone 配置。`--s3-no-check-bucket` 避免上传阶段自动创建桶。

注意：预检查和 rclone 不可覆盖保护不是跨机器的服务器端原子锁。不要在网页后台、其他机器或其他上传工具同时写同一 key；为每次发布分配独立版本路径。如果需要抵御其他写入者竞争的严格原子创建，需要支持条件写入的上传实现，不能把本脚本描述成这种保证。

确认成功后脚本输出 HTTPS 地址，并返回对象：`Uploaded`、`Key`、`Size`、`MD5`、`SHA256`、`Verification`、`DownloadUrl`、`CompletedUtc`。它不自动修改作品 JSON，也不会在上传时部署网站。

## 接入作品下载链接

正式文件经确认上传后，把返回的 `DownloadUrl` 填入 `public/works/catalogue.json` 对应作品的 **`downloadUrl`** 字段，并按实际发行信息维护版本及 Markdown 版本页。`downloadUrl` 优先于旧 `download` 和 `latestReleaseRepo`；Bingo 现在也直接下载已校验的 R2 文件，不再在每次点击时寻找 GitHub 最新版。GitHub Releases 继续保留作为发行记录。新作品不填写旧的本地 `download` 路径。

不需要新增前端环境变量或让浏览器持有 R2 密钥。本站 GitHub Pages / Cloudflare 两种部署都可链接到同一个下载域名。只有已发布作品可填写 `downloadUrl`，地址必须与项目 type、slug、版本、文件名对应。

```json
{
  "downloadUrl": "https://download.studiofimel.com/works/java/my-map/1.0.0/my-map-1.0.0.zip"
}
```

这是字段示例，不要替换整条项目记录。接入后运行 `npm run build`，再检查下载按钮。上传和更新网站是两个步骤，脚本不会自动提交或部署。

### 旧地址兼容与构建

此次没有删除三个本地发行原件，目录中旧 `download` / `fallbackDownload` 留作兼容路径。`scripts/prepare-r2-downloads.mjs` 从目录生成 `dist/downloads/r2-redirects.json` 和 `.assetsignore`；原构建命令仍通过 `prepare-bingo-download.mjs` 兼容入口调用它，不再生成 Bingo 二进制分片。

- Cloudflare：Wrangler 不上传这三个旧发行文件；现有 Worker 对其原始 GET/HEAD 地址返回 302，指向 R2。
- GitHub Pages：部署方式不变，旧发行原件仍随静态构建提供，新页面统一使用 R2。不能把它描述成 GitHub Pages 已支持服务器 302。
- 没有更改现有插件源码及 Blockbench 元数据入口，也没有修改下载统计、定时保活或账户配置。
- 后续新文件仅上传 R2，不需要再添加本地兼容入口或分片逻辑。维护新版时用新版本路径，确认上传与公开下载校验后更新 `downloadUrl` 及版本正文。

## 回归测试

```powershell
.\scripts\test-r2-upload.ps1
```

测试使用内存中的 rclone 替身，不联网、不读取配置；覆盖路径安全、大小边界、ZIP 格式、已有对象拒绝、权限失败、WhatIf、重试参数、multipart 参数、MD5/SHA-256 不匹配与回读降级。测试素材仅为 `tests/fixtures/r2-upload/smoke.txt`，本机 ZIP 生成在 Git 忽略的 `.artifacts/`。

联网小文件测试需加 `-SmokeTest`，只允许 `r2-smoke-*` 作品 ID 和不超过 1 MiB 的 ZIP。测试对象保留在远端，清理也必须另行明确确认。不要把正式作品改名为测试 ID 来绕过发行确认流程。

### 本次实际验证（2026-10-14）

- Windows PowerShell 5.1，rclone 1.75.2，已有 remote 与目标桶可读；配置仍位于用户 AppData 目录，不在项目中。
- 13 项离线回归通过，包含 100 MB/1 GiB 边界检查（未生成或上传这两种大文件）。
- 实际只上传一个 208 字节的测试 ZIP：`works/tools/r2-smoke-uploader/2026.10.14-e11993e9/fimel 上传测试.zip`。
- 大小、MD5、完整流式回读 SHA-256 均通过；从公开 HTTPS 域名下载的副本也与源 ZIP 的 SHA-256 一致。
- 重复上传同一对象被上传前检查拒绝，没有覆盖。测试对象保留，未删除；没有上传任何正式作品。
- `npm run build`、PowerShell 语法解析和 `git diff --check` 通过。没有改动 R2 配置、GitHub Pages 部署、Supabase、网站作品 JSON 或页面，也没有把凭据写入仓库。

### 正式迁移（2026-10-14，用户已授权）

以下三个本体均已上传，远端完整回读与公开 HTTPS 完整下载均通过大小和 SHA-256 校验。正式记录及哈希保存在 [r2-release-manifest.json](r2-release-manifest.json)。没有覆盖或删除远程对象，早先的 smoke 对象仍保留。

| 作品 | 发行版本 | 文件字节数 | 下载 |
| --- | --- | --- | --- |
| Minecraft OBJ Cubizer | 1.4.0 | 53,731 | [ZIP](https://download.studiofimel.com/works/tools/minecraft-obj-cubizer/1.4.0/minecraft_obj_cubizer-1.4.0.zip) |
| Minecraft Explorer | 1.0.2 | 22,384,640 | [EXE](https://download.studiofimel.com/works/tools/minecraft-explorer/1.0.2/MinecraftExplorer-1.0-win-x64.exe) |
| Bingo But Don't Do It | 1.0 | 59,689,247 | [JAR](https://download.studiofimel.com/works/mods/bingo-but-dont-do-it/1.21.11-v1.0/bingo-but-dont-do-it-1.21.11-v1.0.jar) |

Explorer 的版本目录为 `1.0.2`，稳定文件名仍为 `MinecraftExplorer-1.0-win-x64.exe`。Bingo 按用户要求使用 `1.21.11-v1.0` 作为版本目录，区分 Minecraft 兼容版本与发行版本；网站展示标签仍为 `1.0`，内嵌 mod 版本为 `0.10.0+mc1.21.11`，本次没有修改或重新打包它。最初上传的 `1.0` 路径原件保留，不擅自删除；新目录通过服务器端复制创建，完整回读哈希一致。

两个 Java 地图与 Fimel Card 未发布，网易地图没有本地本体，不能据此生成虚构下载。

官方依据：[copyto](https://rclone.org/commands/rclone_copyto/)、[不可修改保护](https://rclone.org/docs/#immutable)、[S3 multipart、哈希与 HTTP 元数据](https://rclone.org/s3/)、[流式哈希校验](https://rclone.org/commands/rclone_hashsum/)。
