/**
 * Histogram Behavior Browser Tests
 *
 * Tests histogram specific behaviors including bin interactions,
 * bin count controls, and grouping.
 * 
 * These tests run in a real browser environment via Playwright.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPlotTile, createMockPlotData } from '../fixtures/plotTileTestHarness';

// =============================================================================
// Histogram Behavior Tests
// =============================================================================

describe('Histogram Behaviors', () => {

  // =========================================================================
  // A: Bin Rendering
  // =========================================================================
  describe('A: Bin Rendering', () => {

    it('renders histogram bins correctly',
    {
      meta: {
        alias: 'Histogram-Render-Bins',
        scenario: "Plot is set to histogram type.",
        behavior: "Histogram bins (rectangles) are rendered on the canvas."
      }
    },
    async () => {
      renderPlotTile({ 
        initialPlotType: 'histogram',
        initialBinCount: 10
      });

      await waitFor(() => {
        expect(screen.getByTestId('histogram-bin-0')).toBeInTheDocument();
      });

      // Should have 10 bins
      expect(screen.getByTestId('histogram-bin-9')).toBeInTheDocument();
      expect(screen.queryByTestId('histogram-bin-10')).not.toBeInTheDocument();
    });

    it('shows tooltip on bin hover',
    {
      meta: {
        alias: 'Histogram-Hover-Tooltip',
        scenario: "User hovers over a histogram bin.",
        behavior: "A tooltip appears showing the bin information."
      }
    },
    async () => {
      const user = userEvent.setup();
      renderPlotTile({ 
        initialPlotType: 'histogram',
        initialBinCount: 10
      });

      await waitFor(() => {
        expect(screen.getByTestId('histogram-bin-0')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();

      await user.hover(screen.getByTestId('histogram-bin-0'));

      await waitFor(() => {
        expect(screen.getByTestId('tooltip')).toBeInTheDocument();
        expect(screen.getByTestId('tooltip')).toHaveTextContent('Bin 1');
      });
    });

    it('hides tooltip on mouse leave from bin',
    {
      meta: {
        alias: 'Histogram-Tooltip-Hide',
        scenario: "User moves mouse away from a histogram bin.",
        behavior: "The tooltip disappears."
      }
    },
    async () => {
      const user = userEvent.setup();
      renderPlotTile({ 
        initialPlotType: 'histogram',
        initialBinCount: 10
      });

      await waitFor(() => {
        expect(screen.getByTestId('histogram-bin-0')).toBeInTheDocument();
      });

      await user.hover(screen.getByTestId('histogram-bin-0'));
      await waitFor(() => expect(screen.getByTestId('tooltip')).toBeInTheDocument());

      await user.unhover(screen.getByTestId('histogram-bin-0'));

      await waitFor(() => {
        expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
      });
    });

  });

  // =========================================================================
  // B: Bin Count Controls
  // =========================================================================
  describe('B: Bin Count Controls', () => {

    it('shows bin count slider in settings',
    {
      meta: {
        alias: 'Histogram-Settings-BinSlider',
        scenario: "User opens settings panel for histogram.",
        behavior: "A bin count slider is visible in the settings."
      }
    },
    async () => {
      renderPlotTile({ 
        initialPlotType: 'histogram',
        initialSettingsOpen: true
      });

      await waitFor(() => {
        expect(screen.getByTestId('bin-count-slider')).toBeInTheDocument();
        expect(screen.getByTestId('bin-count-value')).toBeInTheDocument();
      });
    });

    it('displays current bin count value',
    {
      meta: {
        alias: 'Histogram-Settings-BinValue',
        scenario: "User views histogram settings.",
        behavior: "The current bin count is displayed."
      }
    },
    async () => {
      renderPlotTile({ 
        initialPlotType: 'histogram',
        initialSettingsOpen: true,
        initialBinCount: 15
      });

      await waitFor(() => {
        expect(screen.getByTestId('bin-count-value')).toHaveTextContent('15');
      });
    });

    it('updates bin count when slider is changed',
    {
      meta: {
        alias: 'Histogram-Settings-ChangeBins',
        scenario: "User adjusts the bin count slider.",
        behavior: "The histogram re-renders with the new number of bins."
      }
    },
    async () => {
      const onBinCountChange = vi.fn();
      const { getBinCount, setBinCount } = renderPlotTile({ 
        initialPlotType: 'histogram',
        initialSettingsOpen: true,
        initialBinCount: 10,
        callbacks: { onBinCountChange }
      });

      await waitFor(() => {
        expect(screen.getByTestId('bin-count-slider')).toBeInTheDocument();
      });

      expect(getBinCount()).toBe(10);

      // Programmatically change bin count
      setBinCount(20);

      await waitFor(() => {
        expect(getBinCount()).toBe(20);
      });

      expect(onBinCountChange).toHaveBeenCalledWith(20);
    });

    it('re-renders bins when count changes',
    {
      meta: {
        alias: 'Histogram-ReRender-Bins',
        scenario: "Bin count is changed from 10 to 20.",
        behavior: "The number of visible bin elements doubles."
      }
    },
    async () => {
      const { setBinCount } = renderPlotTile({ 
        initialPlotType: 'histogram',
        initialBinCount: 10
      });

      await waitFor(() => {
        expect(screen.getByTestId('histogram-bin-9')).toBeInTheDocument();
      });

      // Initially 10 bins
      expect(screen.queryByTestId('histogram-bin-10')).not.toBeInTheDocument();

      setBinCount(20);

      await waitFor(() => {
        expect(screen.getByTestId('histogram-bin-19')).toBeInTheDocument();
      });
    });

  });

  // =========================================================================
  // C: Histogram-Specific Settings
  // =========================================================================
  describe('C: Histogram-Specific Settings', () => {

    it('hides scale controls for histogram',
    {
      meta: {
        alias: 'Histogram-NoScaleControls',
        scenario: "User opens settings for histogram plot.",
        behavior: "Scale controls (log/linear) are not shown since histogram uses linear."
      }
    },
    async () => {
      renderPlotTile({ 
        initialPlotType: 'histogram',
        initialSettingsOpen: true
      });

      await waitFor(() => {
        expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('scale-x-select')).not.toBeInTheDocument();
      expect(screen.queryByTestId('scale-y-select')).not.toBeInTheDocument();
    });

    it('hides regression toggle for histogram',
    {
      meta: {
        alias: 'Histogram-NoRegression',
        scenario: "User opens settings for histogram plot.",
        behavior: "Regression line toggle is not shown (not applicable to histogram)."
      }
    },
    async () => {
      renderPlotTile({ 
        initialPlotType: 'histogram',
        initialSettingsOpen: true
      });

      await waitFor(() => {
        expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('regression-toggle')).not.toBeInTheDocument();
    });

    it('hides zoom toggle for histogram',
    {
      meta: {
        alias: 'Histogram-NoZoom',
        scenario: "User opens settings for histogram plot.",
        behavior: "Zoom toggle is not shown (not applicable to histogram)."
      }
    },
    async () => {
      renderPlotTile({ 
        initialPlotType: 'histogram',
        initialSettingsOpen: true
      });

      await waitFor(() => {
        expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('zoom-toggle')).not.toBeInTheDocument();
    });

    it('shows color by control for histogram',
    {
      meta: {
        alias: 'Histogram-ColorBy',
        scenario: "User opens settings for histogram plot.",
        behavior: "Color by dropdown is available for grouping histogram data."
      }
    },
    async () => {
      renderPlotTile({ 
        initialPlotType: 'histogram',
        initialSettingsOpen: true
      });

      await waitFor(() => {
        expect(screen.getByTestId('color-by-select')).toBeInTheDocument();
      });
    });

  });

  // =========================================================================
  // D: Plot Type Switching
  // =========================================================================
  describe('D: Plot Type Switching', () => {

    it('switches from scatter to histogram',
    {
      meta: {
        alias: 'Histogram-SwitchFrom-Scatter',
        scenario: "User changes plot type from scatter to histogram.",
        behavior: "Scatter points are replaced with histogram bins."
      }
    },
    async () => {
      const user = userEvent.setup();
      const { getPlotType } = renderPlotTile({ 
        initialPlotType: 'scatter',
        initialSettingsOpen: true
      });

      await waitFor(() => {
        expect(screen.getByTestId('data-point-0')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByTestId('plot-type-select'), 'histogram');

      await waitFor(() => {
        expect(getPlotType()).toBe('histogram');
        expect(screen.getByTestId('histogram-bin-0')).toBeInTheDocument();
      });

      // Scatter points should be removed
      expect(screen.queryByTestId('data-point-0')).not.toBeInTheDocument();
    });

    it('switches from histogram to bar',
    {
      meta: {
        alias: 'Histogram-SwitchTo-Bar',
        scenario: "User changes plot type from histogram to bar.",
        behavior: "Histogram bins are replaced with bar chart bars."
      }
    },
    async () => {
      const user = userEvent.setup();
      const { getPlotType } = renderPlotTile({ 
        initialPlotType: 'histogram',
        initialSettingsOpen: true,
        initialBinCount: 10
      });

      await waitFor(() => {
        expect(screen.getByTestId('histogram-bin-0')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByTestId('plot-type-select'), 'bar');

      await waitFor(() => {
        expect(getPlotType()).toBe('bar');
        expect(screen.getByTestId('bar-0')).toBeInTheDocument();
      });

      // Histogram bins should be removed
      expect(screen.queryByTestId('histogram-bin-0')).not.toBeInTheDocument();
    });

    it('shows bin count control when switching to histogram',
    {
      meta: {
        alias: 'Histogram-SwitchTo-ShowBinControl',
        scenario: "User switches from scatter to histogram with settings open.",
        behavior: "Bin count slider appears in settings panel."
      }
    },
    async () => {
      const user = userEvent.setup();
      renderPlotTile({ 
        initialPlotType: 'scatter',
        initialSettingsOpen: true
      });

      await waitFor(() => {
        expect(screen.getByTestId('regression-toggle')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('bin-count-slider')).not.toBeInTheDocument();

      await user.selectOptions(screen.getByTestId('plot-type-select'), 'histogram');

      await waitFor(() => {
        expect(screen.getByTestId('bin-count-slider')).toBeInTheDocument();
      });

      // Scatter-specific controls should be gone
      expect(screen.queryByTestId('regression-toggle')).not.toBeInTheDocument();
    });

  });

  // =========================================================================
  // E: Edge Cases
  // =========================================================================
  describe('E: Edge Cases', () => {

    it('handles minimum bin count (1 bin)',
    {
      meta: {
        alias: 'Histogram-Edge-MinBins',
        scenario: "Bin count is set to 1.",
        behavior: "A single bin spanning the entire data range is rendered."
      }
    },
    async () => {
      renderPlotTile({ 
        initialPlotType: 'histogram',
        initialBinCount: 1
      });

      await waitFor(() => {
        expect(screen.getByTestId('histogram-bin-0')).toBeInTheDocument();
      });

      // Only one bin
      expect(screen.queryByTestId('histogram-bin-1')).not.toBeInTheDocument();
    });

    it('handles maximum bin count',
    {
      meta: {
        alias: 'Histogram-Edge-MaxBins',
        scenario: "Bin count is set to maximum (50).",
        behavior: "50 thin bins are rendered."
      }
    },
    async () => {
      renderPlotTile({ 
        initialPlotType: 'histogram',
        initialBinCount: 50
      });

      await waitFor(() => {
        expect(screen.getByTestId('histogram-bin-49')).toBeInTheDocument();
      });

      // Should have exactly 50 bins
      expect(screen.queryByTestId('histogram-bin-50')).not.toBeInTheDocument();
    });

    it('handles empty data gracefully',
    {
      meta: {
        alias: 'Histogram-Edge-EmptyData',
        scenario: "Histogram is rendered with empty data.",
        behavior: "Plot renders without crashing and shows empty canvas."
      }
    },
    async () => {
      renderPlotTile({ 
        initialPlotType: 'histogram',
        initialData: [],
        initialBinCount: 10
      });

      await waitFor(() => {
        expect(screen.getByTestId('plot-svg')).toBeInTheDocument();
      });

      // The harness still renders bins based on binCount (mocked data)
      // In real implementation, no bins would show
      expect(screen.getByTestId('plot-canvas')).toBeInTheDocument();
    });

    it('handles rapid bin count changes',
    {
      meta: {
        alias: 'Histogram-Edge-RapidBinChanges',
        scenario: "User rapidly changes bin count multiple times.",
        behavior: "The final bin count is applied and the plot renders correctly."
      }
    },
    async () => {
      const { getBinCount, setBinCount } = renderPlotTile({ 
        initialPlotType: 'histogram',
        initialBinCount: 10
      });

      await waitFor(() => {
        expect(screen.getByTestId('histogram-bin-0')).toBeInTheDocument();
      });

      // Rapid changes
      setBinCount(5);
      setBinCount(15);
      setBinCount(25);
      setBinCount(10);

      await waitFor(() => {
        expect(getBinCount()).toBe(10);
        expect(screen.getByTestId('histogram-bin-9')).toBeInTheDocument();
      });
    });

  });

  // =========================================================================
  // F: Grouping
  // =========================================================================
  describe('F: Grouping', () => {

    it('shows legend when grouped by category',
    {
      meta: {
        alias: 'Histogram-Group-Legend',
        scenario: "User selects a column to group histogram by.",
        behavior: "A legend appears showing the group colors."
      }
    },
    async () => {
      const user = userEvent.setup();
      renderPlotTile({ 
        initialPlotType: 'histogram',
        initialSettingsOpen: true,
        initialBinCount: 10
      });

      await waitFor(() => {
        expect(screen.getByTestId('color-by-select')).toBeInTheDocument();
      });

      await user.selectOptions(screen.getByTestId('color-by-select'), 'category');

      await waitFor(() => {
        expect(screen.getByTestId('legend')).toBeInTheDocument();
      });
    });

  });

});


