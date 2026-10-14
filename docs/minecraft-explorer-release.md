# Minecraft Explorer 1.0 登记与验收

当前更新为 **1.0.2**，追加验收见文末。下面保留首次登记及历史验证记录，旧 SHA256 不代表当前下载。

2026-10-14：当前发行文件已逐字节上传并校验到 R2，网站使用目录中的 `downloadUrl`，文件名仍为 `MinecraftExplorer-1.0-win-x64.exe`。[R2 下载 1.0.2](https://download.studiofimel.com/works/tools/minecraft-explorer/1.0.2/MinecraftExplorer-1.0-win-x64.exe)。本地原件保留作兼容，旧记录中的本地下载方式属于迁移前状态；正式流程与当前哈希见 [R2 上传说明](r2-uploads.md) 和 [发行清单](r2-release-manifest.json)。

2026-10-12，在既有作品目录中加入 `minecraft-explorer`，分类“插件与工具”。源码入口为 [Ylong4004/Minecraft-Explorer](https://github.com/Ylong4004/Minecraft-Explorer)。应用版本及 Windows 文件版本为 1.0.0，网站下载名称按要求使用 `MinecraftExplorer-1.0-win-x64.exe`。

## 内容与文件

- `public/works/catalogue.json`：标题、三语简介、创作辅助 / 开发工具标签、Windows 平台、实际作者仓库链接、版本、体积与直接 EXE 下载路径。目录现在为 28 条，未改变原有作品。
- `public/works/minecraft-explorer/`：概述、日志、版本三个页签各有中英日正文。概述包含首次添加根目录、自动分析、搜索、备份、启动器与脚本关联、缓存位置、系统运行库和许可使用步骤。
- `public/assets/images/works/minecraft-explorer/`：原创程序图标封面及三张当前源码的原生窗口截图。截图来自生成演示数据，正文明确说明；没有公开真实用户游戏文件。
- `public/plugins/minecraft-explorer/MinecraftExplorer-1.0-win-x64.exe`：唯一的作品下载文件，普通 Release 构建，不是 ZIP 或安装器。图标及项目、依赖许可原文内置，可从关于页主动导出查看。源码、运行库安装包或测试程序不加入下载目录。

EXE 大小 **22,254,080 B（21.22 MiB）**，SHA256：`7E5B53411DA579BF99A457DC5527AC3B0795F30A9605309864B336D717BE9C59`。Windows FileVersion / ProductVersion 均为 1.0.0。与 Minecraft Explorer 普通 Release 构建逐字节一致，并单独运行通过全新缓存、图标、内置完整许可、无 UI 测试入口和正常退出检查。

## 验证

`npm run build`、`npm run lint` 通过，内容校验为 28 个作品 / 240 条精确大小写路径 / 21 份网易来源资料。完整 `npm run test:e2e` **57 项通过**，含新增四项 Explorer 回归：实际下载、单个精确文件名、完整 SHA256、MZ 文件头、工具搜索与源码入口，另覆盖中英日正文、三个截图、深浅主题和 320 px 详情页。

独立生产预览在根目录 `/` 与 GitHub Pages 子目录 `/Fimel/` 均通过下载完整 EXE、同一 SHA256、截图加载、版本页刷新与窄屏无页面溢出，两个预览没有页面异常。记录与截图在忽略的 `.artifacts/explorer-production-*` 中，测试脚本的第一次图片路径断言误将 Markdown 解析后的绝对 URL 当作相对 URL；修正断言后两个部署目录通过。

Minecraft Explorer 自身通过 **106 项集成测试**、格式、Clippy、普通 Release 构建，以及当前原生界面 8 组交互和重启回归。首次下载测试因正文与详情标题都为 H1 而出现定位歧义，已将断言限定到详情标题；没有修改产品页面来迁就测试。

更新文件时保持直接 EXE 路径，并同步版本、体积、SHA256 与正文，具体流程见 [内容维护说明](content-maintenance.md)。新作品未接入已有模组专用的 JAR 最新版本下载逻辑，也未更改 Supabase 表或计数规则。

## 1.0.1 自动识别脚本更新，2026-10-12

新增 PCL2/PCL CE 既有启动脚本的自动匹配及独立本地副本，在打开关联对话框、切换目标或点击“自动识别”时检查。只有版本与游戏目录准确匹配才会填入，已有手动输入及旧异步回执不能覆盖用户当前选择。没有匹配时提示先在原启动器启动目标一次；不生成登录参数，不直接猜测原生启动接口。

网站三语概述、日志、版本与目录更新为 1.0.1，保留用户编辑的旧更新日志。1.0 系列下载名继续使用 `MinecraftExplorer-1.0-win-x64.exe`。EXE 为 **22,299,136 B（21.27 MiB）**，Windows 文件及产品版本 1.0.1，SHA256：`986FDCBD3F5EC49DEDD02A0D62DD912EEAB048F7847C9C193A3AF22042526213`。与普通 Release 构建逐字节一致，内置许可、图标、独立缓存和正常退出检查通过。

应用本轮 6 项脚本与 3 项双语测试、格式、Clippy 及原生界面完整流程/重启回归通过。自动识别只用生成的临时脚本验收，没有执行真实 Minecraft。网站 Lint、内容与资源校验、构建和 Explorer 下载/三语/轮播/手机端专项回归通过；当前通用前端代码没有改动，1.0.0 的完整 57 项记录作为基线保留。

## 1.0.2 正式界面清理，2026-10-13

移除设置页的旧开发说明和常驻日志，真实扫描问题从底部按需查看；启动器状态与保存提示正确区分打开启动器和执行关联脚本。更新三语指南、版本、日志及三张生成演示数据的原生截图，保留 1.0 下载名与现有作品记录，没有更改网站运行配置或部署配置。

普通 EXE 为 **22,384,640 B（21.35 MiB）**，产品版本 **1.0.2**，SHA256：`EC26FA368DE51458AD1CF153D03AB0309674E5EF1CEC7B964AF0FFD836C6250E`。网站下载与应用构建逐字节一致，内置完整许可、图标、全新缓存及正常关闭通过。应用 106 项集成测试通过、另 1 项显式回收验收保持忽略；格式、Clippy、最终 3 项双语回归及两套原生窗口与重启回归通过，实际 Minecraft 启动没有计作已验收。

网站 `npm run build`、`npm run lint` 与内容/资源校验通过，Explorer 4 项端到端回归通过：实际下载的文件名、MZ 头和完整 SHA256，以及中英日指南、三张截图、320 px 页面与版本页刷新。保留之前完整网站验收作为基线，本轮仅更新该作品的内容及下载文件。
