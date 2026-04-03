/**
 * Line Chart Edge Case & Interaction Tests
 *
 * Browser-based tests for edge cases and user interactions.
 * For comprehensive matrix tests, see line.matrix.browser.test.tsx
 */

import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { renderPlotCanvas } from '../fixtures/plotCanvasTestHarness';
import { assertLinePathIsValid, assertLineWithinPlotArea } from './_line-test-helpers';

// =============================================================================
// Setup
// =============================================================================

afterEach(() => {
  cleanup();
});

// =============================================================================
// Edge Cases (Not covered by matrix)
// =============================================================================

describe('Line Chart - Edge Cases', () => {
  it('handles empty data gracefully', async () => {
    const result = renderPlotCanvas({
      plotType: 'Line Chart',
      logs: [],
    });

    const svg = result.getSvg();
    expect(svg).not.toBeNull();

    const linePath = result.getLinePath();
    // No path or empty path expected
  });

  it('handles single data point', async () => {
    const singleLog = [
      {
        id: 'log_0',
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': 50, 'table1.y_value': 75 },
      },
    ];

    const result = renderPlotCanvas({
      plotType: 'Line Chart',
      logs: singleLog as any,
    });

    await result.waitForPlot();

    const svg = result.getSvg();
    expect(svg).not.toBeNull();
  });

  it('handles two data points (minimal line)', async () => {
    const twoPointLogs = [
      {
        id: 'log_0',
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': 0, 'table1.y_value': 0 },
      },
      {
        id: 'log_1',
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': 100, 'table1.y_value': 100 },
      },
    ];

    const result = renderPlotCanvas({
      plotType: 'Line Chart',
      logs: twoPointLogs as any,
    });

    await result.waitForPlot();

    const svg = result.getSvg();
    expect(svg).not.toBeNull();

    const linePath = result.getLinePath();
    assertLinePathIsValid(linePath);
  });

  it('handles gaps (null values in series)', async () => {
    const gappyLogs = [
      {
        id: 'log_0',
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': 1, 'table1.y_value': 0 },
      },
      {
        id: 'log_1',
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': 2, 'table1.y_value': null },
      },
      {
        id: 'log_2',
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': 3, 'table1.y_value': 50 },
      },
    ];

    const result = renderPlotCanvas({
      plotType: 'Line Chart',
      logs: gappyLogs as any,
    });

    await result.waitForPlot();

    const svg = result.getSvg();
    expect(svg).not.toBeNull();
  });

  it('handles large values', async () => {
    const largeValueLogs = [
      {
        id: 'log_0',
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': 1, 'table1.y_value': 1e10 },
      },
      {
        id: 'log_1',
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': 2, 'table1.y_value': 1e12 },
      },
    ];

    const result = renderPlotCanvas({
      plotType: 'Line Chart',
      logs: largeValueLogs as any,
    });

    await result.waitForPlot();

    const svg = result.getSvg();
    expect(svg).not.toBeNull();

    const linePath = result.getLinePath();
    assertLinePathIsValid(linePath);
  });

  it('handles negative values', async () => {
    const negativeValueLogs = [
      {
        id: 'log_0',
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': -50, 'table1.y_value': -25 },
      },
      {
        id: 'log_1',
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': 0, 'table1.y_value': 0 },
      },
      {
        id: 'log_2',
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': 50, 'table1.y_value': 25 },
      },
    ];

    const result = renderPlotCanvas({
      plotType: 'Line Chart',
      logs: negativeValueLogs as any,
    });

    await result.waitForPlot();

    const svg = result.getSvg();
    expect(svg).not.toBeNull();

    const linePath = result.getLinePath();
    assertLinePathIsValid(linePath);
    assertLineWithinPlotArea(linePath);
  });

  it('handles non-monotonic x values', async () => {
    const nonMonotonicLogs = [
      {
        id: 'log_0',
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': 30, 'table1.y_value': 30 },
      },
      {
        id: 'log_1',
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': 10, 'table1.y_value': 10 },
      },
      {
        id: 'log_2',
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': 50, 'table1.y_value': 50 },
      },
      {
        id: 'log_3',
        timestamp: new Date().toISOString(),
        'table1.entries': { 'table1.x_value': 20, 'table1.y_value': 20 },
      },
    ];

    const result = renderPlotCanvas({
      plotType: 'Line Chart',
      logs: nonMonotonicLogs as any,
    });

    await result.waitForPlot();

    const svg = result.getSvg();
    expect(svg).not.toBeNull();
  });
});

// =============================================================================
// User Interactions
// =============================================================================

describe('Line Chart - Interactions', () => {
  it('has tooltip element in DOM', async () => {
    const result = renderPlotCanvas({
      plotType: 'Line Chart',
      interactive: true,
    });

    await result.waitForPlot();

    const tooltip = result.getTooltip();
    expect(tooltip).not.toBeNull();
    expect(tooltip?.style.opacity).toBe('0'); // Hidden initially
  });

  it('supports zoom when enabled', async () => {
    const result = renderPlotCanvas({
      plotType: 'Line Chart',
      zoomEnabled: true,
    });

    await result.waitForPlot();

    const svg = result.getSvg();
    expect(svg).not.toBeNull();
  });
});
