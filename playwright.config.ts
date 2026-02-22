import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration.
 *
 * Three project groups:
 *  1. "setup"          — global setup that authenticates both test users
 *  2. "chromium"       — all authenticated tests run against userA state
 *  3. "idor"           — IDOR tests load both states manually per-test
 *
 * Pre-requisites for E2E:
 *   TEST_AUTH=true
 *   TEST_USER_A_EMAIL / TEST_USER_A_PASSWORD
 *   TEST_USER_B_EMAIL / TEST_USER_B_PASSWORD
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,     // sequential — share one DB, avoid race conditions
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // ── 1. Auth setup ────────────────────────────────────────────────────
    {
      name: 'setup',
      testMatch: '**/global.setup.ts',
    },

    // ── 2. Main authenticated suite ─────────────────────────────────────
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/userA.json',
      },
      dependencies: ['setup'],
      testMatch: ['**/auth.spec.ts', '**/books.crud.spec.ts', '**/security.spec.ts'],
    },

    // ── 3. IDOR tests (manage their own contexts) ────────────────────────
    {
      name: 'idor',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testMatch: '**/idor.spec.ts',
    },
  ],

  // Start Next.js dev server before running tests
  webServer: {
    command: process.env.CI ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      TEST_AUTH: 'true',
    },
  },
})
