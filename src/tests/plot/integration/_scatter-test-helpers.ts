/**
 * Shared test utilities for scatter plot tests.
 */

import { expect } from 'vitest';
import { PlotCanvasTestResult } from '../fixtures/plotCanvasTestHarness';
import { DeterministicLogSet } from '../fixtures/mockData';
import {
  calculatePositionWithD3Scales,
  positionsAreClose,
  POSITION_TOLERANCE,
  DEFAULT_DIMENSIONS,
} from '../fixtures/calculations';

/**
 * Assert scatter points have valid numeric positions (finite, not NaN)
 */
export function assertPointsHaveValidPositions(points: SVGCircleElement[]) {
  for (const point of points) {
    const cx = point.getAttribute('cx');
    const cy = point.getAttribute('cy');
    const r = point.getAttribute('r');

    // Positions must be valid numbers
    expect(cx).not.toBeNull();
    expect(cy).not.toBeNull();
    expect(Number.isNaN(parseFloat(cx!))).toBe(false);
    expect(Number.isNaN(parseFloat(cy!))).toBe(false);

    // Positions should be finite
    const cxNum = parseFloat(cx!);
    const cyNum = parseFloat(cy!);
    expect(Number.isFinite(cxNum)).toBe(true);
    expect(Number.isFinite(cyNum)).toBe(true);

    // Positions should be within plot area
    expect(cxNum).toBeGreaterThanOrEqual(DEFAULT_DIMENSIONS.margins.left - POSITION_TOLERANCE);
    expect(cxNum).toBeLessThanOrEqual(DEFAULT_DIMENSIONS.width - DEFAULT_DIMENSIONS.margins.right + POSITION_TOLERANCE);
    expect(cyNum).toBeGreaterThanOrEqual(DEFAULT_DIMENSIONS.margins.top - POSITION_TOLERANCE);
    expect(cyNum).toBeLessThanOrEqual(DEFAULT_DIMENSIONS.height - DEFAULT_DIMENSIONS.margins.bottom + POSITION_TOLERANCE);

    // Radius should be positive
    if (r) {
      const rNum = parseFloat(r);
      expect(rNum).toBeGreaterThan(0);
    }
  }
}

/**
 * Assert exact point count matches expected data
 */
export function assertExactPointCount(
  result: PlotCanvasTestResult,
  expectedCount: number
) {
  const points = result.getScatterPoints();
  expect(points.length).toBe(expectedCount);
}

/**
 * Assert points are positioned correctly based on data values.
 */
export function assertPointPositionsMatchData(
  result: PlotCanvasTestResult,
  deterministicData: DeterministicLogSet,
  scaleX: 'linear' | 'log',
  scaleY: 'linear' | 'log',
  sampleSize = 10
) {
  const points = result.getScatterPoints();

  // Get all numeric values for scale calculation
  const numericXValues = deterministicData.expectedXValues.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v) && (scaleX !== 'log' || v > 0)
  );
  const numericYValues = deterministicData.expectedYValues.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v) && (scaleY !== 'log' || v > 0)
  );

  // Skip if no valid numeric values
  if (numericXValues.length === 0 || numericYValues.length === 0) {
    return;
  }

  // Check a sample of points
  const step = Math.max(1, Math.floor(points.length / sampleSize));

  for (let i = 0; i < points.length; i += step) {
    const point = points[i];
    const cx = parseFloat(point.getAttribute('cx')!);
    const cy = parseFloat(point.getAttribute('cy')!);

    // Find corresponding log entry
    const logIndex = i;
    if (logIndex >= deterministicData.logs.length) continue;

    const log = deterministicData.logs[logIndex];
    const xValue = log['table1.entries']['table1.x_value'];
    const yValue = log['table1.entries']['table1.y_value'];

    // Skip null/invalid values
    if (xValue === null || yValue === null) continue;
    if (typeof xValue !== 'number' || typeof yValue !== 'number') continue;
    // Skip non-positive values for log scale
    if (scaleX === 'log' && xValue <= 0) continue;
    if (scaleY === 'log' && yValue <= 0) continue;

    // Calculate expected position using D3 scales
    const expectedPos = calculatePositionWithD3Scales(
      xValue,
      yValue,
      numericXValues,
      numericYValues,
      scaleX,
      scaleY
    );

    // Use tolerance for floating point and rendering differences
    const tolerance = POSITION_TOLERANCE * 3;
    expect(positionsAreClose(cx, expectedPos.cx, tolerance)).toBe(true);
    expect(positionsAreClose(cy, expectedPos.cy, tolerance)).toBe(true);
  }
}

/**
 * Assert point dimensions (radius) are consistent and valid
 */
export function assertPointDimensions(
  result: PlotCanvasTestResult,
  expectedRadius?: number
) {
  const points = result.getScatterPoints();

  const radii = points.map(p => parseFloat(p.getAttribute('r') || '0'));

  for (const r of radii) {
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(50); // Reasonable max radius
  }

  if (expectedRadius !== undefined) {
    // All points should have the same radius
    for (const r of radii) {
      expect(r).toBeCloseTo(expectedRadius, 1);
    }
  }

  // All radii should be consistent
  const uniqueRadii = new Set(radii.map(r => Math.round(r * 10) / 10));
  expect(uniqueRadii.size).toBeLessThanOrEqual(3);
}

