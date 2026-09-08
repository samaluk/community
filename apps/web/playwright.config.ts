import { defineConfig, devices } from '@playwright/test'

import { loadTestEnv } from './scripts/loadScriptEnv'

loadTestEnv()

const isCI = !!process.env.CI
const baseURL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // Publishing tests invalidate shared cached listings and restore their fixtures.
  workers: 1,
  reporter: isCI ? [['github'], ['list']] : 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      // The normal build must exercise ISR and prefetch behavior without the
      // testing API, which changes Next's background ISR path.
      name: 'chromium',
      testIgnore: /instant-nav\.e2e\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
    {
      // Instant-navigation assertions require Next's production testing API.
      // Keep them in a separate project/build so that API cannot affect the
      // normal production E2E coverage.
      name: 'instant',
      testMatch: /instant-nav\.e2e\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    // Prefetching, ISR, and offline checks need a production build locally too.
    command: 'pnpm start',
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: isCI ? 120_000 : 60_000,
  },
})
