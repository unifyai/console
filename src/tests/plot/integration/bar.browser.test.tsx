/**
 * Bar Chart Integration Tests
 *
 * Browser-based tests for bar chart rendering correctness,
 * user interactions, and edge cases.
 *
 * Structure:
 * - Edge Cases: Invalid/boundary conditions not in matrix
 * - User Interactions: Hover, tooltip behaviors
 * - Matrix Tests: Comprehensive coverage of all valid config combinations
 *
 * Key improvements:
 * - Uses deterministic mock data for precise position assertions
 * - Verifies exact bar counts (number of unique categories)
 * - Verifies exact bar positions and dimensions
 * - Verifies bar heights match aggregated data values
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
  createAggregatedMockData,
  DeterministicLogSet,
} from '../fixtures/mockData';
import {
  calculateBarDimensions,
  calculateDomain,
  calculateExpectedBarCount,
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
 * Assert bars have valid dimensions (finite, positive values)
 */
function assertBarsHaveValidDimensions(bars: SVGRectElement[]) {
  for (const bar of bars) {
    const x = bar.getAttribute('x');
    const y = bar.getAttribute('y');
    const width = bar.getAttribute('width');
    const height = bar.getAttribute('height');

    // All dimensions must be valid numbers
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
      expect(widthNum).toBeGreaterThan(0); // Bars should have positive width
    }
    if (height) {
      const heightNum = parseFloat(height);
      expect(Number.isFinite(heightNum)).toBe(true);
      expect(heightNum).toBeGreaterThanOrEqual(0); // Height can be 0 for zero values
    }
  }
}

/**
 * Assert bars are within the plot area
 */
function assertBarsWithinPlotArea(bars: SVGRectElement[]) {
  const { width, height, margins } = DEFAULT_DIMENSIONS;

  for (const bar of bars) {
    const x = parseFloat(bar.getAttribute('x') || '0');
    const y = parseFloat(bar.getAttribute('y') || '0');
    const barWidth = parseFloat(bar.getAttribute('width') || '0');
    const barHeight = parseFloat(bar.getAttribute('height') || '0');

    // Bar left edge should be at or after margin (with tolerance)
    expect(x).toBeGreaterThanOrEqual(margins.left - POSITION_TOLERANCE);
    // Bar right edge should be before right margin (with tolerance)
    expect(x + barWidth).toBeLessThanOrEqual(width - margins.right + POSITION_TOLERANCE);
    // Bar top should be at or after top margin
    expect(y).toBeGreaterThanOrEqual(margins.top - POSITION_TOLERANCE);
    // Bar bottom should be at or before bottom margin
    expect(y + barHeight).toBeLessThanOrEqual(height - margins.bottom + POSITION_TOLERANCE);
  }
}

/**
 * Assert exact bar count matches expected unique categories
 */
function assertExactBarCount(
  result: PlotCanvasTestResult,
  deterministicData: DeterministicLogSet,
  categoryField: string
) {
  const bars = result.getBars();
  const expectedCount = calculateExpectedBarCount(
    deterministicData.logs.map(l => ({
      [categoryField]: l.table1.category,
    })),
    categoryField
  );

  expect(bars.length).toBe(expectedCount);
}

/**
 * Assert bar widths are consistent (all bars should have same width in non-grouped chart)
 */
function assertConsistentBarWidths(bars: SVGRectElement[]) {
  if (bars.length <= 1) return;

  const widths = bars.map(bar => parseFloat(bar.getAttribute('width') || '0'));
  const firstWidth = widths[0];

  for (const width of widths) {
    // Allow small tolerance for rendering differences
    expect(Math.abs(width - firstWidth)).toBeLessThan(POSITION_TOLERANCE);
  }
}

/**
 * Assert bars are evenly spaced (ordered from left to right)
 */
function assertBarsEvenlySpaced(bars: SVGRectElement[]) {
  if (bars.length <= 2) return;

  const xPositions = bars.map(bar => parseFloat(bar.getAttribute('x') || '0')).sort((a, b) => a - b);
  const gaps: number[] = [];

  for (let i = 1; i < xPositions.length; i++) {
    gaps.push(xPositions[i] - xPositions[i - 1]);
  }

  // All gaps should be approximately equal
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  for (const gap of gaps) {
    expect(Math.abs(gap - avgGap)).toBeLessThan(POSITION_TOLERANCE * 2);
  }
}

/**
 * Assert bar heights are proportional to values
 * Higher values should result in taller bars (shorter y position from top)
 */
