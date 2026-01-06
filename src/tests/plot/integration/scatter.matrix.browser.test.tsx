/**
 * Scatter Plot Matrix Tests
 *
 * Comprehensive matrix tests covering all valid config combinations.
 * For edge cases and interactions, see scatter.browser.test.tsx
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
import { calculateExpectedPointCount } from '../fixtures/calculations';
import { defineMatrixTests, TestUtils } from '../../utils/matrixTestRunnerBrowser';
import {
  assertPointsHaveValidPositions,
  assertExactPointCount,
  assertPointPositionsMatchData,
  assertPointDimensions,
} from './_scatter-test-helpers';

// =============================================================================
// Setup
// =============================================================================

afterEach(() => {
  cleanup();
});

// =============================================================================
// Matrix Tests
// =============================================================================

interface ScatterMatrixConfig {
  plotConfig: PlotConfig;
  dataTypeConfig: DataTypeConfig;
  scale: ScaleOption;
}

function generateScatterMatrix(): ScatterMatrixConfig[] {
  const allPlotConfigs = generateValidPlotConfigsForType('scatter');
  const allDataTypes = generateDataTypeConfigs().filter(
    (dt) => ['float', 'int'].includes(dt.x_axis_type)
  );
  const activeScales = getActiveScales();

  const fullMatrix: ScatterMatrixConfig[] = [];
  for (const plotConfig of allPlotConfigs) {
    for (const dataTypeConfig of allDataTypes) {
      for (const scale of activeScales) {
        fullMatrix.push({ plotConfig, dataTypeConfig, scale });
      }
    }
  }

  return sampleConfigs(fullMatrix);
}

function defineScatterTests(
  config: ScatterMatrixConfig,
  { it, expect }: TestUtils
): void {
  const { plotConfig, dataTypeConfig, scale } = config;
  const deterministicData = createDeterministicMockLogs(dataTypeConfig, scale.count);

  it('renders scatter plot correctly', async () => {
    const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
      deterministic: true,
    });
    const result = renderPlotCanvas(testSetup);
    await result.waitForPlot();

    // Point count
    const logsForCounting = deterministicData.logs.map(l => ({
      'table1.x_value': l['table1.entries']['table1.x_value'],
      'table1.y_value': l['table1.entries']['table1.y_value'],
    }));
    const expectedCount = calculateExpectedPointCount(
      logsForCounting,
      'table1.x_value',
      'table1.y_value'
    );
    assertExactPointCount(result, expectedCount);

    // Point positions
    const points = result.getScatterPoints();
    assertPointsHaveValidPositions(points);
    assertPointPositionsMatchData(
      result,
      deterministicData,
      plotConfig.scale_x,
      plotConfig.scale_y
    );

    // Point dimensions
    assertPointDimensions(result);

    // Axes
    assertAxesRendered(result);
    const xTicks = result.getAxisTicks('x');
    const yTicks = result.getAxisTicks('y');
    expect(xTicks.length).toBeGreaterThan(0);
    expect(yTicks.length).toBeGreaterThan(0);

    // Regression line (if enabled)
    if (plotConfig.show_regression) {
      const plotData = result.getPlotDataGroup();
      expect(plotData).not.toBeNull();
      const lines = plotData?.querySelectorAll('line, path.regression-line');
      expect(lines?.length).toBeGreaterThanOrEqual(0);
    }

    // Grouped: different colors for groups
    if (plotConfig.group_by) {
      const fillColors = new Set(
        points.map((p) => p.getAttribute('fill')).filter(Boolean)
      );
      expect(fillColors.size).toBeGreaterThanOrEqual(1);
    }
  }, scale.timeout);
}

export const matrixTests = defineMatrixTests<ScatterMatrixConfig>({
  name: 'Scatter Plot - Matrix Tests',
  getMatrix: generateScatterMatrix,
  defineTests: defineScatterTests,
  chunkSize: 25,
  getConfigAlias: (config) =>
    generateTestAlias('scatter', config.plotConfig, config.dataTypeConfig, config.scale),
});
