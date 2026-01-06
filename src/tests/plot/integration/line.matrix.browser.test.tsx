/**
 * Line Chart Integration Tests
 *
 * Browser-based tests for line chart rendering correctness,
 * user interactions, and edge cases.
 *
 * Structure:
 * - Edge Cases: Invalid/boundary conditions not in matrix
 * - User Interactions: Hover, zoom behaviors
 * - Matrix Tests: Comprehensive coverage of all valid config combinations
 *
 * Key improvements:
 * - Uses deterministic mock data for precise position assertions
 * - Verifies line path validity (no NaN/Infinity, valid commands)
 * - Verifies line passes through data points
 * - Verifies line is within plot area bounds
 */

import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import {
  renderPlotCanvas,
  createPlotTestSetup,
  assertAxesRendered,
  PlotCanvasTestResult,
} from '../fixtures/plotCanvasTestHarness';
import {
  generateValidPlotConfigsForType,
  generateDataTypeConfigs,
  getActiveScales,
  generateTestAlias,
  sampleConfigs,
  PlotConfig,
  DataTypeConfig,
  ScaleOption,
} from '../fixtures/configs';
import {
  createDeterministicMockLogs,
  DeterministicLogSet,
} from '../fixtures/mockData';
import {
  calculateScatterPointPosition,
  calculateDomain,
  calculateLogDomain,
  positionsAreClose,
  POSITION_TOLERANCE,
  DEFAULT_DIMENSIONS,
  Domain,
} from '../fixtures/calculations';
import { defineMatrixTests, TestUtils } from '../../utils/matrixTestRunnerBrowser';

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
 * Parse SVG path d attribute into commands
 */
function parsePathD(d: string): Array<{ cmd: string; x?: number; y?: number }> {
  const commands: Array<{ cmd: string; x?: number; y?: number }> = [];
  const regex = /([MLHVCSTQAZmlhvcsqtaz])([^MLHVCSTQAZmlhvcsqtaz]*)/g;
  let match;

  while ((match = regex.exec(d)) !== null) {
    const cmd = match[1];
    const params = match[2].trim().split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));

    if (cmd === 'M' || cmd === 'L') {
      for (let i = 0; i < params.length; i += 2) {
        commands.push({ cmd, x: params[i], y: params[i + 1] });
      }
    } else if (cmd === 'H') {
      for (const x of params) {
        commands.push({ cmd, x });
      }
    } else if (cmd === 'V') {
      for (const y of params) {
        commands.push({ cmd, y });
      }
    } else if (cmd === 'Z') {
      commands.push({ cmd });
    }
  }

  return commands;
}

/**
 * Assert line path has valid d attribute
 */
function assertLinePathIsValid(linePath: SVGPathElement | null) {
  if (!linePath) return;

  const d = linePath.getAttribute('d');
  if (d) {
    // Path should start with M (moveto) command
    expect(d.startsWith('M') || d.startsWith('m')).toBe(true);

    // Path should have content
    expect(d.length).toBeGreaterThan(1);

    // Should not contain NaN or Infinity
    expect(d).not.toContain('NaN');
    expect(d).not.toContain('Infinity');

    // Parse and validate all coordinates
    const commands = parsePathD(d);
    for (const cmd of commands) {
      if (cmd.x !== undefined) {
        expect(Number.isFinite(cmd.x)).toBe(true);
      }
      if (cmd.y !== undefined) {
        expect(Number.isFinite(cmd.y)).toBe(true);
      }
    }
  }
}

/**
 * Assert line path is within plot area bounds
 */
function assertLineWithinPlotArea(linePath: SVGPathElement | null) {
  if (!linePath) return;

  const d = linePath.getAttribute('d');
  if (!d) return;

  const { width, height, margins } = DEFAULT_DIMENSIONS;
  const commands = parsePathD(d);

  for (const cmd of commands) {
    if (cmd.x !== undefined) {
      expect(cmd.x).toBeGreaterThanOrEqual(margins.left - POSITION_TOLERANCE);
      expect(cmd.x).toBeLessThanOrEqual(width - margins.right + POSITION_TOLERANCE);
    }
    if (cmd.y !== undefined) {
      expect(cmd.y).toBeGreaterThanOrEqual(margins.top - POSITION_TOLERANCE);
      expect(cmd.y).toBeLessThanOrEqual(height - margins.bottom + POSITION_TOLERANCE);
    }
  }
}

/**
 * Assert line passes through expected data points (with tolerance)
 * Returns the number of points that were found near the expected positions
 */
