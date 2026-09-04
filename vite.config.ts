import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // 如果你的 GitHub 仓库不是根目录，需要配置 base，例如仓库名叫 Fimel，就填 '/Fimel/'
  // 如果你有自定义域名或者是在 [你的名字].github.io 根目录，这里请保持为 '/'
  base: '/',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three') || id.includes('@react-three')) {
              return 'vendor-three';
            }
            if (id.includes('motion') || id.includes('gsap') || id.includes('lenis')) {
              return 'vendor-motion';
            }
            if (id.includes('lucide-react') || id.includes('i18next')) {
              return 'vendor-ui';
            }
          }
        },
      },
    },
  },
})
