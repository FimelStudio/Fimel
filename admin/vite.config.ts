import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ root: 'admin', publicDir: false, cacheDir: '../node_modules/.vite-admin', plugins: [react()],
  optimizeDeps: { include: ['@noble/hashes/sha2.js', '@noble/hashes/utils.js'] },
  server: { host: '127.0.0.1', port: 5174, strictPort: true, fs: { allow: ['..'] }, proxy: { '/api': 'http://127.0.0.1:8788', '/assets/brand': 'http://127.0.0.1:8788', '/assets/fonts': 'http://127.0.0.1:8788' } },
  build: { outDir: 'dist', emptyOutDir: true },
});
