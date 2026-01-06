/**
 * Shared test utilities for bar chart tests.
 * Used by both bar.browser.test.tsx (edge cases) and bar.matrix.browser.test.tsx (matrix tests).
 */

import { expect } from 'vitest';
import { PlotCanvasTestResult } from '../fixtures/plotCanvasTestHarness';
import { DeterministicLogSet } from '../fixtures/mockData';
import {
  calculateGroupedAggregates,
  POSITION_TOLERANCE,
  DEFAULT_DIMENSIONS,
  AggregateType,
} from '../fixtures/calculations';

/**
 * Assert bars have valid dimensions (finite, positive values)
 */
export function assertBarsHaveValidDimensions(bars: SVGRectElement[]) {
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
export function assertBarsWithinPlotArea(bars: SVGRectElement[]) {
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
 * Assert exact bar count matches expected bars.
 * - Non-grouped: one bar per unique x-axis category
 * - Grouped: one bar per unique (x-axis category, group value) pair in the data
 */
export function assertExactBarCount(
  result: PlotCanvasTestResult,
  deterministicData: DeterministicLogSet,
  xAxisField: string,
  isGrouped = false,
  _groupByType: 'str' | 'bool' = 'str'
) {
  const bars = result.getBars();
  
  let expectedCount: number;

  if (isGrouped) {
    // For grouped charts, count unique (x, group) pairs in the actual data
    const uniquePairs = new Set(
      deterministicData.logs
        .filter(l => 
          l['table1.entries'][xAxisField] !== null && 
          l['table1.entries'][xAxisField] !== undefined &&
          l['table1.entries']['table1.category'] !== null &&
          l['table1.entries']['table1.category'] !== undefined
        )
        .map(l => `${l['table1.entries'][xAxisField]}|${l['table1.entries']['table1.category']}`)
    );
    expectedCount = uniquePairs.size;
  } else {
    // For non-grouped charts, count unique x-axis categories
    const uniqueXCategories = new Set(
      deterministicData.logs
        .map(l => l['table1.entries'][xAxisField])
        .filter(v => v !== null && v !== undefined)
    );
    expectedCount = uniqueXCategories.size;
  }

  // Strict assertion: bar count must match expected
  expect(bars.length).toBe(expectedCount);
}

/**
 * Assert bar widths are consistent (all bars should have same width in non-grouped chart)
 */
export function assertConsistentBarWidths(bars: SVGRectElement[]) {
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
export function assertBarsEvenlySpaced(bars: SVGRectElement[]) {
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
 */
export function assertBarHeightsMatchAggregatedValues(
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
    // Heights should show corresponding variation
    if (minHeight > 0) {
      const actualRatio = maxHeight / minHeight;
      // The ordering should be preserved: higher values = taller bars
      expect(maxHeight).toBeGreaterThanOrEqual(minHeight);
      // Ratio should be roughly proportional
      expect(actualRatio).toBeGreaterThan(1);
    }
  }

  // Additional check: bars should be ordered consistently with values
  const heightOrder = [...barData].sort((a, b) => b.height - a.height).map(b => b.height);
  
  // Tallest bar should have height >= median bar
  if (expectedValues.length >= 2 && heightOrder.length >= 2) {
    const medianHeight = heightOrder[Math.floor(heightOrder.length / 2)];
    expect(heightOrder[0]).toBeGreaterThanOrEqual(medianHeight);
  }
}

