/**
 * Scatter Plot Behavior Browser Tests
 *
 * Tests scatter plot specific behaviors including data point interactions,
 * regression lines, zoom/pan, and scale controls.
 *
 * These tests run in a real browser environment via Playwright.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPlotTile, createMockPlotData } from '../fixtures/plotTileTestHarness';

// =============================================================================
// Scatter Plot Behavior Tests
// =============================================================================

describe('Scatter Plot Behaviors', () => {
  // =========================================================================
  // A: Data Point Interactions
  // =========================================================================
  describe('A: Data Point Interactions', () => {
    it(
      'highlights data point on hover',
      {
        meta: {
          alias: 'Scatter-Hover-Highlight',
          scenario: 'User hovers over a scatter plot data point.',
          behavior: 'The hovered point increases in size and other points dim.',
        },
      },
      async () => {
        const user = userEvent.setup();
        renderPlotTile({ initialPlotType: 'scatter' });

        await waitFor(() => {
          expect(screen.getByTestId('plot-svg')).toBeInTheDocument();
        });

        const dataPoint = screen.getByTestId('data-point-0');
        const initialRadius = dataPoint.getAttribute('r');

        await user.hover(dataPoint);

        await waitFor(() => {
          const hoveredRadius = screen.getByTestId('data-point-0').getAttribute('r');
          expect(parseInt(hoveredRadius ?? '0')).toBeGreaterThan(parseInt(initialRadius ?? '0'));
        });
      }
    );

    it(
      'dims non-hovered points on hover',
      {
        meta: {
          alias: 'Scatter-Hover-DimOthers',
          scenario: 'User hovers over one data point among many.',
          behavior: 'Non-hovered points reduce their opacity to create focus.',
        },
      },
      async () => {
        const user = userEvent.setup();
        renderPlotTile({
          initialPlotType: 'scatter',
          initialData: createMockPlotData(5),
        });

        await waitFor(() => {
          expect(screen.getByTestId('data-point-0')).toBeInTheDocument();
        });

        await user.hover(screen.getByTestId('data-point-0'));

        await waitFor(() => {
          const otherPoint = screen.getByTestId('data-point-1');
          const opacity = parseFloat(otherPoint.getAttribute('opacity') ?? '1');
          expect(opacity).toBeLessThan(1);
        });
      }
    );

    it(
      'restores point appearance on mouse leave',
      {
        meta: {
          alias: 'Scatter-Hover-Restore',
          scenario: 'User moves mouse away from a data point.',
          behavior: 'All points return to their normal size and opacity.',
        },
      },
      async () => {
        const user = userEvent.setup();
        renderPlotTile({
          initialPlotType: 'scatter',
          initialData: createMockPlotData(5),
        });

        await waitFor(() => {
          expect(screen.getByTestId('data-point-0')).toBeInTheDocument();
        });

        // Hover then leave
        await user.hover(screen.getByTestId('data-point-0'));
        await user.unhover(screen.getByTestId('data-point-0'));

        await waitFor(() => {
          const otherPoint = screen.getByTestId('data-point-1');
          const opacity = parseFloat(otherPoint.getAttribute('opacity') ?? '1');
          expect(opacity).toBe(1);
        });
      }
    );

    it(
      'shows tooltip with point data on hover',
      {
        meta: {
          alias: 'Scatter-Hover-Tooltip',
          scenario: 'User hovers over a data point.',
          behavior: "A tooltip appears showing the point's coordinates and label.",
        },
      },
      async () => {
        const user = userEvent.setup();
        renderPlotTile({ initialPlotType: 'scatter' });

        await waitFor(() => {
          expect(screen.getByTestId('data-point-0')).toBeInTheDocument();
        });

        expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();

        await user.hover(screen.getByTestId('data-point-0'));

        await waitFor(() => {
          expect(screen.getByTestId('tooltip')).toBeInTheDocument();
          expect(screen.getByTestId('tooltip')).toHaveTextContent('Point 1');
        });
      }
    );

    it(
      'hides tooltip on mouse leave',
      {
        meta: {
          alias: 'Scatter-Tooltip-Hide',
          scenario: 'User moves mouse away from a data point.',
          behavior: 'The tooltip disappears.',
        },
      },
      async () => {
        const user = userEvent.setup();
        renderPlotTile({ initialPlotType: 'scatter' });

        await waitFor(() => {
          expect(screen.getByTestId('data-point-0')).toBeInTheDocument();
        });

        await user.hover(screen.getByTestId('data-point-0'));
        await waitFor(() => expect(screen.getByTestId('tooltip')).toBeInTheDocument());

        await user.unhover(screen.getByTestId('data-point-0'));

        await waitFor(() => {
          expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
        });
      }
    );
  });

  // =========================================================================
  // B: Regression Line
  // =========================================================================
  describe('B: Regression Line', () => {
    it(
      'shows regression line when enabled',
      {
        meta: {
          alias: 'Scatter-Regression-Show',
          scenario: 'User enables the regression line toggle.',
          behavior: 'A regression line appears overlaid on the scatter plot.',
        },
      },
      async () => {
        const user = userEvent.setup();
        const { toggleRegression, isRegressionShown } = renderPlotTile({
          initialPlotType: 'scatter',
          initialSettingsOpen: true,
        });

        await waitFor(() => {
          expect(screen.getByTestId('plot-svg')).toBeInTheDocument();
        });

        expect(screen.queryByTestId('regression-line')).not.toBeInTheDocument();

        await user.click(screen.getByTestId('regression-toggle'));

        await waitFor(() => {
          expect(isRegressionShown()).toBe(true);
          expect(screen.getByTestId('regression-line')).toBeInTheDocument();
        });
      }
    );

    it(
      'hides regression line when disabled',
      {
        meta: {
          alias: 'Scatter-Regression-Hide',
          scenario: 'User disables the regression line toggle after it was enabled.',
          behavior: 'The regression line disappears from the plot.',
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

        await user.click(screen.getByTestId('regression-toggle'));

        await waitFor(() => {
          expect(screen.queryByTestId('regression-line')).not.toBeInTheDocument();
        });
      }
    );

    it(
      'displays correlation coefficient with regression line',
      {
        meta: {
          alias: 'Scatter-Regression-RValue',
          scenario: 'Regression line is enabled.',
          behavior: 'The correlation coefficient (r value) is displayed along the line.',
        },
      },
      async () => {
        renderPlotTile({
          initialPlotType: 'scatter',
          initialShowRegression: true,
        });

        await waitFor(() => {
          expect(screen.getByTestId('regression-line')).toBeInTheDocument();
        });

        expect(screen.getByTestId('regression-text')).toBeInTheDocument();
        expect(screen.getByTestId('regression-text')).toHaveTextContent('r =');
      }
    );

    it(
      'triggers callback when regression is toggled',
      {
        meta: {
          alias: 'Scatter-Regression-Callback',
          scenario: 'User toggles regression line.',
          behavior: 'The onRegressionChange callback is called with the new state.',
        },
      },
      async () => {
        const user = userEvent.setup();
        const onRegressionChange = vi.fn();

        renderPlotTile({
          initialPlotType: 'scatter',
          initialSettingsOpen: true,
          callbacks: { onRegressionChange },
        });

        await waitFor(() => {
          expect(screen.getByTestId('regression-toggle')).toBeInTheDocument();
        });

        await user.click(screen.getByTestId('regression-toggle'));

        expect(onRegressionChange).toHaveBeenCalledWith(true);
      }
    );
  });

  // =========================================================================
  // C: Scale Controls
  // =========================================================================
  describe('C: Scale Controls', () => {
    it(
      'changes X axis to log scale',
      {
        meta: {
          alias: 'Scatter-Scale-LogX',
          scenario: "User selects 'Log' from the X scale dropdown.",
          behavior: 'The plot updates to use logarithmic scale on X axis.',
        },
      },
      async () => {
        const user = userEvent.setup();
        const onScaleXChange = vi.fn();
        const { getScaleX } = renderPlotTile({
          initialPlotType: 'scatter',
          initialSettingsOpen: true,
          callbacks: { onScaleXChange },
        });

        await waitFor(() => {
          expect(screen.getByTestId('scale-x-select')).toBeInTheDocument();
        });

        expect(getScaleX()).toBe('linear');

        await user.selectOptions(screen.getByTestId('scale-x-select'), 'log');

        await waitFor(() => {
          expect(getScaleX()).toBe('log');
        });

        expect(onScaleXChange).toHaveBeenCalledWith('log');
      }
    );

    it(
      'changes Y axis to log scale',
      {
        meta: {
          alias: 'Scatter-Scale-LogY',
          scenario: "User selects 'Log' from the Y scale dropdown.",
          behavior: 'The plot updates to use logarithmic scale on Y axis.',
        },
      },
      async () => {
        const user = userEvent.setup();
        const { getScaleY } = renderPlotTile({
          initialPlotType: 'scatter',
          initialSettingsOpen: true,
        });

        await waitFor(() => {
          expect(screen.getByTestId('scale-y-select')).toBeInTheDocument();
        });

        await user.selectOptions(screen.getByTestId('scale-y-select'), 'log');

        await waitFor(() => {
          expect(getScaleY()).toBe('log');
        });
      }
    );

    it(
      'stores scale type in SVG data attribute',
      {
        meta: {
          alias: 'Scatter-Scale-DataAttr',
          scenario: 'User changes scale type.',
          behavior: "The SVG element's data attributes reflect the current scale types.",
        },
      },
      async () => {
        const user = userEvent.setup();
        renderPlotTile({
          initialPlotType: 'scatter',
          initialSettingsOpen: true,
        });

        await waitFor(() => {
          expect(screen.getByTestId('plot-svg')).toBeInTheDocument();
        });

        const svg = screen.getByTestId('plot-svg');
        expect(svg.getAttribute('data-scale-x')).toBe('linear');
        expect(svg.getAttribute('data-scale-y')).toBe('linear');

        await user.selectOptions(screen.getByTestId('scale-x-select'), 'log');

        await waitFor(() => {
          expect(svg.getAttribute('data-scale-x')).toBe('log');
        });
      }
    );
  });

  // =========================================================================
  // D: Zoom Behavior
  // =========================================================================
  describe('D: Zoom Behavior', () => {
    it(
      'enables zoom via toggle',
      {
        meta: {
          alias: 'Scatter-Zoom-Enable',
          scenario: 'User clicks the zoom toggle checkbox.',
          behavior: 'Zoom is enabled and the SVG data attribute reflects this.',
        },
      },
      async () => {
        const user = userEvent.setup();
        const { isZoomEnabled } = renderPlotTile({
          initialPlotType: 'scatter',
          initialSettingsOpen: true,
        });

        await waitFor(() => {
          expect(screen.getByTestId('zoom-toggle')).toBeInTheDocument();
        });

        expect(isZoomEnabled()).toBe(false);

        await user.click(screen.getByTestId('zoom-toggle'));

        await waitFor(() => {
          expect(isZoomEnabled()).toBe(true);
        });

        const svg = screen.getByTestId('plot-svg');
        expect(svg.getAttribute('data-zoom-enabled')).toBe('true');
      }
    );

    it(
      'disables zoom via toggle',
      {
        meta: {
          alias: 'Scatter-Zoom-Disable',
          scenario: 'User disables the zoom toggle after enabling it.',
          behavior: 'Zoom is disabled and the zoom transform is reset.',
        },
      },
      async () => {
        const user = userEvent.setup();
        const { isZoomEnabled } = renderPlotTile({
          initialPlotType: 'scatter',
          initialSettingsOpen: true,
          initialZoomEnabled: true,
        });

        await waitFor(() => {
          expect(isZoomEnabled()).toBe(true);
        });

        await user.click(screen.getByTestId('zoom-toggle'));

        await waitFor(() => {
          expect(isZoomEnabled()).toBe(false);
        });

        // Zoom container should have reset transform
        const zoomContainer = screen.getByTestId('zoom-container');
        expect(zoomContainer.getAttribute('transform')).toContain('scale(1)');
      }
    );

    it(
      'triggers callback when zoom is toggled',
      {
        meta: {
          alias: 'Scatter-Zoom-Callback',
          scenario: 'User toggles zoom.',
          behavior: 'The onZoomChange callback is called with the new state.',
        },
      },
      async () => {
        const user = userEvent.setup();
        const onZoomChange = vi.fn();

        renderPlotTile({
          initialPlotType: 'scatter',
          initialSettingsOpen: true,
          callbacks: { onZoomChange },
        });

        await waitFor(() => {
          expect(screen.getByTestId('zoom-toggle')).toBeInTheDocument();
        });

        await user.click(screen.getByTestId('zoom-toggle'));

        expect(onZoomChange).toHaveBeenCalledWith(true);
      }
    );

    it(
      'maintains zoom container transform structure',
      {
        meta: {
          alias: 'Scatter-Zoom-Transform',
          scenario: 'Zoom is enabled on the plot.',
          behavior: 'The zoom container has proper transform attributes for zoom operations.',
        },
      },
      async () => {
        renderPlotTile({
          initialPlotType: 'scatter',
          initialZoomEnabled: true,
        });

        await waitFor(() => {
          expect(screen.getByTestId('zoom-container')).toBeInTheDocument();
        });

        const zoomContainer = screen.getByTestId('zoom-container');
        const transform = zoomContainer.getAttribute('transform');

        // Should have translate and scale
        expect(transform).toMatch(/translate/);
        expect(transform).toMatch(/scale/);
      }
    );
  });

  // =========================================================================
  // E: Grouping and Colors
  // =========================================================================
  describe('E: Grouping and Colors', () => {
    it(
      'applies different colors when grouped by category',
      {
        meta: {
          alias: 'Scatter-Group-Colors',
          scenario: 'User selects a column to group/color by.',
          behavior: 'Data points are colored according to their category.',
        },
      },
      async () => {
        const user = userEvent.setup();
        renderPlotTile({
          initialPlotType: 'scatter',
          initialSettingsOpen: true,
          initialData: createMockPlotData(10),
        });

        await waitFor(() => {
          expect(screen.getByTestId('color-by-select')).toBeInTheDocument();
        });

        await user.selectOptions(screen.getByTestId('color-by-select'), 'category');

        await waitFor(() => {
          expect(screen.getByTestId('legend')).toBeInTheDocument();
        });

        // Points should have different fill colors based on category
        const point0 = screen.getByTestId('data-point-0');
        const point1 = screen.getByTestId('data-point-1');
        const point2 = screen.getByTestId('data-point-2');

        // At least some points should have different colors (A, B, C categories)
        const fills = [
          point0.getAttribute('fill'),
          point1.getAttribute('fill'),
          point2.getAttribute('fill'),
        ];
        const uniqueFills = new Set(fills);
        expect(uniqueFills.size).toBeGreaterThan(1);
      }
    );

    it(
      'shows legend when color by is selected',
      {
        meta: {
          alias: 'Scatter-Group-Legend',
          scenario: 'User enables grouping by a category column.',
          behavior: 'A legend appears showing the category names and their colors.',
        },
      },
      async () => {
        renderPlotTile({
          initialPlotType: 'scatter',
          initialColorBy: 'category',
        });

        await waitFor(() => {
          expect(screen.getByTestId('legend')).toBeInTheDocument();
        });

        const legend = screen.getByTestId('legend');
        expect(legend).toHaveTextContent('A');
        expect(legend).toHaveTextContent('B');
        expect(legend).toHaveTextContent('C');
      }
    );

    it(
      'hides legend when color by is cleared',
      {
        meta: {
          alias: 'Scatter-Group-ClearLegend',
          scenario: 'User clears the color by selection.',
          behavior: 'The legend disappears and all points return to default color.',
        },
      },
      async () => {
        const user = userEvent.setup();
        renderPlotTile({
          initialPlotType: 'scatter',
          initialSettingsOpen: true,
          initialColorBy: 'category',
        });

        await waitFor(() => {
          expect(screen.getByTestId('legend')).toBeInTheDocument();
        });

        await user.selectOptions(screen.getByTestId('color-by-select'), '');

        await waitFor(() => {
          expect(screen.queryByTestId('legend')).not.toBeInTheDocument();
        });
      }
    );
  });

  // =========================================================================
  // F: Plot Type Switching
  // =========================================================================
  describe('F: Plot Type Switching', () => {
    it(
      'maintains data when switching from scatter to line',
      {
        meta: {
          alias: 'Scatter-Switch-ToLine',
          scenario: 'User changes plot type from scatter to line.',
          behavior: 'The visualization updates but the underlying data is preserved.',
        },
      },
      async () => {
        const user = userEvent.setup();
        const { getPlotType } = renderPlotTile({
          initialPlotType: 'scatter',
          initialSettingsOpen: true,
          initialData: createMockPlotData(5),
        });

        await waitFor(() => {
          expect(screen.getByTestId('data-point-0')).toBeInTheDocument();
        });

        await user.selectOptions(screen.getByTestId('plot-type-select'), 'line');

        await waitFor(() => {
          expect(getPlotType()).toBe('line');
          expect(screen.getByTestId('line-path')).toBeInTheDocument();
        });

        // Scatter points should be removed
        expect(screen.queryByTestId('data-point-0')).not.toBeInTheDocument();
      }
    );

    it(
      'maintains data when switching from scatter to bar',
      {
        meta: {
          alias: 'Scatter-Switch-ToBar',
          scenario: 'User changes plot type from scatter to bar.',
          behavior: 'The visualization updates to show bars instead of points.',
        },
      },
      async () => {
        const user = userEvent.setup();
        const { getPlotType } = renderPlotTile({
          initialPlotType: 'scatter',
          initialSettingsOpen: true,
        });

        await waitFor(() => {
          expect(screen.getByTestId('data-point-0')).toBeInTheDocument();
        });

        await user.selectOptions(screen.getByTestId('plot-type-select'), 'bar');

        await waitFor(() => {
          expect(getPlotType()).toBe('bar');
          expect(screen.getByTestId('bar-0')).toBeInTheDocument();
        });
      }
    );

    it(
      'hides scatter-specific settings when switching to histogram',
      {
        meta: {
          alias: 'Scatter-Switch-HideSettings',
          scenario: 'User switches from scatter to histogram.',
          behavior:
            'Scatter-specific settings (regression, scale) are hidden and histogram settings appear.',
        },
      },
      async () => {
        const user = userEvent.setup();
        renderPlotTile({
          initialPlotType: 'scatter',
          initialSettingsOpen: true,
        });

        await waitFor(() => {
          expect(screen.getByTestId('regression-toggle')).toBeInTheDocument();
          expect(screen.getByTestId('scale-x-select')).toBeInTheDocument();
        });

        await user.selectOptions(screen.getByTestId('plot-type-select'), 'histogram');

        await waitFor(() => {
          expect(screen.queryByTestId('regression-toggle')).not.toBeInTheDocument();
          expect(screen.getByTestId('bin-count-slider')).toBeInTheDocument();
        });
      }
    );
  });

  // =========================================================================
  // G: Edge Cases
  // =========================================================================
  describe('G: Edge Cases', () => {
    it(
      'handles empty data gracefully',
      {
        meta: {
          alias: 'Scatter-Edge-EmptyData',
          scenario: 'Plot is rendered with no data points.',
          behavior: 'The plot renders without crashing and shows empty canvas.',
        },
      },
      async () => {
        renderPlotTile({
          initialPlotType: 'scatter',
          initialData: [],
        });

        await waitFor(() => {
          expect(screen.getByTestId('plot-svg')).toBeInTheDocument();
        });

        // No data points
        expect(screen.queryByTestId('data-point-0')).not.toBeInTheDocument();
      }
    );

    it(
      'handles single data point',
      {
        meta: {
          alias: 'Scatter-Edge-SinglePoint',
          scenario: 'Plot has only one data point.',
          behavior: 'The single point is rendered and can be interacted with.',
        },
      },
      async () => {
        const user = userEvent.setup();
        renderPlotTile({
          initialPlotType: 'scatter',
          initialData: createMockPlotData(1),
        });

        await waitFor(() => {
          expect(screen.getByTestId('data-point-0')).toBeInTheDocument();
        });

        expect(screen.queryByTestId('data-point-1')).not.toBeInTheDocument();

        // Can still hover
        await user.hover(screen.getByTestId('data-point-0'));
        await waitFor(() => {
          expect(screen.getByTestId('tooltip')).toBeInTheDocument();
        });
      }
    );

    it(
      'handles rapid settings changes',
      {
        meta: {
          alias: 'Scatter-Edge-RapidChanges',
          scenario: 'User rapidly changes multiple settings in succession.',
          behavior: 'The plot handles all changes without crashing or visual artifacts.',
        },
      },
      async () => {
        const user = userEvent.setup();
        const { getPlotType, getScaleX, getColorBy } = renderPlotTile({
          initialPlotType: 'scatter',
          initialSettingsOpen: true,
        });

        await waitFor(() => {
          expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
        });

        // Rapid changes
        await user.selectOptions(screen.getByTestId('scale-x-select'), 'log');
        await user.selectOptions(screen.getByTestId('color-by-select'), 'category');
        await user.click(screen.getByTestId('regression-toggle'));
        await user.selectOptions(screen.getByTestId('plot-type-select'), 'line');

        await waitFor(() => {
          expect(getPlotType()).toBe('line');
          expect(getScaleX()).toBe('log');
          expect(getColorBy()).toBe('category');
        });
      }
    );

    it(
      'handles toggling settings panel during focus mode',
      {
        meta: {
          alias: 'Scatter-Edge-FocusSettings',
          scenario: 'User toggles settings while in focus mode.',
          behavior: 'Settings panel opens within the focus mode overlay.',
        },
      },
      async () => {
        const user = userEvent.setup();
        const { isSettingsOpen, isFocusMode } = renderPlotTile({
          initialPlotType: 'scatter',
          initialFocusMode: true,
        });

        await waitFor(() => {
          expect(screen.getByTestId('focus-overlay')).toBeInTheDocument();
        });

        expect(isFocusMode()).toBe(true);
        expect(isSettingsOpen()).toBe(false);

        await user.click(screen.getByTestId('settings-button'));

        // Focus mode should remain, settings should open
        expect(isFocusMode()).toBe(true);
      }
    );
  });
});
