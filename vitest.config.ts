import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { playwright } from '@vitest/browser-playwright';
import { loadEnvConfig } from '@next/env';
import * as os from "os";

// Load .env.test file before config
loadEnvConfig(process.cwd(), true); // true = force test mode

// Ensure test config env vars are set globally for test collection phase
// These must be set before test files are parsed
if (!process.env.PLOT_TEST_SCALE) {
  process.env.PLOT_TEST_SCALE = process.env.PLOT_TEST_SCALE || 'small';
}
if (!process.env.PLOT_TEST_SAMPLE_RATE) {
  process.env.PLOT_TEST_SAMPLE_RATE = process.env.PLOT_TEST_SAMPLE_RATE || '100';
}
if (!process.env.PLOT_TEST_API_REAL) {
  process.env.PLOT_TEST_API_REAL = process.env.PLOT_TEST_API_REAL || 'true';
}

export default defineConfig({

  // Shared Vite config for both test projects
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
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
          exclude: ['src/**/*.browser.test.ts?(x)'],
          maxConcurrency: 50,
          env: {
            PLOT_TEST_SCALE: process.env.PLOT_TEST_SCALE || 'small',
            PLOT_TEST_SAMPLE_RATE: process.env.PLOT_TEST_SAMPLE_RATE || '100',
            PLOT_TEST_API_REAL: process.env.PLOT_TEST_API_REAL || 'false',
            VITE_TEST_API_URL: process.env.VITE_TEST_API_URL || 'http://localhost:3000',
            VITE_TEST_API_KEY: process.env.VITE_TEST_API_KEY || 'test-api-key-12345',
          },
        },
      },

      {
        extends: true,
        css: {
          postcss: './postcss.config.js',
        },
        define: {
          'import.meta.env.VITE_TAKE_SCREENSHOTS': JSON.stringify(
            process.env.VITE_TAKE_SCREENSHOTS === 'true'
          ),
          // Test config vars - inject at compile time for browser tests
          'import.meta.env.PLOT_TEST_SCALE': JSON.stringify(process.env.PLOT_TEST_SCALE || 'small'),
          'import.meta.env.PLOT_TEST_SAMPLE_RATE': JSON.stringify(process.env.PLOT_TEST_SAMPLE_RATE || '100'),
          'import.meta.env.PLOT_TEST_API_REAL': JSON.stringify(process.env.PLOT_TEST_API_REAL || 'true'),
          'import.meta.env.VITE_TEST_API_URL': JSON.stringify(process.env.VITE_TEST_API_URL || 'http://localhost:3000'),
          'import.meta.env.VITE_TEST_API_KEY': JSON.stringify(process.env.VITE_TEST_API_KEY || 'test-api-key-12345'),
          // Matrix test splitting for parallel execution
          'import.meta.env.MATRIX_TEST_SPLIT': JSON.stringify(process.env.MATRIX_TEST_SPLIT || 'false'),
          'import.meta.env.MATRIX_TEST_CHUNK': JSON.stringify(process.env.MATRIX_TEST_CHUNK || ''),
          // Define process.env for browser tests (Next.js components use this)
          'process.env': JSON.stringify({
            NEXT_PUBLIC_DEBUG_PERFORMANCE: 'false',
            NEXT_PUBLIC_DEBUG_TABLE_ADVANCED_FEATURES: 'false',
            NODE_ENV: 'test',
            PLOT_TEST_SCALE: process.env.PLOT_TEST_SCALE || 'small',
            PLOT_TEST_SAMPLE_RATE: process.env.PLOT_TEST_SAMPLE_RATE || '100',
            PLOT_TEST_API_REAL: process.env.PLOT_TEST_API_REAL || 'true',
            VITE_TEST_API_URL: process.env.VITE_TEST_API_URL || 'http://localhost:3000',
            VITE_TEST_API_KEY: process.env.VITE_TEST_API_KEY || 'test-api-key-12345',
            MATRIX_TEST_SPLIT: process.env.MATRIX_TEST_SPLIT || 'false',
            MATRIX_TEST_CHUNK: process.env.MATRIX_TEST_CHUNK || '',
          }),
        },
        test: {
          name: 'browser',
          setupFiles: ['./vitest.browser.setup.ts'],
          include: ['src/**/*.browser.test.ts?(x)'],
          exclude: ['src/**/*.node.test.ts?(x)'],
          // Env vars for test collection (happens in Node.js context)
          env: {
            PLOT_TEST_SCALE: process.env.PLOT_TEST_SCALE || 'small',
            PLOT_TEST_SAMPLE_RATE: process.env.PLOT_TEST_SAMPLE_RATE || '100',
            PLOT_TEST_API_REAL: process.env.PLOT_TEST_API_REAL || 'true',
            VITE_TEST_API_URL: process.env.VITE_TEST_API_URL || 'http://localhost:3000',
            VITE_TEST_API_KEY: process.env.VITE_TEST_API_KEY || 'test-api-key-12345',
            MATRIX_TEST_SPLIT: process.env.MATRIX_TEST_SPLIT || 'false',
            MATRIX_TEST_CHUNK: process.env.MATRIX_TEST_CHUNK || '',
          },
          // Use fileParallelism to run test files in parallel across workers
          // Each worker gets its own browser instance
          fileParallelism: true,
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            // Single browser instance per process
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
