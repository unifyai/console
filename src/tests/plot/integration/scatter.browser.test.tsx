/**
 * Scatter Plot Edge Case & Interaction Tests
 *
 * Browser-based tests for edge cases and user interactions.
 * For comprehensive matrix tests, see scatter.matrix.browser.test.tsx
 * For mode transition tests, see scatter.transitions.browser.test.tsx
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent } from '@testing-library/react';
import {
  renderPlotCanvas,
  updateConfig,
  resetConfig,
  getConfig,
  assertSVGRenderMode,
  assertWebGLRenderMode,
  assertScatterPlotRendered,
} from '../fixtures/plotCanvasTestHarness';
import { POSITION_TOLERANCE } from '../fixtures/calculations';
import { assertPointsHaveValidPositions } from './_scatter-test-helpers';

// =============================================================================
// Setup
// =============================================================================

afterEach(() => {
  cleanup();
  resetConfig();
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

/**
 * Get axis tick values as numbers
 */
function getTickValues(ticks: string[]): number[] {
  return ticks
    .map((t) => parseFloat(t))
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);
}

/**
 * Get the min/max range from axis ticks
 */
function getTickRange(ticks: string[]): { min: number; max: number } {
  const values = getTickValues(ticks);
  if (values.length === 0) {
    return { min: 0, max: 0 };
  }
  return { min: values[0], max: values[values.length - 1] };
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
    const nullLogs = Array.from({ length: 10 }, (_, i) => createLog(`log_${i}`, null, null));

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
    const xPositions = points.map((p) => parseFloat(p.getAttribute('cx')!));
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
    const xPositions = points.map((p) => parseFloat(p.getAttribute('cx')!));
    const avgX = xPositions.reduce((a, b) => a + b, 0) / xPositions.length;
    for (const x of xPositions) {
      expect(Math.abs(x - avgX)).toBeLessThan(POSITION_TOLERANCE);
    }
  });
});

// =============================================================================
// SVG Interactions
// =============================================================================

describe('Scatter Plot - SVG Interactions', () => {
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
// WebGL Interactions
// =============================================================================

describe('Scatter Plot - WebGL Interactions', () => {
  beforeEach(() => {
    // Lower threshold so small datasets trigger WebGL for testing
    updateConfig({ SVG_MAX: 50 });
  });

  it('shows tooltip element in WebGL mode', async () => {
    const logs = Array.from({ length: 100 }, (_, i) =>
      createLog(`log_${i}`, Math.random() * 100, Math.random() * 100)
    );

    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      logs: logs as any,
      interactive: true,
    });

    await result.waitForPlot();
    assertWebGLRenderMode(result);

    const tooltip = result.getTooltip();
    expect(tooltip).not.toBeNull();
    expect(tooltip?.style.opacity).toBe('0');
  });

  it('has interactive cursor on WebGL canvas', async () => {
    const logs = Array.from({ length: 100 }, (_, i) =>
      createLog(`log_${i}`, Math.random() * 100, Math.random() * 100)
    );

    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      logs: logs as any,
      interactive: true,
    });

    await result.waitForPlot();
    assertWebGLRenderMode(result);

    const webglCanvas = result.getWebGLCanvas();
    expect(webglCanvas).not.toBeNull();
    expect(webglCanvas?.style.cursor).toBe('crosshair');
  });

  it('renders with zoom enabled in WebGL mode', async () => {
    const logs = Array.from({ length: 100 }, (_, i) => createLog(`log_${i}`, i, i * 2));

    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      logs: logs as any,
      zoomEnabled: true,
      interactive: true,
    });

    await result.waitForPlot();
    assertWebGLRenderMode(result);

    // Canvas should be present
    const webglCanvas = result.getWebGLCanvas();
    expect(webglCanvas).not.toBeNull();

    // Axes should be present (zoom affects axes)
    const xTicks = result.getAxisTicks('x');
    const yTicks = result.getAxisTicks('y');
    expect(xTicks.length).toBeGreaterThan(0);
    expect(yTicks.length).toBeGreaterThan(0);
  });

  it('maintains axis state after simulated interactions', async () => {
    const logs = Array.from({ length: 100 }, (_, i) => createLog(`log_${i}`, i, i * 2));

    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      logs: logs as any,
      zoomEnabled: true,
      interactive: true,
    });

    await result.waitForPlot();
    assertWebGLRenderMode(result);

    // Get initial axis state
    const initialXTicks = result.getAxisTicks('x');
    const initialXRange = getTickRange(initialXTicks);

    // Simulate mouse movement over canvas (hover without hitting point)
    const webglCanvas = result.getWebGLCanvas();
    if (webglCanvas) {
      fireEvent.mouseMove(webglCanvas, { clientX: 100, clientY: 100 });
    }

    // Axis state should remain unchanged
    const afterMoveXTicks = result.getAxisTicks('x');
    const afterMoveXRange = getTickRange(afterMoveXTicks);

    expect(afterMoveXRange.min).toBeCloseTo(initialXRange.min, 1);
    expect(afterMoveXRange.max).toBeCloseTo(initialXRange.max, 1);
  });

  it('renders regression line over WebGL points', async () => {
    const logs = Array.from({ length: 100 }, (_, i) =>
      createLog(`log_${i}`, i, i * 1.5 + Math.random() * 10)
    );

    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      logs: logs as any,
      showRegression: true,
    });

    await result.waitForPlot();
    assertWebGLRenderMode(result);

    // Regression line should still be SVG (overlaid on WebGL)
    const plotData = result.getPlotDataGroup();
    const regressionLine = plotData?.querySelector('path.best-fit');
    expect(regressionLine).not.toBeNull();
  });
});