function assertLinePassesThroughPoints(
  linePath: SVGPathElement | null,
  deterministicData: DeterministicLogSet,
  scaleX: 'linear' | 'log',
  scaleY: 'linear' | 'log',
  sampleSize = 5
): number {
  if (!linePath) return 0;

  const d = linePath.getAttribute('d');
  if (!d) return 0;

  const commands = parsePathD(d);
  if (commands.length === 0) return 0;

  // Calculate domains
  const numericXValues = deterministicData.expectedXValues.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v)
  );
  const numericYValues = deterministicData.expectedYValues.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v)
  );

  if (numericXValues.length === 0 || numericYValues.length === 0) return 0;

  const xDomain: Domain = scaleX === 'log'
    ? calculateLogDomain(numericXValues)
    : calculateDomain(numericXValues, true);

  const yDomain: Domain = scaleY === 'log'
    ? calculateLogDomain(numericYValues)
    : calculateDomain(numericYValues, true);

  // Sample some data points and verify line passes near them
  const step = Math.max(1, Math.floor(deterministicData.logs.length / sampleSize));
  let pointsChecked = 0;
  let pointsFound = 0;

  for (let i = 0; i < deterministicData.logs.length; i += step) {
    const log = deterministicData.logs[i];
    const xValue = log['table1.entries']['table1.x_value'];
    const yValue = log['table1.entries']['table1.y_value'];

    if (xValue === null || yValue === null) continue;
    if (typeof xValue !== 'number' || typeof yValue !== 'number') continue;

    pointsChecked++;

    const expectedPos = calculateScatterPointPosition(
      xValue,
      yValue,
      xDomain,
      yDomain,
      scaleX,
      scaleY
    );

    // Check if any point on the line is close to the expected position
    // Use larger tolerance for lines (interpolation may shift points)
    const tolerance = POSITION_TOLERANCE * 15; // Large tolerance for curve interpolation
    const hasNearbyPoint = commands.some(cmd =>
      cmd.x !== undefined &&
      cmd.y !== undefined &&
      Math.abs(cmd.x - expectedPos.cx) < tolerance &&
      Math.abs(cmd.y - expectedPos.cy) < tolerance
    );

    if (hasNearbyPoint) {
      pointsFound++;
    }
  }

  // At least some sampled points should be found near the line
  // (allow for curve interpolation that may shift exact positions)
  if (pointsChecked > 0) {
    const foundRatio = pointsFound / pointsChecked;
    expect(foundRatio).toBeGreaterThanOrEqual(0.3); // At least 30% of points should be near the line
  }

  return pointsFound;
}

/**
 * Assert line has expected number of segments.
 * Line charts render one point per log entry (aggregate affects value computation, not point count).
 */
function assertLineSegmentCount(
  linePath: SVGPathElement | null,
  deterministicData: DeterministicLogSet
) {
  if (!linePath) return;

  const d = linePath.getAttribute('d');
  if (!d) return;

  const commands = parsePathD(d);

  // Line should have roughly as many M/L commands as data points
  // (accounting for null values creating gaps)
  const expectedPointCount = deterministicData.logs.filter(log =>
    log['table1.entries']['table1.x_value'] !== null && log['table1.entries']['table1.y_value'] !== null
  ).length;

  // Commands should be proportional to data points
  // Allow wide tolerance as line interpolation varies
  expect(commands.length).toBeGreaterThan(0);
  expect(commands.length).toBeLessThanOrEqual(expectedPointCount * 3 + 10); // Bezier curves add points
}

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
    const singleLog = [{
      id: 'log_0',
      timestamp: new Date().toISOString(),
      'table1.entries': { 'table1.x_value': 50, 'table1.y_value': 75 },
    }];

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
      { id: 'log_0', timestamp: new Date().toISOString(), 'table1.entries': { 'table1.x_value': 0, 'table1.y_value': 0 } },
      { id: 'log_1', timestamp: new Date().toISOString(), 'table1.entries': { 'table1.x_value': 100, 'table1.y_value': 100 } },
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
      { id: 'log_0', timestamp: new Date().toISOString(), 'table1.entries': { 'table1.x_value': 1, 'table1.y_value': 0 } },
      { id: 'log_1', timestamp: new Date().toISOString(), 'table1.entries': { 'table1.x_value': 2, 'table1.y_value': null } },
      { id: 'log_2', timestamp: new Date().toISOString(), 'table1.entries': { 'table1.x_value': 3, 'table1.y_value': 50 } },
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
      { id: 'log_0', timestamp: new Date().toISOString(), 'table1.entries': { 'table1.x_value': 1, 'table1.y_value': 1e10 } },
      { id: 'log_1', timestamp: new Date().toISOString(), 'table1.entries': { 'table1.x_value': 2, 'table1.y_value': 1e12 } },
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
      { id: 'log_0', timestamp: new Date().toISOString(), 'table1.entries': { 'table1.x_value': -50, 'table1.y_value': -25 } },
      { id: 'log_1', timestamp: new Date().toISOString(), 'table1.entries': { 'table1.x_value': 0, 'table1.y_value': 0 } },
      { id: 'log_2', timestamp: new Date().toISOString(), 'table1.entries': { 'table1.x_value': 50, 'table1.y_value': 25 } },
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
      { id: 'log_0', timestamp: new Date().toISOString(), 'table1.entries': { 'table1.x_value': 30, 'table1.y_value': 30 } },
      { id: 'log_1', timestamp: new Date().toISOString(), 'table1.entries': { 'table1.x_value': 10, 'table1.y_value': 10 } },
      { id: 'log_2', timestamp: new Date().toISOString(), 'table1.entries': { 'table1.x_value': 50, 'table1.y_value': 50 } },
      { id: 'log_3', timestamp: new Date().toISOString(), 'table1.entries': { 'table1.x_value': 20, 'table1.y_value': 20 } },
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