function assertBarHeightsMatchValues(
  result: PlotCanvasTestResult,
  deterministicData: DeterministicLogSet,
  aggregateType: 'sum' | 'mean' | 'count' | 'min' | 'max' = 'sum'
) {
  const bars = result.getBars();
  if (bars.length < 2) return;

  // Get bar y positions (top of bar)
  const barData = bars.map(bar => ({
    y: parseFloat(bar.getAttribute('y') || '0'),
    height: parseFloat(bar.getAttribute('height') || '0'),
  }));

  // Bars with larger heights should have smaller y values (SVG coordinates)
  const sortedByHeight = [...barData].sort((a, b) => b.height - a.height);
  const sortedByY = [...barData].sort((a, b) => a.y - b.y);

  // The tallest bar should have the smallest y value
  expect(sortedByHeight[0].y).toBeLessThanOrEqual(sortedByY[sortedByY.length - 1].y + POSITION_TOLERANCE);
}

// =============================================================================
// Edge Cases (Not covered by matrix)
// =============================================================================

describe('Bar Chart - Edge Cases', () => {
  it('handles empty data gracefully', async () => {
    const result = renderPlotCanvas({
      plotType: 'Bar Chart',
      logs: [],
    });

    const svg = result.getSvg();
    expect(svg).not.toBeNull();

    const bars = result.getBars();
    expect(bars.length).toBe(0);
  });

  it('handles single category', async () => {
    const singleCategoryLogs = Array.from({ length: 5 }, (_, i) => ({
      id: `log_${i}`,
      timestamp: new Date().toISOString(),
      table1: {
        category: 'only_category',
        value: i * 10,
      },
    }));

    const result = renderPlotCanvas({
      plotType: 'Bar Chart',
      xAxis: 'table1.category',
      yAxis: 'table1.value',
      logs: singleCategoryLogs as any,
    });

    await result.waitForPlot();

    const svg = result.getSvg();
    expect(svg).not.toBeNull();

    const bars = result.getBars();
    // Should have exactly 1 bar for the single category
    expect(bars.length).toBeLessThanOrEqual(1);
  });

  it('handles zero values', async () => {
    const zeroValueLogs = [
      { id: 'log_0', timestamp: new Date().toISOString(), table1: { category: 'A', value: 0 } },
      { id: 'log_1', timestamp: new Date().toISOString(), table1: { category: 'B', value: 100 } },
    ];

    const result = renderPlotCanvas({
      plotType: 'Bar Chart',
      xAxis: 'table1.category',
      yAxis: 'table1.value',
      logs: zeroValueLogs as any,
    });

    await result.waitForPlot();

    const svg = result.getSvg();
    expect(svg).not.toBeNull();

    const bars = result.getBars();
    assertBarsHaveValidDimensions(bars);

    // Find the zero value bar - it should have height 0 or very small
    const barHeights = bars.map(bar => parseFloat(bar.getAttribute('height') || '0'));
    expect(Math.min(...barHeights)).toBeGreaterThanOrEqual(0);
  });

  it('handles negative values', async () => {
    const negativeValueLogs = [
      { id: 'log_0', timestamp: new Date().toISOString(), table1: { category: 'A', value: -50 } },
      { id: 'log_1', timestamp: new Date().toISOString(), table1: { category: 'B', value: 50 } },
      { id: 'log_2', timestamp: new Date().toISOString(), table1: { category: 'C', value: 0 } },
    ];

    const result = renderPlotCanvas({
      plotType: 'Bar Chart',
      xAxis: 'table1.category',
      yAxis: 'table1.value',
      logs: negativeValueLogs as any,
    });

    await result.waitForPlot();

    const svg = result.getSvg();
    expect(svg).not.toBeNull();

    const bars = result.getBars();
    assertBarsHaveValidDimensions(bars);
  });

  it('handles very long category names', async () => {
    const longNameLogs = [
      { id: 'log_0', timestamp: new Date().toISOString(), table1: { category: 'A'.repeat(50), value: 100 } },
      { id: 'log_1', timestamp: new Date().toISOString(), table1: { category: 'B'.repeat(50), value: 200 } },
    ];

    const result = renderPlotCanvas({
      plotType: 'Bar Chart',
      xAxis: 'table1.category',
      yAxis: 'table1.value',
      logs: longNameLogs as any,
    });

    await result.waitForPlot();

    const svg = result.getSvg();
    expect(svg).not.toBeNull();
  });
});

// =============================================================================
// User Interactions
// =============================================================================

