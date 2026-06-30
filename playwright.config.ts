/// <reference types="node" />

import { defineConfig, devices } from '@playwright/test';
import { loadEnvConfig } from '@next/env';

/**
 * Parse one dotenv-style file into key/value pairs.
 *
 * We only need the subset used by the local test harness, so a minimal parser is
 * enough here and avoids adding more runtime dependencies to the Playwright boot
 * path.
 */
function parseEnvFileContents(contents: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const normalized = line.startsWith('export ') ? line.slice('export '.length) : line;
    const separatorIndex = normalized.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = normalized.slice(0, separatorIndex).trim();
    let value = normalized.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

/**
 * Resolve the same env files as `next dev` (.env.local, .env.development, .env).
 *
 * Cursor shells often already export cloud/staging vars such as `ORCHESTRA_URL`.
 * `@next/env` intentionally preserves those existing values, but the local
 * Playwright harness needs repo env files to win so it seeds the same local
 * Orchestra instance that `next dev` is using.
 */
const nodeEnvBefore = process.env.NODE_ENV;
process.env.NODE_ENV = 'development';
const { loadedEnvFiles } = loadEnvConfig(process.cwd(), true, console, true);
for (const envFile of [...loadedEnvFiles].reverse()) {
  const parsed = parseEnvFileContents(envFile.contents);
  for (const [key, value] of Object.entries(parsed)) {
    process.env[key] = value;
  }
}
if (nodeEnvBefore !== undefined) {
  process.env.NODE_ENV = nodeEnvBefore;
} else {
  delete process.env.NODE_ENV;
}

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

  // Warm the dev server's lazy route compilation once before any spec, so the
  // first test of a run doesn't eat the cold-start cost and flake on auth.
  globalSetup: './src/tests/global-setup.ts',

  // Per src/tests/README.md, different spec files are fully independent but tests
  // *within* a file run serially and share state. `fullyParallel: false` honours
  // that contract: each file is dispatched whole to a worker (intra-file order
  // preserved), while distinct files run in parallel across workers. This lets CI
  // use the multi-core runners instead of crawling through every suite on one
  // worker (which pushed the larger suites past the 30-min job timeout).
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.PLAYWRIGHT_WORKERS
    ? Number(process.env.PLAYWRIGHT_WORKERS)
    : process.env.CI
      ? 2
      : undefined,
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
