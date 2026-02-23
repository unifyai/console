import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration
 * Only matches *.spec.ts and *.e2e.ts files (NOT Vitest *.test.ts files)
 */
export default defineConfig({
  testDir: './src/tests',
  // Only match Playwright test files, not Vitest files
  testMatch: ['**/*.spec.ts', '**/*.e2e.ts'],
  // Ignore Vitest test files
  testIgnore: ['**/*.test.ts', '**/*.test.tsx', '**/*.node.test.ts', '**/*.browser.test.tsx'],

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Don't fail if no tests found - just report empty
  // This allows the workflow to pass when no E2E tests exist yet
});
