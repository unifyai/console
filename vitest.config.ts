import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { playwright } from '@vitest/browser-playwright';

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
