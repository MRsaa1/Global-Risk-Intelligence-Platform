import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5180',
    trace: 'on-first-retry',
    timeout: 15000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.CI ? undefined : {
    command: 'npm run preview',
    url: 'http://127.0.0.1:5180',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
})
