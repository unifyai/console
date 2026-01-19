/**
 * Plot Type Transitions Tests
 *
 * Browser-based tests for transitioning between different plot types
 * using the plotTileTestHarness (for Zustand store interactions).
 *
 * Tests verify:
 * - Plot type changes render correctly
 * - State is preserved across transitions where appropriate
 * - No rendering errors during transitions
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, waitFor, screen } from '@testing-library/react';
import {
  renderPlotTile,
  PlotType,
  PlotTileTestResult,
} from '../../interfaces/behavior/fixtures/plotTileTestHarness';

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
 * Wait for plot to update after type change
 */
async function waitForPlotUpdate(result: PlotTileTestResult, expectedType: PlotType) {
  await waitFor(() => {
    expect(result.getPlotType()).toBe(expectedType);
  });
}

// =============================================================================
// Plot Type Transition Tests
// =============================================================================

describe('Plot Type Transitions', () => {
  describe('Scatter to Other Types', () => {
    it('transitions from scatter to bar', async () => {
      const result = renderPlotTile({
        initialPlotType: 'scatter',
        initialXAxis: 'x',
        initialYAxis: 'y',
      });

      expect(result.getPlotType()).toBe('scatter');

      result.setPlotType('bar');

      await waitForPlotUpdate(result, 'bar');

      // Verify the plot canvas updated
      const canvas = result.getByTestId('plot-canvas');
      expect(canvas.dataset.plotType).toBe('bar');
    });

    it('transitions from scatter to line', async () => {
      const result = renderPlotTile({
        initialPlotType: 'scatter',
      });

      result.setPlotType('line');

      await waitForPlotUpdate(result, 'line');

      const canvas = result.getByTestId('plot-canvas');
      expect(canvas.dataset.plotType).toBe('line');
    });

    it('transitions from scatter to histogram', async () => {
      const result = renderPlotTile({
        initialPlotType: 'scatter',
      });

      result.setPlotType('histogram');

      await waitForPlotUpdate(result, 'histogram');

      const canvas = result.getByTestId('plot-canvas');
      expect(canvas.dataset.plotType).toBe('histogram');
    });
  });

  describe('Bar to Other Types', () => {
    it('transitions from bar to scatter', async () => {
      const result = renderPlotTile({
        initialPlotType: 'bar',
      });

      result.setPlotType('scatter');

      await waitForPlotUpdate(result, 'scatter');

      const canvas = result.getByTestId('plot-canvas');
      expect(canvas.dataset.plotType).toBe('scatter');
    });

    it('transitions from bar to line', async () => {
      const result = renderPlotTile({
        initialPlotType: 'bar',
      });

      result.setPlotType('line');

      await waitForPlotUpdate(result, 'line');

      const canvas = result.getByTestId('plot-canvas');
      expect(canvas.dataset.plotType).toBe('line');
    });

    it('transitions from bar to histogram', async () => {
      const result = renderPlotTile({
        initialPlotType: 'bar',
      });

      result.setPlotType('histogram');

      await waitForPlotUpdate(result, 'histogram');

      const canvas = result.getByTestId('plot-canvas');
      expect(canvas.dataset.plotType).toBe('histogram');
    });
  });

  describe('Line to Other Types', () => {
    it('transitions from line to scatter', async () => {
      const result = renderPlotTile({
        initialPlotType: 'line',
      });

      result.setPlotType('scatter');

      await waitForPlotUpdate(result, 'scatter');
    });

    it('transitions from line to bar', async () => {
      const result = renderPlotTile({
        initialPlotType: 'line',
      });

      result.setPlotType('bar');

      await waitForPlotUpdate(result, 'bar');
    });

    it('transitions from line to histogram', async () => {
      const result = renderPlotTile({
        initialPlotType: 'line',
      });

      result.setPlotType('histogram');

      await waitForPlotUpdate(result, 'histogram');
    });
  });

  describe('Histogram to Other Types', () => {
    it('transitions from histogram to scatter', async () => {
      const result = renderPlotTile({
        initialPlotType: 'histogram',
        initialBinCount: 20,
      });

      result.setPlotType('scatter');

      await waitForPlotUpdate(result, 'scatter');
    });

    it('transitions from histogram to bar', async () => {
      const result = renderPlotTile({
        initialPlotType: 'histogram',
      });

      result.setPlotType('bar');

      await waitForPlotUpdate(result, 'bar');
    });

    it('transitions from histogram to line', async () => {
      const result = renderPlotTile({
        initialPlotType: 'histogram',
      });

      result.setPlotType('line');

      await waitForPlotUpdate(result, 'line');
    });
  });
});

