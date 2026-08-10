/**
 * Plot Rendering Integration Browser Tests
 *
 * Tests end-to-end plot rendering scenarios including plot type transitions,
 * data updates, settings persistence, and cross-feature interactions.
 *
 * These tests run in a real browser environment via Playwright.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  renderPlotTile,
  createMockPlotData,
  PlotType,
} from '../behavior/fixtures/plotTileTestHarness';

// =============================================================================
// Plot Rendering Integration Tests
// =============================================================================

describe('Plot Rendering Integration', () => {
  // =========================================================================
  // A: Complete Plot Type Transitions
  // =========================================================================
  describe('A: Complete Plot Type Transitions', () => {
    it(
      'transitions through all plot types correctly',
      {
        meta: {
          alias: 'Integration-PlotType-AllTransitions',
          scenario: 'User switches through all available plot types.',
          behavior: 'Each plot type renders correctly with its specific elements.',
        },
      },
      async () => {
        const user = userEvent.setup();
        const { getPlotType } = renderPlotTile({
          initialPlotType: 'scatter',
          initialSettingsOpen: true,
          initialData: createMockPlotData(10),
        });

        await waitFor(() => {
          expect(screen.getByTestId('data-point-0')).toBeInTheDocument();
        });

        // Scatter -> Line
        await user.selectOptions(screen.getByTestId('plot-type-select'), 'line');
        await waitFor(() => {
          expect(getPlotType()).toBe('line');
          expect(screen.getByTestId('line-path')).toBeInTheDocument();
          expect(screen.queryByTestId('data-point-0')).not.toBeInTheDocument();
        });

        // Line -> Bar
        await user.selectOptions(screen.getByTestId('plot-type-select'), 'bar');
        await waitFor(() => {
          expect(getPlotType()).toBe('bar');
          expect(screen.getByTestId('bar-0')).toBeInTheDocument();
          expect(screen.queryByTestId('line-path')).not.toBeInTheDocument();
        });

        // Bar -> Histogram
        await user.selectOptions(screen.getByTestId('plot-type-select'), 'histogram');
        await waitFor(() => {
          expect(getPlotType()).toBe('histogram');
          expect(screen.getByTestId('histogram-bin-0')).toBeInTheDocument();
          expect(screen.queryByTestId('bar-0')).not.toBeInTheDocument();
        });

        // Histogram -> Scatter (full cycle)
        await user.selectOptions(screen.getByTestId('plot-type-select'), 'scatter');
        await waitFor(() => {
          expect(getPlotType()).toBe('scatter');
          expect(screen.getByTestId('data-point-0')).toBeInTheDocument();
          expect(screen.queryByTestId('histogram-bin-0')).not.toBeInTheDocument();
        });
      }
    );

    it(
      'preserves grouping across plot type changes',
      {
        meta: {
          alias: 'Integration-PlotType-PreserveGrouping',
          scenario: 'User changes plot type while grouping is enabled.',
          behavior: 'The grouping setting and legend persist across plot type changes.',
        },
      },
      async () => {
        const user = userEvent.setup();
        const { getColorBy } = renderPlotTile({
          initialPlotType: 'scatter',
          initialSettingsOpen: true,
          initialColorBy: 'category',
        });

        await waitFor(() => {
          expect(screen.getByTestId('legend')).toBeInTheDocument();
        });

        // Switch to line
        await user.selectOptions(screen.getByTestId('plot-type-select'), 'line');
        await waitFor(() => {
          expect(screen.getByTestId('line-path')).toBeInTheDocument();
        });

        // Grouping should still be active
        expect(getColorBy()).toBe('category');
        expect(screen.getByTestId('legend')).toBeInTheDocument();

        // Switch to bar
        await user.selectOptions(screen.getByTestId('plot-type-select'), 'bar');
        await waitFor(() => {
          expect(screen.getByTestId('bar-0')).toBeInTheDocument();
        });

        expect(getColorBy()).toBe('category');
        expect(screen.getByTestId('legend')).toBeInTheDocument();
      }
    );

    it(
      'clears type-specific settings on plot type change',
      {
        meta: {
          alias: 'Integration-PlotType-ClearSettings',
          scenario: 'User switches from scatter (with regression) to histogram.',
          behavior: "Regression line is removed since it's not applicable to histogram.",
        },
      },
      async () => {
        const user = userEvent.setup();
        renderPlotTile({
          initialPlotType: 'scatter',
          initialSettingsOpen: true,
          initialShowRegression: true,
        });

        await waitFor(() => {
          expect(screen.getByTestId('regression-line')).toBeInTheDocument();
        });

        await user.selectOptions(screen.getByTestId('plot-type-select'), 'histogram');

        await waitFor(() => {
          expect(screen.getByTestId('histogram-bin-0')).toBeInTheDocument();
        });

        // Regression line should not be visible (not applicable)
        expect(screen.queryByTestId('regression-line')).not.toBeInTheDocument();
      }
    );
  });

  // =========================================================================
  // B: Settings Panel Interactions
  // =========================================================================
  describe('B: Settings Panel Interactions', () => {
    it(
      'toggles settings panel visibility',
      {
        meta: {
          alias: 'Integration-Settings-Toggle',
          scenario: 'User clicks the settings button multiple times.',
          behavior: 'Settings panel opens and closes accordingly.',
        },
      },
      async () => {
        const user = userEvent.setup();
        const { isSettingsOpen } = renderPlotTile({ initialPlotType: 'scatter' });

        await waitFor(() => {
          expect(screen.getByTestId('plot-tile-container')).toBeInTheDocument();
        });

        expect(isSettingsOpen()).toBe(false);
        expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument();

        // Open
        await user.click(screen.getByTestId('settings-button'));
        await waitFor(() => {
          expect(isSettingsOpen()).toBe(true);
          expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
        });

        // Close
        await user.click(screen.getByTestId('settings-button'));
        await waitFor(() => {
          expect(isSettingsOpen()).toBe(false);
          expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument();
        });
      }
    );

    it(
      'settings changes apply immediately to plot',
      {
        meta: {
          alias: 'Integration-Settings-ImmediateApply',
          scenario: 'User changes X axis in settings.',
          behavior: 'The plot updates immediately without requiring a save/apply action.',
        },
      },
      async () => {
        const user = userEvent.setup();
        const { getXAxis } = renderPlotTile({
          initialPlotType: 'scatter',
          initialSettingsOpen: true,
          initialXAxis: 'x',
        });

        await waitFor(() => {
          expect(screen.getByTestId('x-axis-label')).toHaveTextContent('x');
        });

        await user.selectOptions(screen.getByTestId('x-axis-select'), 'timestamp');

        await waitFor(() => {
          expect(getXAxis()).toBe('timestamp');
          expect(screen.getByTestId('x-axis-label')).toHaveTextContent('timestamp');
        });
      }
    );

    it(
      'shows plot-type-specific settings',
      {
        meta: {
          alias: 'Integration-Settings-TypeSpecific',
          scenario: 'User views settings for different plot types.',
          behavior: 'Each plot type shows its relevant settings controls.',
        },
      },
      async () => {
        const user = userEvent.setup();
        renderPlotTile({
          initialPlotType: 'scatter',
          initialSettingsOpen: true,
        });

        // Scatter-specific controls
        await waitFor(() => {
          expect(screen.getByTestId('regression-toggle')).toBeInTheDocument();
          expect(screen.getByTestId('zoom-toggle')).toBeInTheDocument();
          expect(screen.getByTestId('scale-x-select')).toBeInTheDocument();
        });

        // Switch to histogram
        await user.selectOptions(screen.getByTestId('plot-type-select'), 'histogram');

        await waitFor(() => {
          // Histogram-specific controls
          expect(screen.getByTestId('bin-count-slider')).toBeInTheDocument();
          // Scatter controls should be gone
          expect(screen.queryByTestId('regression-toggle')).not.toBeInTheDocument();
          expect(screen.queryByTestId('zoom-toggle')).not.toBeInTheDocument();
        });
      }
    );
  });

  // =========================================================================
  // C: Focus Mode Integration
  // =========================================================================
  describe('C: Focus Mode Integration', () => {
    it(
      'enters and exits focus mode correctly',
      {
        meta: {
          alias: 'Integration-Focus-EnterExit',
          scenario: 'User clicks focus button to expand plot, then clicks again to collapse.',
          behavior: 'Plot expands to full screen with overlay, then returns to normal.',
        },
      },
      async () => {
        const user = userEvent.setup();
        const { isFocusMode } = renderPlotTile({ initialPlotType: 'scatter' });

        await waitFor(() => {
          expect(screen.getByTestId('plot-tile-container')).toBeInTheDocument();
        });

        expect(isFocusMode()).toBe(false);
        expect(screen.queryByTestId('focus-overlay')).not.toBeInTheDocument();

        // Enter focus mode
        await user.click(screen.getByTestId('focus-mode-button'));
        await waitFor(() => {
          expect(isFocusMode()).toBe(true);
          expect(screen.getByTestId('focus-overlay')).toBeInTheDocument();
        });

        // Exit focus mode
        await user.click(screen.getByTestId('focus-mode-button'));
        await waitFor(() => {
          expect(isFocusMode()).toBe(false);
          expect(screen.queryByTestId('focus-overlay')).not.toBeInTheDocument();
        });
      }
    );

    it(
      'maintains plot state during focus mode',
      {
        meta: {
          alias: 'Integration-Focus-PreserveState',
          scenario: 'User enters focus mode while plot has specific settings.',
          behavior: 'All settings and plot state are preserved in focus mode.',
        },
      },
      async () => {
        const user = userEvent.setup();
        const { isFocusMode, getPlotType, getColorBy, isRegressionShown } = renderPlotTile({
          initialPlotType: 'scatter',
          initialColorBy: 'category',
          initialShowRegression: true,
        });

        await waitFor(() => {
          expect(screen.getByTestId('regression-line')).toBeInTheDocument();
          expect(screen.getByTestId('legend')).toBeInTheDocument();
        });

        // Enter focus mode
        await user.click(screen.getByTestId('focus-mode-button'));
        await waitFor(() => {
          expect(isFocusMode()).toBe(true);
        });

        // All state should be preserved
        expect(getPlotType()).toBe('scatter');
        expect(getColorBy()).toBe('category');
        expect(isRegressionShown()).toBe(true);
        expect(screen.getByTestId('regression-line')).toBeInTheDocument();
        expect(screen.getByTestId('legend')).toBeInTheDocument();
      }
    );

    it(
      'can modify settings while in focus mode',
      {
        meta: {
          alias: 'Integration-Focus-ModifySettings',
          scenario: 'User opens settings panel while in focus mode.',
          behavior: 'Settings changes apply correctly even in focus mode.',
        },
      },
      async () => {
        const user = userEvent.setup();
        const { getPlotType } = renderPlotTile({
          initialPlotType: 'scatter',
          initialFocusMode: true,
        });

        await waitFor(() => {
          expect(screen.getByTestId('focus-overlay')).toBeInTheDocument();
        });

        // Open settings
        await user.click(screen.getByTestId('settings-button'));
        await waitFor(() => {
          expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
        });

        // Change plot type
        await user.selectOptions(screen.getByTestId('plot-type-select'), 'line');
        await waitFor(() => {
          expect(getPlotType()).toBe('line');
          expect(screen.getByTestId('line-path')).toBeInTheDocument();
        });
      }
    );
  });

  // =========================================================================
  // D: Data Interaction Integration
  // =========================================================================
  describe('D: Data Interaction Integration', () => {
    it(
      'tooltip shows correct data for grouped points',
      {
        meta: {
          alias: 'Integration-Tooltip-GroupedData',
          scenario: 'User hovers over a data point when grouping is enabled.',
          behavior: 'Tooltip displays the point data including its group/category.',
        },
      },
      async () => {
        const user = userEvent.setup();
        renderPlotTile({
          initialPlotType: 'scatter',
          initialColorBy: 'category',
          initialData: createMockPlotData(5),
        });

        await waitFor(() => {
          expect(screen.getByTestId('data-point-0')).toBeInTheDocument();
          expect(screen.getByTestId('legend')).toBeInTheDocument();
        });

        await user.hover(screen.getByTestId('data-point-0'));

        await waitFor(() => {
          expect(screen.getByTestId('tooltip')).toBeInTheDocument();
          expect(screen.getByTestId('tooltip')).toHaveTextContent('Point 1');
        });
      }
    );

    it(
      'hover effects work with zoom enabled',
      {
        meta: {
          alias: 'Integration-Hover-WithZoom',
          scenario: 'User hovers over data point when zoom is enabled.',
          behavior: 'Hover effects and tooltip work correctly regardless of zoom state.',
        },
      },
      async () => {
        const user = userEvent.setup();
        renderPlotTile({
          initialPlotType: 'scatter',
          initialZoomEnabled: true,
          initialData: createMockPlotData(5),
        });

        await waitFor(() => {
          expect(screen.getByTestId('data-point-0')).toBeInTheDocument();
        });

        const svg = screen.getByTestId('plot-svg');
        expect(svg.getAttribute('data-zoom-enabled')).toBe('true');

        await user.hover(screen.getByTestId('data-point-0'));

        await waitFor(() => {
          expect(screen.getByTestId('tooltip')).toBeInTheDocument();
        });
      }
    );

    it(
      'hover effects work with regression line shown',
      {
        meta: {
          alias: 'Integration-Hover-WithRegression',
          scenario: 'User hovers over data point when regression line is visible.',
          behavior: 'Hover effects work correctly without interfering with regression line.',
        },
      },
      async () => {
        const user = userEvent.setup();
        renderPlotTile({
          initialPlotType: 'scatter',
          initialShowRegression: true,
          initialData: createMockPlotData(5),
        });

        await waitFor(() => {
          expect(screen.getByTestId('data-point-0')).toBeInTheDocument();
          expect(screen.getByTestId('regression-line')).toBeInTheDocument();
        });

        await user.hover(screen.getByTestId('data-point-0'));

        await waitFor(() => {
          expect(screen.getByTestId('tooltip')).toBeInTheDocument();
        });

        // Regression line should still be visible
        expect(screen.getByTestId('regression-line')).toBeInTheDocument();
      }
    );
  });

  // =========================================================================
  // E: Multi-Feature Combinations
  // =========================================================================
  describe('E: Multi-Feature Combinations', () => {
    it(
      'handles all scatter features enabled simultaneously',
      {
        meta: {
          alias: 'Integration-Scatter-AllFeatures',
          scenario: 'User enables grouping, regression, log scale, and zoom together.',
          behavior: 'All features work correctly without conflicts.',
        },
      },
      async () => {
        const user = userEvent.setup();
        const { getColorBy, isRegressionShown, getScaleX, isZoomEnabled } = renderPlotTile({
          initialPlotType: 'scatter',
          initialSettingsOpen: true,
          initialColorBy: 'category',
          initialShowRegression: true,
          initialScaleX: 'log',
          initialZoomEnabled: true,
        });

        await waitFor(() => {
          expect(screen.getByTestId('data-point-0')).toBeInTheDocument();
        });

        // All features active
        expect(getColorBy()).toBe('category');
        expect(isRegressionShown()).toBe(true);
        expect(getScaleX()).toBe('log');
        expect(isZoomEnabled()).toBe(true);

        // Visual elements present
        expect(screen.getByTestId('legend')).toBeInTheDocument();
        expect(screen.getByTestId('regression-line')).toBeInTheDocument();
        expect(screen.getByTestId('plot-svg').getAttribute('data-scale-x')).toBe('log');
        expect(screen.getByTestId('plot-svg').getAttribute('data-zoom-enabled')).toBe('true');

        // Can still hover
        await user.hover(screen.getByTestId('data-point-0'));
        await waitFor(() => {
          expect(screen.getByTestId('tooltip')).toBeInTheDocument();
        });
      }
    );

    it(
      'rapid feature toggling does not cause errors',
      {
        meta: {
          alias: 'Integration-RapidToggle-NoErrors',
          scenario: 'User rapidly toggles multiple features on and off.',
          behavior: 'All toggles are processed correctly without UI glitches.',
        },
      },
      async () => {
        const user = userEvent.setup();
        const { isRegressionShown, isZoomEnabled, getScaleX } = renderPlotTile({
          initialPlotType: 'scatter',
          initialSettingsOpen: true,
        });

        await waitFor(() => {
          expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
        });

        // Rapid toggles
        await user.click(screen.getByTestId('regression-toggle'));
        await user.click(screen.getByTestId('zoom-toggle'));
        await user.selectOptions(screen.getByTestId('scale-x-select'), 'log');
        await user.click(screen.getByTestId('regression-toggle'));
        await user.selectOptions(screen.getByTestId('scale-x-select'), 'linear');
        await user.click(screen.getByTestId('zoom-toggle'));

        // Final state should be coherent
        await waitFor(() => {
          expect(isRegressionShown()).toBe(false);
          expect(isZoomEnabled()).toBe(false);
          expect(getScaleX()).toBe('linear');
        });

        // Plot should still render correctly
        expect(screen.getByTestId('data-point-0')).toBeInTheDocument();
      }
    );
  });

  // =========================================================================
  // F: Callbacks Integration
  // =========================================================================
  describe('F: Callbacks Integration', () => {
    it(
      'all callbacks fire correctly during a complex interaction sequence',
      {
        meta: {
          alias: 'Integration-Callbacks-ComplexWorkflow',
          scenario: 'User performs multiple actions that trigger various callbacks.',
          behavior: 'Each callback is called with correct parameters.',
        },
      },
      async () => {
        const user = userEvent.setup();
        const callbacks = {
          onXAxisChange: vi.fn(),
          onYAxisChange: vi.fn(),
          onPlotTypeChange: vi.fn(),
          onColorByChange: vi.fn(),
          onScaleXChange: vi.fn(),
          onRegressionChange: vi.fn(),
          onZoomChange: vi.fn(),
          onSettingsToggle: vi.fn(),
          onFocusModeToggle: vi.fn(),
        };

        renderPlotTile({
          initialPlotType: 'scatter',
          callbacks,
        });

        await waitFor(() => {
          expect(screen.getByTestId('plot-tile-container')).toBeInTheDocument();
        });

        // Open settings
        await user.click(screen.getByTestId('settings-button'));
        expect(callbacks.onSettingsToggle).toHaveBeenCalledWith(true);

        // Change X axis
        await user.selectOptions(screen.getByTestId('x-axis-select'), 'timestamp');
        expect(callbacks.onXAxisChange).toHaveBeenCalledWith('timestamp');

        // Change Y axis
        await user.selectOptions(screen.getByTestId('y-axis-select'), 'score');
        expect(callbacks.onYAxisChange).toHaveBeenCalledWith('score');

        // Enable grouping
        await user.selectOptions(screen.getByTestId('color-by-select'), 'category');
        expect(callbacks.onColorByChange).toHaveBeenCalledWith('category');

        // Enable regression
        await user.click(screen.getByTestId('regression-toggle'));
        expect(callbacks.onRegressionChange).toHaveBeenCalledWith(true);

        // Enable zoom
        await user.click(screen.getByTestId('zoom-toggle'));
        expect(callbacks.onZoomChange).toHaveBeenCalledWith(true);

        // Change scale
        await user.selectOptions(screen.getByTestId('scale-x-select'), 'log');
        expect(callbacks.onScaleXChange).toHaveBeenCalledWith('log');

        // Change plot type
        await user.selectOptions(screen.getByTestId('plot-type-select'), 'line');
        expect(callbacks.onPlotTypeChange).toHaveBeenCalledWith('line');

        // Enter focus mode
        await user.click(screen.getByTestId('focus-mode-button'));
        expect(callbacks.onFocusModeToggle).toHaveBeenCalledWith(true);
      }
    );
  });
});
