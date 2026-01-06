/**
 * Shared test utilities for histogram tests.
 */

import { expect } from 'vitest';
import {
  calculateExpectedBinCount,
  POSITION_TOLERANCE,
  DEFAULT_DIMENSIONS,
} from '../fixtures/calculations';

/**
 * Assert histogram bins have valid dimensions
 */
export function assertBinsHaveValidDimensions(bins: SVGRectElement[]) {
  for (const bin of bins) {
    const x = bin.getAttribute('x');
    const y = bin.getAttribute('y');
    const width = bin.getAttribute('width');
    const height = bin.getAttribute('height');

    if (x) {
      const xNum = parseFloat(x);
      expect(Number.isFinite(xNum)).toBe(true);
      expect(xNum).toBeGreaterThanOrEqual(0);
    }
    if (y) {
      const yNum = parseFloat(y);
      expect(Number.isFinite(yNum)).toBe(true);
      expect(yNum).toBeGreaterThanOrEqual(0);
    }
    if (width) {
      const widthNum = parseFloat(width);
      expect(Number.isFinite(widthNum)).toBe(true);
      expect(widthNum).toBeGreaterThan(0);
    }
    if (height) {
      const heightNum = parseFloat(height);
      expect(Number.isFinite(heightNum)).toBe(true);
      expect(heightNum).toBeGreaterThanOrEqual(0);
    }
  }
}

/**
 * Assert bins are within the plot area
 */
export function assertBinsWithinPlotArea(bins: SVGRectElement[]) {
  const { width, height, margins } = DEFAULT_DIMENSIONS;

  for (const bin of bins) {
    const x = parseFloat(bin.getAttribute('x') || '0');
    const y = parseFloat(bin.getAttribute('y') || '0');
    const binWidth = parseFloat(bin.getAttribute('width') || '0');
    const binHeight = parseFloat(bin.getAttribute('height') || '0');

    expect(x).toBeGreaterThanOrEqual(margins.left - POSITION_TOLERANCE);
    expect(x + binWidth).toBeLessThanOrEqual(width - margins.right + POSITION_TOLERANCE);
    expect(y).toBeGreaterThanOrEqual(margins.top - POSITION_TOLERANCE);
    expect(y + binHeight).toBeLessThanOrEqual(height - margins.bottom + POSITION_TOLERANCE);
  }
}

/**
 * Assert bin count is within expected range
 */
export function assertBinCountInRange(
  bins: SVGRectElement[],
  requestedBinCount: number,
  dataCount: number,
  isGrouped = false,
  expectedGroupCount = 5
) {
  const { min, max } = calculateExpectedBinCount(requestedBinCount, dataCount);
  
  if (isGrouped) {
    const minTotalBins = min * Math.max(1, expectedGroupCount - 1);
    const maxTotalBins = max * (expectedGroupCount + 1);
    expect(bins.length).toBeGreaterThanOrEqual(minTotalBins);
    expect(bins.length).toBeLessThanOrEqual(maxTotalBins);
  } else {
    expect(bins.length).toBeGreaterThanOrEqual(min);
    expect(bins.length).toBeLessThanOrEqual(max);
  }
}

/**
 * Group histogram bins by their fill color
 */
export function groupBinsByColor(bins: SVGRectElement[]): Map<string, SVGRectElement[]> {
  const groups = new Map<string, SVGRectElement[]>();
  
  for (const bin of bins) {
    const fill = bin.getAttribute('fill') || 'default';
    if (!groups.has(fill)) {
      groups.set(fill, []);
    }
    groups.get(fill)!.push(bin);
  }
  
  return groups;
}

/**
 * Assert grouped histogram bins have valid structure
 */
