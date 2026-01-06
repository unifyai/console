/**
 * Scatter Plot Edge Case & Interaction Tests
 *
 * Browser-based tests for edge cases and user interactions.
 * For comprehensive matrix tests, see scatter.matrix.browser.test.tsx
 */

import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { renderPlotCanvas } from '../fixtures/plotCanvasTestHarness';
import { POSITION_TOLERANCE } from '../fixtures/calculations';
import { assertPointsHaveValidPositions } from './_scatter-test-helpers';

// =============================================================================
// Setup
// =============================================================================

afterEach(() => {
  cleanup();
});

// =============================================================================
// Test Helpers
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