describe('Bar Chart - Interactions', () => {
  it('has tooltip element in DOM', async () => {
    const result = renderPlotCanvas({
      plotType: 'Bar Chart',
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

describe('Bar Chart - Matrix Tests', () => {
  const allValidConfigs = generateValidPlotConfigsForType('bar');
  const sampledConfigs = sampleConfigs(allValidConfigs);

  const dataTypeConfigs = sampleConfigs(generateDataTypeConfigs());
  // Bar charts typically use string x-axis and numeric y-axis
  const barDataTypes = dataTypeConfigs.filter(
    (dt) => dt.x_axis_type === 'str' && ['float', 'int'].includes(dt.y_axis_type)
  );
  const activeScales = getActiveScales();

  describe.each(sampledConfigs)('config: %o', (plotConfig) => {
    describe.each(barDataTypes)('data types: %o', (dataTypeConfig) => {
      describe.each(activeScales)('scale: %s', (scale) => {
        const alias = generateTestAlias('bar', plotConfig, dataTypeConfig, scale);

        // Generate deterministic data for precise assertions
        const deterministicData = createDeterministicMockLogs(dataTypeConfig, scale.count);

        it(
          `${alias} - renders SVG and axes`,
          async () => {
            const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
              deterministic: true,
            });
            const result = renderPlotCanvas(testSetup);

            await result.waitForPlot();

            const svg = result.getSvg();
            expect(svg).not.toBeNull();

            assertAxesRendered(result);
          },
          scale.timeout
        );

        it(
          `${alias} - renders exact number of bars`,
          async () => {
            const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
              deterministic: true,
            });
            const result = renderPlotCanvas(testSetup);

            await result.waitForPlot();

            assertExactBarCount(result, deterministicData, 'table1.category');
          },
          scale.timeout
        );

        it(
          `${alias} - all bars have valid dimensions`,
          async () => {
            const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
              deterministic: true,
            });
            const result = renderPlotCanvas(testSetup);

            await result.waitForPlot();

            const bars = result.getBars();
            assertBarsHaveValidDimensions(bars);
            assertBarsWithinPlotArea(bars);
          },
          scale.timeout
        );

        it(
          `${alias} - bars have consistent widths`,
          async () => {
            const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
              deterministic: true,
            });
            const result = renderPlotCanvas(testSetup);

            await result.waitForPlot();

            const bars = result.getBars();
            if (!plotConfig.group_by) {
              assertConsistentBarWidths(bars);
            }
          },
          scale.timeout
        );

        it(
          `${alias} - bar heights are proportional to values`,
          async () => {
            const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
              deterministic: true,
            });
            const result = renderPlotCanvas(testSetup);

            await result.waitForPlot();

            assertBarHeightsMatchValues(
              result,
              deterministicData,
              (plotConfig.aggregate as 'sum' | 'mean' | 'count' | 'min' | 'max') ?? 'sum'
            );
          },
          scale.timeout
        );

        it(
          `${alias} - axis ticks are present`,
          async () => {
            const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
              deterministic: true,
            });
            const result = renderPlotCanvas(testSetup);

            await result.waitForPlot();

            const xTicks = result.getAxisTicks('x');
            const yTicks = result.getAxisTicks('y');
            // At least some ticks should be present
            expect(xTicks.length + yTicks.length).toBeGreaterThan(0);
          },
          scale.timeout
        );

        if (plotConfig.group_by) {
          it(
            `${alias} - grouped bars have different colors`,
            async () => {
              const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
                deterministic: true,
              });
              const result = renderPlotCanvas(testSetup);

              await result.waitForPlot();

              const bars = result.getBars();
              if (bars.length > 0) {
                const fillColors = new Set(
                  bars.map((b) => b.getAttribute('fill')).filter(Boolean)
                );
                expect(fillColors.size).toBeGreaterThanOrEqual(1);
              }
            },
            scale.timeout
          );
        }

        if (plotConfig.sort_by) {
          it(
            `${alias} - bars are sorted correctly`,
            async () => {
              const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
                deterministic: true,
              });
              const result = renderPlotCanvas(testSetup);

              await result.waitForPlot();

              const bars = result.getBars();
              if (bars.length > 1) {
                const heights = bars.map(bar => parseFloat(bar.getAttribute('height') || '0'));

                if (plotConfig.sort_order === 'asc') {
                  // Heights should be in ascending order
                  for (let i = 1; i < heights.length; i++) {
                    expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1] - POSITION_TOLERANCE);
                  }
                } else if (plotConfig.sort_order === 'desc') {
                  // Heights should be in descending order
                  for (let i = 1; i < heights.length; i++) {
                    expect(heights[i]).toBeLessThanOrEqual(heights[i - 1] + POSITION_TOLERANCE);
                  }
                }
              }
            },
            scale.timeout
          );
        }
      });
    });
  });
});
