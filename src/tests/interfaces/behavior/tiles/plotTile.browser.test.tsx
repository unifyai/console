/**
 * P2-F: Plot Tile Behavior Tests
 *
 * Tests plot/chart visualization behaviors including axis selection,
 * plot type changes, tooltips, and focus mode.
 * 
 * Covers behaviors from BEHAVIORS.md:
 * - F1: Plot renders
 * - F2: Hover data point
 * - F3: Plot settings
 * - F4: Change X axis
 * - F5: Change Y axis
 * - F6: Plot type
 * - F7: Color by column
 * - F8: Focus mode
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPlotTile, createMockPlotData } from '../fixtures/plotTileTestHarness';

// =============================================================================
// P2-F: Plot Tile
// =============================================================================

describe('P2-F: Plot Tile', () => {
  
  // =========================================================================
  // F1: Plot renders
  // =========================================================================
  describe('F1: Plot renders', () => {
    it('renders plot container', async () => {
      renderPlotTile();

      await waitFor(() => {
        expect(screen.getByTestId('plot-tile-container')).toBeInTheDocument();
      });
    });

    it('renders SVG canvas with data points', async () => {
      renderPlotTile();

      await waitFor(() => {
        expect(screen.getByTestId('plot-svg')).toBeInTheDocument();
      });

      // Default is scatter plot with data points
      expect(screen.getByTestId('data-point-0')).toBeInTheDocument();
    });

    it('renders axis labels', async () => {
      renderPlotTile({ initialXAxis: 'timestamp', initialYAxis: 'score' });

      await waitFor(() => {
        expect(screen.getByTestId('x-axis-label')).toHaveTextContent('timestamp');
        expect(screen.getByTestId('y-axis-label')).toHaveTextContent('score');
      });
    });

    it('renders with custom data', async () => {
      const customData = createMockPlotData(5);
      renderPlotTile({ initialData: customData });

      await waitFor(() => {
        expect(screen.getByTestId('plot-svg')).toBeInTheDocument();
      });

      // Should have 5 data points
      expect(screen.getByTestId('data-point-0')).toBeInTheDocument();
      expect(screen.getByTestId('data-point-4')).toBeInTheDocument();
      expect(screen.queryByTestId('data-point-5')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // F2: Hover data point
  // =========================================================================
  describe('F2: Hover data point', () => {
    it('shows tooltip on hover', async () => {
      const user = userEvent.setup();
      renderPlotTile();

      await waitFor(() => {
        expect(screen.getByTestId('plot-svg')).toBeInTheDocument();
      });

      // Initially no tooltip
      expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();

      // Hover over a data point
      await user.hover(screen.getByTestId('data-point-0'));

      await waitFor(() => {
        expect(screen.getByTestId('tooltip')).toBeInTheDocument();
      });
    });

    it('tooltip shows point data', async () => {
      const user = userEvent.setup();
      renderPlotTile();

      await waitFor(() => {
        expect(screen.getByTestId('plot-svg')).toBeInTheDocument();
      });

      await user.hover(screen.getByTestId('data-point-0'));

      await waitFor(() => {
        const tooltip = screen.getByTestId('tooltip');
        expect(tooltip).toHaveTextContent('Point 1');
      });
    });

    it('hides tooltip on mouse leave', async () => {
      const user = userEvent.setup();
      renderPlotTile();

      await waitFor(() => {
        expect(screen.getByTestId('plot-svg')).toBeInTheDocument();
      });

      await user.hover(screen.getByTestId('data-point-0'));

      await waitFor(() => {
        expect(screen.getByTestId('tooltip')).toBeInTheDocument();
      });

      await user.unhover(screen.getByTestId('data-point-0'));

      await waitFor(() => {
        expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // F3: Plot settings
  // =========================================================================
  describe('F3: Plot settings', () => {
    it('clicking settings button opens settings panel', async () => {
      const user = userEvent.setup();
      const onSettingsToggle = vi.fn();
      const { isSettingsOpen } = renderPlotTile({
        callbacks: { onSettingsToggle },
      });

      await waitFor(() => {
        expect(screen.getByTestId('plot-tile-container')).toBeInTheDocument();
      });

      expect(isSettingsOpen()).toBe(false);
      expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('settings-button'));

      await waitFor(() => {
        expect(isSettingsOpen()).toBe(true);
        expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
      });

      expect(onSettingsToggle).toHaveBeenCalledWith(true);
    });

    it('settings panel shows axis and type options', async () => {
      renderPlotTile({ initialSettingsOpen: true });

      await waitFor(() => {
        expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
      });

      expect(screen.getByTestId('x-axis-select')).toBeInTheDocument();
      expect(screen.getByTestId('y-axis-select')).toBeInTheDocument();
      expect(screen.getByTestId('plot-type-select')).toBeInTheDocument();
      expect(screen.getByTestId('color-by-select')).toBeInTheDocument();
    });

    it('clicking settings button again closes panel', async () => {
      const user = userEvent.setup();
      const { isSettingsOpen } = renderPlotTile({ initialSettingsOpen: true });

      await waitFor(() => {
        expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('settings-button'));

      await waitFor(() => {
        expect(isSettingsOpen()).toBe(false);
        expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // F4: Change X axis
  // =========================================================================
  describe('F4: Change X axis', () => {
    it('changing X axis updates the plot', async () => {
      const user = userEvent.setup();
      const onXAxisChange = vi.fn();
      const { getXAxis } = renderPlotTile({
        initialSettingsOpen: true,
        callbacks: { onXAxisChange },
      });

      await waitFor(() => {
        expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
      });

      expect(getXAxis()).toBe('x');

      await user.selectOptions(screen.getByTestId('x-axis-select'), 'timestamp');

      await waitFor(() => {
        expect(getXAxis()).toBe('timestamp');
      });

      expect(onXAxisChange).toHaveBeenCalledWith('timestamp');
      expect(screen.getByTestId('x-axis-label')).toHaveTextContent('timestamp');
    });

    it('X axis dropdown shows all columns', async () => {
      renderPlotTile({
        initialSettingsOpen: true,
        columns: ['x', 'y', 'score', 'timestamp'],
      });

      await waitFor(() => {
        expect(screen.getByTestId('x-axis-select')).toBeInTheDocument();
      });

      const select = screen.getByTestId('x-axis-select');
      expect(select).toContainHTML('x');
      expect(select).toContainHTML('y');
      expect(select).toContainHTML('score');
      expect(select).toContainHTML('timestamp');
    });
  });

  // =========================================================================
  // F5: Change Y axis
  // =========================================================================
  describe('F5: Change Y axis', () => {
    it('changing Y axis updates the plot', async () => {
      const user = userEvent.setup();
      const onYAxisChange = vi.fn();
      const { getYAxis } = renderPlotTile({
        initialSettingsOpen: true,
        callbacks: { onYAxisChange },
      });

      await waitFor(() => {
        expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
      });

      expect(getYAxis()).toBe('y');

      await user.selectOptions(screen.getByTestId('y-axis-select'), 'score');

      await waitFor(() => {
        expect(getYAxis()).toBe('score');
      });

      expect(onYAxisChange).toHaveBeenCalledWith('score');
      expect(screen.getByTestId('y-axis-label')).toHaveTextContent('score');
    });
  });

  // =========================================================================
  // F6: Plot type
  // =========================================================================
  describe('F6: Plot type', () => {
    it('changing plot type updates visualization', async () => {
      const user = userEvent.setup();
      const onPlotTypeChange = vi.fn();
      const { getPlotType } = renderPlotTile({
        initialSettingsOpen: true,
        callbacks: { onPlotTypeChange },
      });

      await waitFor(() => {
        expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
      });

      expect(getPlotType()).toBe('scatter');
      expect(screen.getByTestId('plot-canvas')).toHaveAttribute('data-plot-type', 'scatter');

      await user.selectOptions(screen.getByTestId('plot-type-select'), 'line');

      await waitFor(() => {
        expect(getPlotType()).toBe('line');
      });

      expect(onPlotTypeChange).toHaveBeenCalledWith('line');
      expect(screen.getByTestId('plot-canvas')).toHaveAttribute('data-plot-type', 'line');
    });

    it('line plot shows line path', async () => {
      renderPlotTile({ initialPlotType: 'line' });

      await waitFor(() => {
        expect(screen.getByTestId('plot-svg')).toBeInTheDocument();
      });

      expect(screen.getByTestId('line-path')).toBeInTheDocument();
    });

    it('bar plot shows bars', async () => {
      renderPlotTile({ initialPlotType: 'bar' });

      await waitFor(() => {
        expect(screen.getByTestId('plot-svg')).toBeInTheDocument();
      });

      expect(screen.getByTestId('bar-0')).toBeInTheDocument();
    });

    it('supports all plot types', async () => {
      const user = userEvent.setup();
      const { getPlotType } = renderPlotTile({ initialSettingsOpen: true });

      await waitFor(() => {
        expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
      });

      const plotTypes = ['scatter', 'line', 'bar'] as const;

      for (const type of plotTypes) {
        await user.selectOptions(screen.getByTestId('plot-type-select'), type);
        await waitFor(() => {
          expect(getPlotType()).toBe(type);
        });
      }
    });
  });

  // =========================================================================
  // F7: Color by column
  // =========================================================================
  describe('F7: Color by column', () => {
    it('selecting color by column shows legend', async () => {
      const user = userEvent.setup();
      const onColorByChange = vi.fn();
      const { getColorBy } = renderPlotTile({
        initialSettingsOpen: true,
        callbacks: { onColorByChange },
      });

      await waitFor(() => {
        expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
      });

      expect(getColorBy()).toBeNull();
      expect(screen.queryByTestId('legend')).not.toBeInTheDocument();

      await user.selectOptions(screen.getByTestId('color-by-select'), 'category');

      await waitFor(() => {
        expect(getColorBy()).toBe('category');
        expect(screen.getByTestId('legend')).toBeInTheDocument();
      });

      expect(onColorByChange).toHaveBeenCalledWith('category');
    });

    it('legend shows category values', async () => {
      renderPlotTile({ initialColorBy: 'category' });

      await waitFor(() => {
        expect(screen.getByTestId('legend')).toBeInTheDocument();
      });

      const legend = screen.getByTestId('legend');
      expect(legend).toHaveTextContent('category');
      expect(legend).toHaveTextContent('A');
      expect(legend).toHaveTextContent('B');
      expect(legend).toHaveTextContent('C');
    });

    it('clearing color by removes legend', async () => {
      const user = userEvent.setup();
      const { getColorBy } = renderPlotTile({
        initialSettingsOpen: true,
        initialColorBy: 'category',
      });

      await waitFor(() => {
        expect(screen.getByTestId('legend')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByTestId('color-by-select'), '');

      await waitFor(() => {
        expect(getColorBy()).toBeNull();
        expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // F8: Focus mode
  // =========================================================================
  describe('F8: Focus mode', () => {
    it('clicking expand button enables focus mode', async () => {
      const user = userEvent.setup();
      const onFocusModeToggle = vi.fn();
      const { isFocusMode } = renderPlotTile({
        callbacks: { onFocusModeToggle },
      });

      await waitFor(() => {
        expect(screen.getByTestId('plot-tile-container')).toBeInTheDocument();
      });

      expect(isFocusMode()).toBe(false);

      await user.click(screen.getByTestId('focus-mode-button'));

      await waitFor(() => {
        expect(isFocusMode()).toBe(true);
      });

      expect(onFocusModeToggle).toHaveBeenCalledWith(true);
    });

    it('focus mode shows overlay', async () => {
      renderPlotTile({ initialFocusMode: true });

      await waitFor(() => {
        expect(screen.getByTestId('focus-overlay')).toBeInTheDocument();
      });
    });

    it('clicking button in focus mode exits focus mode', async () => {
      const user = userEvent.setup();
      const { isFocusMode } = renderPlotTile({ initialFocusMode: true });

      await waitFor(() => {
        expect(screen.getByTestId('focus-overlay')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('focus-mode-button'));

      await waitFor(() => {
        expect(isFocusMode()).toBe(false);
        expect(screen.queryByTestId('focus-overlay')).not.toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================
  describe('Edge cases', () => {
    it('respects initial settings state', async () => {
      const { isSettingsOpen } = renderPlotTile({ initialSettingsOpen: true });

      await waitFor(() => {
        expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
      });

      expect(isSettingsOpen()).toBe(true);
    });

    it('respects initial axis values', async () => {
      const { getXAxis, getYAxis } = renderPlotTile({
        initialXAxis: 'timestamp',
        initialYAxis: 'score',
      });

      await waitFor(() => {
        expect(screen.getByTestId('plot-tile-container')).toBeInTheDocument();
      });

      expect(getXAxis()).toBe('timestamp');
      expect(getYAxis()).toBe('score');
    });

    it('respects initial plot type', async () => {
      const { getPlotType } = renderPlotTile({ initialPlotType: 'bar' });

      await waitFor(() => {
        expect(screen.getByTestId('plot-tile-container')).toBeInTheDocument();
      });

      expect(getPlotType()).toBe('bar');
    });
  });

  // =========================================================================
  // Error Handling
  // =========================================================================
  describe('Error handling', () => {
    it('handles empty data gracefully', async () => {
      renderPlotTile({ initialData: [] });

      await waitFor(() => {
        expect(screen.getByTestId('plot-tile-container')).toBeInTheDocument();
      });

      // Should render without crashing
      expect(screen.getByTestId('plot-canvas')).toBeInTheDocument();
    });

    it('handles missing columns gracefully', async () => {
      const { setXAxis, getXAxis } = renderPlotTile({
        columns: ['x', 'y'], // Limited columns
      });

      await waitFor(() => {
        expect(screen.getByTestId('plot-tile-container')).toBeInTheDocument();
      });

      // Try to set an axis that doesn't exist in columns
      // The harness should handle this gracefully
      setXAxis('nonexistent');
      
      // Should either keep old value or update (depending on implementation)
      // But shouldn't crash
      expect(screen.getByTestId('plot-tile-container')).toBeInTheDocument();
    });

    it('handles rapid axis changes', async () => {
      const user = userEvent.setup();
      const { getXAxis } = renderPlotTile({ initialSettingsOpen: true });

      await waitFor(() => {
        expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
      });

      // Rapidly change x-axis
      const xAxisSelect = screen.getByTestId('x-axis-select');
      await user.selectOptions(xAxisSelect, 'y');
      await user.selectOptions(xAxisSelect, 'score');
      await user.selectOptions(xAxisSelect, 'timestamp');

      await waitFor(() => {
        expect(getXAxis()).toBe('timestamp');
      });
    });

    it('handles rapid plot type changes', async () => {
      const user = userEvent.setup();
      const { getPlotType } = renderPlotTile({ initialSettingsOpen: true });

      await waitFor(() => {
        expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
      });

      // Rapidly change plot type
      const plotTypeSelect = screen.getByTestId('plot-type-select');
      await user.selectOptions(plotTypeSelect, 'bar');
      await user.selectOptions(plotTypeSelect, 'line');
      await user.selectOptions(plotTypeSelect, 'scatter');

      await waitFor(() => {
        expect(getPlotType()).toBe('scatter');
      });
    });

    it('handles settings toggle during focus mode', async () => {
      const user = userEvent.setup();
      const { isSettingsOpen, isFocusMode } = renderPlotTile({
        initialFocusMode: true,
      });

      await waitFor(() => {
        expect(screen.getByTestId('focus-overlay')).toBeInTheDocument();
      });

      // Try to toggle settings while in focus mode
      await user.click(screen.getByTestId('settings-button'));

      // Should handle gracefully (may or may not show settings depending on design)
      expect(isFocusMode()).toBe(true);
    });

    it('handles null colorBy value', async () => {
      const { getColorBy, setColorBy } = renderPlotTile({
        initialColorBy: 'category',
      });

      await waitFor(() => {
        expect(screen.getByTestId('plot-tile-container')).toBeInTheDocument();
      });

      // Set colorBy to null (disable grouping)
      setColorBy(null);

      await waitFor(() => {
        expect(getColorBy()).toBeNull();
      });

      // Should render without crashing
      expect(screen.getByTestId('plot-canvas')).toBeInTheDocument();
    });
  });
});


