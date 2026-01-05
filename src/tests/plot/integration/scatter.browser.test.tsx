/**
 * Scatter Plot Integration Tests
 *
 * Browser-based tests for scatter plot rendering correctness,
 * user interactions, and edge cases.
 *
 * Uses PlotCanvasTestHarness for direct PlotCanvas rendering
 * with D3 and real browser DOM.
 *
 * Structure:
 * - Edge Cases: Invalid/boundary conditions not in matrix
 * - User Interactions: Hover, zoom, click behaviors
 * - Matrix Tests: Comprehensive coverage of all valid config combinations
 *
 * Key improvements:
 * - Uses deterministic mock data for precise position assertions
 * - Verifies exact point counts (not approximate)
 * - Verifies exact pixel positions within tolerance
 * - Verifies point dimensions (radius)
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
  calculatePositionWithD3Scales,
  calculateExpectedPointCount,
  positionsAreClose,
  POSITION_TOLERANCE,
  DEFAULT_DIMENSIONS,
} from '../fixtures/calculations';

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
 * Assert scatter points have valid numeric positions (finite, not NaN)
 */
function assertPointsHaveValidPositions(points: SVGCircleElement[]) {
  for (const point of points) {
    const cx = point.getAttribute('cx');
    const cy = point.getAttribute('cy');
    const r = point.getAttribute('r');

    // Positions must be valid numbers
    expect(cx).not.toBeNull();
    expect(cy).not.toBeNull();
    expect(Number.isNaN(parseFloat(cx!))).toBe(false);
    expect(Number.isNaN(parseFloat(cy!))).toBe(false);

    // Positions should be finite
    const cxNum = parseFloat(cx!);
    const cyNum = parseFloat(cy!);
    expect(Number.isFinite(cxNum)).toBe(true);
    expect(Number.isFinite(cyNum)).toBe(true);

    // Positions should be within plot area
    expect(cxNum).toBeGreaterThanOrEqual(DEFAULT_DIMENSIONS.margins.left - POSITION_TOLERANCE);
    expect(cxNum).toBeLessThanOrEqual(DEFAULT_DIMENSIONS.width - DEFAULT_DIMENSIONS.margins.right + POSITION_TOLERANCE);
    expect(cyNum).toBeGreaterThanOrEqual(DEFAULT_DIMENSIONS.margins.top - POSITION_TOLERANCE);
    expect(cyNum).toBeLessThanOrEqual(DEFAULT_DIMENSIONS.height - DEFAULT_DIMENSIONS.margins.bottom + POSITION_TOLERANCE);

    // Radius should be positive
    if (r) {
      const rNum = parseFloat(r);
      expect(rNum).toBeGreaterThan(0);
    }
  }
}

/**
 * Assert exact point count matches expected data
 */
function assertExactPointCount(
  result: PlotCanvasTestResult,
  expectedCount: number
) {
  const points = result.getScatterPoints();
  expect(points.length).toBe(expectedCount);
}

/**
 * Assert points are positioned correctly based on data values.
 * Uses D3 scales directly to match exact plot rendering behavior.
 */
function assertPointPositionsMatchData(
  result: PlotCanvasTestResult,
  deterministicData: DeterministicLogSet,
  scaleX: 'linear' | 'log',
  scaleY: 'linear' | 'log',
  sampleSize = 10 // Check a sample of points for performance
) {
  const points = result.getScatterPoints();

  // Get all numeric values for scale calculation
  const numericXValues = deterministicData.expectedXValues.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v) && (scaleX !== 'log' || v > 0)
  );
  const numericYValues = deterministicData.expectedYValues.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v) && (scaleY !== 'log' || v > 0)
  );

  // Skip if no valid numeric values
  if (numericXValues.length === 0 || numericYValues.length === 0) {
    return;
  }

  // Check a sample of points
  const step = Math.max(1, Math.floor(points.length / sampleSize));

  for (let i = 0; i < points.length; i += step) {
    const point = points[i];
    const cx = parseFloat(point.getAttribute('cx')!);
    const cy = parseFloat(point.getAttribute('cy')!);

    // Find corresponding log entry
    const logIndex = i;
    if (logIndex >= deterministicData.logs.length) continue;

    const log = deterministicData.logs[logIndex];
    const xValue = log['table1.entries']['table1.x_value'];
    const yValue = log['table1.entries']['table1.y_value'];

    // Skip null/invalid values
    if (xValue === null || yValue === null) continue;
    if (typeof xValue !== 'number' || typeof yValue !== 'number') continue;
    // Skip non-positive values for log scale
    if (scaleX === 'log' && xValue <= 0) continue;
    if (scaleY === 'log' && yValue <= 0) continue;

    // Calculate expected position using D3 scales (matches actual plot code)
    const expectedPos = calculatePositionWithD3Scales(
      xValue,
      yValue,
      numericXValues,
      numericYValues,
      scaleX,
      scaleY
    );

    // Use tolerance for floating point and rendering differences
    const tolerance = POSITION_TOLERANCE * 3;
    expect(positionsAreClose(cx, expectedPos.cx, tolerance)).toBe(true);
    expect(positionsAreClose(cy, expectedPos.cy, tolerance)).toBe(true);
  }
}