// =============================================================================
// WebGL Rendering
// =============================================================================

describe('Scatter Plot - WebGL Rendering', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('creates WebGL canvas with correct structure', async () => {
    updateConfig({ SVG_MAX: 50 });

    const logs = Array.from({ length: 100 }, (_, i) =>
      createLog(`log_${i}`, Math.random() * 100, Math.random() * 100)
    );

    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      logs: logs as any,
    });

    await result.waitForPlot();
    assertWebGLRenderMode(result);

    const webglCanvas = result.getWebGLCanvas();
    expect(webglCanvas).not.toBeNull();
    expect(webglCanvas?.tagName.toLowerCase()).toBe('canvas');
    expect(webglCanvas?.classList.contains('webgl-scatter')).toBe(true);
  });

  it('WebGL canvas has correct positioning', async () => {
    updateConfig({ SVG_MAX: 50 });

    const logs = Array.from({ length: 100 }, (_, i) =>
      createLog(`log_${i}`, Math.random() * 100, Math.random() * 100)
    );

    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      logs: logs as any,
    });

    await result.waitForPlot();

    const webglCanvas = result.getWebGLCanvas();
    expect(webglCanvas).not.toBeNull();
    expect(webglCanvas?.style.position).toBe('absolute');
    expect(webglCanvas?.style.top).toBe('0px');
    expect(webglCanvas?.style.left).toBe('0px');
  });

  it('removes SVG points when using WebGL mode', async () => {
    updateConfig({ SVG_MAX: 50 });

    const logs = Array.from({ length: 100 }, (_, i) =>
      createLog(`log_${i}`, Math.random() * 100, Math.random() * 100)
    );

    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      logs: logs as any,
    });

    await result.waitForPlot();
    assertWebGLRenderMode(result);

    // SVG points should be removed in WebGL mode
    const svgPoints = result.getScatterPoints();
    expect(svgPoints.length).toBe(0);
  });

  it('axes remain as SVG in WebGL mode', async () => {
    updateConfig({ SVG_MAX: 50 });

    const logs = Array.from({ length: 100 }, (_, i) => createLog(`log_${i}`, i, i * 2));

    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      logs: logs as any,
    });

    await result.waitForPlot();
    assertWebGLRenderMode(result);

    // Axes should still be SVG elements
    const svg = result.getSvg();
    expect(svg).not.toBeNull();

    const xAxis = svg?.querySelector('.xAxis');
    const yAxis = svg?.querySelector('.yAxis');
    expect(xAxis).not.toBeNull();
    expect(yAxis).not.toBeNull();
  });

  it('handles grouped data in WebGL mode', async () => {
    updateConfig({ SVG_MAX: 50 });

    const logs = Array.from({ length: 100 }, (_, i) =>
      createLog(`log_${i}`, Math.random() * 100, Math.random() * 100, `group_${i % 3}`)
    );

    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      logs: logs as any,
      groupBy: 'table1.category',
    });

    await result.waitForPlot();
    assertWebGLRenderMode(result);

    // Should render without errors
    const webglCanvas = result.getWebGLCanvas();
    expect(webglCanvas).not.toBeNull();
  });
});