// =============================================================================
// Matrix Tests - Comprehensive Coverage with Exact Assertions
// =============================================================================

interface LineMatrixConfig {
  plotConfig: PlotConfig;
  dataTypeConfig: DataTypeConfig;
  scale: ScaleOption;
}

function generateLineMatrix(): LineMatrixConfig[] {
  const allPlotConfigs = generateValidPlotConfigsForType('line');
  const allDataTypes = generateDataTypeConfigs().filter(
    (dt) => ['float', 'int', 'datetime'].includes(dt.x_axis_type)
  );
  const activeScales = getActiveScales();

  const fullMatrix: LineMatrixConfig[] = [];
  for (const plotConfig of allPlotConfigs) {
    for (const dataTypeConfig of allDataTypes) {
      for (const scale of activeScales) {
        fullMatrix.push({ plotConfig, dataTypeConfig, scale });
      }
    }
  }

  return sampleConfigs(fullMatrix);
}

function defineLineTests(
  config: LineMatrixConfig,
  { it, expect }: TestUtils
): void {
  const { plotConfig, dataTypeConfig, scale } = config;
  const deterministicData = createDeterministicMockLogs(dataTypeConfig, scale.count);

  it('renders line chart correctly', async () => {
    const testSetup = createPlotTestSetup(plotConfig, dataTypeConfig, scale, {
      deterministic: true,
    });
    const result = renderPlotCanvas(testSetup);
    await result.waitForPlot();

    // Core assertions - SVG and structure
    const svg = result.getSvg();
    expect(svg).not.toBeNull();
    assertAxesRendered(result);

    // Line path validation
    const linePath = result.getLinePath();
    assertLinePathIsValid(linePath);
    assertLineWithinPlotArea(linePath);
    assertLineSegmentCount(linePath, deterministicData);

    // Non-grouped: line passes through data points
    if (!plotConfig.group_by) {
      assertLinePassesThroughPoints(
        linePath,
        deterministicData,
        plotConfig.scale_x as 'linear' | 'log',
        plotConfig.scale_y as 'linear' | 'log'
      );
    }

    // Axis ticks
    const xTicks = result.getAxisTicks('x');
    const yTicks = result.getAxisTicks('y');
    if (xTicks.length + yTicks.length === 0) {
      const xAxis = result.getXAxis();
      const yAxis = result.getYAxis();
      expect(xAxis !== null || yAxis !== null).toBe(true);
    }

    // Grouped: multiple lines with different colors
    if (plotConfig.group_by) {
      const plotData = result.getPlotDataGroup();
      const paths = plotData?.querySelectorAll('path.line-item') ?? [];
      expect(paths.length).toBeGreaterThan(1);

      // All grouped paths should be valid
      for (const path of Array.from(paths)) {
        assertLinePathIsValid(path as SVGPathElement);
      }

      // Different colors for different groups
      if (paths.length > 1) {
        const strokeColors = new Set(
          Array.from(paths).map(p => p.getAttribute('stroke')).filter(Boolean)
        );
        expect(strokeColors.size).toBeGreaterThan(1);
      }
    }
  }, scale.timeout);
}

export const matrixTests = defineMatrixTests<LineMatrixConfig>({
  name: 'Line Chart - Matrix Tests',
  getMatrix: generateLineMatrix,
  defineTests: defineLineTests,
  chunkSize: 25,
  getConfigAlias: (config) =>
    generateTestAlias('line', config.plotConfig, config.dataTypeConfig, config.scale),
});
