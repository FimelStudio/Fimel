import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./e2e',outputDir:'../.artifacts/admin-e2e',workers:1,reporter:'list',use:{baseURL:'http://127.0.0.1:5174',browserName:'chromium',channel:process.platform==='win32'?'msedge':undefined,viewport:{width:1440,height:1000},trace:'retain-on-failure',actionTimeout:15000},
  webServer:[{command:'npm run admin:api',url:'http://127.0.0.1:8788/api/library',reuseExistingServer:!process.env.CI},{command:'npm run admin:dev',url:'http://127.0.0.1:5174',reuseExistingServer:!process.env.CI}],timeout:180000});