// =============================================================================
// State Preservation Tests
// =============================================================================

describe('State Preservation During Transitions', () => {
  it('preserves axis selections when changing plot type', async () => {
    const result = renderPlotTile({
      initialPlotType: 'scatter',
      initialXAxis: 'timestamp',
      initialYAxis: 'score',
    });

    result.setPlotType('line');

    await waitForPlotUpdate(result, 'line');

    // Axes should be preserved
    expect(result.getXAxis()).toBe('timestamp');
    expect(result.getYAxis()).toBe('score');
  });

  it('preserves color by setting when changing plot type', async () => {
    const result = renderPlotTile({
      initialPlotType: 'scatter',
      initialColorBy: 'category',
    });

    result.setPlotType('bar');

    await waitForPlotUpdate(result, 'bar');

    expect(result.getColorBy()).toBe('category');
  });

  it('preserves scale settings when changing between compatible types', async () => {
    const result = renderPlotTile({
      initialPlotType: 'scatter',
      initialScaleX: 'log',
      initialScaleY: 'linear',
    });

    result.setPlotType('line');

    await waitForPlotUpdate(result, 'line');

    expect(result.getScaleX()).toBe('log');
    expect(result.getScaleY()).toBe('linear');
  });

  it('preserves settings panel state across transitions', async () => {
    const result = renderPlotTile({
      initialPlotType: 'scatter',
      initialSettingsOpen: true,
    });

    expect(result.isSettingsOpen()).toBe(true);

    result.setPlotType('bar');

    await waitForPlotUpdate(result, 'bar');

    expect(result.isSettingsOpen()).toBe(true);
  });
});

// =============================================================================
// Rapid Transition Tests
// =============================================================================

describe('Rapid Plot Type Changes', () => {
  it('handles rapid successive type changes', async () => {
    const result = renderPlotTile({
      initialPlotType: 'scatter',
    });

    // Rapidly change types
    result.setPlotType('bar');
    result.setPlotType('line');
    result.setPlotType('histogram');
    result.setPlotType('scatter');

    // Should end up at scatter
    await waitForPlotUpdate(result, 'scatter');
  });

  it('handles cycling through all types', async () => {
    const result = renderPlotTile({
      initialPlotType: 'scatter',
    });

    const types: PlotType[] = ['scatter', 'bar', 'line', 'histogram'];

    for (const type of types) {
      result.setPlotType(type);
      await waitForPlotUpdate(result, type);
    }

    // Should end at histogram
    expect(result.getPlotType()).toBe('histogram');
  });
});

// =============================================================================
// Type-Specific Settings Tests
// =============================================================================

describe('Type-Specific Settings During Transitions', () => {
  it('regression settings only apply to scatter', async () => {
    const result = renderPlotTile({
      initialPlotType: 'scatter',
      initialShowRegression: true,
    });

    expect(result.isRegressionShown()).toBe(true);

    // Change to bar - regression should still be tracked but not visible
    result.setPlotType('bar');
    await waitForPlotUpdate(result, 'bar');

    // Regression state is preserved but not rendered for bar
    expect(result.isRegressionShown()).toBe(true);

    // Change back to scatter - regression should be visible again
    result.setPlotType('scatter');
    await waitForPlotUpdate(result, 'scatter');

    expect(result.isRegressionShown()).toBe(true);
  });

  it('bin count settings only apply to histogram', async () => {
    const result = renderPlotTile({
      initialPlotType: 'histogram',
      initialBinCount: 25,
    });

    expect(result.getBinCount()).toBe(25);

    result.setPlotType('scatter');
    await waitForPlotUpdate(result, 'scatter');

    // Bin count is preserved in state
    expect(result.getBinCount()).toBe(25);

    result.setPlotType('histogram');
    await waitForPlotUpdate(result, 'histogram');

    // Bin count should still be 25
    expect(result.getBinCount()).toBe(25);
  });
});

