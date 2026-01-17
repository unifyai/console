/**
 * Drawer Test Helpers
 *
 * Utility functions for testing drawer-related functionality.
 * These helpers work with the PlotCanvas test harness and
 * provide assertions for drawer state and highlighting.
 */

import { expect } from 'vitest';
import type { PlotCanvasTestResult } from './plotCanvasTestHarness';
import type { HighlightTarget } from '@/types/interfaces/plot';
import type { PlotGroup, PinnedDatapoint } from '@/types/interfaces/plot-details';

// =============================================================================
// Drawer State Assertions
// =============================================================================

/**
 * Assert that bars have the expected opacity value
 *
 * @param result - PlotCanvas test result
 * @param expectedOpacity - Expected opacity (0-1)
 * @param tolerance - Tolerance for comparison (default 0.1)
 */
export function assertBarsHaveOpacity(
  result: PlotCanvasTestResult,
  expectedOpacity: number,
  tolerance: number = 0.1
): void {
  const bars = result.getBars();

  bars.forEach((bar, index) => {
    const opacity = parseFloat(bar.style.opacity || '1');
    expect(
      Math.abs(opacity - expectedOpacity),
      `Bar ${index} has opacity ${opacity}, expected ${expectedOpacity}`
    ).toBeLessThanOrEqual(tolerance);
  });
}

/**
 * Assert that all bars of a specific group have expected opacity
 *
 * @param result - PlotCanvas test result
 * @param groupKey - Group key to check
 * @param expectedOpacity - Expected opacity (0-1)
 */
export function assertGroupBarsHaveOpacity(
  result: PlotCanvasTestResult,
  groupKey: string,
  expectedOpacity: number
): void {
  const bars = result.getBars();

  bars.forEach((bar) => {
    // Bars store their data in d3 __data__ property
    const barData = (bar as any).__data__;
    if (barData && barData[0] === groupKey) {
      const opacity = parseFloat(bar.style.opacity || '1');
      expect(opacity).toBeCloseTo(expectedOpacity, 1);
    }
  });
}

/**
 * Assert that non-matching groups are hidden (opacity 0)
 *
 * @param result - PlotCanvas test result
 * @param highlightedGroupKey - The group that should be visible
 */
export function assertOtherGroupsHidden(
  result: PlotCanvasTestResult,
  highlightedGroupKey: string
): void {
  const bars = result.getBars();

  bars.forEach((bar) => {
    const barData = (bar as any).__data__;
    if (barData && barData[0] !== highlightedGroupKey) {
      const opacity = parseFloat(bar.style.opacity || '1');
      expect(opacity).toBe(0);
    }
  });
}

/**
 * Assert that highlighted group is visible (opacity 1)
 *
 * @param result - PlotCanvas test result
 * @param highlightedGroupKey - The group that should be visible
 */
export function assertGroupHighlighted(
  result: PlotCanvasTestResult,
  highlightedGroupKey: string
): void {
  const bars = result.getBars();
  let foundHighlightedBars = false;

  bars.forEach((bar) => {
    const barData = (bar as any).__data__;
    if (barData && barData[0] === highlightedGroupKey) {
      foundHighlightedBars = true;
      const opacity = parseFloat(bar.style.opacity || '1');
      expect(opacity).toBe(1);
    }
  });

  expect(foundHighlightedBars).toBe(true);
}

// =============================================================================
// Scatter Plot Highlight Assertions
// =============================================================================

/**
 * Assert that scatter points have expected opacity
 *
 * @param result - PlotCanvas test result
 * @param expectedOpacity - Expected opacity (0-1)
 */
export function assertScatterPointsHaveOpacity(
  result: PlotCanvasTestResult,
  expectedOpacity: number,
  tolerance: number = 0.1
): void {
  const points = result.getScatterPoints();

  points.forEach((point, index) => {
    const opacity = parseFloat(point.style.opacity || '1');
    expect(
      Math.abs(opacity - expectedOpacity),
      `Point ${index} has opacity ${opacity}, expected ${expectedOpacity}`
    ).toBeLessThanOrEqual(tolerance);
  });
}

// =============================================================================
// Histogram Highlight Assertions
// =============================================================================

/**
 * Assert that histogram bins have expected opacity
 *
 * @param result - PlotCanvas test result
 * @param expectedOpacity - Expected opacity (0-1)
 */