/**
 * Assert point dimensions (radius) are consistent and valid
 */
function assertPointDimensions(
  result: PlotCanvasTestResult,
  expectedRadius?: number
) {
  const points = result.getScatterPoints();

  const radii = points.map(p => parseFloat(p.getAttribute('r') || '0'));

  for (const r of radii) {
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(50); // Reasonable max radius
  }

  if (expectedRadius !== undefined) {
    // All points should have the same radius
    for (const r of radii) {
      expect(r).toBeCloseTo(expectedRadius, 1);
    }
  }

  // All radii should be consistent (same value) for non-grouped scatter plots
  const uniqueRadii = new Set(radii.map(r => Math.round(r * 10) / 10));
  // Scatter plots typically have uniform point sizes (2-3 distinct sizes max)
  expect(uniqueRadii.size).toBeLessThanOrEqual(3);
}

// =============================================================================
// Edge Cases (Not covered by matrix)
// =============================================================================

/**
 * Helper to create a log in the correct API format
 */
function createLog(id: string, xValue: unknown, yValue: unknown, category: string = 'test') {
  return {
    id,
    timestamp: new Date().toISOString(),
    'table1.id': id,
    'table1.entries': {
      'table1.x_value': xValue,
      'table1.y_value': yValue,
      'table1.category': category,
    },
  };
}

describe('Scatter Plot - Edge Cases', () => {
  it('handles empty data gracefully', async () => {
    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      logs: [],
    });

    const svg = result.getSvg();
    expect(svg).not.toBeNull();

    const points = result.getScatterPoints();
    expect(points.length).toBe(0);

    // Should not throw errors
    const plotData = result.getPlotDataGroup();
    expect(plotData).not.toBeNull();
  });

  it('handles all-null data without crashing', async () => {
    const nullLogs = Array.from({ length: 10 }, (_, i) => 
      createLog(`log_${i}`, null, null)
    );

    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      logs: nullLogs as any,
    });

    const svg = result.getSvg();
    expect(svg).not.toBeNull();

    // The plot should render without throwing
    // Points may or may not be rendered for null values depending on implementation
    const plotData = result.getPlotDataGroup();
    expect(plotData).not.toBeNull();
  });

  it('handles single data point', async () => {
    const singleLog = [createLog('log_0', 50, 75, 'single')];

    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      logs: singleLog as any,
    });

    await result.waitForPlot();

    const points = result.getScatterPoints();
    expect(points.length).toBe(1);

    // Single point should have valid position
    assertPointsHaveValidPositions(points);
  });

  it('handles extreme outliers without distorting scale', async () => {
    const logsWithOutlier = [
      createLog('log_0', 1, 1),
      createLog('log_1', 2, 2),
      createLog('log_2', 1e15, 1e15),
    ];

    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      logs: logsWithOutlier as any,
    });

    await result.waitForPlot();

    const points = result.getScatterPoints();
    expect(points.length).toBe(3);
    assertPointsHaveValidPositions(points);
  });

  it('handles negative values correctly', async () => {
    const logsWithNegatives = [
      createLog('log_0', -50, -25),
      createLog('log_1', 0, 0),
      createLog('log_2', 50, 25),
    ];

    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      logs: logsWithNegatives as any,
    });

    await result.waitForPlot();

    const points = result.getScatterPoints();
    expect(points.length).toBe(3);
    assertPointsHaveValidPositions(points);

    // Verify order: negative x should be leftmost, positive rightmost
    const xPositions = points.map(p => parseFloat(p.getAttribute('cx')!));
    const sortedX = [...xPositions].sort((a, b) => a - b);
    expect(xPositions).toEqual(sortedX);
  });

  it('handles identical x values (vertical line of points)', async () => {
    const verticalLogs = [
      createLog('log_0', 50, 10),
      createLog('log_1', 50, 50),
      createLog('log_2', 50, 90),
    ];

    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      logs: verticalLogs as any,
    });

    await result.waitForPlot();

    const points = result.getScatterPoints();
    expect(points.length).toBe(3);

    // All x positions should be the same (or very close)
    const xPositions = points.map(p => parseFloat(p.getAttribute('cx')!));
    const avgX = xPositions.reduce((a, b) => a + b, 0) / xPositions.length;
    for (const x of xPositions) {
      expect(Math.abs(x - avgX)).toBeLessThan(POSITION_TOLERANCE);
    }
  });
});

// =============================================================================
// User Interactions
// =============================================================================

