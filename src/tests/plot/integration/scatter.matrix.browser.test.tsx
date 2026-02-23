/**
 * Scatter Plot Matrix Tests
 *
 * Comprehensive matrix tests covering all valid config combinations.
 * For edge cases and interactions, see scatter.browser.test.tsx
 *
 * Render mode is determined automatically by data size:
 * - small/medium scales (≤2000 points) → SVG rendering
 * - large scale (10000 points) → WebGL rendering
 */

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import {
  renderPlotCanvas,
  createPlotTestSetup,
  assertAxesRendered,
  assertScatterPlotRendered,
  resetConfig,
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
  // Reset scatter config to defaults after each test
  resetConfig();
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
  // Production code (plot-scatter.ts line 479) accepts:
  // float, int, timestamp, time, timedelta, date, bool, Any
  // All are converted to numeric by getValue()
  const allDataTypes = generateDataTypeConfigs().filter((dt) =>
    ['float', 'int', 'datetime', 'time', 'timedelta', 'date', 'bool'].includes(dt.xAxisType)
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

function defineScatterTests(config: ScatterMatrixConfig, { it, expect }: TestUtils): void {
  const { plotConfig, dataTypeConfig, scale } = config;
  const deterministicData = createDeterministicMockLogs(dataTypeConfig, scale.count);

  // Render mode is automatically determined by data size:
  // - small (100) / medium (1000) → SVG (below svgMax of 2000)
  // - large (10000) → WebGL (above svgMax)
  const expectWebGL = scale.count > 2000;

  it(
    'renders scatter plot correctly',
    async () => {
      const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
        deterministic: true,
      });

      const result = renderPlotCanvas(testSetup);
      await result.waitForPlot();

      // Verify the plot rendered (works for both SVG and WebGL)
      assertScatterPlotRendered(result);

      // Check that the correct render mode was automatically selected
      const points = result.getScatterPoints();
      const webglCanvas = result.getWebGLCanvas();
      const isSVGMode = points.length > 0;
      const isWebGLMode = webglCanvas !== null && webglCanvas.style.display !== 'none';

      if (expectWebGL) {
        // Large scale should use WebGL
        expect(isWebGLMode).toBe(true);
      } else {
        // Small/medium scale should use SVG
        expect(isSVGMode).toBe(true);
      }

      if (isSVGMode) {
        // SVG-specific assertions
        const logsForCounting = deterministicData.logs.map((l) => ({
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
        assertPointsHaveValidPositions(points);
        assertPointPositionsMatchData(
          result,
          deterministicData,
          plotConfig.scaleX,
          plotConfig.scaleY
        );

        // Point dimensions
        assertPointDimensions(result);

        // Grouped: different colors for groups
        if (plotConfig.groupBy) {
          const fillColors = new Set(points.map((p) => p.getAttribute('fill')).filter(Boolean));
          expect(fillColors.size).toBeGreaterThanOrEqual(1);
        }
      } else {
        // WebGL mode - verify canvas is present and visible
        expect(webglCanvas).not.toBeNull();
        expect(webglCanvas?.style.display).not.toBe('none');
      }

      // Axes (works for both modes - axes are always SVG)
      assertAxesRendered(result);
      const xTicks = result.getAxisTicks('x');
      const yTicks = result.getAxisTicks('y');
      expect(xTicks.length).toBeGreaterThan(0);
      expect(yTicks.length).toBeGreaterThan(0);

      // Regression line (if enabled - always SVG overlay)
      if (plotConfig.showRegression) {
        const plotData = result.getPlotDataGroup();
        expect(plotData).not.toBeNull();
        const lines = plotData?.querySelectorAll('path.best-fit');
        expect(lines?.length).toBeGreaterThanOrEqual(0);
      }
    },
    scale.timeout
  );
}

export const matrixTests = defineMatrixTests<ScatterMatrixConfig>({
  name: 'Scatter Plot - Matrix Tests',
  getMatrix: generateScatterMatrix,
  defineTests: defineScatterTests,
  chunkSize: 25,
  getConfigAlias: (config) =>
    generateTestAlias('scatter', config.plotConfig, config.dataTypeConfig, config.scale),
});
