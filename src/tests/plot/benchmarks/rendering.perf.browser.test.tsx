/**
 * Plot Rendering Performance Benchmarks
 *
 * Browser-based performance tests for plot rendering.
 * Measures render times across different scales and plot types.
 *
 * Configuration:
 * - PLOT_TEST_SCALE: Which scale(s) to benchmark (small/medium/large/all)
 *
 * This file consolidates all rendering performance tests.
 * Results are logged for analysis and regression tracking.
 */

import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { renderPlotCanvas, createPlotTestSetup } from '../fixtures/plotCanvasTestHarness';
import {
  getActiveScales,
  ScaleOption,
  PlotConfig,
  DataTypeConfig,
} from '../fixtures/configs';

// =============================================================================
// Setup
// =============================================================================

afterEach(() => {
  cleanup();
});

// =============================================================================
// Types
// =============================================================================

interface BenchmarkResult {
  plotType: string;
  variant?: string;
  scale: string;
  dataCount: number;
  renderTime: number;
  domElements: number;
}

const benchmarkResults: BenchmarkResult[] = [];

// =============================================================================
// Utilities
// =============================================================================

function logBenchmarkResult(result: BenchmarkResult) {
  benchmarkResults.push(result);
  console.log(
    `[RENDER BENCHMARK] ${result.plotType}${result.variant ? ` (${result.variant})` : ''} @ ${result.scale}: ` +
      `${result.renderTime.toFixed(2)}ms, ${result.domElements} DOM elements`
  );
}

function countDomElements(container: HTMLElement): number {
  return container.querySelectorAll('*').length;
}

// Default data type config for benchmarks
const defaultDataTypeConfig: DataTypeConfig = {
  x_axis_type: 'float',
  y_axis_type: 'float',
  group_by_type: 'str',
};

// =============================================================================
// Scatter Plot Benchmarks
// =============================================================================

describe('Scatter Plot Rendering Performance', () => {
  const activeScales = getActiveScales();
  const baseConfig: PlotConfig = {
    type: 'scatter',
    xAxis: 'table1.x_value',
    yAxis: 'table1.y_value',
    scaleX: 'linear',
    scaleY: 'linear',
    showRegression: false,
    binCount: 10,
  };

  describe.each(activeScales)('Scale: %s', (scale) => {
    it(
      `baseline: ${scale.count} points`,
      async () => {
        const start = performance.now();

        const testSetup = createPlotTestSetup(baseConfig, defaultDataTypeConfig, scale);
        const result = renderPlotCanvas(testSetup);

        await result.waitForPlot();

        const renderTime = performance.now() - start;
        const points = result.getScatterPoints();

        logBenchmarkResult({
          plotType: 'scatter',
          scale: scale.name,
          dataCount: points.length,
          renderTime,
          domElements: countDomElements(result.container),
        });

        expect(renderTime).toBeLessThan(scale.timeout);
      },
      scale.timeout + 2000
    );

    it(
      `with regression: ${scale.count} points`,
      async () => {
        const start = performance.now();

        const configWithRegression = { ...baseConfig, showRegression: true };
        const testSetup = createPlotTestSetup(configWithRegression, defaultDataTypeConfig, scale);
        const result = renderPlotCanvas(testSetup);

        await result.waitForPlot();

        const renderTime = performance.now() - start;

        logBenchmarkResult({
          plotType: 'scatter',
          variant: 'regression',
          scale: scale.name,
          dataCount: scale.count,
          renderTime,
          domElements: countDomElements(result.container),
        });

        expect(renderTime).toBeLessThan(scale.timeout);
      },
      scale.timeout + 2000
    );

    it(
      `with grouping: ${scale.count} points`,
      async () => {
        const start = performance.now();

        const configWithGrouping = { ...baseConfig, groupBy: 'table1.category' };
        const testSetup = createPlotTestSetup(configWithGrouping, defaultDataTypeConfig, scale);
        const result = renderPlotCanvas(testSetup);

        await result.waitForPlot();

        const renderTime = performance.now() - start;

        logBenchmarkResult({
          plotType: 'scatter',
          variant: 'grouped',
          scale: scale.name,
          dataCount: scale.count,
          renderTime,
          domElements: countDomElements(result.container),
        });

        expect(renderTime).toBeLessThan(scale.timeout);
      },
      scale.timeout + 2000
    );

    it(
      `with log scales: ${scale.count} points`,
      async () => {
        const start = performance.now();

        const configWithLog = { ...baseConfig, scaleX: 'log' as const, scaleY: 'log' as const };
        const testSetup = createPlotTestSetup(configWithLog, defaultDataTypeConfig, scale);
        const result = renderPlotCanvas(testSetup);

        await result.waitForPlot();

        const renderTime = performance.now() - start;

        logBenchmarkResult({
          plotType: 'scatter',
          variant: 'log-scale',
          scale: scale.name,
          dataCount: scale.count,
          renderTime,
          domElements: countDomElements(result.container),
        });

        expect(renderTime).toBeLessThan(scale.timeout);
      },
      scale.timeout + 2000
    );
  });
});

