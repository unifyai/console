/**
 * Matrix Test Runner Utility
 *
 * Provides a way to define parameterized/matrix tests that can be:
 * 1. Run normally (all tests in one file)
 * 2. Split into multiple files for parallel execution in CI
 *
 * Usage:
 * ```typescript
 * import { defineMatrixTests } from '@/tests/utils/matrixTestRunner';
 *
 * export const matrixTests = defineMatrixTests({
 *   name: 'My Matrix Tests',
 *   getMatrix: () => [{ id: 1 }, { id: 2 }, ...],
 *   defineTests: (config, { it, expect }) => {
 *     it(`test for ${config.id}`, async () => {
 *       // test logic
 *     });
 *   },
 *   chunkSize: 10,
 * });
 * ```
 *
 * In CI, set MATRIX_TEST_SPLIT=true to skip matrix tests in original files
 * (they'll be run from generated chunk files instead).
 */

import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';

// Test utilities passed to defineTests
export interface TestUtils {
  describe: typeof describe;
  it: typeof it;
  expect: typeof expect;
}

// Configuration for matrix tests
export interface MatrixTestConfig<T> {
  /** Name of the test suite */
  name: string;

  /** Function that returns the array of test configurations */
  getMatrix: () => T[];

  /**
   * Function that defines tests for a single configuration.
   * Called once per config in the matrix.
   */
  defineTests: (config: T, utils: TestUtils) => void;

  /** Number of configs per generated chunk file (default: 10) */
  chunkSize?: number;

  /** Default timeout for tests in ms */
  timeout?: number;

  /** Setup function run before all tests */
  setup?: () => void | Promise<void>;

  /** Teardown function run after all tests */
  teardown?: () => void | Promise<void>;

  /** Whether to run cleanup after each test (default: true) */
  cleanupAfterEach?: boolean;

  /**
   * Function to generate a unique alias/name for each config.
   * Used in test names for identification.
   */
  getConfigAlias?: (config: T, index: number) => string;
}

// Marker to identify matrix test exports
export const MATRIX_TEST_MARKER = '__MATRIX_TEST__';

// Return type for defineMatrixTests
export interface MatrixTestResult<T> {
  [MATRIX_TEST_MARKER]: true;
  name: string;
  getMatrix: () => T[];
  chunkSize: number;
  defineTests: MatrixTestConfig<T>['defineTests'];
  getConfigAlias?: MatrixTestConfig<T>['getConfigAlias'];
}

/**
 * Get environment variable that works in both Node.js and browser contexts.
 */
function getEnvVar(name: string): string | undefined {
  // Check browser environment first (Vite/Vitest)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return (import.meta.env as Record<string, string>)[name];
  }
  // Fall back to Node.js environment
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name];
  }
  return undefined;
}

/**
 * Define a matrix test suite.
 *
 * When run normally: executes all tests in the matrix.
 * When MATRIX_TEST_SPLIT=true: skips execution (generated files handle it).
 * When MATRIX_TEST_CHUNK=N: runs only chunk N of the matrix.
 */
export function defineMatrixTests<T>(
  config: MatrixTestConfig<T>
): MatrixTestResult<T> {
  const {
    name,
    getMatrix,
    defineTests,
    chunkSize = 10,
    timeout,
    setup,
    teardown,
    cleanupAfterEach = true,
    getConfigAlias,
  } = config;

  // Build the result object (always returned for generator discovery)
  const result: MatrixTestResult<T> = {
    [MATRIX_TEST_MARKER]: true,
    name,
    getMatrix,
    chunkSize,
    defineTests,
    getConfigAlias,
  };

  // If running in split mode, skip matrix tests in original files
  // Generated chunk files will run them instead
  if (getEnvVar('MATRIX_TEST_SPLIT') === 'true') {
    describe(`${name} (skipped - using generated splits)`, () => {
      it.skip('matrix tests run via generated chunk files in CI', () => {
        // This is just a placeholder to show the tests were skipped
      });
    });
    return result;
  }

  // Get the matrix
  const matrix = getMatrix();

  // Check if we're running a specific chunk (used by generated files)
  const chunkIndexStr = process.env.MATRIX_TEST_CHUNK;
  let configsToRun: T[];
  let startIndex = 0;

  if (chunkIndexStr !== undefined) {
    const chunkIndex = parseInt(chunkIndexStr, 10);
    startIndex = chunkIndex * chunkSize;
    configsToRun = matrix.slice(startIndex, startIndex + chunkSize);
  } else {
    configsToRun = matrix;
  }

  // Run the tests
  describe(name, () => {
    if (cleanupAfterEach) {
      afterEach(() => {
        cleanup();
      });
    }

    if (setup) {
      beforeAll(setup);
    }

    if (teardown) {
      afterAll(teardown);
    }

    configsToRun.forEach((testConfig, index) => {
      const actualIndex = startIndex + index;
      const alias = getConfigAlias
        ? getConfigAlias(testConfig, actualIndex)
        : `Config ${actualIndex}`;

      describe(alias, () => {
        defineTests(testConfig, { describe, it, expect });
      });
    });
  });

  return result;
}

/**
 * Run a specific chunk of a matrix test.
 * Used by generated chunk files.
 */
export function runMatrixChunk<T>(
  matrixConfig: MatrixTestResult<T>,
  chunkIndex: number
): void {
  const { name, getMatrix, defineTests, chunkSize, getConfigAlias } = matrixConfig;

  const matrix = getMatrix();
  const startIndex = chunkIndex * chunkSize;
  const chunk = matrix.slice(startIndex, startIndex + chunkSize);

  if (chunk.length === 0) {
    console.warn(`Chunk ${chunkIndex} is empty for ${name}`);
    return;
  }

  describe(`${name} - Chunk ${chunkIndex}`, () => {
    afterEach(() => {
      cleanup();
    });

    chunk.forEach((config, index) => {
      const actualIndex = startIndex + index;
      const alias = getConfigAlias
        ? getConfigAlias(config, actualIndex)
        : `Config ${actualIndex}`;

      describe(alias, () => {
        defineTests(config, { describe, it, expect });
      });
    });
  });
}

/**
 * Get metadata about a matrix test configuration.
 * Used by the generator script to determine how many chunks to create.
 */
export function getMatrixMetadata<T>(matrixConfig: MatrixTestResult<T>): {
  name: string;
  totalConfigs: number;
  chunkSize: number;
  numChunks: number;
} {
  const matrix = matrixConfig.getMatrix();
  const numChunks = Math.ceil(matrix.length / matrixConfig.chunkSize);

  return {
    name: matrixConfig.name,
    totalConfigs: matrix.length,
    chunkSize: matrixConfig.chunkSize,
    numChunks,
  };
}

