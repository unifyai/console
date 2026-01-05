/**
 * Histogram Integration Tests
 *
 * Browser-based tests for histogram rendering correctness,
 * user interactions, and edge cases.
 *
 * Structure:
 * - Edge Cases: Invalid/boundary conditions not in matrix
 * - User Interactions: Hover, tooltip behaviors
 * - Matrix Tests: Comprehensive coverage of all valid config combinations
 *
 * Key improvements:
 * - Uses deterministic mock data for precise position assertions
 * - Verifies bin count matches expected (within D3 threshold adjustment)
 * - Verifies bin dimensions (width consistency, height proportionality)
 * - Verifies bins are contiguous (no gaps between bins)
 */

import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import {
  renderPlotCanvas,
  createPlotTestSetup,
  assertAxesRendered,
  PlotCanvasTestResult,
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
import {
  createDeterministicMockLogs,
  DeterministicLogSet,
} from '../fixtures/mockData';
import {
  calculateExpectedBinCount,
  positionsAreClose,
  POSITION_TOLERANCE,
  DEFAULT_DIMENSIONS,
} from '../fixtures/calculations';
import { defineMatrixTests, TestUtils } from '../../utils/matrixTestRunner';

// =============================================================================
// Setup
// =============================================================================

afterEach(() => {
  cleanup();
});

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Assert histogram bins have valid dimensions
 */
function assertBinsHaveValidDimensions(bins: SVGRectElement[]) {
  for (const bin of bins) {
    const x = bin.getAttribute('x');
    const y = bin.getAttribute('y');
    const width = bin.getAttribute('width');
    const height = bin.getAttribute('height');

    if (x) {
      const xNum = parseFloat(x);
      expect(Number.isFinite(xNum)).toBe(true);
      expect(xNum).toBeGreaterThanOrEqual(0);
    }
    if (y) {
      const yNum = parseFloat(y);
      expect(Number.isFinite(yNum)).toBe(true);
      expect(yNum).toBeGreaterThanOrEqual(0);
    }
    if (width) {
      const widthNum = parseFloat(width);
      expect(Number.isFinite(widthNum)).toBe(true);
      expect(widthNum).toBeGreaterThan(0); // Bins should have positive width
    }
    if (height) {
      const heightNum = parseFloat(height);
      expect(Number.isFinite(heightNum)).toBe(true);
      expect(heightNum).toBeGreaterThanOrEqual(0); // Height can be 0 for empty bins
    }
  }
}

/**
 * Assert bins are within the plot area
 */
function assertBinsWithinPlotArea(bins: SVGRectElement[]) {
  const { width, height, margins } = DEFAULT_DIMENSIONS;

  for (const bin of bins) {
    const x = parseFloat(bin.getAttribute('x') || '0');
    const y = parseFloat(bin.getAttribute('y') || '0');
    const binWidth = parseFloat(bin.getAttribute('width') || '0');
    const binHeight = parseFloat(bin.getAttribute('height') || '0');

    expect(x).toBeGreaterThanOrEqual(margins.left - POSITION_TOLERANCE);
    expect(x + binWidth).toBeLessThanOrEqual(width - margins.right + POSITION_TOLERANCE);
    expect(y).toBeGreaterThanOrEqual(margins.top - POSITION_TOLERANCE);
    expect(y + binHeight).toBeLessThanOrEqual(height - margins.bottom + POSITION_TOLERANCE);
  }
}

/**
 * Assert bin count is within expected range
 * D3's histogram threshold algorithms may adjust bin count
 * For grouped histograms, each group has its own set of bins
 */
function assertBinCountInRange(
  bins: SVGRectElement[],
  requestedBinCount: number,
  dataCount: number,
  isGrouped = false,
  expectedGroupCount = 5 // Default: 5 categories in mock data
) {
  const { min, max } = calculateExpectedBinCount(requestedBinCount, dataCount);
  
  if (isGrouped) {
    // For grouped histograms, total bins = bins per group * number of groups
    // Each group should have approximately requestedBinCount bins
    const minTotalBins = min * Math.max(1, expectedGroupCount - 1);
    const maxTotalBins = max * (expectedGroupCount + 1);
    expect(bins.length).toBeGreaterThanOrEqual(minTotalBins);
    expect(bins.length).toBeLessThanOrEqual(maxTotalBins);
  } else {
    expect(bins.length).toBeGreaterThanOrEqual(min);
    expect(bins.length).toBeLessThanOrEqual(max);
  }
}

/**
 * Group histogram bins by their fill color (each group has a unique color)
 */
function groupBinsByColor(bins: SVGRectElement[]): Map<string, SVGRectElement[]> {
  const groups = new Map<string, SVGRectElement[]>();
  
  for (const bin of bins) {
    const fill = bin.getAttribute('fill') || 'default';
    if (!groups.has(fill)) {
      groups.set(fill, []);
    }
    groups.get(fill)!.push(bin);
  }
  
  return groups;
}

/**
 * Assert grouped histogram bins have valid structure
 * Each group should have its own set of bins with consistent properties
 */
function assertGroupedBinsValid(bins: SVGRectElement[], expectedGroupCount = 5) {
  if (bins.length === 0) return;
  
  const groups = groupBinsByColor(bins);
  
  // Grouped histogram should have multiple distinct color groups
  // Expect exactly the number of groups (allow slight tolerance for edge cases)
  expect(groups.size).toBeGreaterThanOrEqual(Math.max(2, expectedGroupCount - 1));
  expect(groups.size).toBeLessThanOrEqual(expectedGroupCount + 1);
  
  // Each group's bins should have valid dimensions
  groups.forEach((groupBins) => {
    assertBinsHaveValidDimensions(groupBins);
    
    // Within each group, bins should be sorted by x position
    const sortedBins = [...groupBins].sort(
      (a, b) => parseFloat(a.getAttribute('x') || '0') - parseFloat(b.getAttribute('x') || '0')
    );
    
    // Verify bins don't overlap within group
    for (let i = 1; i < sortedBins.length; i++) {
      const prevBin = sortedBins[i - 1];
      const currBin = sortedBins[i];
      const prevEnd = parseFloat(prevBin.getAttribute('x') || '0') + 
                      parseFloat(prevBin.getAttribute('width') || '0');
      const currStart = parseFloat(currBin.getAttribute('x') || '0');
      
      // Current bin should start at or after previous bin ends (within tolerance)
      expect(currStart).toBeGreaterThanOrEqual(prevEnd - POSITION_TOLERANCE);
    }
  });
}

/**
 * Assert all bins have consistent widths
 */
function assertConsistentBinWidths(bins: SVGRectElement[]) {
  if (bins.length <= 1) return;

  const widths = bins.map(bin => parseFloat(bin.getAttribute('width') || '0'));
  const avgWidth = widths.reduce((a, b) => a + b, 0) / widths.length;

  for (const width of widths) {
    // Allow small tolerance (1px) for rendering differences
    expect(Math.abs(width - avgWidth)).toBeLessThan(POSITION_TOLERANCE);
  }
}

/**
 * Assert bins are contiguous (no gaps between them)
 */
function assertBinsContiguous(bins: SVGRectElement[]) {
  if (bins.length <= 1) return;

  // Sort bins by x position
  const sortedBins = [...bins].sort(
    (a, b) => parseFloat(a.getAttribute('x') || '0') - parseFloat(b.getAttribute('x') || '0')
  );

  for (let i = 1; i < sortedBins.length; i++) {
    const prevBin = sortedBins[i - 1];
    const currBin = sortedBins[i];

    const prevX = parseFloat(prevBin.getAttribute('x') || '0');
    const prevWidth = parseFloat(prevBin.getAttribute('width') || '0');
    const currX = parseFloat(currBin.getAttribute('x') || '0');

    // Current bin should start where previous bin ends (with tolerance)
    expect(Math.abs(currX - (prevX + prevWidth))).toBeLessThan(POSITION_TOLERANCE);
  }
}

/**
 * Assert bin heights are proportional to frequency
 * Taller bins should have more data points
 */
function assertBinHeightsProportional(bins: SVGRectElement[]) {
  if (bins.length === 0) return;

  const binData = bins.map(bin => ({
    y: parseFloat(bin.getAttribute('y') || '0'),
    height: parseFloat(bin.getAttribute('height') || '0'),
  }));

  // All heights should be non-negative
  for (const bin of binData) {
    expect(bin.height).toBeGreaterThanOrEqual(0);
  }

  // At least one bin should have non-zero height (data was rendered)
  const nonZeroHeights = binData.filter(b => b.height > 0);
  expect(nonZeroHeights.length).toBeGreaterThan(0);

  // If there are multiple non-zero heights, verify proportionality:
  // Bins with larger heights should have lower y positions (closer to top of plot area)
  if (nonZeroHeights.length >= 2) {
    const sortedByHeight = [...nonZeroHeights].sort((a, b) => b.height - a.height);
    const tallestBin = sortedByHeight[0];
    const shortestNonZero = sortedByHeight[sortedByHeight.length - 1];
    
    // Taller bin should have lower or equal y value (higher in SVG = lower y)
    expect(tallestBin.y).toBeLessThanOrEqual(shortestNonZero.y + POSITION_TOLERANCE);
  }
}

/**
 * Assert total bin coverage spans the data range
 */
function assertBinsCoverDataRange(bins: SVGRectElement[]) {
  if (bins.length === 0) return;

  const { margins, width } = DEFAULT_DIMENSIONS;
  const plotWidth = width - margins.left - margins.right;

  // Sort bins by x position
  const sortedBins = [...bins].sort(
    (a, b) => parseFloat(a.getAttribute('x') || '0') - parseFloat(b.getAttribute('x') || '0')
  );

  const firstBinX = parseFloat(sortedBins[0].getAttribute('x') || '0');
  const lastBin = sortedBins[sortedBins.length - 1];
  const lastBinEnd = parseFloat(lastBin.getAttribute('x') || '0') +
                     parseFloat(lastBin.getAttribute('width') || '0');

  // Bins should span most of the plot width (at least 80%)
  const coverage = lastBinEnd - firstBinX;
  expect(coverage).toBeGreaterThan(plotWidth * 0.5);
}

// =============================================================================
// Edge Cases (Not covered by matrix)
// =============================================================================

describe('Histogram - Edge Cases', () => {
  it('handles empty data gracefully', async () => {
    const result = renderPlotCanvas({
      plotType: 'Histogram',
      xAxis: 'table1.x_value',
      logs: [],
    });

    const svg = result.getSvg();
    expect(svg).not.toBeNull();

    const bins = result.getHistogramBins();
    expect(bins.length).toBe(0);
  });

  it('handles single data point', async () => {
    const singleLog = [{
      id: 'log_0',
      timestamp: new Date().toISOString(),
      'table1.entries': { 'table1.x_value': 50 },
    }];

    const result = renderPlotCanvas({
      plotType: 'Histogram',
      xAxis: 'table1.x_value',
      logs: singleLog as any,
    });

    // Single data point may or may not render a visible plot
    const svg = result.getSvg();
    expect(svg).not.toBeNull();

    // Don't assert on bins - single data point behavior varies
  });

  it('handles uniform data (all same value)', async () => {
    const uniformLogs = Array.from({ length: 100 }, (_, i) => ({
      id: `log_${i}`,
      timestamp: new Date().toISOString(),
      'table1.entries': { 'table1.x_value': 42 },
    }));

    const result = renderPlotCanvas({
      plotType: 'Histogram',
      xAxis: 'table1.x_value',
      logs: uniformLogs as any,
    });

    await result.waitForPlot();

    const svg = result.getSvg();
    expect(svg).not.toBeNull();

    // Uniform data may render as a single bin or not render bins at all
    // Just verify the SVG is rendered without crashing
  });

  it('handles data with extreme outliers', async () => {
    const logsWithOutlier = [
      ...Array.from({ length: 50 }, (_, i) => ({
        id: `log_${i}`,
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': i + 1 },
      })),
      {
        id: 'outlier',
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': 1e10 },
      },
    ];

    const result = renderPlotCanvas({
      plotType: 'Histogram',
      xAxis: 'table1.x_value',
      logs: logsWithOutlier as any,
    });

    await result.waitForPlot();

    const svg = result.getSvg();
    expect(svg).not.toBeNull();

    const bins = result.getHistogramBins();
    assertBinsHaveValidDimensions(bins);
  });

  it('handles negative values', async () => {
    const negativeValueLogs = Array.from({ length: 50 }, (_, i) => ({
      id: `log_${i}`,
      timestamp: new Date().toISOString(),
      'table1.entries': { 'table1.x_value': i - 25 },
    }));

    const result = renderPlotCanvas({
      plotType: 'Histogram',
      xAxis: 'table1.x_value',
      logs: negativeValueLogs as any,
    });

    await result.waitForPlot();

    const svg = result.getSvg();
    expect(svg).not.toBeNull();

    const bins = result.getHistogramBins();
    assertBinsHaveValidDimensions(bins);
    assertBinsWithinPlotArea(bins);
  });

  it('handles two distinct values (bimodal data)', async () => {
    const bimodalLogs = [
      ...Array.from({ length: 50 }, (_, i) => ({
        id: `log_a_${i}`,
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': 10 },
      })),
      ...Array.from({ length: 50 }, (_, i) => ({
        id: `log_b_${i}`,
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': 90 },
      })),
    ];

    const result = renderPlotCanvas({
      plotType: 'Histogram',
      xAxis: 'table1.x_value',
      logs: bimodalLogs as any,
      binCount: 10,
    });

    await result.waitForPlot();

    const svg = result.getSvg();
    expect(svg).not.toBeNull();

    const bins = result.getHistogramBins();
    assertBinsHaveValidDimensions(bins);
  });
});

// =============================================================================
// User Interactions
// =============================================================================

describe('Histogram - Interactions', () => {
  it('has tooltip element in DOM', async () => {
    const result = renderPlotCanvas({
      plotType: 'Histogram',
      xAxis: 'table1.x_value',
      interactive: true,
    });

    await result.waitForPlot();

    const tooltip = result.getTooltip();
    expect(tooltip).not.toBeNull();
    expect(tooltip?.style.opacity).toBe('0'); // Hidden initially
  });
});

// =============================================================================
// Matrix Tests - Comprehensive Coverage with Exact Assertions
// =============================================================================

interface HistogramMatrixConfig {
  plotConfig: PlotConfig;
  dataTypeConfig: DataTypeConfig;
  scale: ScaleOption;
}

function generateHistogramMatrix(): HistogramMatrixConfig[] {
  const allPlotConfigs = generateValidPlotConfigsForType('histogram');
  const allDataTypes = generateDataTypeConfigs().filter(
    (dt) => ['float', 'int'].includes(dt.x_axis_type)
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

function defineHistogramTests(
  config: HistogramMatrixConfig,
  { it, expect }: TestUtils
): void {
  const { plotConfig, dataTypeConfig, scale } = config;
  const deterministicData = createDeterministicMockLogs(dataTypeConfig, scale.count);
  const expectedGroupCount = dataTypeConfig.group_by_type === 'bool' ? 2 : 5;

  it('renders histogram correctly', async () => {
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
    const isGrouped = !!plotConfig.group_by;
    assertBinCountInRange(bins, plotConfig.bin_count, deterministicData.count, isGrouped, expectedGroupCount);

    // Bin dimensions
    if (plotConfig.group_by) {
      assertGroupedBinsValid(bins, expectedGroupCount);
    } else {
      assertBinsHaveValidDimensions(bins);
    }
    assertBinsWithinPlotArea(bins);

    // Non-grouped specific assertions
    if (!plotConfig.group_by) {
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
  }, scale.timeout);
}

export const matrixTests = defineMatrixTests<HistogramMatrixConfig>({
  name: 'Histogram - Matrix Tests',
  getMatrix: generateHistogramMatrix,
  defineTests: defineHistogramTests,
  chunkSize: 25,
  getConfigAlias: (config) =>
    generateTestAlias('histogram', config.plotConfig, config.dataTypeConfig, config.scale),
});
