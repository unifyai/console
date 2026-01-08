/// <reference types="vite/client" />

import 'vitest';

// =============================================================================
// Environment Variable Type Declarations
// =============================================================================

// All test environment variables are injected via process.env
// by vitest.config.ts TEST_ENV object (for both Node and Browser tests)
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV?: 'test' | 'development' | 'production';

      // Plot test configuration
      PLOT_TEST_SCALE?: 'small' | 'medium' | 'large' | 'all';
      PLOT_TEST_SAMPLE_RATE?: string;
      PLOT_TEST_API_REAL?: 'true' | 'false';

      // API configuration
      VITE_TEST_API_URL?: string;
      VITE_TEST_API_KEY?: string;
      NEXTAUTH_URL?: string;

      // Matrix test splitting
      MATRIX_TEST_SPLIT?: 'true' | 'false';
      MATRIX_TEST_CHUNK?: string;

      // Screenshots
      VITE_TAKE_SCREENSHOTS?: 'true' | 'false';

      // Next.js public vars
      NEXT_PUBLIC_DEBUG_PERFORMANCE?: string;
      NEXT_PUBLIC_DEBUG_TABLE_ADVANCED_FEATURES?: string;
    }
  }
}

// =============================================================================
// Vitest Custom Metadata
// =============================================================================

interface CustomMeta {
  alias?: string;
  mock?: boolean;
  scenario?: string;
  behavior?: string;
}

declare module 'vitest' {
  interface TestOptions {
    meta?: CustomMeta;
  }

  interface TaskMeta extends CustomMeta {}
}
