# 项目目录规范

目录整理以资源用途为边界，不更换页面设计，也不改变 Supabase 或 Worker 业务逻辑。作品分享链接的 `slug`、现有下载地址和两种部署的资源前缀保持稳定。

## 目录分工

```text
Fimel/
├─ src/                         React 页面、组件、国际化与运行时逻辑
│  ├─ pages/                    路由页面
│  ├─ components/               共用组件与场景组件
│  ├─ hooks/                    数据和动画 Hook
│  ├─ content/                  作品类型、分类词典与共用文案
│  └─ worker.ts                 Cloudflare Worker 入口
├─ public/                      原样复制到 dist 的运行时静态资源
│  ├─ assets/
│  │  ├─ brand/                 Fimel 标识
│  │  ├─ fonts/                各字体独立目录，含本地子集及许可证
│  │  ├─ images/
│  │  │  ├─ works/<slug>/       作品封面、后续截图等展示图
│  │  │  ├─ team/               成员 Minecraft 头像
│  │  │  └─ ui/minecraft/       HUD 与界面用 Minecraft 图片
│  │  ├─ textures/minecraft/   3D 场景的方块纹理
│  │  ├─ audio/minecraft/      TNT 等交互音效
│  │  └─ icons/                共用 SVG 图标
│  ├─ works/
│  │  ├─ catalogue.json        唯一的运行时作品目录
│  │  ├─ catalogue.schema.json 目录字段与类型约束
│  │  └─ <slug>/              概述、更新日志、版本 Markdown
│  ├─ mods/                    既有 JAR 原件，旧地址兼容；新文件上传 R2
│  ├─ plugins/                 既有发行原件、Blockbench 元数据及旧地址兼容
│  └─ robots.txt               站点爬虫规则
├─ content-sources/netease/     内容来源 JSON 快照，不作为静态资源部署
├─ scripts/                    内容校验、下载分片与冒烟检查
├─ tests/                      Playwright 浏览器回归测试
├─ docs/                       维护和验证文档
│  └─ archive/                 不参与运行的旧代码和模板素材
├─ supabase/migrations/        已有数据库迁移
└─ .artifacts/                 被 Git 忽略的本机检查产物
```

`dist/`、`node_modules/`、Playwright 报告和构建缓存由工具生成，不手工维护，也不作为网站内容来源。

## 图片、音效和图标

- 工作室标识：`public/assets/brand/fimel-logo.svg` 为从现有图形轮廓描摹的导航矢量版；`fimel-logo.png` 保留原图，用于备用显示、favicon 和分享预览。
- 导航字标字体：`public/assets/fonts/minecraft-seven/minecraft-seven-latin.woff`，仅含可打印 ASCII；同目录保留来源说明及 `OFL.txt`，不使用外部字体 CDN。旧 `monocraft/` 保留但不再加载。
- 作品封面：`public/assets/images/works/<slug>/cover.<扩展名>`；商店展示图放在同一作品目录，按原顺序使用 `gallery-01.webp`、`gallery-02.webp` 等文件名，不新增散放的截图目录。
- 团队头像：`public/assets/images/team/<原文件名>.png`，保留原始像素图，不用其他成员的图作占位。
- 游戏界面图：`public/assets/images/ui/minecraft/`；3D 材质则放在 `public/assets/textures/minecraft/`，两者不要混放。
- Minecraft 交互音效：`public/assets/audio/minecraft/`。
- 共用社会平台 SVG 图标：`public/assets/icons/social.svg`。

重命名或移动资源必须同步目录 JSON、页面、3D 加载代码、HTML 元信息和测试引用。不能只调整文件管理器里的目录。没有正式封面的作品使用明确的临时封面或现有材质占位，不能挪用其他项目封面；补入正式素材时同时修改 `catalogue.json` 的 `image`。

## 正文与来源快照

正文统一按作品 `slug` 放在 `public/works/<slug>/`。新增文件优先采用 `description.zh.md`、`changelog.zh.md`、`versions.zh.md`；英文和日文分别使用 `.en.md`、`.ja.md`。部分现有日志及版本页保留 `changelog.md`、`versions.md` 文件名，真实读取路径以 `catalogue.json` 的 `content` 字段为准，不要仅因文档中的命名建议更改已经引用的文件名。

网易概述原来混放在 `public/content/netease/`，现在统一为 `public/works/<slug>/description.zh.md`。旧城迷行真实 v2.0 日志位于 `public/works/hunger-games-old-city/changelog.zh.md`。原始商店 JSON 快照统一为 `content-sources/netease/<slug>.json`，这些文件用于追溯、核对和维护，不由 Vite 静态复制到部署资源中。公开商店来源并不需要在每次浏览时重新请求。

