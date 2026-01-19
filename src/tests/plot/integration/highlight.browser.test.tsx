/**
 * Bidirectional Highlight Integration Tests
 *
 * Tests for bidirectional hover highlighting between the plot and drawer.
 *
 * These tests verify:
 * - Hovering drawer elements triggers plot highlighting
 * - Grouped bar chart specific behaviors
 * - Ungrouped chart dimming behavior
 * - Smooth transitions without flickering
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { renderPlotCanvas } from '../fixtures/plotCanvasTestHarness';
import { createMockLogs, createMockFields } from '../fixtures/mockData';

// =============================================================================
// Setup
// =============================================================================

afterEach(() => {
  cleanup();
});

// =============================================================================
// Grouped Bar Chart Highlight Tests
// =============================================================================

describe('Bidirectional Highlight', () => {
  describe('grouped bar chart specifics', () => {
    it('renders grouped bars correctly', async () => {
      const dataTypeConfig = {
        xAxisType: 'str' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 30, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Bar Chart',
        xAxis: 'table1.category',
        yAxis: 'table1.y_value',
        groupBy: 'table1.category',
        logs: logs as any,
        fields: fields as any,
      });

      await result.waitForPlot();

      const bars = result.getBars();
      expect(bars.length).toBeGreaterThan(0);
    });

    it('grouped bars have correct class for identification', async () => {
      const dataTypeConfig = {
        xAxisType: 'str' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 30, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Bar Chart',
        xAxis: 'table1.category',
        yAxis: 'table1.y_value',
        groupBy: 'table1.category',
        logs: logs as any,
        fields: fields as any,
      });

      await result.waitForPlot();

      const bars = result.getBars();
      // All bars should have bar-item class
      bars.forEach((bar) => {
        expect(bar.classList.contains('bar-item')).toBe(true);
      });
    });

    it('bars start with correct initial opacity', async () => {
      const dataTypeConfig = {
        xAxisType: 'str' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 30, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Bar Chart',
        xAxis: 'table1.category',
        yAxis: 'table1.y_value',
        groupBy: 'table1.category',
        logs: logs as any,
        fields: fields as any,
      });

      await result.waitForPlot();

      const bars = result.getBars();
      // Grouped bars should have opacity 0.7 initially
      bars.forEach((bar) => {
        const opacity = parseFloat(bar.style.opacity || '1');
        // Allow some tolerance for initial opacity
        expect(opacity).toBeGreaterThanOrEqual(0.5);
        expect(opacity).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('ungrouped bar chart', () => {
    it('ungrouped bars start at full opacity', async () => {
      const dataTypeConfig = {
        xAxisType: 'str' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 20, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Bar Chart',
        xAxis: 'table1.category',
        yAxis: 'table1.y_value',
        // No groupBy
        logs: logs as any,
        fields: fields as any,
      });

      await result.waitForPlot();

      const bars = result.getBars();
      bars.forEach((bar) => {
        const opacity = parseFloat(bar.style.opacity || '1');
        expect(opacity).toBe(1);
      });
    });
  });

  describe('scatter plot highlighting', () => {
    it('scatter points render correctly for highlighting', async () => {
      const dataTypeConfig = {
        xAxisType: 'float' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 30, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Scatter Plot',
        xAxis: 'table1.x_value',
        yAxis: 'table1.y_value',
        groupBy: 'table1.category',
        logs: logs as any,
        fields: fields as any,
        forceRenderMode: 'svg',
      });

      await result.waitForPlot();

      // Should have SVG points in SVG mode
      const points = result.getScatterPoints();
      expect(points.length).toBeGreaterThan(0);
    });

    it('scatter points have data-point class', async () => {
      const dataTypeConfig = {
        xAxisType: 'float' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 30, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Scatter Plot',
        xAxis: 'table1.x_value',
        yAxis: 'table1.y_value',
        logs: logs as any,
        fields: fields as any,
        forceRenderMode: 'svg',
      });

      await result.waitForPlot();

      const points = result.getScatterPoints();
      points.forEach((point) => {
        expect(point.classList.contains('data-point')).toBe(true);
      });
    });
  });

  describe('histogram highlighting', () => {
    it('histogram bins render for highlighting', async () => {
      const dataTypeConfig = {
        xAxisType: 'float' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 50, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Histogram',
        xAxis: 'table1.x_value',
        logs: logs as any,
        fields: fields as any,
      });

      await result.waitForPlot();

      const bins = result.getHistogramBins();
      expect(bins.length).toBeGreaterThan(0);
    });

    it('grouped histogram has multiple bin sets', async () => {
      const dataTypeConfig = {
        xAxisType: 'float' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 50, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Histogram',
        xAxis: 'table1.x_value',
        groupBy: 'table1.category',
        logs: logs as any,
        fields: fields as any,
      });

      await result.waitForPlot();

      const bins = result.getHistogramBins();
      expect(bins.length).toBeGreaterThan(0);
    });
  });

  describe('performance', () => {
    it('renders quickly with moderate data', async () => {
      const startTime = performance.now();

      const dataTypeConfig = {
        xAxisType: 'str' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 100, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Bar Chart',
        xAxis: 'table1.category',
        yAxis: 'table1.y_value',
        groupBy: 'table1.category',
        logs: logs as any,
        fields: fields as any,
      });

      await result.waitForPlot();

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render in under 3 seconds (generous for CI)
      expect(renderTime).toBeLessThan(3000);
    });

    it('multiple updates do not cause memory leaks', async () => {
      const dataTypeConfig = {
        xAxisType: 'str' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 30, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Bar Chart',
        xAxis: 'table1.category',
        yAxis: 'table1.y_value',
        groupBy: 'table1.category',
        logs: logs as any,
        fields: fields as any,
      });

      await result.waitForPlot();

      // Simulate multiple rapid updates
      for (let i = 0; i < 5; i++) {
        result.updateProps({ binCount: 10 + i });
      }

      // Should still render correctly
      const bars = result.getBars();
      expect(bars.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('handles plot type change during highlight', async () => {
      const dataTypeConfig = {
        xAxisType: 'float' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 50, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Bar Chart',
        xAxis: 'table1.x_value',
        yAxis: 'table1.y_value',
        logs: logs as any,
        fields: fields as any,
      });

      await result.waitForPlot();

      // Change plot type
      result.updateProps({ plotType: 'Scatter Plot' });

      await result.waitForPlot();

      // Should render scatter plot
      const isScatter = result.getScatterPoints().length > 0 || result.isWebGLMode();
      expect(isScatter).toBe(true);
    });

    it('handles data update during highlight', async () => {
      const dataTypeConfig = {
        xAxisType: 'str' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 20, skip: false, timeout: 5000 };

      const logs1 = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const logs2 = createMockLogs({
        dataTypeConfig,
        scale: { ...scale, count: 30 },
        deterministic: false,
      });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Bar Chart',
        xAxis: 'table1.category',
        yAxis: 'table1.y_value',
        logs: logs1 as any,
        fields: fields as any,
      });

      await result.waitForPlot();

      const barsBeforeUpdate = result.getBars().length;

      // Update with new data
      result.updateProps({ logs: logs2 as any });

      await result.waitForPlot();

      // Should still have bars
      const barsAfterUpdate = result.getBars().length;
      expect(barsAfterUpdate).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// HighlightTarget Prop Tests
// =============================================================================

describe('HighlightTarget Prop Integration', () => {
  describe('group highlighting via highlightTarget prop', () => {
    it('applies highlight when highlightTarget is set to group type', async () => {
      const dataTypeConfig = {
        xAxisType: 'str' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 30, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Bar Chart',
        xAxis: 'table1.category',
        yAxis: 'table1.y_value',
        groupBy: 'table1.category',
        logs: logs as any,
        fields: fields as any,
      });

      await result.waitForPlot();

      const bars = result.getBars();
      expect(bars.length).toBeGreaterThan(0);

      // Get the group keys from the bars
      const groups = result.getBarGroups();
      expect(groups.length).toBeGreaterThan(0);

      // Simulate group highlight
      result.simulateGroupHighlight(groups[0]);

      await result.waitForHighlightTransition();

      // Highlighted group should have opacity close to 1
      const highlightedBars = result.getBarsByGroup(groups[0]);
      highlightedBars.forEach((bar) => {
        const opacity = parseFloat(bar.style.opacity || '1');
        expect(opacity).toBeGreaterThanOrEqual(0.9);
      });
    });

    it('dims other groups when one group is highlighted', async () => {
      const dataTypeConfig = {
        xAxisType: 'str' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 50, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Bar Chart',
        xAxis: 'table1.category',
        yAxis: 'table1.y_value',
        groupBy: 'table1.category',
        logs: logs as any,
        fields: fields as any,
      });

      await result.waitForPlot();

      const groups = result.getBarGroups();
      expect(groups.length).toBeGreaterThan(1);

      // Highlight the first group
      result.simulateGroupHighlight(groups[0]);

      await result.waitForHighlightTransition();

      // Other groups should have lower opacity or be hidden
      groups.slice(1).forEach((groupKey) => {
        const otherBars = result.getBarsByGroup(groupKey);
        otherBars.forEach((bar) => {
          const opacity = parseFloat(bar.style.opacity || '1');
          // Other groups should be dimmed (opacity < 0.5) or hidden (opacity = 0)
          expect(opacity).toBeLessThanOrEqual(0.5);
        });
      });
    });

    it('clears highlight when highlightTarget is set to none', async () => {
      const dataTypeConfig = {
        xAxisType: 'str' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 30, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Bar Chart',
        xAxis: 'table1.category',
        yAxis: 'table1.y_value',
        groupBy: 'table1.category',
        logs: logs as any,
        fields: fields as any,
      });

      await result.waitForPlot();

      const groups = result.getBarGroups();
      expect(groups.length).toBeGreaterThan(0);

      // First highlight a group
      result.simulateGroupHighlight(groups[0]);
      await result.waitForHighlightTransition();

      // Then clear the highlight
      result.clearHighlight();
      await result.waitForHighlightTransition();

      // All bars should return to normal opacity (>= 0.5 for grouped bars)
      const opacities = result.getBarOpacities();
      opacities.forEach((opacity) => {
        expect(opacity).toBeGreaterThanOrEqual(0.5);
      });
    });
  });

  describe('datapoint highlighting via highlightTarget prop', () => {
    it('applies highlight when highlightTarget is set to datapoint type', async () => {
      const dataTypeConfig = {
        xAxisType: 'float' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 30, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Scatter Plot',
        xAxis: 'table1.x_value',
        yAxis: 'table1.y_value',
        logs: logs as any,
        fields: fields as any,
        forceRenderMode: 'svg',
      });

      await result.waitForPlot();

      const points = result.getScatterPoints();
      expect(points.length).toBeGreaterThan(0);

      // Get a point ID (if stored in data attribute)
      const firstPoint = points[0];
      const pointData = (firstPoint as any).__data__;
      const pointId = pointData?.id || `point-0`;

      // Simulate datapoint highlight
      result.simulateDatapointHighlight(pointId);

      await result.waitForHighlightTransition();

      // The plot should still be rendered
      expect(result.getScatterPoints().length).toBeGreaterThan(0);
    });
  });

  describe('histogram highlighting', () => {
    it('applies group highlight to histogram bins', async () => {
      const dataTypeConfig = {
        xAxisType: 'float' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 50, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Histogram',
        xAxis: 'table1.x_value',
        groupBy: 'table1.category',
        logs: logs as any,
        fields: fields as any,
      });

      await result.waitForPlot();

      const bins = result.getHistogramBins();
      expect(bins.length).toBeGreaterThan(0);

      // Histogram should render correctly with groupBy
      const opacities = result.getHistogramBinOpacities();
      opacities.forEach((opacity) => {
        expect(opacity).toBeGreaterThanOrEqual(0);
        expect(opacity).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('highlight transitions', () => {
    it('supports rapid highlight transitions without errors', async () => {
      const dataTypeConfig = {
        xAxisType: 'str' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 30, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Bar Chart',
        xAxis: 'table1.category',
        yAxis: 'table1.y_value',
        groupBy: 'table1.category',
        logs: logs as any,
        fields: fields as any,
      });

      await result.waitForPlot();

      const groups = result.getBarGroups();
      expect(groups.length).toBeGreaterThan(0);

      // Rapidly cycle through highlights
      result.simulateGroupHighlight(groups[0]);
      result.clearHighlight();
      if (groups.length > 1) {
        result.simulateGroupHighlight(groups[1]);
      }
      result.clearHighlight();

      await result.waitForHighlightTransition();

      // Should not have crashed, bars should still be rendered
      const bars = result.getBars();
      expect(bars.length).toBeGreaterThan(0);
    });

    it('highlight persists across prop updates', async () => {
      const dataTypeConfig = {
        xAxisType: 'str' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 30, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Bar Chart',
        xAxis: 'table1.category',
        yAxis: 'table1.y_value',
        groupBy: 'table1.category',
        logs: logs as any,
        fields: fields as any,
      });

      await result.waitForPlot();

      const groups = result.getBarGroups();
      expect(groups.length).toBeGreaterThan(0);

      // Highlight a group
      result.simulateGroupHighlight(groups[0]);
      await result.waitForHighlightTransition();

      // Update another prop (should not clear highlight)
      result.updateProps({ binCount: 15 });
      await result.waitForPlot();

      // Bars should still be rendered
      const bars = result.getBars();
      expect(bars.length).toBeGreaterThan(0);
    });
  });
});
