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

import { describe, it, expect, afterEach } from 'vitest';
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
async function waitForPlotUpdate(
  result: PlotTileTestResult,
  expectedType: PlotType
) {
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

// Import vi for callback tests
import { vi } from 'vitest';



