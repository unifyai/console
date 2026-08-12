import path from 'path';
import { loadEnvConfig } from '@next/env';

const defineConfig = <T extends object>(config: T) => config;

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
  ORCHESTRA_URL:
    process.env.ORCHESTRA_URL || (process.env.CI === 'true' ? 'http://127.0.0.1:8000' : ''),
  VITE_SHARED_CONTEXT_ASSISTANT_ID: process.env.VITE_SHARED_CONTEXT_ASSISTANT_ID || '',
  VITE_SHARED_CONTEXT_SPACES_REAL: process.env.VITE_SHARED_CONTEXT_SPACES_REAL || 'false',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  // Matrix test splitting
  MATRIX_TEST_SPLIT: process.env.MATRIX_TEST_SPLIT || 'false',
  MATRIX_TEST_CHUNK: process.env.MATRIX_TEST_CHUNK || '',
  // Screenshots
  VITE_TAKE_SCREENSHOTS: process.env.VITE_TAKE_SCREENSHOTS || 'false',
};

const vitestConfig = async () => {
  const react = (await import('@vitejs/plugin-react')).default;
  const { playwright } = await import('@vitest/browser-playwright');

  return defineConfig({
    // Shared Vite config for both test projects
    plugins: [react()],
    resolve: {
      alias: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        '@': path.resolve(__dirname, './src'),
        'server-only': path.resolve(__dirname, './src/tests/mocks/server-only.ts'),
      },
    },
    // Define process.env for browser tests (Next.js components use this)
    define: {
      'process.env': JSON.stringify(TEST_ENV),
    },
    // Optimize dependency pre-bundling for faster CI runs
    // This prevents Vite from discovering dependencies at runtime and triggering
    // page reloads that crash the Vitest browser runner (causes "Failed to fetch
    // dynamically imported module" and "Vitest failed to find the runner" errors)
    optimizeDeps: {
      // Force pre-bundle ALL dependencies that tests might import
      // Without this, Vite discovers them at runtime, triggers a reload, and crashes tests
      include: [
        // React core
        'react',
        'react-dom',
        'react-dom/client',
        // Testing utilities
        '@testing-library/react',
        '@testing-library/user-event',
        // State management
        '@tanstack/react-query',
        'zustand',
        'use-context-selector',
        // UI components (Radix)
        '@radix-ui/react-tooltip',
        '@radix-ui/react-popover',
        '@radix-ui/react-accordion',
        '@radix-ui/react-dialog',
        '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-select',
        '@radix-ui/react-switch',
        '@radix-ui/react-tabs',
        // Drag and drop (used by DataTable, SelectionPanel)
        '@dnd-kit/core',
        '@dnd-kit/modifiers',
        '@dnd-kit/sortable',
        '@dnd-kit/utilities',
        // Virtualization (used by DataTable)
        'react-window',
        'react-window-infinite-loader',
        // Table (used extensively)
        '@tanstack/react-table',
        // URL state management
        'nuqs',
      ],
      // Ensure Vite scans test files for dependencies before running
      entries: ['./src/tests/**/*.browser.test.tsx'],
    },
    // Server settings for better CI stability
    server: {
      // Increase warmup to pre-transform commonly used files
      warmup: {
        clientFiles: ['./src/tests/render.tsx', './src/contexts/**/*.tsx'],
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
            // Exclude browser tests, real/api tests, and matrix tests (separate projects)
            exclude: [
              'src/**/*.browser.test.ts?(x)',
              'src/**/*.real.node.test.ts?(x)',
              'src/**/*.api.node.test.ts?(x)',
              'src/**/*.matrix.node.test.ts?(x)',
            ],
            maxConcurrency: 30,
            env: TEST_ENV,
          },
        },

        // Node matrix tests - heavy tests that need sharding via MATRIX_SHARD env var
        {
          extends: true,
          test: {
            name: 'node-matrix',
            environment: 'jsdom',
            setupFiles: ['./vitest.node.setup.ts'],
            include: ['src/**/*.matrix.node.test.ts?(x)'],
            exclude: ['src/**/*.browser.test.ts?(x)'],
            // Lower concurrency to avoid OOM with large matrices
            maxConcurrency: 5,
            testTimeout: 60000,
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
            include: ['src/**/*.real.node.test.ts?(x)', 'src/**/*.api.node.test.ts?(x)'],
            exclude: ['src/**/*.browser.test.ts?(x)'],
            maxConcurrency: 10,
            env: TEST_ENV,
          },
        },

        // Regular browser tests (excludes matrix and benchmark tests)
        {
          extends: true,
          css: {
            postcss: './postcss.config.js',
          },
          test: {
            name: 'browser',
            globalSetup: ['./vitest.browser.globalSetup.ts'],
            setupFiles: ['./vitest.browser.setup.ts'],
            include: ['src/**/*.browser.test.ts?(x)'],
            exclude: [
              'src/**/*.node.test.ts?(x)',
              'src/**/*.matrix.browser.test.ts?(x)', // Matrix tests have dedicated workflow
              'src/**/benchmarks/**', // Benchmark tests run on staging only
            ],
            env: TEST_ENV,
            // Increased timeouts for CI where cold cache + shared resources slow things down
            testTimeout: 20000,
            hookTimeout: 30000,
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
              // Explicit connection timeout for browser<->Vite WebSocket
              connectTimeout: 120000,
            },
          },
        },

        // Matrix browser tests (separate project for dedicated CI workflow)
        {
          extends: true,
          css: {
            postcss: './postcss.config.js',
          },
          test: {
            name: 'browser-matrix',
            globalSetup: ['./vitest.browser.globalSetup.ts'],
            setupFiles: ['./vitest.browser.setup.ts'],
            include: ['src/**/*.matrix.browser.test.ts?(x)'],
            exclude: ['src/**/*.node.test.ts?(x)'],
            env: TEST_ENV,
            testTimeout: 30000, // Matrix tests can be slower
            hookTimeout: 10000,
            fileParallelism: true,
            browser: {
              enabled: true,
              provider: playwright(),
              headless: true,
              instances: [{ browser: 'chromium' }],
              screenshotFailures: false,
            },
          },
        },

        // Benchmark browser tests (staging only)
        {
          extends: true,
          css: {
            postcss: './postcss.config.js',
          },
          test: {
            name: 'browser-benchmarks',
            globalSetup: ['./vitest.browser.globalSetup.ts'],
            setupFiles: ['./vitest.browser.setup.ts'],
            include: ['src/**/benchmarks/**/*.browser.test.ts?(x)'],
            exclude: ['src/**/*.node.test.ts?(x)'],
            env: TEST_ENV,
            testTimeout: 60000, // Benchmarks need more time
            hookTimeout: 10000,
            fileParallelism: true,
            browser: {
              enabled: true,
              provider: playwright(),
              headless: true,
              instances: [{ browser: 'chromium' }],
              screenshotFailures: false,
            },
          },
        },
      ],
    },
  });
};

export default vitestConfig;
