/**
 * Shared test utilities for line chart tests.
 */

import { expect } from 'vitest';
import { DeterministicLogSet } from '../fixtures/mockData';
import {
  calculateScatterPointPosition,
  calculateDomain,
  calculateLogDomain,
  POSITION_TOLERANCE,
  DEFAULT_DIMENSIONS,
  Domain,
} from '../fixtures/calculations';

/**
 * Parse SVG path d attribute into commands
 */
export function parsePathD(d: string): Array<{ cmd: string; x?: number; y?: number }> {
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
export function assertLinePathIsValid(linePath: SVGPathElement | null) {
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
export function assertLineWithinPlotArea(linePath: SVGPathElement | null) {
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
 */
export function assertLinePassesThroughPoints(
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
    const tolerance = POSITION_TOLERANCE * 15;
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
  if (pointsChecked > 0) {
    const foundRatio = pointsFound / pointsChecked;
    expect(foundRatio).toBeGreaterThanOrEqual(0.3);
  }

  return pointsFound;
}

/**
 * Assert line has expected number of segments.
 */
export function assertLineSegmentCount(
  linePath: SVGPathElement | null,
  deterministicData: DeterministicLogSet
) {
  if (!linePath) return;

  const d = linePath.getAttribute('d');
  if (!d) return;

  const commands = parsePathD(d);

  // Line should have roughly as many M/L commands as data points
  const expectedPointCount = deterministicData.logs.filter(log =>
    log['table1.entries']['table1.x_value'] !== null && log['table1.entries']['table1.y_value'] !== null
  ).length;

  // Commands should be proportional to data points
  expect(commands.length).toBeGreaterThan(0);
  expect(commands.length).toBeLessThanOrEqual(expectedPointCount * 3 + 10);
}

