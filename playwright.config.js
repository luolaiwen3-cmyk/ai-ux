import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure'
  },
  webServer: [
    { command: 'node scripts/e2e-dev.mjs', url: 'http://127.0.0.1:5173', timeout: 120000, reuseExistingServer: false },
    { command: 'node test/e2e/url-target-server.mjs', url: 'http://127.0.0.1:8899/health', timeout: 30000, reuseExistingServer: false }
  ]
})

