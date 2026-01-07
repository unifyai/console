import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { playwright } from '@vitest/browser-playwright';
import { loadEnvConfig } from '@next/env';

// Load .env.test file before config
loadEnvConfig(process.cwd(), true); // true = force test mode

// =============================================================================
// Test Environment Variables (with defaults)
// =============================================================================
// These are injected into both Node and Browser test environments.
// Override via CLI: PLOT_TEST_SAMPLE_RATE=25 npm run test:browser
const TEST_ENV = {
  // Core
  NODE_ENV: 'test' as const,
  // Next.js debug flags
  NEXT_PUBLIC_DEBUG_PERFORMANCE: 'false',
  NEXT_PUBLIC_DEBUG_TABLE_ADVANCED_FEATURES: 'false',
  NEXT_PUBLIC_DEBUG_PERF_TELEMETRY: 'false',
  // Plot test configuration
  PLOT_TEST_SCALE: process.env.PLOT_TEST_SCALE || 'small',
  PLOT_TEST_SAMPLE_RATE: process.env.PLOT_TEST_SAMPLE_RATE || '100',
  PLOT_TEST_API_REAL: process.env.PLOT_TEST_API_REAL || 'false',
  // API endpoints
  VITE_TEST_API_URL: process.env.VITE_TEST_API_URL || 'http://localhost:3000',
  VITE_TEST_API_KEY: process.env.VITE_TEST_API_KEY || 'test-api-key-12345',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  // Matrix test splitting
  MATRIX_TEST_SPLIT: process.env.MATRIX_TEST_SPLIT || 'false',
  MATRIX_TEST_CHUNK: process.env.MATRIX_TEST_CHUNK || '',
  // Screenshots
  VITE_TAKE_SCREENSHOTS: process.env.VITE_TAKE_SCREENSHOTS || 'false',
};

export default defineConfig({
  // Shared Vite config for both test projects
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Define process.env for browser tests (Next.js components use this)
  define: {
    'process.env': JSON.stringify(TEST_ENV),
  },

  // Project-specific configs
  test: {
    globals: true,

    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'jsdom',
          setupFiles: ['./vitest.node.setup.ts'],
          include: ['src/**/*.node.test.ts?(x)'],
          // Exclude browser tests and .real. tests (those need a running server)
          exclude: ['src/**/*.browser.test.ts?(x)', 'src/**/*.real.node.test.ts?(x)'],
          maxConcurrency: 30,
          env: TEST_ENV,
        },
      },

      // Real integration tests - require Console + Orchestra running
      {
        extends: true,
        test: {
          name: 'real',
          environment: 'jsdom',
          setupFiles: ['./vitest.node.setup.ts'],
          include: ['src/**/*.real.node.test.ts?(x)'],
          exclude: ['src/**/*.browser.test.ts?(x)'],
          maxConcurrency: 10,
          env: TEST_ENV,
        },
      },

      {
        extends: true,
        css: {
          postcss: './postcss.config.js',
        },
        test: {
          name: 'browser',
          setupFiles: ['./vitest.browser.setup.ts'],
          include: ['src/**/*.browser.test.ts?(x)'],
          exclude: ['src/**/*.node.test.ts?(x)'],
          env: TEST_ENV,
          testTimeout: 10000,
          hookTimeout: 10000,
          // Use fileParallelism to run test files in parallel across workers. Each worker gets its own browser instance
          fileParallelism: true,
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            // Use sharding (--shard) to distribute tests across multiple processes
            instances: [{ browser: 'chromium' }],
            // Disable screenshots to allow concurrent test execution
            screenshotFailures: false,
          },
        },
      },
    ],
  },
});