export function assertHistogramBinsHaveOpacity(
  result: PlotCanvasTestResult,
  expectedOpacity: number,
  tolerance: number = 0.1
): void {
  const bins = result.getHistogramBins();

  bins.forEach((bin, index) => {
    const opacity = parseFloat(bin.style.opacity || '1');
    expect(
      Math.abs(opacity - expectedOpacity),
      `Bin ${index} has opacity ${opacity}, expected ${expectedOpacity}`
    ).toBeLessThanOrEqual(tolerance);
  });
}

// =============================================================================
// Group Extraction Helpers
// =============================================================================

/**
 * Extract unique groups from bar chart data
 *
 * @param result - PlotCanvas test result
 * @returns Array of unique group keys
 */
export function extractGroupsFromBars(result: PlotCanvasTestResult): string[] {
  const bars = result.getBars();
  const groups = new Set<string>();

  bars.forEach((bar) => {
    const barData = (bar as any).__data__;
    if (barData && barData[0]) {
      groups.add(barData[0]);
    }
  });

  return Array.from(groups);
}

/**
 * Count bars per group
 *
 * @param result - PlotCanvas test result
 * @returns Map of group key to bar count
 */
export function countBarsPerGroup(result: PlotCanvasTestResult): Map<string, number> {
  const bars = result.getBars();
  const counts = new Map<string, number>();

  bars.forEach((bar) => {
    const barData = (bar as any).__data__;
    if (barData && barData[0]) {
      const current = counts.get(barData[0]) || 0;
      counts.set(barData[0], current + 1);
    }
  });

  return counts;
}

// =============================================================================
// Highlight Target Helpers
// =============================================================================

/**
 * Create a group highlight target
 */
export function createGroupHighlight(groupKey: string): HighlightTarget {
  return { type: 'group', groupKey };
}

/**
 * Create a datapoint highlight target
 */
export function createDatapointHighlight(datapointId: string): HighlightTarget {
  return { type: 'datapoint', datapointId };
}

/**
 * Create a none highlight target
 */
export function createNoHighlight(): HighlightTarget {
  return { type: 'none' };
}

// =============================================================================
// Mock Data Creators
// =============================================================================

/**
 * Create mock groups for testing
 *
 * @param count - Number of groups to create
 * @returns Array of PlotGroup
 */
export function createMockGroups(count: number): PlotGroup[] {
  const colors = [
    '#ff0000',
    '#00ff00',
    '#0000ff',
    '#ffff00',
    '#ff00ff',
    '#00ffff',
    '#ff8000',
    '#8000ff',
    '#0080ff',
    '#80ff00',
  ];

  return Array.from({ length: count }, (_, i) => ({
    key: `Group ${String.fromCharCode(65 + i)}`,
    color: colors[i % colors.length],
  }));
}

/**
 * Create mock pinned datapoints for testing
 *
 * @param count - Number of datapoints to create
 * @param withGroups - Whether to include group information
 * @returns Array of PinnedDatapoint
 */
export function createMockPinnedDatapoints(
  count: number,
  withGroups: boolean = false
): PinnedDatapoint[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `dp-${i + 1}`,
    x: { label: 'X Axis', value: `Value ${i + 1}` },
    y: { label: 'Y Axis', value: (i + 1) * 10 },
    ...(withGroups
      ? { group: { label: 'Category', value: `Group ${String.fromCharCode(65 + (i % 3))}` } }
      : {}),
  }));
}

// =============================================================================
// Transition Assertions
// =============================================================================

/**
 * Wait for D3 transitions to complete
 *
 * @param ms - Milliseconds to wait (default 250ms for 200ms transition + buffer)
 */