// =============================================================================
// Bar Chart Benchmarks
// =============================================================================

describe('Bar Chart Rendering Performance', () => {
  const activeScales = getActiveScales();
  const baseConfig: PlotConfig = {
    type: 'bar',
    xAxis: 'table1.category',
    yAxis: 'table1.value',
    scaleX: 'linear',
    scaleY: 'linear',
    showRegression: false,
    binCount: 10,
  };
  const barDataTypeConfig: DataTypeConfig = {
    x_axis_type: 'str',
    y_axis_type: 'float',
    group_by_type: 'str',
  };

  describe.each(activeScales)('Scale: %s', (scale) => {
    it(
      `baseline: ${scale.count} data points`,
      async () => {
        const start = performance.now();

        const testSetup = createPlotTestSetup(baseConfig, barDataTypeConfig, scale);
        const result = renderPlotCanvas(testSetup);

        await result.waitForPlot();

        const renderTime = performance.now() - start;

        logBenchmarkResult({
          plotType: 'bar',
          scale: scale.name,
          dataCount: scale.count,
          renderTime,
          domElements: countDomElements(result.container),
        });

        expect(renderTime).toBeLessThan(scale.timeout);
      },
      scale.timeout + 2000
    );

    it(
      `with grouping: ${scale.count} data points`,
      async () => {
        const start = performance.now();

        const configWithGrouping = { ...baseConfig, groupBy: 'table1.status' };
        const testSetup = createPlotTestSetup(configWithGrouping, barDataTypeConfig, scale);
        const result = renderPlotCanvas(testSetup);

        await result.waitForPlot();

        const renderTime = performance.now() - start;

        logBenchmarkResult({
          plotType: 'bar',
          variant: 'grouped',
          scale: scale.name,
          dataCount: scale.count,
          renderTime,
          domElements: countDomElements(result.container),
        });

        expect(renderTime).toBeLessThan(scale.timeout);
      },
      scale.timeout + 2000
    );
  });
});

// =============================================================================
// Histogram Benchmarks
// =============================================================================