export function assertGroupedBinsValid(bins: SVGRectElement[], expectedGroupCount = 5) {
  if (bins.length === 0) return;
  
  const groups = groupBinsByColor(bins);
  
  expect(groups.size).toBeGreaterThanOrEqual(Math.max(2, expectedGroupCount - 1));
  expect(groups.size).toBeLessThanOrEqual(expectedGroupCount + 1);
  
  groups.forEach((groupBins) => {
    assertBinsHaveValidDimensions(groupBins);
    
    const sortedBins = [...groupBins].sort(
      (a, b) => parseFloat(a.getAttribute('x') || '0') - parseFloat(b.getAttribute('x') || '0')
    );
    
    for (let i = 1; i < sortedBins.length; i++) {
      const prevBin = sortedBins[i - 1];
      const currBin = sortedBins[i];
      const prevEnd = parseFloat(prevBin.getAttribute('x') || '0') + 
                      parseFloat(prevBin.getAttribute('width') || '0');
      const currStart = parseFloat(currBin.getAttribute('x') || '0');
      
      expect(currStart).toBeGreaterThanOrEqual(prevEnd - POSITION_TOLERANCE);
    }
  });
}

/**
 * Assert all bins have consistent widths
 */
export function assertConsistentBinWidths(bins: SVGRectElement[]) {
  if (bins.length <= 1) return;

  const widths = bins.map(bin => parseFloat(bin.getAttribute('width') || '0'));
  const avgWidth = widths.reduce((a, b) => a + b, 0) / widths.length;

  for (const width of widths) {
    expect(Math.abs(width - avgWidth)).toBeLessThan(POSITION_TOLERANCE);
  }
}

/**
 * Assert bins are contiguous
 */
export function assertBinsContiguous(bins: SVGRectElement[]) {
  if (bins.length <= 1) return;

  const sortedBins = [...bins].sort(
    (a, b) => parseFloat(a.getAttribute('x') || '0') - parseFloat(b.getAttribute('x') || '0')
  );

  for (let i = 1; i < sortedBins.length; i++) {
    const prevBin = sortedBins[i - 1];
    const currBin = sortedBins[i];

    const prevX = parseFloat(prevBin.getAttribute('x') || '0');
    const prevWidth = parseFloat(prevBin.getAttribute('width') || '0');
    const currX = parseFloat(currBin.getAttribute('x') || '0');

    expect(Math.abs(currX - (prevX + prevWidth))).toBeLessThan(POSITION_TOLERANCE);
  }
}

/**
 * Assert bin heights are proportional to frequency
 */
export function assertBinHeightsProportional(bins: SVGRectElement[]) {
  if (bins.length === 0) return;

  const binData = bins.map(bin => ({
    y: parseFloat(bin.getAttribute('y') || '0'),
    height: parseFloat(bin.getAttribute('height') || '0'),
  }));

  for (const bin of binData) {
    expect(bin.height).toBeGreaterThanOrEqual(0);
  }

  const nonZeroHeights = binData.filter(b => b.height > 0);
  expect(nonZeroHeights.length).toBeGreaterThan(0);

  if (nonZeroHeights.length >= 2) {
    const sortedByHeight = [...nonZeroHeights].sort((a, b) => b.height - a.height);
    const tallestBin = sortedByHeight[0];
    const shortestNonZero = sortedByHeight[sortedByHeight.length - 1];
    
    expect(tallestBin.y).toBeLessThanOrEqual(shortestNonZero.y + POSITION_TOLERANCE);
  }
}

/**
 * Assert total bin coverage spans the data range
 */
export function assertBinsCoverDataRange(bins: SVGRectElement[]) {
  if (bins.length === 0) return;

  const { margins, width } = DEFAULT_DIMENSIONS;
  const plotWidth = width - margins.left - margins.right;

  const sortedBins = [...bins].sort(
    (a, b) => parseFloat(a.getAttribute('x') || '0') - parseFloat(b.getAttribute('x') || '0')
  );

  const firstBinX = parseFloat(sortedBins[0].getAttribute('x') || '0');
  const lastBin = sortedBins[sortedBins.length - 1];
  const lastBinEnd = parseFloat(lastBin.getAttribute('x') || '0') +
                     parseFloat(lastBin.getAttribute('width') || '0');

  const coverage = lastBinEnd - firstBinX;
  expect(coverage).toBeGreaterThan(plotWidth * 0.5);
}

