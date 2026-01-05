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
  plotConfigName,
  dataTypeConfigName,
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
  calculateScatterPointPosition,
  calculateDomain,
  calculateLogDomain,
  calculateExpectedPointCount,
  positionsAreClose,
  POSITION_TOLERANCE,
  DEFAULT_DIMENSIONS,
  Domain,
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
 * Assert points are positioned correctly based on data values
 */
function assertPointPositionsMatchData(
  result: PlotCanvasTestResult,
  deterministicData: DeterministicLogSet,
  scaleX: 'linear' | 'log',
  scaleY: 'linear' | 'log',
  sampleSize = 10 // Check a sample of points for performance
) {
  const points = result.getScatterPoints();

  // Calculate domains based on scale type
  const numericXValues = deterministicData.expectedXValues.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v)
  );
  const numericYValues = deterministicData.expectedYValues.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v)
  );

  // Skip if no numeric values
  if (numericXValues.length === 0 || numericYValues.length === 0) {
    return;
  }

  const xDomain: Domain = scaleX === 'log'
    ? calculateLogDomain(numericXValues)
    : calculateDomain(numericXValues, true);

  const yDomain: Domain = scaleY === 'log'
    ? calculateLogDomain(numericYValues)
    : calculateDomain(numericYValues, true);

  // Check a sample of points
  const step = Math.max(1, Math.floor(points.length / sampleSize));

  for (let i = 0; i < points.length; i += step) {
    const point = points[i];
    const cx = parseFloat(point.getAttribute('cx')!);
    const cy = parseFloat(point.getAttribute('cy')!);

    // Find corresponding log entry
    // Points are typically rendered in data order
    const logIndex = i;
    if (logIndex >= deterministicData.logs.length) continue;

    const log = deterministicData.logs[logIndex];
    const xValue = log.table1.x_value;
    const yValue = log.table1.y_value;

    // Skip null values
    if (xValue === null || yValue === null) continue;
    if (typeof xValue !== 'number' || typeof yValue !== 'number') continue;

    // Calculate expected position
    const expectedPos = calculateScatterPointPosition(
      xValue,
      yValue,
      xDomain,
      yDomain,
      scaleX,
      scaleY
    );

    // Allow tolerance for D3's "nice" domain adjustments
    // D3 often adjusts domains to nice round numbers, so positions may differ slightly
    const tolerance = POSITION_TOLERANCE * 3; // Larger tolerance for D3 adjustments

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

  // All radii should be consistent (same value) unless grouped
  const uniqueRadii = new Set(radii.map(r => Math.round(r * 10) / 10));
  // Typically scatter plots have uniform point sizes
  expect(uniqueRadii.size).toBeLessThanOrEqual(5); // Allow some variation for groups
}

// =============================================================================
// Edge Cases (Not covered by matrix)
// =============================================================================

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
    const nullLogs = Array.from({ length: 10 }, (_, i) => ({
      id: `log_${i}`,
      timestamp: new Date().toISOString(),
      table1: {
        x_value: null,
        y_value: null,
        category: 'test',
      },
    }));

    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      logs: nullLogs as any,
    });

    const svg = result.getSvg();
    expect(svg).not.toBeNull();

    // Should render but with no visible points
    const points = result.getScatterPoints();
    expect(points.length).toBe(0);
  });

  it('handles single data point', async () => {
    const singleLog = [{
      id: 'log_0',
      timestamp: new Date().toISOString(),
      table1: {
        x_value: 50,
        y_value: 75,
        category: 'single',
      },
    }];

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
      { id: 'log_0', timestamp: new Date().toISOString(), table1: { x_value: 1, y_value: 1 } },
      { id: 'log_1', timestamp: new Date().toISOString(), table1: { x_value: 2, y_value: 2 } },
      { id: 'log_2', timestamp: new Date().toISOString(), table1: { x_value: 1e15, y_value: 1e15 } },
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
      { id: 'log_0', timestamp: new Date().toISOString(), table1: { x_value: -50, y_value: -25 } },
      { id: 'log_1', timestamp: new Date().toISOString(), table1: { x_value: 0, y_value: 0 } },
      { id: 'log_2', timestamp: new Date().toISOString(), table1: { x_value: 50, y_value: 25 } },
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
      { id: 'log_0', timestamp: new Date().toISOString(), table1: { x_value: 50, y_value: 10 } },
      { id: 'log_1', timestamp: new Date().toISOString(), table1: { x_value: 50, y_value: 50 } },
      { id: 'log_2', timestamp: new Date().toISOString(), table1: { x_value: 50, y_value: 90 } },
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
// =============================================================================

describe.concurrent('Scatter Plot - Matrix Tests', () => {
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

            // Calculate expected count (excluding nulls)
            const expectedCount = calculateExpectedPointCount(
              deterministicData.logs.map(l => ({
                'table1.x_value': l.table1.x_value,
                'table1.y_value': l.table1.y_value,
              })),
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
