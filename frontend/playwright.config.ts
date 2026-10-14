import { defineConfig } from '@playwright/test'

// Servers are started and stopped by scripts/e2e-servers.sh, not by Playwright (T#4 contract).
export default defineConfig({
  testDir: './e2e',
  // T#6: wait until the seeded demo accounts can log in.
  globalSetup: './e2e/global-setup.ts',
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:14173',
    browserName: 'chromium',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    { name: 'e2e', testIgnore: ['**/screens/**', '**/write/**'] },
    { name: 'screens', testMatch: 'screens/*.spec.ts' },
    // T#39: the specs that really save, run only on the per-run DB of scripts/e2e-servers.sh --fresh-db.
    { name: 'e2e-write', testMatch: 'write/*.spec.ts' },
  ],
})