describe('Histogram Rendering Performance', () => {
  const activeScales = getActiveScales();
  const baseConfig: PlotConfig = {
    type: 'histogram',
    xAxis: 'table1.x_value',
    scaleX: 'linear',
    scaleY: 'linear',
    showRegression: false,
    binCount: 20,
  };

  describe.each(activeScales)('Scale: %s', (scale) => {
    it(
      `20 bins: ${scale.count} data points`,
      async () => {
        const start = performance.now();

        const testSetup = createPlotTestSetup(baseConfig, defaultDataTypeConfig, scale);
        const result = renderPlotCanvas(testSetup);

        await result.waitForPlot();

        const renderTime = performance.now() - start;

        logBenchmarkResult({
          plotType: 'histogram',
          variant: '20-bins',
          scale: scale.name,
          dataCount: scale.count,
          renderTime,
          domElements: countDomElements(result.container),
        });

        expect(renderTime).toBeLessThan(scale.timeout);
      },
      scale.timeout + 2000
    );

    it(
      `100 bins: ${scale.count} data points`,
      async () => {
        const start = performance.now();

        const config100Bins = { ...baseConfig, binCount: 100 };
        const testSetup = createPlotTestSetup(config100Bins, defaultDataTypeConfig, scale);
        const result = renderPlotCanvas(testSetup);

        await result.waitForPlot();

        const renderTime = performance.now() - start;

        logBenchmarkResult({
          plotType: 'histogram',
          variant: '100-bins',
          scale: scale.name,
          dataCount: scale.count,
          renderTime,
          domElements: countDomElements(result.container),
        });

        expect(renderTime).toBeLessThan(scale.timeout);
      },
      scale.timeout + 2000
    );
  });
});

// =============================================================================
// Line Chart Benchmarks
// =============================================================================

describe('Line Chart Rendering Performance', () => {
  const activeScales = getActiveScales();
  const baseConfig: PlotConfig = {
    type: 'line',
    xAxis: 'table1.x_value',
    yAxis: 'table1.y_value',
    scaleX: 'linear',
    scaleY: 'linear',
    showRegression: false,
    binCount: 10,
  };

  describe.each(activeScales)('Scale: %s', (scale) => {
    it(
      `baseline: ${scale.count} data points`,
      async () => {
        const start = performance.now();

        const testSetup = createPlotTestSetup(baseConfig, defaultDataTypeConfig, scale);
        const result = renderPlotCanvas(testSetup);

        await result.waitForPlot();

        const renderTime = performance.now() - start;

        logBenchmarkResult({
          plotType: 'line',
          scale: scale.name,
          dataCount: scale.count,
          renderTime,
          domElements: countDomElements(result.container),
        });

        expect(renderTime).toBeLessThan(scale.timeout);
      },
      scale.timeout + 2000
    );

    it(
      `with grouping (multiple lines): ${scale.count} data points`,
      async () => {
        const start = performance.now();

        const configWithGrouping = { ...baseConfig, groupBy: 'table1.category' };
        const testSetup = createPlotTestSetup(configWithGrouping, defaultDataTypeConfig, scale);
        const result = renderPlotCanvas(testSetup);

        await result.waitForPlot();

        const renderTime = performance.now() - start;

        logBenchmarkResult({
          plotType: 'line',
          variant: 'grouped',
          scale: scale.name,
          dataCount: scale.count,
          renderTime,
          domElements: countDomElements(result.container),
        });

        expect(renderTime).toBeLessThan(scale.timeout);
      },
      scale.timeout + 2000
    );
  });
});

// =============================================================================
// Summary
// =============================================================================

afterAll(() => {
  if (benchmarkResults.length > 0) {
    console.log('\n========================================');
    console.log('      RENDERING BENCHMARK SUMMARY');
    console.log('========================================');

    // Group by plot type
    const byPlotType = benchmarkResults.reduce((acc, r) => {
      const key = r.plotType;
      if (!acc[key]) acc[key] = [];
      acc[key].push(r);
      return acc;
    }, {} as Record<string, BenchmarkResult[]>);

    for (const [plotType, results] of Object.entries(byPlotType)) {
      console.log(`\n${plotType.toUpperCase()}:`);
      for (const r of results) {
        const variant = r.variant ? ` (${r.variant})` : '';
        console.log(
          `  ${r.scale}${variant}: ${r.renderTime.toFixed(2)}ms, ${r.domElements} elements`
        );
      }
    }

    console.log('\n========================================\n');
  }
});
