#!/usr/bin/env tsx
/**
 * Matrix Discovery Script
 *
 * This script is run as a subprocess to extract matrix metadata from test files.
 * It mocks vitest and React Testing Library to allow importing the test files.
 *
 * Usage: npx tsx discover-matrix.ts <test-file-path>
 */

// Mock vitest before any imports
const vitestMock = {
  describe: Object.assign(() => {}, { skip: () => {}, only: () => {}, concurrent: () => {} }),
  it: Object.assign(() => {}, { skip: () => {}, only: () => {}, concurrent: () => {} }),
  test: Object.assign(() => {}, { skip: () => {}, only: () => {}, concurrent: () => {} }),
  expect: () => ({
    toBe: () => {},
    toEqual: () => {},
    toBeGreaterThan: () => {},
    toBeGreaterThanOrEqual: () => {},
    toBeLessThan: () => {},
    toBeLessThanOrEqual: () => {},
    toBeNull: () => {},
    toBeDefined: () => {},
    toBeUndefined: () => {},
    toBeTruthy: () => {},
    toBeFalsy: () => {},
    toContain: () => {},
    toHaveLength: () => {},
    not: {
      toBe: () => {},
      toBeNull: () => {},
      toEqual: () => {},
    },
  }),
  vi: {
    fn: () => () => {},
    mock: () => {},
    spyOn: () => ({ mockImplementation: () => {} }),
  },
  beforeAll: () => {},
  afterAll: () => {},
  beforeEach: () => {},
  afterEach: () => {},
};

// Mock @testing-library/react
const rtlMock = {
  render: () => ({ container: {}, unmount: () => {} }),
  cleanup: () => {},
  screen: {},
  waitFor: async () => {},
  fireEvent: {},
};

// Register mocks
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Override require for vitest
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id: string) {
  if (id === 'vitest') {
    return vitestMock;
  }
  if (id === '@testing-library/react') {
    return rtlMock;
  }
  return originalRequire.apply(this, arguments);
};

// Main
async function main() {
  const testFilePath = process.argv[2];
  if (!testFilePath) {
    console.error('Usage: npx tsx discover-matrix.ts <test-file-path>');
    process.exit(1);
  }

  try {
    const module = await import(testFilePath);
    const matrixExport = module.matrixTests;

    if (!matrixExport || typeof matrixExport.getMatrix !== 'function') {
      console.log('__MATRIX_ERROR__matrixTests export not found or missing getMatrix()__END__');
      process.exit(1);
    }

    const matrix = matrixExport.getMatrix();
    const chunkSize = matrixExport.chunkSize || 10;

    const metadata = {
      totalConfigs: matrix.length,
      chunkSize,
      numChunks: Math.ceil(matrix.length / chunkSize),
    };

    console.log('__MATRIX_METADATA__' + JSON.stringify(metadata) + '__END__');
  } catch (error: any) {
    console.log('__MATRIX_ERROR__' + (error.message || 'Unknown error') + '__END__');
    process.exit(1);
  }
}

main();

