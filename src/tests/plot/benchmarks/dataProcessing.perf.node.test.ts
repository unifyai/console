/**
 * Data Processing Performance Benchmarks
 *
 * Node.js-based performance tests for data processing utilities.
 * Measures transformation and aggregation times across different scales.
 *
 * Configuration:
 * - PLOT_TEST_SCALE: Which scale(s) to benchmark (small/medium/large/all)
 */

import { describe, it, expect } from 'vitest';
import {
  getActiveScales,
  ScaleOption,
  DataTypeConfig,
} from '../fixtures/configs';
import {
  createMockLogs,
  createMockFields,
  createAggregatedMockData,
} from '../fixtures/mockData';

// =============================================================================
// Types
// =============================================================================

interface BenchmarkResult {
  operation: string;
  scale: string;
  dataCount: number;
  duration: number;
}

const benchmarkResults: BenchmarkResult[] = [];

// =============================================================================
// Utilities
// =============================================================================

function logBenchmarkResult(result: BenchmarkResult) {
  benchmarkResults.push(result);
  console.log(
    `[BENCHMARK] ${result.operation} @ ${result.scale}: ` +
      `${result.duration.toFixed(2)}ms for ${result.dataCount} items`
  );
}

// =============================================================================
// Mock Data Generation Benchmarks
// =============================================================================

describe('Mock Data Generation Benchmarks', () => {
  const activeScales = getActiveScales();
  const dataTypeConfig: DataTypeConfig = {
    x_axis_type: 'float',
    y_axis_type: 'float',
    group_by_type: 'str',
  };

  describe.each(activeScales)('Scale: %s', (scale) => {
    it(
      `generates ${scale.count} mock logs`,
      () => {
        const start = performance.now();

        const logs = createMockLogs({
          dataTypeConfig,
          scale,
          includeNulls: true,
          includeEdgeCases: true,
        });

        const duration = performance.now() - start;

        logBenchmarkResult({
          operation: 'createMockLogs',
          scale: scale.name,
          dataCount: logs.length,
          duration,
        });

        expect(logs.length).toBeGreaterThanOrEqual(scale.count);
        expect(duration).toBeLessThan(scale.timeout);
      },
      scale.timeout
    );
  });
});

// =============================================================================
// Aggregation Benchmarks
// =============================================================================

describe('Aggregation Benchmarks', () => {
  const activeScales = getActiveScales();
  const dataTypeConfig: DataTypeConfig = {
    x_axis_type: 'float',
    y_axis_type: 'float',
    group_by_type: 'str',
  };
  const aggregateTypes = ['sum', 'mean', 'count', 'min', 'max'] as const;

  describe.each(activeScales)('Scale: %s', (scale) => {
    const logs = createMockLogs({
      dataTypeConfig,
      scale,
      includeNulls: false,
      includeEdgeCases: false,
    });

    describe.each(aggregateTypes)('Aggregate: %s', (aggregate) => {
      it(
        `aggregates ${scale.count} logs with ${aggregate}`,
        () => {
          const start = performance.now();

          const result = createAggregatedMockData(
            logs,
            'table1.category',
            aggregate,
            'table1.y_value'
          );

          const duration = performance.now() - start;

          logBenchmarkResult({
            operation: `aggregate-${aggregate}`,
            scale: scale.name,
            dataCount: logs.length,
            duration,
          });

          expect(result.length).toBeGreaterThan(0);
          expect(duration).toBeLessThan(scale.timeout);
        },
        scale.timeout
      );
    });
  });
});

// =============================================================================
// Field Generation Benchmarks
// =============================================================================

describe('Field Generation Benchmarks', () => {
  const dataTypeConfigs: DataTypeConfig[] = [
    { x_axis_type: 'float', y_axis_type: 'float', group_by_type: 'str' },
    { x_axis_type: 'int', y_axis_type: 'int', group_by_type: 'bool' },
    { x_axis_type: 'datetime', y_axis_type: 'float', group_by_type: 'str' },
    { x_axis_type: 'str', y_axis_type: 'int', group_by_type: 'str' },
  ];

  describe.each(dataTypeConfigs)('Data types: %o', (dataTypeConfig) => {
    it('generates field definitions', () => {
      const start = performance.now();

      const fields = createMockFields(dataTypeConfig);

      const duration = performance.now() - start;

      logBenchmarkResult({
        operation: 'createMockFields',
        scale: `${dataTypeConfig.x_axis_type}-${dataTypeConfig.y_axis_type}`,
        dataCount: fields.length,
        duration,
      });

      expect(fields.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Should be very fast
    });
  });
});

// =============================================================================
// Data Type Specific Benchmarks
// =============================================================================

describe('Data Type Specific Generation Benchmarks', () => {
  const activeScales = getActiveScales();

  const dataTypeConfigs: DataTypeConfig[] = [
    { x_axis_type: 'float', y_axis_type: 'float', group_by_type: 'str' },
    { x_axis_type: 'int', y_axis_type: 'int', group_by_type: 'bool' },
    { x_axis_type: 'datetime', y_axis_type: 'float', group_by_type: 'str' },
    { x_axis_type: 'str', y_axis_type: 'float', group_by_type: 'str' },
  ];

  describe.each(dataTypeConfigs)('Data types: %o', (dataTypeConfig) => {
    describe.each(activeScales)('Scale: %s', (scale) => {
      it(
        `generates ${scale.count} logs with ${dataTypeConfig.x_axis_type} x-axis`,
        () => {
          const start = performance.now();

          const logs = createMockLogs({
            dataTypeConfig,
            scale,
            includeNulls: false,
            includeEdgeCases: true,
          });

          const duration = performance.now() - start;

          logBenchmarkResult({
            operation: `createMockLogs-${dataTypeConfig.x_axis_type}`,
            scale: scale.name,
            dataCount: logs.length,
            duration,
          });

          expect(logs.length).toBeGreaterThanOrEqual(scale.count);
          expect(duration).toBeLessThan(scale.timeout);
        },
        scale.timeout
      );
    });
  });
});

// =============================================================================
// Summary
// =============================================================================

describe('Benchmark Summary', () => {
  it('logs all benchmark results', () => {
    if (benchmarkResults.length > 0) {
      console.log('\n=== DATA PROCESSING BENCHMARK SUMMARY ===');
      console.log(JSON.stringify(benchmarkResults, null, 2));
      console.log('==========================================\n');
    }
    expect(true).toBe(true);
  });
});


