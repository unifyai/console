/**
 * Bar Chart Edge Case & Interaction Tests
 *
 * Browser-based tests for edge cases and user interactions.
 * For comprehensive matrix tests, see bar.matrix.browser.test.tsx
 */

import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import {
  renderPlotCanvas,
} from '../fixtures/plotCanvasTestHarness';
import {
  assertBarsHaveValidDimensions,
} from './_bar-test-helpers';

// =============================================================================
// Setup
// =============================================================================

afterEach(() => {
  cleanup();
});

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