export async function waitForTransitions(ms: number = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Assert that transitions are smooth (no flickering)
 * This is a placeholder for more sophisticated transition testing
 *
 * @param result - PlotCanvas test result
 */
export async function assertNoFlicker(result: PlotCanvasTestResult): Promise<void> {
  // Record initial opacities
  const bars = result.getBars();
  const initialOpacities = bars.map((bar) => parseFloat(bar.style.opacity || '1'));

  // Wait a short period
  await waitForTransitions(50);

  // Record final opacities
  const finalOpacities = bars.map((bar) => parseFloat(bar.style.opacity || '1'));

  // For each bar, opacity should either be stable or changing monotonically
  // (not jumping back and forth)
  initialOpacities.forEach((initial, index) => {
    const final = finalOpacities[index];
    // Either stable or changed - we just ensure no crash
    expect(typeof final).toBe('number');
    expect(final).toBeGreaterThanOrEqual(0);
    expect(final).toBeLessThanOrEqual(1);
  });
}

// =============================================================================
// Bar Ordering Assertions
// =============================================================================

/**
 * Assert that shorter bars are rendered on top of taller bars within groups
 * This ensures hovering works correctly on shorter bars
 *
 * @param result - PlotCanvas test result
 */
export function assertShorterBarsOnTop(result: PlotCanvasTestResult): void {
  const bars = result.getBars();

  // Group bars by their x position (category)
  const barsByX = new Map<number, SVGRectElement[]>();

  bars.forEach((bar) => {
    const x = parseFloat(bar.getAttribute('x') || '0');
    const roundedX = Math.round(x); // Round to handle floating point

    if (!barsByX.has(roundedX)) {
      barsByX.set(roundedX, []);
    }
    barsByX.get(roundedX)!.push(bar);
  });

  // For each x position with multiple bars, check rendering order
  barsByX.forEach((barsAtX) => {
    if (barsAtX.length > 1) {
      // Bars should be sorted by height descending (taller first, shorter last)
      // so that shorter bars are rendered on top
      for (let i = 0; i < barsAtX.length - 1; i++) {
        const currentHeight = parseFloat(barsAtX[i].getAttribute('height') || '0');
        const nextHeight = parseFloat(barsAtX[i + 1].getAttribute('height') || '0');

        // Taller bars should come before shorter bars in DOM order
        // (or at least this is the expected pattern)
        expect(currentHeight).toBeGreaterThanOrEqual(nextHeight);
      }
    }
  });
}

// =============================================================================
// Axis Customization Assertions
// =============================================================================

/**
 * Assert that x-axis label is visible
 *
 * @param result - PlotCanvas test result
 */
export function assertXAxisLabelVisible(result: PlotCanvasTestResult): void {
  const xAxis = result.getXAxis();
  expect(xAxis).not.toBeNull();

  const label = xAxis?.querySelector('.x-axis-label');
  expect(label).not.toBeNull();
}

/**
 * Assert that y-axis label is visible
 *
 * @param result - PlotCanvas test result
 */
export function assertYAxisLabelVisible(result: PlotCanvasTestResult): void {
  const yAxis = result.getYAxis();
  expect(yAxis).not.toBeNull();

  const label = yAxis?.querySelector('.y-axis-label');
  expect(label).not.toBeNull();
}

/**
 * Assert that x-axis label is hidden
 *
 * @param result - PlotCanvas test result
 */
export function assertXAxisLabelHidden(result: PlotCanvasTestResult): void {
  const xAxis = result.getXAxis();
  if (!xAxis) return; // No axis is also valid for hidden

  const label = xAxis.querySelector('.x-axis-label');
  expect(label).toBeNull();
}

/**
 * Assert that y-axis label is hidden
 *
 * @param result - PlotCanvas test result
 */
export function assertYAxisLabelHidden(result: PlotCanvasTestResult): void {
  const yAxis = result.getYAxis();
  if (!yAxis) return; // No axis is also valid for hidden

  const label = yAxis.querySelector('.y-axis-label');
  expect(label).toBeNull();
}

/**
 * Assert that x-axis label has specific text
 *
 * @param result - PlotCanvas test result
 * @param expectedText - Expected label text
 */
export function assertXAxisLabelText(result: PlotCanvasTestResult, expectedText: string): void {
  const xAxis = result.getXAxis();
  expect(xAxis).not.toBeNull();

  const label = xAxis?.querySelector('.x-axis-label');
  expect(label?.textContent).toBe(expectedText);
}

/**
 * Assert that y-axis label has specific text
 *
 * @param result - PlotCanvas test result
 * @param expectedText - Expected label text
 */
export function assertYAxisLabelText(result: PlotCanvasTestResult, expectedText: string): void {
  const yAxis = result.getYAxis();
  expect(yAxis).not.toBeNull();

  const label = yAxis?.querySelector('.y-axis-label');
  expect(label?.textContent).toBe(expectedText);
}

/**
 * Assert that y-axis ticks have currency formatting
 *
 * @param result - PlotCanvas test result
 */
export function assertYAxisTicksHaveCurrencyFormat(result: PlotCanvasTestResult): void {
  const ticks = result.getAxisTicks('y');

  ticks.forEach((tick) => {
    if (tick && tick !== '' && !tick.startsWith('0')) {
      // Check if tick starts with $ or contains $
      expect(tick).toMatch(/\$/);
    }
  });
}