// =============================================================================
// Tiered Rendering System Tests
// =============================================================================

describe('Scatter Plot - Tiered Rendering', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('uses SVG renderer for data below SVG_MAX threshold', async () => {
    const config = getConfig();
    const dataCount = Math.min(config.SVG_MAX - 100, 500); // Cap for test speed

    const logs = Array.from({ length: dataCount }, (_, i) =>
      createLog(`log_${i}`, Math.random() * 100, Math.random() * 100)
    );

    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      logs: logs as any,
    });

    await result.waitForPlot();

    assertSVGRenderMode(result);

    const points = result.getScatterPoints();
    expect(points.length).toBeGreaterThan(0);
    expect(result.getWebGLCanvas()).toBeNull();
  });

  it('switches to WebGL renderer for data above SVG_MAX threshold', async () => {
    updateConfig({ SVG_MAX: 100 });

    const logs = Array.from({ length: 150 }, (_, i) =>
      createLog(`log_${i}`, Math.random() * 100, Math.random() * 100)
    );

    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      logs: logs as any,
    });

    await result.waitForPlot();

    assertWebGLRenderMode(result);
    expect(result.getWebGLCanvas()).not.toBeNull();
    expect(result.getScatterPoints().length).toBe(0);
  });

  it('can force SVG render mode regardless of data size', async () => {
    const logs = Array.from({ length: 500 }, (_, i) =>
      createLog(`log_${i}`, Math.random() * 100, Math.random() * 100)
    );

    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      logs: logs as any,
      forceRenderMode: 'svg',
    });

    await result.waitForPlot();

    assertSVGRenderMode(result);
    expect(result.getScatterPoints().length).toBeGreaterThan(0);
  });

  it('can force WebGL render mode regardless of data size', async () => {
    const logs = Array.from({ length: 50 }, (_, i) =>
      createLog(`log_${i}`, Math.random() * 100, Math.random() * 100)
    );

    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      logs: logs as any,
      forceRenderMode: 'webgl',
    });

    await result.waitForPlot();

    assertWebGLRenderMode(result);
  });

  it('applies stratified sampling for very large datasets', async () => {
    updateConfig({
      SVG_MAX: 50,
      WEBGL_MAX: 100,
      SAMPLE_TARGET: 75,
    });

    const logs = Array.from({ length: 150 }, (_, i) =>
      createLog(`log_${i}`, Math.random() * 100, Math.random() * 100)
    );

    const result = renderPlotCanvas({
      plotType: 'Scatter Plot',
      logs: logs as any,
    });

    await result.waitForPlot();

    // Should show a sampling message in the placeholder
    const svg = result.getSvg();
    const placeholder = svg?.querySelector('.placeholderText');
    const placeholderText = placeholder?.textContent || '';

    expect(placeholderText).toMatch(/sample|showing.*of/i);
  });
});

// =============================================================================
// Viewport Culling Tests
// =============================================================================

describe('Scatter Plot - Viewport Culling', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('enables viewport culling by default', () => {
    const config = getConfig();
    expect(config.VIEWPORT_CULLING).toBe(true);
  });

  it('can disable viewport culling via config', () => {
    updateConfig({ VIEWPORT_CULLING: false });
    const config = getConfig();
    expect(config.VIEWPORT_CULLING).toBe(false);
  });
});

// =============================================================================
// Configuration Tests
// =============================================================================

describe('Scatter Plot - Configuration', () => {
  afterEach(() => {
    resetConfig();
  });

  it('has sensible default thresholds', () => {
    resetConfig();
    const config = getConfig();
    expect(config.SVG_MAX).toBe(2000);
    expect(config.WEBGL_MAX).toBe(1_000_000);
    expect(config.SAMPLE_TARGET).toBe(500_000);
  });

  it('allows updating configuration', () => {
    updateConfig({ SVG_MAX: 5000 });
    const config = getConfig();
    expect(config.SVG_MAX).toBe(5000);
    expect(config.WEBGL_MAX).toBe(1_000_000);
  });

  it('resets to defaults correctly', () => {
    updateConfig({ SVG_MAX: 999, WEBGL_MAX: 999 });
    resetConfig();
    const config = getConfig();
    expect(config.SVG_MAX).toBe(2000);
    expect(config.WEBGL_MAX).toBe(1_000_000);
  });
});
