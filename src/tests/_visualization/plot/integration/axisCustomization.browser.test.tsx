/**
 * Axis Customization Integration Tests - Browser
 *
 * Tests that axis customization options work correctly when rendering plots.
 *
 * These tests verify:
 * - showXAxisLabel/showYAxisLabel visibility options
 * - xAxisLabel/yAxisLabel custom label text
 * - xTickFormatter/yTickFormatter tick formatting
 * - groupByLabel/aggregateLabel custom labels
 */

import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { renderPlotCanvas } from '../fixtures/plotCanvasTestHarness';
import { createMockLogs, createMockFields } from '../fixtures/mockData';
import {
  assertXAxisLabelVisible,
  assertYAxisLabelVisible,
  assertXAxisLabelHidden,
  assertYAxisLabelHidden,
  assertXAxisLabelText,
  assertYAxisLabelText,
  assertYAxisTicksHaveCurrencyFormat,
} from '../fixtures/drawerTestHelpers';

// =============================================================================
// Setup
// =============================================================================

afterEach(() => {
  cleanup();
});

// =============================================================================
// Axis Label Visibility Tests
// =============================================================================

describe('Axis Customization Integration', () => {
  describe('axis label visibility', () => {
    it('hides X-axis label by default', async () => {
      const dataTypeConfig = {
        xAxisType: 'float' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 30, skip: false, timeout: 5000 };

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

      // X-axis label should be hidden by default
      assertXAxisLabelHidden(result);
    });

    it('hides Y-axis label by default', async () => {
      const dataTypeConfig = {
        xAxisType: 'float' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 30, skip: false, timeout: 5000 };

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

      // Y-axis label should be hidden by default
      assertYAxisLabelHidden(result);
    });

    it('shows X-axis label when showXAxisLabel is true', async () => {
      const dataTypeConfig = {
        xAxisType: 'float' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 30, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Bar Chart',
        xAxis: 'table1.x_value',
        yAxis: 'table1.y_value',
        logs: logs as any,
        fields: fields as any,
        showXAxisLabel: true,
      });

      await result.waitForPlot();

      // X-axis label should be visible
      assertXAxisLabelVisible(result);
    });

    it('shows Y-axis label when showYAxisLabel is true', async () => {
      const dataTypeConfig = {
        xAxisType: 'float' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 30, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Bar Chart',
        xAxis: 'table1.x_value',
        yAxis: 'table1.y_value',
        logs: logs as any,
        fields: fields as any,
        showYAxisLabel: true,
      });

      await result.waitForPlot();

      // Y-axis label should be visible
      assertYAxisLabelVisible(result);
    });

    it('hides X-axis label when showXAxisLabel is false', async () => {
      const dataTypeConfig = {
        xAxisType: 'float' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 30, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Bar Chart',
        xAxis: 'table1.x_value',
        yAxis: 'table1.y_value',
        logs: logs as any,
        fields: fields as any,
        showXAxisLabel: false,
      });

      await result.waitForPlot();

      // X-axis label should be hidden
      assertXAxisLabelHidden(result);
    });

    it('hides Y-axis label when showYAxisLabel is false', async () => {
      const dataTypeConfig = {
        xAxisType: 'float' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 30, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Bar Chart',
        xAxis: 'table1.x_value',
        yAxis: 'table1.y_value',
        logs: logs as any,
        fields: fields as any,
        showYAxisLabel: false,
      });

      await result.waitForPlot();

      // Y-axis label should be hidden
      assertYAxisLabelHidden(result);
    });

    it('can hide both axis labels simultaneously', async () => {
      const dataTypeConfig = {
        xAxisType: 'float' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 30, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Bar Chart',
        xAxis: 'table1.x_value',
        yAxis: 'table1.y_value',
        logs: logs as any,
        fields: fields as any,
        showXAxisLabel: false,
        showYAxisLabel: false,
      });

      await result.waitForPlot();

      // Both axis labels should be hidden
      assertXAxisLabelHidden(result);
      assertYAxisLabelHidden(result);
    });
  });

  // =============================================================================
  // Custom Axis Labels Tests
  // =============================================================================

  describe('custom axis labels', () => {
    it('uses custom xAxisLabel when provided', async () => {
      const dataTypeConfig = {
        xAxisType: 'float' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 30, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Bar Chart',
        xAxis: 'table1.x_value',
        yAxis: 'table1.y_value',
        logs: logs as any,
        fields: fields as any,
        showXAxisLabel: true,
        xAxisLabel: 'Custom X Label',
      });

      await result.waitForPlot();

      // X-axis should have custom label
      assertXAxisLabelText(result, 'Custom X Label');
    });

    it('uses custom yAxisLabel when provided', async () => {
      const dataTypeConfig = {
        xAxisType: 'float' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 30, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Bar Chart',
        xAxis: 'table1.x_value',
        yAxis: 'table1.y_value',
        logs: logs as any,
        fields: fields as any,
        showYAxisLabel: true,
        yAxisLabel: 'Custom Y Label',
      });

      await result.waitForPlot();

      // Y-axis should have custom label
      assertYAxisLabelText(result, 'Custom Y Label');
    });

    it('uses both custom axis labels when provided', async () => {
      const dataTypeConfig = {
        xAxisType: 'float' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 30, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Bar Chart',
        xAxis: 'table1.x_value',
        yAxis: 'table1.y_value',
        logs: logs as any,
        fields: fields as any,
        showXAxisLabel: true,
        showYAxisLabel: true,
        xAxisLabel: 'Day',
        yAxisLabel: 'Billed Cost',
      });

      await result.waitForPlot();

      // Both axes should have custom labels
      assertXAxisLabelText(result, 'Day');
      assertYAxisLabelText(result, 'Billed Cost');
    });
  });

  // =============================================================================
  // Tick Formatter Tests
  // =============================================================================

  describe('tick formatters', () => {
    it('applies yTickFormatter to Y-axis ticks', async () => {
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
        logs: logs as any,
        fields: fields as any,
        yTickFormatter: (value: unknown) => `$${Number(value).toFixed(2)}`,
      });

      await result.waitForPlot();

      // Y-axis ticks should have currency format
      assertYAxisTicksHaveCurrencyFormat(result);
    });

    it('applies xTickFormatter to X-axis ticks (bar chart)', async () => {
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
        logs: logs as any,
        fields: fields as any,
        xTickFormatter: (value: unknown) => `#${String(value)}`,
      });

      await result.waitForPlot();

      // X-axis ticks should have custom format with #
      const xTicks = result.getAxisTicks('x');
      expect(xTicks.length).toBeGreaterThan(0);
      // At least some ticks should have the # prefix
      const hasFormattedTicks = xTicks.some((tick) => tick.startsWith('#'));
      expect(hasFormattedTicks).toBe(true);
    });

    it('percentage formatter example', async () => {
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
        logs: logs as any,
        fields: fields as any,
        yTickFormatter: (value: unknown) => `${Math.round(Number(value))}%`,
      });

      await result.waitForPlot();

      // Y-axis ticks should have percentage format
      const yTicks = result.getAxisTicks('y');
      expect(yTicks.length).toBeGreaterThan(0);
      // At least some ticks should have the % suffix
      const hasPercentTicks = yTicks.some((tick) => tick.endsWith('%'));
      expect(hasPercentTicks).toBe(true);
    });
  });

  // =============================================================================
  // Combined Customization Tests
  // =============================================================================

  describe('combined customization', () => {
    it('usage page pattern: hide labels but keep custom labels for tooltip', async () => {
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
        // Hide axis labels on chart
        showXAxisLabel: false,
        showYAxisLabel: false,
        // But provide custom labels for tooltip
        xAxisLabel: 'Day',
        yAxisLabel: 'Billed Cost',
        // Format y-axis ticks as currency
        yTickFormatter: (value: unknown) => `$${Number(value).toFixed(2)}`,
        // Custom group label
        groupByLabel: 'Model',
        aggregateLabel: 'Total Cost',
      });

      await result.waitForPlot();

      // Axis labels should be hidden
      assertXAxisLabelHidden(result);
      assertYAxisLabelHidden(result);

      // Y-axis ticks should have currency format
      assertYAxisTicksHaveCurrencyFormat(result);

      // Bars should be rendered
      const bars = result.getBars();
      expect(bars.length).toBeGreaterThan(0);
    });

    it('scatter plot with visible axes renders correctly', async () => {
      const dataTypeConfig = {
        xAxisType: 'float' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 50, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Scatter Plot',
        xAxis: 'table1.x_value',
        yAxis: 'table1.y_value',
        logs: logs as any,
        fields: fields as any,
        forceRenderMode: 'svg',
        showXAxisLabel: true,
        showYAxisLabel: true,
      });

      await result.waitForPlot();

      // Axes should be rendered
      const xAxis = result.getXAxis();
      const yAxis = result.getYAxis();
      expect(xAxis).not.toBeNull();
      expect(yAxis).not.toBeNull();

      // Scatter points should be rendered
      const points = result.getScatterPoints();
      expect(points.length).toBeGreaterThan(0);
    });

    it('histogram with custom labels', async () => {
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
        showXAxisLabel: false, // Bins are self-explanatory
        showYAxisLabel: true,
        yAxisLabel: 'Frequency',
      });

      await result.waitForPlot();

      // X-axis label should be hidden
      assertXAxisLabelHidden(result);

      // Y-axis should have custom label
      assertYAxisLabelText(result, 'Frequency');

      // Histogram bins should be rendered
      const bins = result.getHistogramBins();
      expect(bins.length).toBeGreaterThan(0);
    });
  });

  // =============================================================================
  // Plot Type Specific Tests
  // =============================================================================

  describe('axis customization for different plot types', () => {
    it('line chart with axis customization', async () => {
      const dataTypeConfig = {
        xAxisType: 'float' as const,
        yAxisType: 'float' as const,
        groupByType: 'str' as const,
      };
      const scale = { name: 'small', count: 30, skip: false, timeout: 5000 };

      const logs = createMockLogs({ dataTypeConfig, scale, deterministic: false });
      const fields = createMockFields(dataTypeConfig);

      const result = renderPlotCanvas({
        plotType: 'Line Chart',
        xAxis: 'table1.x_value',
        yAxis: 'table1.y_value',
        logs: logs as any,
        fields: fields as any,
        showXAxisLabel: true,
        showYAxisLabel: true,
      });

      await result.waitForPlot();

      // Axes should be rendered
      const xAxis = result.getXAxis();
      const yAxis = result.getYAxis();
      expect(xAxis).not.toBeNull();
      expect(yAxis).not.toBeNull();

      // Line path should be rendered
      const svg = result.getSvg();
      expect(svg).not.toBeNull();
    });

    it('grouped bar chart with axis customization', async () => {
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
        showXAxisLabel: true,
        showYAxisLabel: true,
        xAxisLabel: 'Category',
        yAxisLabel: 'Total',
        groupByLabel: 'Type',
      });

      await result.waitForPlot();

      // Axes should have custom labels
      assertXAxisLabelText(result, 'Category');
      assertYAxisLabelText(result, 'Total');

      // Bars should be rendered
      const bars = result.getBars();
      expect(bars.length).toBeGreaterThan(0);
    });
  });
});
