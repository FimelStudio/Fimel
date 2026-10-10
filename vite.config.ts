import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // 如果你的 GitHub 仓库不是根目录，需要配置 base，例如仓库名叫 Fimel，就填 '/Fimel/'
  // 如果你有自定义域名或者是在 [你的名字].github.io 根目录，这里请保持为 '/'
  // Cloudflare uses the domain root; GitHub Pages supplies its project path during CI.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    // Use automatic splitting with the lazy route boundaries in App.tsx.
    // Recursive manual vendor groups had moved React's scheduler into the 3D
    // chunk, making every route load Three.js even when it contained no canvas.
  },
})
