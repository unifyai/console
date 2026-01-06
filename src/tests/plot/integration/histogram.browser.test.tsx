/**
 * Histogram Edge Case & Interaction Tests
 *
 * Browser-based tests for edge cases and user interactions.
 * For comprehensive matrix tests, see histogram.matrix.browser.test.tsx
 */

import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { renderPlotCanvas } from '../fixtures/plotCanvasTestHarness';
import {
  assertBinsHaveValidDimensions,
  assertBinsWithinPlotArea,
} from './_histogram-test-helpers';

// =============================================================================
// Setup
// =============================================================================

afterEach(() => {
  cleanup();
});

// =============================================================================
// Edge Cases (Not covered by matrix)
// =============================================================================

describe('Histogram - Edge Cases', () => {
  it('handles empty data gracefully', async () => {
    const result = renderPlotCanvas({
      plotType: 'Histogram',
      xAxis: 'table1.x_value',
      logs: [],
    });

    const svg = result.getSvg();
    expect(svg).not.toBeNull();

    const bins = result.getHistogramBins();
    expect(bins.length).toBe(0);
  });

  it('handles single data point', async () => {
    const singleLog = [{
      id: 'log_0',
      timestamp: new Date().toISOString(),
      'table1.entries': { 'table1.x_value': 50 },
    }];

    const result = renderPlotCanvas({
      plotType: 'Histogram',
      xAxis: 'table1.x_value',
      logs: singleLog as any,
    });

    // Single data point may or may not render a visible plot
    const svg = result.getSvg();
    expect(svg).not.toBeNull();
  });

  it('handles uniform data (all same value)', async () => {
    const uniformLogs = Array.from({ length: 100 }, (_, i) => ({
      id: `log_${i}`,
      timestamp: new Date().toISOString(),
      'table1.entries': { 'table1.x_value': 42 },
    }));

    const result = renderPlotCanvas({
      plotType: 'Histogram',
      xAxis: 'table1.x_value',
      logs: uniformLogs as any,
    });

    await result.waitForPlot();

    const svg = result.getSvg();
    expect(svg).not.toBeNull();
  });

  it('handles data with extreme outliers', async () => {
    const logsWithOutlier = [
      ...Array.from({ length: 50 }, (_, i) => ({
        id: `log_${i}`,
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': i + 1 },
      })),
      {
        id: 'outlier',
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': 1e10 },
      },
    ];

    const result = renderPlotCanvas({
      plotType: 'Histogram',
      xAxis: 'table1.x_value',
      logs: logsWithOutlier as any,
    });

    await result.waitForPlot();

    const svg = result.getSvg();
    expect(svg).not.toBeNull();

    const bins = result.getHistogramBins();
    assertBinsHaveValidDimensions(bins);
  });

  it('handles negative values', async () => {
    const negativeValueLogs = Array.from({ length: 50 }, (_, i) => ({
      id: `log_${i}`,
      timestamp: new Date().toISOString(),
      'table1.entries': { 'table1.x_value': i - 25 },
    }));

    const result = renderPlotCanvas({
      plotType: 'Histogram',
      xAxis: 'table1.x_value',
      logs: negativeValueLogs as any,
    });

    await result.waitForPlot();

    const svg = result.getSvg();
    expect(svg).not.toBeNull();

    const bins = result.getHistogramBins();
    assertBinsHaveValidDimensions(bins);
    assertBinsWithinPlotArea(bins);
  });

  it('handles two distinct values (bimodal data)', async () => {
    const bimodalLogs = [
      ...Array.from({ length: 50 }, (_, i) => ({
        id: `log_a_${i}`,
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': 10 },
      })),
      ...Array.from({ length: 50 }, (_, i) => ({
        id: `log_b_${i}`,
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': 90 },
      })),
    ];

    const result = renderPlotCanvas({
      plotType: 'Histogram',
      xAxis: 'table1.x_value',
      logs: bimodalLogs as any,
      binCount: 10,
    });

    await result.waitForPlot();

    const svg = result.getSvg();
    expect(svg).not.toBeNull();

    const bins = result.getHistogramBins();
    assertBinsHaveValidDimensions(bins);
  });
});

// =============================================================================
// User Interactions
// =============================================================================

describe('Histogram - Interactions', () => {
  it('has tooltip element in DOM', async () => {
    const result = renderPlotCanvas({
      plotType: 'Histogram',
      xAxis: 'table1.x_value',
      interactive: true,
    });

    await result.waitForPlot();

    const tooltip = result.getTooltip();
    expect(tooltip).not.toBeNull();
    expect(tooltip?.style.opacity).toBe('0'); // Hidden initially
  });
});
