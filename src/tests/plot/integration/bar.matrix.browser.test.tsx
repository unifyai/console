/**
 * Bar Chart Matrix Tests
 *
 * Comprehensive matrix tests covering all valid config combinations.
 * For edge cases and interactions, see bar.browser.test.tsx
 */

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import {
  renderPlotCanvas,
  createPlotTestSetup,
  assertAxesRendered,
} from '../fixtures/plotCanvasTestHarness';
import {
  generateValidPlotConfigsForType,
  generateDataTypeConfigs,
  getActiveScales,
  generateTestAlias,
  sampleConfigs,
  PlotConfig,
  DataTypeConfig,
  ScaleOption,
} from '../fixtures/configs';
import { createDeterministicMockLogs } from '../fixtures/mockData';
import { POSITION_TOLERANCE, AggregateType } from '../fixtures/calculations';
import { defineMatrixTests, TestUtils } from '../../utils/matrixTestRunnerBrowser';
import {
  assertBarsHaveValidDimensions,
  assertBarsWithinPlotArea,
  assertExactBarCount,
  assertConsistentBarWidths,
  assertBarsEvenlySpaced,
  assertBarHeightsMatchAggregatedValues,
} from './_bar-test-helpers';

// =============================================================================
// Setup
// =============================================================================

afterEach(() => {
  cleanup();
});

// =============================================================================
// Matrix Tests - Comprehensive Coverage with Exact Assertions
// =============================================================================

// Interface for matrix test configuration
interface BarMatrixConfig {
  plotConfig: PlotConfig;
  dataTypeConfig: DataTypeConfig;
  scale: ScaleOption;
}

/**
 * Generate the full matrix of test configurations.
 */
function generateBarChartMatrix(): BarMatrixConfig[] {
  // Get all valid plot configs for bar charts
  const allPlotConfigs = generateValidPlotConfigsForType('bar');

  // Bar charts accept ANY x-axis type (used as categorical labels via JSON.stringify)
  // Production code (plot-bar.ts line 168) has no dataType filter
  // y-axis must be numeric for meaningful aggregation
  const allDataTypes = generateDataTypeConfigs().filter(
    (dt) => ['float', 'int'].includes(dt.y_axis_type)
  );

  const activeScales = getActiveScales();

  // Build the full matrix first
  const fullMatrix: BarMatrixConfig[] = [];
  for (const plotConfig of allPlotConfigs) {
    for (const dataTypeConfig of allDataTypes) {
      for (const scale of activeScales) {
        fullMatrix.push({ plotConfig, dataTypeConfig, scale });
      }
    }
  }

  // Debug logging
  if (process.env.PLOT_TEST_MATRIX_DEBUG === 'true') {
    console.log(`[Bar Matrix] Plot configs: ${allPlotConfigs.length}`);
    console.log(`[Bar Matrix] Data types: ${allDataTypes.length}`);
    console.log(`[Bar Matrix] Scales: ${activeScales.length}`);
    console.log(`[Bar Matrix] Full matrix: ${fullMatrix.length}`);
  }

  // Sample the final matrix once
  const sampledMatrix = sampleConfigs(fullMatrix);
  
  if (process.env.PLOT_TEST_MATRIX_DEBUG === 'true') {
    console.log(`[Bar Matrix] Sampled matrix: ${sampledMatrix.length}`);
  }

  return sampledMatrix;
}

/**
 * Define tests for a single bar chart configuration.
 */
function defineBarChartTests(
  config: BarMatrixConfig,
  { it, expect }: TestUtils
): void {
  const { plotConfig, dataTypeConfig, scale } = config;
  const deterministicData = createDeterministicMockLogs(dataTypeConfig, scale.count);

  it('renders bar chart correctly', async () => {
    const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
      deterministic: true,
    });
    const result = renderPlotCanvas(testSetup);
    await result.waitForPlot();

    // Core assertions - SVG and structure
    const svg = result.getSvg();
    expect(svg).not.toBeNull();
    assertAxesRendered(result);

    // Bar count
    assertExactBarCount(
      result,
      deterministicData,
      'table1.x_value',
      !!plotConfig.groupBy,
      dataTypeConfig.group_by_type
    );

    // Bar dimensions and positions
    const bars = result.getBars();
    assertBarsHaveValidDimensions(bars);
    assertBarsWithinPlotArea(bars);

    // Bar heights match aggregated values
    assertBarHeightsMatchAggregatedValues(
      result,
      deterministicData,
      (plotConfig.aggregate as AggregateType) ?? 'sum'
    );

    // Axis ticks
    const xTicks = result.getAxisTicks('x');
    const yTicks = result.getAxisTicks('y');
    expect(xTicks.length + yTicks.length).toBeGreaterThan(0);

    // Non-grouped: consistent widths and spacing
    if (!plotConfig.groupBy) {
      assertConsistentBarWidths(bars);
      assertBarsEvenlySpaced(bars);
    }

    // Grouped: different colors
    if (plotConfig.groupBy && bars.length > 1) {
      const fillColors = new Set(
        bars.map((b) => b.getAttribute('fill')).filter(Boolean)
      );
      expect(fillColors.size).toBeGreaterThan(1);
    }

    // Sorting assertions
    if (plotConfig.sortBy && plotConfig.sortOrder && !plotConfig.groupBy &&
        (plotConfig.sortBy === 'value' || plotConfig.sortBy === 'y') && bars.length > 1) {
      const heights = bars.map(bar => parseFloat(bar.getAttribute('height') || '0'));
      if (plotConfig.sortOrder === 'asc') {
        for (let i = 1; i < heights.length; i++) {
          expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1] - POSITION_TOLERANCE);
        }
      } else if (plotConfig.sortOrder === 'desc') {
        for (let i = 1; i < heights.length; i++) {
          expect(heights[i]).toBeLessThanOrEqual(heights[i - 1] + POSITION_TOLERANCE);
        }
      }
    }

    // Grouped bar positions
    if (plotConfig.sortBy && plotConfig.sortOrder && plotConfig.groupBy) {
      expect(bars.length).toBeGreaterThan(0);
      const xPositions = bars.map(bar => parseFloat(bar.getAttribute('x') || '0'));
      for (const x of xPositions) {
        expect(x).toBeGreaterThanOrEqual(0);
      }
    }
  }, scale.timeout);
}

/**
 * Matrix test definition - exported for use by generated chunk files.
 */
export const matrixTests = defineMatrixTests<BarMatrixConfig>({
  name: 'Bar Chart - Matrix Tests',
  getMatrix: generateBarChartMatrix,
  defineTests: defineBarChartTests,
  chunkSize: 25,
  getConfigAlias: (config) =>
    generateTestAlias('bar', config.plotConfig, config.dataTypeConfig, config.scale),
});