// =============================================================================
// Focus Mode Transition Tests
// =============================================================================

describe('Focus Mode During Transitions', () => {
  it('maintains focus mode during plot type change', async () => {
    const result = renderPlotTile({
      initialPlotType: 'scatter',
      initialFocusMode: true,
    });

    expect(result.isFocusMode()).toBe(true);
    expect(result.getByTestId('focus-overlay')).toBeInTheDocument();

    result.setPlotType('bar');
    await waitForPlotUpdate(result, 'bar');

    expect(result.isFocusMode()).toBe(true);
    expect(result.getByTestId('focus-overlay')).toBeInTheDocument();
  });
});

// =============================================================================
// Error Recovery Tests
// =============================================================================

describe('Transition Error Recovery', () => {
  it('recovers from transition to invalid state', async () => {
    const result = renderPlotTile({
      initialPlotType: 'scatter',
      initialXAxis: 'x',
      initialYAxis: 'y',
    });

    // This should not cause errors
    result.setPlotType('histogram');
    await waitForPlotUpdate(result, 'histogram');

    // Container should still be rendered
    expect(result.getByTestId('plot-canvas')).toBeInTheDocument();
  });
});

// =============================================================================
// Callback Tests
// =============================================================================

describe('Transition Callbacks', () => {
  it('fires onPlotTypeChange callback', async () => {
    const onPlotTypeChange = vi.fn();

    const result = renderPlotTile({
      initialPlotType: 'scatter',
      callbacks: {
        onPlotTypeChange,
      },
    });

    result.setPlotType('bar');

    expect(onPlotTypeChange).toHaveBeenCalledWith('bar');
  });

  it('fires callback for each type change', async () => {
    const onPlotTypeChange = vi.fn();

    const result = renderPlotTile({
      initialPlotType: 'scatter',
      callbacks: {
        onPlotTypeChange,
      },
    });

    result.setPlotType('bar');
    result.setPlotType('line');
    result.setPlotType('histogram');

    expect(onPlotTypeChange).toHaveBeenCalledTimes(3);
    expect(onPlotTypeChange).toHaveBeenNthCalledWith(1, 'bar');
    expect(onPlotTypeChange).toHaveBeenNthCalledWith(2, 'line');
    expect(onPlotTypeChange).toHaveBeenNthCalledWith(3, 'histogram');
  });
});

// =============================================================================
// Scatter Plot Render Mode Transitions (SVG ↔ WebGL)
// =============================================================================

import {
  renderPlotCanvas,
  updateConfig,
  resetConfig,
  assertSVGRenderMode,
  assertWebGLRenderMode,
} from '../fixtures/plotCanvasTestHarness';

/**
 * Helper to create a log for render mode tests
 */
function createLog(id: string, xValue: number, yValue: number, category: string = 'test') {
  return {
    type: 'ungrouped',
    id,
    ts: new Date().toISOString(),
    params: {},
    entries: {
      'table1.x_value': xValue,
      'table1.y_value': yValue,
      'table1.category': category,
    },
    derivedEntries: {},
    clippedFields: {},
    'table1.id': id,
    'table1.entries': {
      'table1.x_value': xValue,
      'table1.y_value': yValue,
      'table1.category': category,
    },
  };
}

function createDataset(count: number) {
  return Array.from({ length: count }, (_, i) =>
    createLog(`log_${i}`, Math.random() * 100, Math.random() * 100)
  );
}

