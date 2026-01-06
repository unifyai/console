/**
 * Line Chart Matrix Tests
 *
 * Comprehensive matrix tests covering all valid config combinations.
 * For edge cases and interactions, see line.browser.test.tsx
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
import { defineMatrixTests, TestUtils } from '../../utils/matrixTestRunnerBrowser';
import {
  assertLinePathIsValid,
  assertLineWithinPlotArea,
  assertLineSegmentCount,
  assertLinePassesThroughPoints,
} from './_line-test-helpers';

// =============================================================================
// Setup
// =============================================================================

afterEach(() => {
  cleanup();
});

// =============================================================================
// Matrix Tests
// =============================================================================

interface LineMatrixConfig {
  plotConfig: PlotConfig;
  dataTypeConfig: DataTypeConfig;
  scale: ScaleOption;
}

function generateLineMatrix(): LineMatrixConfig[] {
  const allPlotConfigs = generateValidPlotConfigsForType('line');
  // Production code (plot-line.ts line 142) accepts:
  // float, int, timestamp, time, timedelta, date, bool, Any
  // All are converted to numeric by getValue()
  const allDataTypes = generateDataTypeConfigs().filter(
    (dt) => ['float', 'int', 'datetime', 'time', 'timedelta', 'date', 'bool'].includes(dt.x_axis_type)
  );
  const activeScales = getActiveScales();

  const fullMatrix: LineMatrixConfig[] = [];
  for (const plotConfig of allPlotConfigs) {
    for (const dataTypeConfig of allDataTypes) {
      for (const scale of activeScales) {
        fullMatrix.push({ plotConfig, dataTypeConfig, scale });
      }
    }
  }

  return sampleConfigs(fullMatrix);
}

function defineLineTests(
  config: LineMatrixConfig,
  { it, expect }: TestUtils
): void {
  const { plotConfig, dataTypeConfig, scale } = config;
  const deterministicData = createDeterministicMockLogs(dataTypeConfig, scale.count);

  it('renders line chart correctly', async () => {
    const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
      deterministic: true,
    });
    const result = renderPlotCanvas(testSetup);
    await result.waitForPlot();

    // Core assertions - SVG and structure
    const svg = result.getSvg();
    expect(svg).not.toBeNull();
    assertAxesRendered(result);

    // Line path validation
    const linePath = result.getLinePath();
    assertLinePathIsValid(linePath);
    assertLineWithinPlotArea(linePath);
    assertLineSegmentCount(linePath, deterministicData);

    // Non-grouped: line passes through data points
    if (!plotConfig.group_by) {
      assertLinePassesThroughPoints(
        linePath,
        deterministicData,
        plotConfig.scale_x as 'linear' | 'log',
        plotConfig.scale_y as 'linear' | 'log'
      );
    }

    // Axis ticks
    const xTicks = result.getAxisTicks('x');
    const yTicks = result.getAxisTicks('y');
    if (xTicks.length + yTicks.length === 0) {
      const xAxis = result.getXAxis();
      const yAxis = result.getYAxis();
      expect(xAxis !== null || yAxis !== null).toBe(true);
    }

    // Grouped: multiple lines with different colors
    if (plotConfig.group_by) {
      const plotData = result.getPlotDataGroup();
      const paths = plotData?.querySelectorAll('path.line-item') ?? [];
      expect(paths.length).toBeGreaterThan(1);

      // All grouped paths should be valid
      for (const path of Array.from(paths)) {
        assertLinePathIsValid(path as SVGPathElement);
      }

      // Different colors for different groups
      if (paths.length > 1) {
        const strokeColors = new Set(
          Array.from(paths).map(p => p.getAttribute('stroke')).filter(Boolean)
        );
        expect(strokeColors.size).toBeGreaterThan(1);
      }
    }
  }, scale.timeout);
}

export const matrixTests = defineMatrixTests<LineMatrixConfig>({
  name: 'Line Chart - Matrix Tests',
  getMatrix: generateLineMatrix,
  defineTests: defineLineTests,
  chunkSize: 25,
  getConfigAlias: (config) =>
    generateTestAlias('line', config.plotConfig, config.dataTypeConfig, config.scale),
});
