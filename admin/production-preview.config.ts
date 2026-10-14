import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  testDir:'production-e2e', outputDir:'../.artifacts/admin-production-preview', workers:1, reporter:'list',
  use:{baseURL:'http://127.0.0.1:4177',browserName:'chromium',channel:process.platform==='win32'?'msedge':undefined},
  webServer:{command:'npx tsx scripts/admin-production-preview.ts',cwd:fileURLToPath(new URL('../',import.meta.url)),url:'http://127.0.0.1:4177',reuseExistingServer:false},
});
