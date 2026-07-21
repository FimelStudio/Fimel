import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  // 如果你的 GitHub 仓库不是根目录，需要配置 base，例如仓库名叫 Fimel，就填 '/Fimel/'
  // 如果你有自定义域名或者是在 [你的名字].github.io 根目录，这里请保持为 '/'
  base: '/Fimel/', 
  plugins: [react(), cloudflare()],
})