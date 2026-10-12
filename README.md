# Fimel Studio

> 从方块出发，构筑可被记住的体验。
> 专注于 Minecraft 顶尖玩法构筑、互动体验、模组研发与创作者工作流工具。

---

## 🌟 项目简介

Fimel 官方网站展示工作室的地图、数据包、模组和创作者工具。作品目录分为五个独立分类：

- **基岩版 / 网易版地图作品**：收录包括《海岛逃生：黎明前夕》、《狼人杀-F小镇》、《饥饿游戏：旧城迷行》、《通电2雪域危机》等数百万累计下载量的代表作品；
- **Java 版地图**：两个制作中的 Java 地图项目；
- **数据包**：新增《Fimel Card 卡牌桌游数据包》，暂未发布，项目入口为 [FimelStudio/fimelcard-dp](https://github.com/FimelStudio/fimelcard-dp)；
- **模组**：如已发布的《Bingo But Don't Do It》；
- **插件与工具**：如《Minecraft OBJ Cubizer》与《Minecraft Explorer》；Explorer 提供单文件 Windows EXE、使用教程、界面截图和源码入口。

作品目录目前为 28 条，其中网易分类为 21 条。音乐制作命令包按工作室要求保留在网易分类，不因数据包分类拆分而迁移。Fimel Card 仓库目前无法公开读取，因此网站仅展示已确认的信息，不补造规则、版本或下载入口。

---

## 🛠️ 技术栈

- **核心框架**：React 19, TypeScript, Vite
- **三维渲染**：Three.js, @react-three/fiber, @react-three/drei
- **动画引擎**：Motion (Framer Motion), GSAP, ScrollTrigger, Lenis (平滑滚动)
- **样式方案**：Tailwind CSS v4
- **国际化 (i18n)**：i18next, react-i18next (支持 简体中文 / English / 日本語)
- **后端服务**：Supabase (工作物下载实时计数与持久化)
- **部署平台**：GitHub Pages（自动化 Actions）/ Cloudflare Workers

---

## 🚀 本地开发与构建

### 1. 安装依赖

```bash
npm install
```

### 2. 环境变量配置（可选）

如需启用 Supabase 下载量统计功能，请在根目录创建 `.env` 文件（参考 `.env.example`）：

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

> **注意**：即使未配置 Supabase 环境变量，网站所有功能均会自动降级展示，完全不影响核心页面的浏览与交互。

### 3. 本地启动

```bash
npm run dev
```

### 4. 代码规范检查

```bash
npm run lint
```

### 5. 生产打包构建

```bash
npm run build
```

构建会先运行 `npm run check:content`，依次执行内容与静态资源校验脚本，检查作品类型和 JSON Schema 一致性、分类标签、资源路径实际大小写及 Markdown 链接，再生成生产资源与 Bingo 本地备用下载分片。也可以单独运行该检查命令。浏览器回归测试运行 `npm run test:e2e`。

## 内容与目录维护

- [内容维护说明](docs/content-maintenance.md)：主页文案位置、五类作品、JSON 字段、Markdown、下载与新增作品步骤。
- [项目目录规范](docs/project-structure.md)：静态图片、纹理、音效、团队头像、内容来源和稳定下载路径。
- [网易内容来源](docs/netease-content-sources.md)：原商店说明、作者署名、封面与历史数据边界。
- [前端验证记录](docs/frontend-verification.md)：按阶段记录的构建、部署、浏览器及性能检查。

`public/` 仅存放要部署的网站资源；来源快照放在 `content-sources/`，旧页面存档放在 `docs/archive/`。作品封面统一放在 `public/assets/images/works/<slug>/`，正文统一放在 `public/works/<slug>/`。已有 `public/mods/` 与 `public/plugins/` 下载入口有意保持不变，避免破坏外部链接。

---

## 📦 部署说明

### GitHub Pages (默认 CI/CD)
本项目已预置 GitHub Actions 自动化部署工作流（位于 `.github/workflows/deploy.yml`）。推送到 `main` 或 `master` 分支即可自动触发构建与发布。如配置了 Supabase 密钥，请在仓库 Settings -> Secrets and variables -> Actions 中添加相应的 Repository Secrets。

### Cloudflare Workers
项目根目录包含 `wrangler.jsonc` 及 `src/worker.ts`，支持一键部署到 Cloudflare，同时提供定时 Cron 任务（防止免费 Supabase 实例休眠）。

```bash
npx wrangler deploy
```

---

## 📄 版权声明

© 2019-2026 FIMEL STUDIO. ALL RIGHTS RESERVED.
