/**
 * Matrix Test Runner for Node.js Tests
 *
 * Similar API to the browser matrix runner but optimized for Node.js:
 * - No React cleanup
 * - Supports describe.concurrent for in-process parallelism
 * - Supports sharding via MATRIX_SHARD env var for parallel processes
 *
 * Usage:
 * ```typescript
 * import { defineNodeMatrixTests } from '@/tests/utils/matrixTestRunnerNode';
 *
 * defineNodeMatrixTests<MyConfig>({
 *   name: 'My Matrix Tests',
 *   getMatrix: () => [
 *     { type: 'a', value: 1 },
 *     { type: 'b', value: 2 },
 *   ],
 *   defineTests: (config, { it, expect }) => {
 *     it('does something', () => { ... });
 *   },
 *   getConfigAlias: (config) => `${config.type}-${config.value}`,
 * });
 * ```
 *
 * Sharding:
 * Run in parallel processes with:
 * ```bash
 * MATRIX_SHARD=1/4 npm run test:node -- 'src/tests/...' &
 * MATRIX_SHARD=2/4 npm run test:node -- 'src/tests/...' &
 * MATRIX_SHARD=3/4 npm run test:node -- 'src/tests/...' &
 * MATRIX_SHARD=4/4 npm run test:node -- 'src/tests/...' &
 * wait
 * ```
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';

// Test utilities passed to defineTests
export interface TestUtils {
  describe: typeof describe;
  it: typeof it;
  expect: typeof expect;
}

/**
 * Configuration for Node.js matrix tests.
 */
export interface NodeMatrixTestConfig<T> {
  /** Name of the test suite */
  name: string;

  /** Function that returns the array of test configurations */
  getMatrix: () => T[];

  /**
   * Define tests for a single configuration.
   * Called once per config in the matrix.
   */
  defineTests: (config: T, utils: TestUtils) => void;

  /** Whether to run tests concurrently (default: true) */
  concurrent?: boolean;

  /** Setup function run before all tests */
  setup?: () => void | Promise<void>;

  /** Teardown function run after all tests */
  teardown?: () => void | Promise<void>;

  /** Cleanup function run after each test */
  afterEach?: () => void | Promise<void>;

  /**
   * Function to generate a unique alias/name for each config.
   * Used in test names for identification.
   */
  getConfigAlias?: (config: T, index: number) => string;

  /** Default timeout for tests in ms */
  timeout?: number;
}

/**
 * Parse the MATRIX_SHARD environment variable.
 * Format: "index/total" (1-indexed), e.g., "1/4" for first of 4 shards.
 *
 * @returns { shardIndex, totalShards } or null if not set/invalid
 */
function parseShardSpec(): { shardIndex: number; totalShards: number } | null {
  const shardSpec = process.env.MATRIX_SHARD;
  if (!shardSpec) return null;

  const match = shardSpec.match(/^(\d+)\/(\d+)$/);
  if (!match) {
    console.warn(`[MatrixTestRunner] Invalid MATRIX_SHARD format: "${shardSpec}". Expected "N/M" (e.g., "1/4").`);
    return null;
  }

  const shardIndex = parseInt(match[1], 10);
  const totalShards = parseInt(match[2], 10);

  if (shardIndex < 1 || shardIndex > totalShards || totalShards < 1) {
    console.warn(`[MatrixTestRunner] Invalid MATRIX_SHARD values: index=${shardIndex}, total=${totalShards}`);
    return null;
  }

  return { shardIndex, totalShards };
}

/**
 * Apply sharding to a matrix array.
 * Splits the matrix into totalShards chunks and returns the chunk for shardIndex.
 *
 * @param matrix Full matrix array
 * @param shardIndex 1-indexed shard number
 * @param totalShards Total number of shards
 * @returns Subset of the matrix for this shard
 */
function applySharding<T>(matrix: T[], shardIndex: number, totalShards: number): T[] {
  const chunkSize = Math.ceil(matrix.length / totalShards);
  const start = (shardIndex - 1) * chunkSize;
  const end = Math.min(start + chunkSize, matrix.length);
  return matrix.slice(start, end);
}

/**
 * Define a matrix test suite for Node.js environment.
 *
 * Iterates over all configs from getMatrix() and runs defineTests for each.
 * Supports sharding via MATRIX_SHARD environment variable for parallel execution.
 */
export function defineNodeMatrixTests<T>(config: NodeMatrixTestConfig<T>): void {
  const {
    name,
    getMatrix,
    defineTests,
    concurrent = true,
    setup,
    teardown,
    afterEach: afterEachFn,
    getConfigAlias,
  } = config;

  // Get the full matrix
  let matrix = getMatrix();
  let startIndex = 0;

  // Apply sharding if MATRIX_SHARD is set
  const shardSpec = parseShardSpec();
  if (shardSpec) {
    const fullSize = matrix.length;
    const chunkSize = Math.ceil(fullSize / shardSpec.totalShards);
    startIndex = (shardSpec.shardIndex - 1) * chunkSize;
    matrix = applySharding(matrix, shardSpec.shardIndex, shardSpec.totalShards);

    console.log(
      `[MatrixTestRunner] Shard ${shardSpec.shardIndex}/${shardSpec.totalShards}: ` +
        `running ${matrix.length} of ${fullSize} configs (indices ${startIndex}-${startIndex + matrix.length - 1})`
    );
  }

  // Use concurrent describe if enabled
  const rootDescribe = concurrent ? describe.concurrent : describe;
  const suiteName = shardSpec ? `${name} (shard ${shardSpec.shardIndex}/${shardSpec.totalShards})` : name;

  rootDescribe(suiteName, () => {
    if (setup) {
      beforeAll(setup);
    }

    if (teardown) {
      afterAll(teardown);
    }

    if (afterEachFn) {
      afterEach(afterEachFn);
    }

    matrix.forEach((testConfig, localIndex) => {
      const globalIndex = startIndex + localIndex;
      const alias = getConfigAlias
        ? getConfigAlias(testConfig, globalIndex)
        : `Config ${globalIndex}`;

      describe(alias, () => {
        defineTests(testConfig, { describe, it, expect });
      });
    });
  });
}

/**
 * Metadata about a node matrix test configuration.
 * Useful for logging/debugging matrix size.
 */
export function getNodeMatrixMetadata<T>(config: NodeMatrixTestConfig<T>): {
  name: string;
  totalConfigs: number;
} {
  const matrix = config.getMatrix();

  return {
    name: config.name,
    totalConfigs: matrix.length,
  };
}
