# 首页精选与字标调整（2026-10-14）

## 范围与设计判断

这是面向 Minecraft 玩家和创作者的保留式优化，沿用现有 React/Tailwind、Logo、青色品牌、明暗主题、3D 首屏、Cube 与鼠标/HUD 交互，不重做整体视觉。设计尺度：DESIGN_VARIANCE 6、MOTION_INTENSITY 6（沿用原交互；字标新增效果仅为 180ms 状态反馈）、VISUAL_DENSITY 4。

Animated Java 文档的导航字标实际使用 `MinecraftFull`，标题使用 `MinecraftTen`。导航字体文件的内置说明为 “All rights reserved”，所以改用 Mojang 开源主题仓库随 OFL 提供的 Minecraft Seven；不是再次用 Monocraft，也不宣称与参考站是同一个字体文件。

## 精选逻辑

- 已发布地图保留主展示位置：海岛逃生、紫晶幻域、中庭决战；选取依据为玩法差异与已有素材，不按下载量排名。原狼人杀-F小镇继续保留在完整作品库。
- Minecraft Explorer（目录当前版本 1.0.2）、OBJ Cubizer、Bingo 同组展示已发布软件，但每张卡片标注其正确作品类型，Bingo 不归入插件与工具。
- Fimel Card、RPG 与 Java 海岛逃生放在制作中分组，不提供虚构下载。
- 文案、状态、封面与历史数据读取唯一运行时目录；只在 `src/content/home-featured.ts` 维护选择和顺序。
- 保留图片 Hover、地图视差标记与 Minecraft 工具提示。新品卡片采用自己的封面，不复用地图背景。目录请求独立于首屏渲染，复用作品页缓存，图片按需加载。

## 地址中的 #

当前 `src/App.tsx` 使用 HashRouter，`#/works` 的片段由浏览器路由解析，服务器只接收 `/`。因此静态托管不必为每一个子路径配置回退。

Cloudflare 的 `assets.not_found_handling: single-page-application` 已具备无 hash 路由的部署前提，但 GitHub Pages 子目录、原有 hash 分享链接、详情页返回状态和相关测试仍需要迁移处理。此次没有修改 URL 或部署配置。

官方资料：

- https://reactrouter.com/api/declarative-routers/HashRouter
- https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/

## 验证

- `npm run build`、`npm run lint`、`git diff --check` 通过。内容校验仍为 28 个作品、241 个精确大小写路径、21 份商店来源快照。
- 完整 Playwright：75 项通过，包含三语言导航、320–1440px 明暗主题、渐变悬停/焦点、减少动态效果、强制对比度、字体/Logo 加载失败、首页目录延迟与重试、路由快速切换、3D 降级及原有内容回归。
- 根目录与 `/Fimel/` 的生产预览冒烟检查通过：新字体正常加载且无重复初始请求、SVG 解码、首页精选九个详情链接、作品分类、63 张作品截图、原有下载、刷新与手机无横向溢出；无浏览器运行时错误。
- 已实际查看桌面地图/软件/制作中分组、手机与明暗主题、导航悬停截图。
- 本机移动端 Lighthouse 默认动效首页：Performance 76、Accessibility 100、Best Practices 100、SEO 100；LCP 约 4.81s、CLS 0.0022，无运行时错误或运行警告。仅为一次实验室测量，不是线上 Core Web Vitals，也不是同条件前后对比。首屏动画及 Three.js 仍影响 LCP/主线程；本次没有承诺或实施整站性能重构。报告另有语言按钮标签匹配、缺少 source map 等诊断，分数 100 不等于逐项不存在问题。
- 新字体 WOFF 3,100 字节，保留现有 Logo 图形。原始 PNG 未改动；没有改动用户预先编辑的目录记录，没有提交或部署。