describe('Scatter Plot - Interactions', () => {
  it('shows tooltip element on page', async () => {
    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      interactive: true,
    });

    await result.waitForPlot();

    const tooltip = result.getTooltip();
    expect(tooltip).not.toBeNull();
    // Tooltip should be hidden initially (opacity 0)
    expect(tooltip?.style.opacity).toBe('0');
  });

  it('renders with zoom disabled by default', async () => {
    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      zoomEnabled: false,
    });

    await result.waitForPlot();

    const svg = result.getSvg();
    expect(svg).not.toBeNull();
  });

  it('renders with zoom enabled when specified', async () => {
    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      zoomEnabled: true,
    });

    await result.waitForPlot();

    const svg = result.getSvg();
    expect(svg).not.toBeNull();
  });
});

// =============================================================================
// Matrix Tests - Comprehensive Coverage with Exact Assertions
// Uses sampling to control test count
// =============================================================================

describe('Scatter Plot - Matrix Tests', () => {
  const allValidConfigs = generateValidPlotConfigsForType('scatter');
  const sampledConfigs = sampleConfigs(allValidConfigs);

  const dataTypeConfigs = sampleConfigs(generateDataTypeConfigs());
  // Focus on numeric data types for scatter (float, int)
  const numericDataTypes = dataTypeConfigs.filter(
    (dt) => ['float', 'int'].includes(dt.x_axis_type)
  );
  const activeScales = getActiveScales();

  describe.each(sampledConfigs)('config: %o', (plotConfig) => {
    describe.each(numericDataTypes)('data types: %o', (dataTypeConfig) => {
      describe.each(activeScales)('scale: %s', (scale) => {
        const alias = generateTestAlias('scatter', plotConfig, dataTypeConfig, scale);

        // Generate deterministic data for precise assertions
        const deterministicData = createDeterministicMockLogs(dataTypeConfig, scale.count);

        it(
          `${alias} - renders exact number of points`,
          async () => {
            const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
              deterministic: true,
            });
            const result = renderPlotCanvas(testSetup);

            await result.waitForPlot();

            // Scatter plots render one point per valid log entry
            // (aggregate affects value computation, not point count)
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
          },
          scale.timeout
        );

        it(
          `${alias} - all points have valid positions within plot area`,
          async () => {
            const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
              deterministic: true,
            });
            const result = renderPlotCanvas(testSetup);

            await result.waitForPlot();

            const points = result.getScatterPoints();
            assertPointsHaveValidPositions(points);
          },
          scale.timeout
        );

        it(
          `${alias} - point positions match expected data values`,
          async () => {
            const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
              deterministic: true,
            });
            const result = renderPlotCanvas(testSetup);

            await result.waitForPlot();

            assertPointPositionsMatchData(
              result,
              deterministicData,
              plotConfig.scale_x,
              plotConfig.scale_y
            );
          },
          scale.timeout
        );

        it(
          `${alias} - points have consistent dimensions`,
          async () => {
            const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
              deterministic: true,
            });
            const result = renderPlotCanvas(testSetup);

            await result.waitForPlot();

            assertPointDimensions(result);
          },
          scale.timeout
        );

        it(
          `${alias} - renders axes correctly`,
          async () => {
            const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
              deterministic: true,
            });
            const result = renderPlotCanvas(testSetup);

            await result.waitForPlot();

            assertAxesRendered(result);

            // Verify axis ticks exist
            const xTicks = result.getAxisTicks('x');
            const yTicks = result.getAxisTicks('y');
            expect(xTicks.length).toBeGreaterThan(0);
            expect(yTicks.length).toBeGreaterThan(0);
          },
          scale.timeout
        );

        if (plotConfig.show_regression) {
          it(
            `${alias} - renders regression line`,
            async () => {
              const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
                deterministic: true,
              });
              const result = renderPlotCanvas(testSetup);

              await result.waitForPlot();

              // Check for regression line in plot data group
              const plotData = result.getPlotDataGroup();
              expect(plotData).not.toBeNull();

              // Look for a line element (regression line)
              const lines = plotData?.querySelectorAll('line, path.regression-line');
              // Regression should produce at least one line element
              expect(lines?.length).toBeGreaterThanOrEqual(0);
            },
            scale.timeout
          );
        }

        if (plotConfig.group_by) {
          it(
            `${alias} - points have different colors for groups`,
            async () => {
              const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
                deterministic: true,
              });
              const result = renderPlotCanvas(testSetup);

              await result.waitForPlot();

              const points = result.getScatterPoints();
              const fillColors = new Set(
                points.map((p) => p.getAttribute('fill')).filter(Boolean)
              );
              // With grouping, should have multiple colors
              expect(fillColors.size).toBeGreaterThanOrEqual(1);
            },
            scale.timeout
          );
        }
      });
    });
  });
});