商店展示图也以作品为边界：各作品概述使用 `../../assets/images/works/<slug>/gallery-01.webp` 这类相对路径；连续图片行之间不留空行即可形成画廊，完整写法见 [内容维护说明](./content-maintenance.md#添加作品图片轮播)。单张不显示切换按钮，多张支持按钮、键盘和原生触控滑动，不自动播放；只在画廊接近视区后加载当前及相邻图片，不让首页承担所有详情媒体请求。

来源 JSON 的 `gallery` 对象记录图片取得日期、来源字段、每张图的来源地址、`sourceKind`、本地路径、尺寸与字节数、原文件 SHA-256 和失败记录。来源快照不是需要放进 `public/` 的浏览器配置，也不是可删除的构建缓存；它保留原说明、署名、版本边界和媒体来源证据，方便以后核实或修订。网站只使用目录、Markdown 和本地图片；原图备份及临时抓取产物留在 `.artifacts/`，不要再复制进公开资源。

`docs/archive/oldApp.txt` 保留原页面代码供核对，不参与构建。未使用的 Vite 模板图标存放在 `docs/archive/vite/favicon.svg`，不再散放在公开资源根目录。存档不是新页面或需要继续加载的资源。

## 五类作品

| `type` | 目录分类 | 链接筛选 |
| --- | --- | --- |
| `bedrock` | 网易基岩版地图 | `#/works?type=bedrock` |
| `java` | Java 版地图 | `#/works?type=java` |
| `datapacks` | 数据包 | `#/works?type=datapacks` |
| `tools` | 插件与工具 | `#/works?type=tools` |
| `mods` | 模组 | `#/works?type=mods` |

类型同时受 `src/content/projects.ts` 和 `public/works/catalogue.schema.json` 约束。新增或改名类型需要同步类型注册、三语分类名称、校验、页面链接与回归测试；不要只改某一处按钮文字。玩法标签独立维护在 `src/content/project-tags.json`，不是从简介截取的词句。

Fimel Card 使用 `slug: fimel-card`、`type: datapacks`、`status: development`，详情地址为 `#/works/fimel-card`。Java 版地图仍使用 `java`，原分享链接与筛选链接无需改动。网易音乐制作命令包仍归 `bedrock`，保留已确认的平台分发逻辑。

## 稳定分发路径的例外

`public/mods/bingo-but-dont-do-it-1.21.11-v1.0.jar` 和 `public/plugins/` 中的三个正式发行原件已上传 R2，网站优先使用目录的 `downloadUrl`。本次原件暂不删除，旧本地字段保留作历史地址兼容；新文件放在仓库外并上传 R2，不继续扩大 `public/` 的发行文件体积。

`scripts/prepare-bingo-download.mjs` 是保留原构建命令的兼容入口，实际调用 `prepare-r2-downloads.mjs` 生成 `dist/downloads/r2-redirects.json` 及 `.assetsignore`，不再生成 JAR 分片。Cloudflare 的三个旧下载路径由现有 Worker 跳转 R2；GitHub Pages 仍保留旧静态文件，新页面在两种部署中都下载 R2 文件。Supabase 业务不变。详细流程及哈希见 [R2 上传说明](r2-uploads.md)。

插件自身目录中的 README、安装说明与 JavaScript 是发行配套内容，不重复当作独立作品上传，也不更改 Blockbench 元数据入口。网站详情正文仍在 `public/works/minecraft-obj-cubizer/`，不要因上传本体删除源码或说明文件。

## 部署路径与检查

JSON 中的资源路径相对于 `public/`，例如 `assets/images/works/my-map/cover.png`，不要加 `public/`、驱动器路径、域名根目录 `/` 或硬编码 `/Fimel/`。组件通过 `BASE_URL` 或现有资源工具拼接部署前缀。Markdown 图片优先使用相对于正文文件的路径，例如 `../../assets/images/works/my-map/cover.png`。

Cloudflare 根域名与 GitHub Pages 的 `/Fimel/` 子目录都需要检查。HashRouter 仍用于深链接与刷新，目录整理不把哈希地址改成需要服务器回退的新路由。

建议依次检查：

1. `npm run check:content`：依次运行 `scripts/validate-content.mjs` 与 `scripts/validate-assets.mjs`，检查目录字段和标签、运行时类型与 JSON Schema 一致性、封面和正文路径实际大小写、源码资源引用、Markdown 相对媒体链接及来源快照的本地资源路径。
2. `npm run build`、`npm run lint`：生产构建与代码检查。
3. `npm run test:e2e`：分类、详情、主题、语言、手机、头像与装饰场景降级。
4. 生产预览中检查首页、五类作品、详情三个页签和浏览器刷新；根路径及 `/Fimel/` 都应可读取资源。
5. 检查网站下载按钮与现有插件文件地址；不得为检查而发布到 Cloudflare 或 GitHub Pages。

文档中的历史验证成绩不代表本次目录移动已经通过检查。当前实际检查结果单独追加到 [前端验证记录](./frontend-verification.md)，不覆盖过去的作品数量、测试数或 Lighthouse 数值。

资源路径检查特意逐级比较实际文件名，而不是仅使用文件存在判断，避免在 Windows 预览正常、部署到大小写敏感环境却 404。`public/` 根目录只允许 `assets`、`works`、`mods`、`plugins` 和 `robots.txt`；以后新增特殊入口应先确认用途和部署需求，再调整规则，不能随手放入并跳过构建校验。
