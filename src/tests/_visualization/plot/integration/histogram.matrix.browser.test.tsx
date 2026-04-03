/**
 * Histogram Matrix Tests
 *
 * Comprehensive matrix tests covering all valid config combinations.
 * For edge cases and interactions, see histogram.browser.test.tsx
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
import { defineMatrixTests, TestUtils } from '../../../helpers/utils/matrixTestRunnerBrowser';
import {
  assertBinsHaveValidDimensions,
  assertBinsWithinPlotArea,
  assertBinCountInRange,
  assertGroupedBinsValid,
  assertConsistentBinWidths,
  assertBinsContiguous,
  assertBinsCoverDataRange,
  assertBinHeightsProportional,
} from './_histogram-test-helpers';

// =============================================================================
// Setup
// =============================================================================

afterEach(() => {
  cleanup();
});

// =============================================================================
// Matrix Tests
// =============================================================================

interface HistogramMatrixConfig {
  plotConfig: PlotConfig;
  dataTypeConfig: DataTypeConfig;
  scale: ScaleOption;
}

function generateHistogramMatrix(): HistogramMatrixConfig[] {
  const allPlotConfigs = generateValidPlotConfigsForType('histogram');
  // Production code (plot-histogram.ts line 150) accepts:
  // float, int, timestamp, time, timedelta, date, bool, Any
  // All are converted to numeric by getValue() before binning
  const allDataTypes = generateDataTypeConfigs().filter((dt) =>
    ['float', 'int', 'datetime', 'time', 'timedelta', 'date', 'bool'].includes(dt.xAxisType)
  );
  const activeScales = getActiveScales();

  const fullMatrix: HistogramMatrixConfig[] = [];
  for (const plotConfig of allPlotConfigs) {
    for (const dataTypeConfig of allDataTypes) {
      for (const scale of activeScales) {
        fullMatrix.push({ plotConfig, dataTypeConfig, scale });
      }
    }
  }

  return sampleConfigs(fullMatrix);
}

function defineHistogramTests(config: HistogramMatrixConfig, { it, expect }: TestUtils): void {
  const { plotConfig, dataTypeConfig, scale } = config;
  const deterministicData = createDeterministicMockLogs(dataTypeConfig, scale.count);
  const expectedGroupCount = dataTypeConfig.groupByType === 'bool' ? 2 : 5;

  it(
    'renders histogram correctly',
    async () => {
      const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
        deterministic: true,
      });
      const result = renderPlotCanvas(testSetup);
      await result.waitForPlot();

      // Core assertions - SVG and structure
      const svg = result.getSvg();
      expect(svg).not.toBeNull();
      assertAxesRendered(result);

      // Bin count
      const bins = result.getHistogramBins();
      const isGrouped = !!plotConfig.groupBy;
      assertBinCountInRange(
        bins,
        plotConfig.binCount,
        deterministicData.count,
        isGrouped,
        expectedGroupCount
      );

      // Bin dimensions
      if (plotConfig.groupBy) {
        assertGroupedBinsValid(bins, expectedGroupCount);
      } else {
        assertBinsHaveValidDimensions(bins);
      }
      assertBinsWithinPlotArea(bins);

      // Non-grouped specific assertions
      if (!plotConfig.groupBy) {
        assertConsistentBinWidths(bins);
        assertBinsContiguous(bins);
        assertBinsCoverDataRange(bins);
      }

      // Bin heights proportional to frequency
      assertBinHeightsProportional(bins);

      // Axis ticks
      const xTicks = result.getAxisTicks('x');
      const yTicks = result.getAxisTicks('y');
      expect(xTicks.length + yTicks.length).toBeGreaterThan(0);
    },
    scale.timeout
  );
}

export const matrixTests = defineMatrixTests<HistogramMatrixConfig>({
  name: 'Histogram - Matrix Tests',
  getMatrix: generateHistogramMatrix,
  defineTests: defineHistogramTests,
  chunkSize: 25,
  getConfigAlias: (config) =>
    generateTestAlias('histogram', config.plotConfig, config.dataTypeConfig, config.scale),
});
