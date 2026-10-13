import { defineConfig } from '@playwright/test'

// Servers are started and stopped by scripts/e2e-servers.sh, not by Playwright (T#4 contract).
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:14173',
    browserName: 'chromium',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    { name: 'e2e', testIgnore: '**/screens/**' },
    { name: 'screens', testMatch: 'screens/*.spec.ts' },
  ],
})
