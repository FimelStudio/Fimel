# Fimel Studio

> 从方块出发，构筑可被记住的体验。
> 专注于 Minecraft 顶尖玩法构筑、互动体验、模组研发与创作者工作流工具。

---

## 🌟 项目简介

Fimel 官方网站展示了工作室自 2019 年以来的核心创作积淀，涵盖：
- **基岩版 / 网易版地图作品**：收录包括《海岛逃生：黎明前夕》、《狼人杀-F小镇》、《饥饿游戏：旧城迷行》、《通电2雪域危机》等数百万累计下载量的代表作品；
- **Java 版地图与数据包**：包含系统重构的《海岛逃生 (Java Core)》与大型叙事 RPG 企划；
- **可游玩玩法模组**：如《Bingo × Don't Do It》（Fabric 1.21.x）；
- **创作者插件与工具**：如《Minecraft OBJ Cubizer》（Blockbench 官方生态模型转换插件），并集成实时下载统计。

---

## 🛠️ 技术栈

- **核心框架**：React 19, TypeScript, Vite
- **三维渲染**：Three.js, @react-three/fiber, @react-three/drei
- **动画引擎**：Motion (Framer Motion), GSAP, ScrollTrigger, Lenis (平滑滚动)
- **样式方案**：Tailwind CSS v4
- **国际化 (i18n)**：i18next, react-i18next (支持 简体中文 / English / 日本語)
- **后端服务**：Supabase (工作物下载实时计数与持久化)
- **部署平台**：GitHub Pages (自动化 Actions) / Cloudflare Workers & Pages

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