describe('Scatter Plot - Render Mode Transitions', () => {
  beforeEach(() => {
    resetConfig();
  });

  afterEach(() => {
    resetConfig();
  });

  describe('Automatic Mode Switching', () => {
    it('switches from SVG to WebGL when data size increases', async () => {
      updateConfig({ svgMax: 100 });

      // First render with small data (SVG mode)
      const smallData = createDataset(50);
      const result1 = renderPlotCanvas({
        plotType: 'Scatter Plot',
        logs: smallData,
      });

      await result1.waitForPlot();
      assertSVGRenderMode(result1);
      expect(result1.getScatterPoints().length).toBeGreaterThan(0);
      expect(result1.getWebGLCanvas()).toBeNull();

      cleanup();

      // Second render with large data (WebGL mode)
      const largeData = createDataset(150);
      const result2 = renderPlotCanvas({
        plotType: 'Scatter Plot',
        logs: largeData,
      });

      await result2.waitForPlot();
      assertWebGLRenderMode(result2);
      expect(result2.getWebGLCanvas()).not.toBeNull();
      expect(result2.getScatterPoints().length).toBe(0);
    });

    it('switches from WebGL to SVG when data size decreases', async () => {
      updateConfig({ svgMax: 100 });

      // First render with large data (WebGL mode)
      const largeData = createDataset(150);
      const result1 = renderPlotCanvas({
        plotType: 'Scatter Plot',
        logs: largeData,
      });

      await result1.waitForPlot();
      assertWebGLRenderMode(result1);

      cleanup();

      // Second render with small data (SVG mode)
      const smallData = createDataset(50);
      const result2 = renderPlotCanvas({
        plotType: 'Scatter Plot',
        logs: smallData,
      });

      await result2.waitForPlot();
      assertSVGRenderMode(result2);
      expect(result2.getScatterPoints().length).toBeGreaterThan(0);
    });

    it('hides WebGL canvas when switching to SVG mode', async () => {
      updateConfig({ svgMax: 100 });

      // First render with WebGL
      const largeData = createDataset(150);
      const result1 = renderPlotCanvas({
        plotType: 'Scatter Plot',
        logs: largeData,
      });

      await result1.waitForPlot();
      const webglCanvas1 = result1.getWebGLCanvas();
      expect(webglCanvas1).not.toBeNull();
      expect(webglCanvas1?.style.display).not.toBe('none');

      cleanup();

      // Switch to SVG mode
      const smallData = createDataset(50);
      const result2 = renderPlotCanvas({
        plotType: 'Scatter Plot',
        logs: smallData,
      });

      await result2.waitForPlot();
      assertSVGRenderMode(result2);

      // WebGL canvas should be hidden or removed
      const webglCanvas2 = result2.getWebGLCanvas();
      expect(webglCanvas2 === null || webglCanvas2.style.display === 'none').toBe(true);
    });
  });

  describe('Canvas Lifecycle', () => {
    it('WebGL canvas is properly initialized with correct class', async () => {
      updateConfig({ svgMax: 100 });
      const logs = createDataset(150);

      const result = renderPlotCanvas({
        plotType: 'Scatter Plot',
        logs,
      });

      await result.waitForPlot();
      assertWebGLRenderMode(result);

      const webglCanvas = result.getWebGLCanvas();
      expect(webglCanvas).not.toBeNull();
      expect(webglCanvas?.classList.contains('webgl-scatter')).toBe(true);
    });

    it('SVG and WebGL can coexist (axes remain SVG in WebGL mode)', async () => {
      updateConfig({ svgMax: 100 });
      const logs = createDataset(150);

      const result = renderPlotCanvas({
        plotType: 'Scatter Plot',
        logs,
      });

      await result.waitForPlot();
      assertWebGLRenderMode(result);

      // WebGL canvas for points
      expect(result.getWebGLCanvas()).not.toBeNull();

      // SVG for axes
      const svg = result.getSvg();
      expect(svg).not.toBeNull();
      expect(svg?.querySelector('.xAxis')).not.toBeNull();
      expect(svg?.querySelector('.yAxis')).not.toBeNull();
    });

    it('regression lines remain SVG when using WebGL renderer', async () => {
      updateConfig({ svgMax: 100 });
      const logs = Array.from({ length: 150 }, (_, i) =>
        createLog(`log_${i}`, i, i * 2 + Math.random() * 5)
      );

      const result = renderPlotCanvas({
        plotType: 'Scatter Plot',
        logs,
        showRegression: true,
      });

      await result.waitForPlot();
      assertWebGLRenderMode(result);

      const plotData = result.getPlotDataGroup();
      const regressionPath = plotData?.querySelector('path.best-fit');
      expect(regressionPath).not.toBeNull();
    });
  });

  describe('Forced Mode Transitions', () => {
    it('forceRenderMode overrides automatic mode selection', async () => {
      updateConfig({ svgMax: 100 });
      const logs = createDataset(150);

      // Force SVG mode despite large data
      const result = renderPlotCanvas({
        plotType: 'Scatter Plot',
        logs,
        forceRenderMode: 'svg',
      });

      await result.waitForPlot();
      assertSVGRenderMode(result);
      expect(result.getScatterPoints().length).toBeGreaterThan(0);
    });

    it('can force WebGL mode for small datasets', async () => {
      const logs = createDataset(50);

      const result = renderPlotCanvas({
        plotType: 'Scatter Plot',
        logs,
        forceRenderMode: 'webgl',
      });

      await result.waitForPlot();
      assertWebGLRenderMode(result);
      expect(result.getWebGLCanvas()).not.toBeNull();
    });

    it('transitions correctly between forced modes', async () => {
      const logs = createDataset(100);

      // First: force SVG
      const result1 = renderPlotCanvas({
        plotType: 'Scatter Plot',
        logs,
        forceRenderMode: 'svg',
      });

      await result1.waitForPlot();
      assertSVGRenderMode(result1);

      cleanup();

      // Second: force WebGL with same data
      const result2 = renderPlotCanvas({
        plotType: 'Scatter Plot',
        logs,
        forceRenderMode: 'webgl',
      });

      await result2.waitForPlot();
      assertWebGLRenderMode(result2);
    });
  });

  describe('Threshold Changes', () => {
    it('responds to svgMax threshold changes', async () => {
      const logs = createDataset(150);

      // High threshold → SVG mode
      updateConfig({ svgMax: 200 });

      const result1 = renderPlotCanvas({
        plotType: 'Scatter Plot',
        logs,
      });

      await result1.waitForPlot();
      assertSVGRenderMode(result1);

      cleanup();
      resetConfig();

      // Low threshold → WebGL mode
      updateConfig({ svgMax: 100 });

      const result2 = renderPlotCanvas({
        plotType: 'Scatter Plot',
        logs,
      });

      await result2.waitForPlot();
      assertWebGLRenderMode(result2);
    });
  });

  describe('Cross-Mode Consistency', () => {
    it('produces consistent axis ranges in SVG and WebGL modes', async () => {
      const logs = Array.from({ length: 100 }, (_, i) => createLog(`log_${i}`, i, i * 2));

      // Render in SVG mode
      const svgResult = renderPlotCanvas({
        plotType: 'Scatter Plot',
        logs,
        forceRenderMode: 'svg',
      });

      await svgResult.waitForPlot();
      const svgXTicks = svgResult.getAxisTicks('x');
      const svgYTicks = svgResult.getAxisTicks('y');

      cleanup();

      // Render in WebGL mode
      const webglResult = renderPlotCanvas({
        plotType: 'Scatter Plot',
        logs,
        forceRenderMode: 'webgl',
      });

      await webglResult.waitForPlot();
      const webglXTicks = webglResult.getAxisTicks('x');
      const webglYTicks = webglResult.getAxisTicks('y');

      // Tick counts should be similar
      expect(Math.abs(svgXTicks.length - webglXTicks.length)).toBeLessThanOrEqual(2);
      expect(Math.abs(svgYTicks.length - webglYTicks.length)).toBeLessThanOrEqual(2);
    });

    it('renders regression line in both modes', async () => {
      const logs = Array.from({ length: 100 }, (_, i) => createLog(`log_${i}`, i, i * 1.5));

      // SVG mode
      const svgResult = renderPlotCanvas({
        plotType: 'Scatter Plot',
        logs,
        showRegression: true,
        forceRenderMode: 'svg',
      });

      await svgResult.waitForPlot();
      expect(svgResult.getPlotDataGroup()?.querySelector('path.best-fit')).not.toBeNull();

      cleanup();

      // WebGL mode
      const webglResult = renderPlotCanvas({
        plotType: 'Scatter Plot',
        logs,
        showRegression: true,
        forceRenderMode: 'webgl',
      });

      await webglResult.waitForPlot();
      expect(webglResult.getPlotDataGroup()?.querySelector('path.best-fit')).not.toBeNull();
    });
  });
});
