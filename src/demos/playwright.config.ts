import { defineConfig } from '@playwright/test';

const WIDTH = 1440;
const HEIGHT = 900;

/**
 * Playwright config for case-study demo recordings.
 *
 * Separate from the E2E test config — these scripts are not tests,
 * they produce video recordings for the landing page.
 */
export default defineConfig({
  testDir: '.',
  testMatch: ['**/*.demo.ts'],
  globalTeardown: './post-process.ts',

  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    video: {
      mode: 'on',
      size: { width: WIDTH, height: HEIGHT },
    },
    viewport: { width: WIDTH, height: HEIGHT },
    trace: 'off',
    launchOptions: {
      slowMo: 50,
    },
  },

  outputDir: './recordings',

  projects: [
    {
      name: 'demo',
      use: {
        browserName: 'chromium',
        viewport: { width: WIDTH, height: HEIGHT },
      },
    },
  ],
});
