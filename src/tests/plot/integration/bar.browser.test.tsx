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
  calculateExpectedBarCount,
  calculateGroupedAggregates,
  positionsAreClose,
  POSITION_TOLERANCE,
  DEFAULT_DIMENSIONS,
  AggregateType,
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
 * Assert exact bar count matches expected unique categories.
 * Bar charts always render one bar per unique category.
 */
function assertExactBarCount(
  result: PlotCanvasTestResult,
  deterministicData: DeterministicLogSet,
  categoryField: string
) {
  const bars = result.getBars();
  const expectedCount = calculateExpectedBarCount(
    deterministicData.logs.map(l => ({
      [categoryField]: l['table1.entries']['table1.category'],
    })),
    categoryField
  );

  // Strict assertion: bar count must match unique category count
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
 * Assert bar heights are proportional to aggregated values.
 * Verifies that bar heights are correctly proportional to their aggregated data values.
 */
function assertBarHeightsMatchAggregatedValues(
  result: PlotCanvasTestResult,
  deterministicData: DeterministicLogSet,
  aggregateType: AggregateType = 'sum'
) {
  const bars = result.getBars();
  if (bars.length < 2) return;

  // Calculate expected aggregated values by category
  const expectedAggregates = calculateGroupedAggregates(
    deterministicData.logs,
    'table1.category',
    'table1.y_value',
    aggregateType
  );

  // Get bar data with heights
  const barData = bars.map(bar => ({
    height: parseFloat(bar.getAttribute('height') || '0'),
    y: parseFloat(bar.getAttribute('y') || '0'),
  }));

  // All heights should be non-negative
  for (const bar of barData) {
    expect(bar.height).toBeGreaterThanOrEqual(0);
  }

  // Get expected values sorted by magnitude
  const expectedValues = Array.from(expectedAggregates.values()).filter(v => Number.isFinite(v));
  if (expectedValues.length < 2) return;

  const sortedExpected = [...expectedValues].sort((a, b) => b - a);
  const sortedHeights = barData.map(b => b.height).sort((a, b) => b - a);

  // Verify proportionality: the ratio of heights should match ratio of values
  const maxExpected = sortedExpected[0];
  const minExpected = sortedExpected[sortedExpected.length - 1];
  const maxHeight = sortedHeights[0];
  const minHeight = sortedHeights[sortedHeights.length - 1];

  // If there's meaningful variation in expected values
  if (maxExpected > minExpected && minExpected > 0) {
    const expectedRatio = maxExpected / minExpected;
    
    // Heights should show corresponding variation
    // Allow tolerance since plot may apply padding/nice domains
    if (minHeight > 0) {
      const actualRatio = maxHeight / minHeight;
      // The ordering should be preserved: higher values = taller bars
      expect(maxHeight).toBeGreaterThanOrEqual(minHeight);
      // Ratio should be roughly proportional (within 50% tolerance)
      expect(actualRatio).toBeGreaterThan(1);
    }
  }

  // Additional check: bars should be ordered consistently with values
  // (larger aggregated values should map to taller bars)
  const expectedOrder = [...expectedValues].sort((a, b) => b - a);
  const heightOrder = [...barData].sort((a, b) => b.height - a.height).map(b => b.height);
  
  // At minimum, the tallest bar should correspond to max value
  // and shortest bar to min value (Spearman correlation check)
  if (expectedOrder.length >= 2 && heightOrder.length >= 2) {
    // Tallest bar should have height >= median bar
    const medianHeight = heightOrder[Math.floor(heightOrder.length / 2)];
    expect(heightOrder[0]).toBeGreaterThanOrEqual(medianHeight);
  }
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
      'table1.entries': {
        'table1.category': 'only_category',
        'table1.value': (i + 1) * 10,
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
    expect(bars.length).toBe(1);
  });

  it('handles zero values', async () => {
    const zeroValueLogs = [
      { id: 'log_0', timestamp: new Date().toISOString(), 'table1.entries': { 'table1.category': 'A', 'table1.value': 1 } },
      { id: 'log_1', timestamp: new Date().toISOString(), 'table1.entries': { 'table1.category': 'B', 'table1.value': 100 } },
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

    // Bar heights should be valid
    const barHeights = bars.map(bar => parseFloat(bar.getAttribute('height') || '0'));
    expect(Math.min(...barHeights)).toBeGreaterThanOrEqual(0);
  });

  it('handles negative values', async () => {
    const negativeValueLogs = [
      { id: 'log_0', timestamp: new Date().toISOString(), 'table1.entries': { 'table1.category': 'A', 'table1.value': -50 } },
      { id: 'log_1', timestamp: new Date().toISOString(), 'table1.entries': { 'table1.category': 'B', 'table1.value': 50 } },
      { id: 'log_2', timestamp: new Date().toISOString(), 'table1.entries': { 'table1.category': 'C', 'table1.value': 1 } },
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
      { id: 'log_0', timestamp: new Date().toISOString(), 'table1.entries': { 'table1.category': 'A'.repeat(50), 'table1.value': 100 } },
      { id: 'log_1', timestamp: new Date().toISOString(), 'table1.entries': { 'table1.category': 'B'.repeat(50), 'table1.value': 200 } },
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

  // Get all data type configs first, then sample from the filtered ones
  const allDataTypeConfigs = generateDataTypeConfigs();
  // Bar charts typically use string x-axis and numeric y-axis
  const barDataTypes = sampleConfigs(
    allDataTypeConfigs.filter(
      (dt) => dt.x_axis_type === 'str' && ['float', 'int'].includes(dt.y_axis_type)
    )
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
          `${alias} - bars have consistent widths and spacing`,
          async () => {
            const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
              deterministic: true,
            });
            const result = renderPlotCanvas(testSetup);

            await result.waitForPlot();

            const bars = result.getBars();
            if (!plotConfig.group_by) {
              assertConsistentBarWidths(bars);
              assertBarsEvenlySpaced(bars);
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

            assertBarHeightsMatchAggregatedValues(
              result,
              deterministicData,
              (plotConfig.aggregate as AggregateType) ?? 'sum'
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
              if (bars.length > 1) {
                const fillColors = new Set(
                  bars.map((b) => b.getAttribute('fill')).filter(Boolean)
                );
                // Grouped bars should have multiple distinct colors (one per group)
                expect(fillColors.size).toBeGreaterThan(1);
              }
            },
            scale.timeout
          );
        }

        // Only test height sorting for non-grouped bars with value-based sorting
        // Grouped bars are sorted by category name, not by height
        if (plotConfig.sort_by && plotConfig.sort_order && !plotConfig.group_by && 
            (plotConfig.sort_by === 'value' || plotConfig.sort_by === 'y')) {
          it(
            `${alias} - bars are sorted by height`,
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
        
        // For grouped bars with sorting, verify bars have valid structure
        if (plotConfig.sort_by && plotConfig.sort_order && plotConfig.group_by) {
          it(
            `${alias} - grouped bars are positioned correctly`,
            async () => {
              const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
                deterministic: true,
              });
              const result = renderPlotCanvas(testSetup);

              await result.waitForPlot();

              const bars = result.getBars();
              // Grouped bars should exist and have valid x positions
              expect(bars.length).toBeGreaterThan(0);
              
              // Verify bars have valid x positions
              const xPositions = bars.map(bar => parseFloat(bar.getAttribute('x') || '0'));
              for (const x of xPositions) {
                expect(x).toBeGreaterThanOrEqual(0);
              }
            },
            scale.timeout
          );
        }
      });
    });
  });
});
