import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { playwright } from '@vitest/browser-playwright';

/**
 * Environment variables for plot test configuration:
 *
 * Scale selection:
 *   PLOT_TEST_SCALE: Which data scale to run tests for
 *     - 'small': ~100 data points (fastest, default)
 *     - 'medium': ~1000 data points
 *     - 'large': ~10000 data points (slowest)
 *     - 'all': Run all scales
 *
 * Sampling:
 *   PLOT_TEST_SAMPLE_RATE: Percentage of configs to test (1-100, default 100)
 *
 * API mode:
 *   PLOT_TEST_API_REAL: Use real backend (default: true), set to 'false' for mocked
 *   VITE_TEST_API_URL: Backend URL for real API tests (default: http://localhost:3000)
 *   VITE_TEST_API_KEY: API key for authentication (default: test-api-key-12345)
 *
 * Example usage:
 *   npm test                                     # Small scale (default)
 *   PLOT_TEST_SCALE=medium npm test              # Medium scale only
 *   PLOT_TEST_SCALE=all npm test                 # All scales
 *   PLOT_TEST_SCALE=small PLOT_TEST_SAMPLE_RATE=25 npm test  # Quick iteration
 *   PLOT_TEST_API_REAL=false npm test            # Use mocked API responses
 */
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
          env: {
            PLOT_TEST_SCALE: process.env.PLOT_TEST_SCALE || 'small',
            PLOT_TEST_SAMPLE_RATE: process.env.PLOT_TEST_SAMPLE_RATE || '100',
            PLOT_TEST_API_REAL: process.env.PLOT_TEST_API_REAL || 'true',
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
          }),
        },
        test: {
          name: 'browser',
          setupFiles: ['./vitest.browser.setup.ts'],
          include: ['src/**/*.browser.test.ts?(x)'],
          exclude: ['src/**/*.node.test.ts?(x)'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
            screenshotDirectory: './screenshots',
          },
        },
      },
    ],
  },
});
