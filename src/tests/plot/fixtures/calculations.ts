/**
 * Plot Calculation Utilities
 *
 * Helper functions to calculate expected pixel positions, dimensions,
 * and counts for plot elements based on data values.
 *
 * Uses D3 directly to match exact behavior of plot rendering code.
 *
 * Used for precise assertions in integration tests.
 */

import * as d3 from 'd3';

// =============================================================================
// Types
// =============================================================================

export interface PlotDimensions {
  width: number;
  height: number;
  margins: { top: number; right: number; bottom: number; left: number };
}

export interface PointPosition {
  cx: number;
  cy: number;
}

export interface BarDimensions {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HistogramBinDimensions {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Domain {
  min: number;
  max: number;
}

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_DIMENSIONS: PlotDimensions = {
  width: 800,
  height: 600,
  margins: { top: 0, right: 15, bottom: 45, left: 55 },
};

// Axis padding used in actual plot code
export const AXIS_PADDING = 10;

export const POSITION_TOLERANCE = 5; // Pixels tolerance for position comparisons

// =============================================================================
// D3 Scale Creation (matches actual plot code)
// =============================================================================

/**
 * Create D3 scales that match the actual plot rendering code.
 * This is the single source of truth for position calculations.
 */
export function createD3Scales(
  xValues: number[],
  yValues: number[],
  scaleX: 'linear' | 'log',
  scaleY: 'linear' | 'log',
  dimensions: PlotDimensions = DEFAULT_DIMENSIONS
): {
  x: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>;
  y: d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number>;
  xDomain: [number, number];
  yDomain: [number, number];
} {
  const { width, height, margins } = dimensions;

  // Get extent (matching plot code)
  const [minX = 0, maxX = 0] = d3.extent(xValues) as [number, number];
  const [minY = 0, maxY = 0] = d3.extent(yValues) as [number, number];

  // Determine scale functions
  const xScaleFn = scaleX === 'log' ? d3.scaleLog : d3.scaleLinear;
  const yScaleFn = scaleY === 'log' ? d3.scaleLog : d3.scaleLinear;

  // Check if we need to reverse for negative log values
  const reverseX = scaleX === 'log' && xValues.every(v => v < 0);
  const reverseY = scaleY === 'log' && yValues.every(v => v < 0);

  // Calculate domains (matching reverseOrKeepDomain in axes.ts)
  const xDomain = reverseX
    ? [Math.max(...xValues.map(Math.abs)), Math.min(...xValues.map(Math.abs))] as [number, number]
    : [minX, maxX] as [number, number];

  const yDomain = reverseY
    ? [Math.max(...yValues.map(Math.abs)), Math.min(...yValues.map(Math.abs))] as [number, number]
    : [minY, maxY] as [number, number];

  // Calculate ranges (matching plot code with axisPadding)
  const xRange: [number, number] = [
    margins.left + AXIS_PADDING,
    width - margins.right - AXIS_PADDING,
  ];
  const yRange: [number, number] = [
    height - margins.bottom - AXIS_PADDING,
    margins.top + AXIS_PADDING,
  ];

  // Create scales
  const x = xScaleFn().domain(xDomain).range(xRange);
  const y = yScaleFn().domain(yDomain).range(yRange);

  return { x, y, xDomain, yDomain };
}

/**
 * Calculate expected position using actual D3 scales
 */
export function calculatePositionWithD3Scales(
  xValue: number,
  yValue: number,
  xValues: number[],
  yValues: number[],
  scaleX: 'linear' | 'log',
  scaleY: 'linear' | 'log',
  dimensions: PlotDimensions = DEFAULT_DIMENSIONS
): PointPosition {
  const { x, y } = createD3Scales(xValues, yValues, scaleX, scaleY, dimensions);
  return {
    cx: x(xValue),
    cy: y(yValue),
  };
}

// =============================================================================
// Domain Calculation (legacy - kept for backwards compatibility)
// =============================================================================

/**
 * Calculate the domain (min/max) from an array of values
 * D3 typically uses "nice" domains, so we apply a similar extension
 */
export function calculateDomain(
  values: number[],
  nice = true
): Domain {
  const validValues = values.filter(v => v !== null && v !== undefined && Number.isFinite(v));
  if (validValues.length === 0) {
    return { min: 0, max: 1 };
  }

  let min = Math.min(...validValues);
  let max = Math.max(...validValues);

  // Handle case where all values are the same
  if (min === max) {
    min = min - 1;
    max = max + 1;
  }

  if (nice) {
    // Approximate D3's nice() function
    const range = max - min;
    const step = Math.pow(10, Math.floor(Math.log10(range))) / 2;
    min = Math.floor(min / step) * step;
    max = Math.ceil(max / step) * step;
  }

  return { min, max };
}

/**
 * Calculate domain for log scale (must be positive)
 */
export function calculateLogDomain(values: number[]): Domain {
  const positiveValues = values.filter(v => v > 0 && Number.isFinite(v));
  if (positiveValues.length === 0) {
    return { min: 1, max: 10 };
  }

  const min = Math.min(...positiveValues);
  const max = Math.max(...positiveValues);

  // Use powers of 10 for nice log scale
  const logMin = Math.pow(10, Math.floor(Math.log10(min)));
  const logMax = Math.pow(10, Math.ceil(Math.log10(max)));

  return { min: logMin, max: logMax };
}

// =============================================================================
// Position Calculations
// =============================================================================

/**
 * Calculate expected X pixel position for a data value (linear scale)
 */
export function calculateLinearX(
  value: number,
  domain: Domain,
  dimensions: PlotDimensions = DEFAULT_DIMENSIONS
): number {
  const { width, margins } = dimensions;
  const plotWidth = width - margins.left - margins.right;

  const t = (value - domain.min) / (domain.max - domain.min);
  return margins.left + t * plotWidth;
}

/**
 * Calculate expected Y pixel position for a data value (linear scale)
 * Note: SVG Y-axis is inverted (0 at top)
 */
export function calculateLinearY(
  value: number,
  domain: Domain,
  dimensions: PlotDimensions = DEFAULT_DIMENSIONS
): number {
  const { height, margins } = dimensions;
  const plotHeight = height - margins.top - margins.bottom;

  const t = (value - domain.min) / (domain.max - domain.min);
  // Invert because SVG Y increases downward
  return height - margins.bottom - t * plotHeight;
}

/**
 * Calculate expected X pixel position for a data value (log scale)
 */
export function calculateLogX(
  value: number,
  domain: Domain,
  dimensions: PlotDimensions = DEFAULT_DIMENSIONS
): number {
  const { width, margins } = dimensions;
  const plotWidth = width - margins.left - margins.right;

  const safeValue = Math.max(value, 1e-10);
  const logMin = Math.log10(Math.max(domain.min, 1e-10));
  const logMax = Math.log10(domain.max);
  const logValue = Math.log10(safeValue);

  const t = (logValue - logMin) / (logMax - logMin);
  return margins.left + t * plotWidth;
}

/**
 * Calculate expected Y pixel position for a data value (log scale)
 */
export function calculateLogY(
  value: number,
  domain: Domain,
  dimensions: PlotDimensions = DEFAULT_DIMENSIONS
): number {
  const { height, margins } = dimensions;
  const plotHeight = height - margins.top - margins.bottom;

  const safeValue = Math.max(value, 1e-10);
  const logMin = Math.log10(Math.max(domain.min, 1e-10));
  const logMax = Math.log10(domain.max);
  const logValue = Math.log10(safeValue);

  const t = (logValue - logMin) / (logMax - logMin);
  return height - margins.bottom - t * plotHeight;
}

/**
 * Calculate expected position for a scatter point
 */
export function calculateScatterPointPosition(
  xValue: number,
  yValue: number,
  xDomain: Domain,
  yDomain: Domain,
  scaleX: 'linear' | 'log' = 'linear',
  scaleY: 'linear' | 'log' = 'linear',
  dimensions: PlotDimensions = DEFAULT_DIMENSIONS
): PointPosition {
  const cx = scaleX === 'log'
    ? calculateLogX(xValue, xDomain, dimensions)
    : calculateLinearX(xValue, xDomain, dimensions);

  const cy = scaleY === 'log'
    ? calculateLogY(yValue, yDomain, dimensions)
    : calculateLinearY(yValue, yDomain, dimensions);

  return { cx, cy };
}

// =============================================================================
// Bar Chart Calculations
// =============================================================================

/**
 * Calculate expected bar dimensions
 */
export function calculateBarDimensions(
  categoryIndex: number,
  totalCategories: number,
  value: number,
  yDomain: Domain,
  dimensions: PlotDimensions = DEFAULT_DIMENSIONS,
  barPaddingRatio = 0.1
): BarDimensions {
  const { width, height, margins } = dimensions;
  const plotWidth = width - margins.left - margins.right;
  const plotHeight = height - margins.top - margins.bottom;

  const slotWidth = plotWidth / totalCategories;
  const barWidth = slotWidth * (1 - barPaddingRatio * 2);
  const padding = slotWidth * barPaddingRatio;

  const x = margins.left + categoryIndex * slotWidth + padding;

  // Handle negative values
  const zeroY = calculateLinearY(0, yDomain, dimensions);
  const valueY = calculateLinearY(value, yDomain, dimensions);

  let y: number;
  let barHeight: number;

  if (value >= 0) {
    y = valueY;
    barHeight = zeroY - valueY;
  } else {
    y = zeroY;
    barHeight = valueY - zeroY;
  }

  return { x, y, width: barWidth, height: Math.abs(barHeight) };
}

/**
 * Calculate expected grouped bar dimensions
 */
export function calculateGroupedBarDimensions(
  categoryIndex: number,
  groupIndex: number,
  totalCategories: number,
  totalGroups: number,
  value: number,
  yDomain: Domain,
  dimensions: PlotDimensions = DEFAULT_DIMENSIONS
): BarDimensions {
  const { width, height, margins } = dimensions;
  const plotWidth = width - margins.left - margins.right;

  const slotWidth = plotWidth / totalCategories;
  const groupWidth = slotWidth / totalGroups;
  const barWidth = groupWidth * 0.8;
  const groupPadding = groupWidth * 0.1;

  const x = margins.left + categoryIndex * slotWidth + groupIndex * groupWidth + groupPadding;

  const zeroY = calculateLinearY(0, yDomain, dimensions);
  const valueY = calculateLinearY(value, yDomain, dimensions);

  const y = value >= 0 ? valueY : zeroY;
  const barHeight = Math.abs(zeroY - valueY);

  return { x, y, width: barWidth, height: barHeight };
}

// =============================================================================
// Histogram Calculations
// =============================================================================

/**
 * Calculate expected histogram bin dimensions
 */
export function calculateHistogramBinDimensions(
  binIndex: number,
  binStart: number,
  binEnd: number,
  count: number,
  maxCount: number,
  xDomain: Domain,
  dimensions: PlotDimensions = DEFAULT_DIMENSIONS
): HistogramBinDimensions {
  const { height, margins } = dimensions;
  const plotHeight = height - margins.top - margins.bottom;

  const x = calculateLinearX(binStart, xDomain, dimensions);
  const binWidth = calculateLinearX(binEnd, xDomain, dimensions) - x;

  const heightRatio = count / maxCount;
  const barHeight = heightRatio * plotHeight;
  const y = height - margins.bottom - barHeight;

  return { x, y, width: binWidth, height: barHeight };
}

// =============================================================================
// Count Calculations
// =============================================================================

/**
 * Calculate expected number of scatter points (excluding nulls)
 */
export function calculateExpectedPointCount(
  logs: Array<{ [key: string]: unknown }>,
  xField: string,
  yField: string
): number {
  return logs.filter(log => {
    const xValue = log[xField];
    const yValue = log[yField];
    return xValue !== null && xValue !== undefined &&
           yValue !== null && yValue !== undefined &&
           Number.isFinite(Number(xValue)) &&
           Number.isFinite(Number(yValue));
  }).length;
}

/**
 * Calculate expected point count when aggregation is applied.
 * When aggregate + group_by are set, we get one point per unique group.
 */
export function calculateExpectedAggregatedPointCount(
  logs: Array<{ [key: string]: unknown }>,
  groupByField: string,
  xField: string,
  yField: string
): number {
  const validLogs = logs.filter(log => {
    const xValue = log[xField];
    const yValue = log[yField];
    const groupValue = log[groupByField];
    return groupValue !== null && groupValue !== undefined &&
           xValue !== null && xValue !== undefined &&
           yValue !== null && yValue !== undefined;
  });

  const uniqueGroups = new Set(
    validLogs.map(log => String(log[groupByField]))
  );

  return uniqueGroups.size;
}

/**
 * Calculate expected number of bars (unique categories)
 */
export function calculateExpectedBarCount(
  logs: Array<{ [key: string]: unknown }>,
  categoryField: string
): number {
  const categories = new Set(
    logs
      .map(log => log[categoryField])
      .filter(v => v !== null && v !== undefined)
  );
  return categories.size;
}

/**
 * Calculate expected number of histogram bins
 * D3 may adjust bin count based on data distribution
 */
export function calculateExpectedBinCount(
  requestedBinCount: number,
  dataCount: number
): { min: number; max: number } {
  // D3 may create fewer bins if data doesn't span enough range
  // or more bins for certain threshold algorithms
  return {
    min: Math.max(1, Math.floor(requestedBinCount * 0.5)),
    max: Math.ceil(requestedBinCount * 1.5),
  };
}

// =============================================================================
// Assertion Helpers
// =============================================================================

/**
 * Check if two positions are approximately equal within tolerance
 */
export function positionsAreClose(
  actual: number,
  expected: number,
  tolerance: number = POSITION_TOLERANCE
): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

// =============================================================================
// Aggregate Calculations
// =============================================================================

export type AggregateType = 'sum' | 'mean' | 'count' | 'min' | 'max';

/**
 * Calculate aggregate value from an array of numbers.
 * Matches the computeStatistic function used in actual plot code.
 */
export function calculateAggregate(
  values: number[],
  aggregateType: AggregateType
): number {
  if (values.length === 0) return 0;

  switch (aggregateType) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'mean':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'count':
      return values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    default:
      return values.reduce((a, b) => a + b, 0); // Default to sum
  }
}

/**
 * Group data by category and calculate aggregate for each group.
 * Returns a map of category -> aggregated value.
 */
export function calculateGroupedAggregates(
  logs: Array<{ [key: string]: unknown }>,
  categoryField: string,
  valueField: string,
  aggregateType: AggregateType
): Map<string, number> {
  const groups = new Map<string, number[]>();

  // Group values by category
  for (const log of logs) {
    // Handle both flat and nested log structures
    const category = getNestedValue(log, categoryField);
    const value = getNestedValue(log, valueField);

    if (category === null || category === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;

    const catKey = String(category);
    if (!groups.has(catKey)) {
      groups.set(catKey, []);
    }
    groups.get(catKey)!.push(value);
  }

  // Calculate aggregate for each group
  const result = new Map<string, number>();
  groups.forEach((values, category) => {
    result.set(category, calculateAggregate(values, aggregateType));
  });

  return result;
}

/**
 * Helper to get nested value from log (handles 'table1.entries' structure)
 */
function getNestedValue(log: Record<string, unknown>, field: string): unknown {
  // Try direct access first
  if (field in log) {
    return log[field];
  }

  // Try table1.entries structure
  const entries = log['table1.entries'] as Record<string, unknown> | undefined;
  if (entries && field in entries) {
    return entries[field];
  }

  // Try without table prefix
  const shortField = field.replace(/^table1\./, '');
  if (entries && shortField in entries) {
    return entries[shortField];
  }

  return undefined;
}

/**
 * Extract numeric value from attribute, handling percentages
 */
export function parseAttributeValue(
  attr: string | null,
  containerSize?: number
): number | null {
  if (attr === null) return null;

  if (attr.endsWith('%') && containerSize !== undefined) {
    return (parseFloat(attr) / 100) * containerSize;
  }

  return parseFloat(attr);
}

/**
 * Validate that a point is within the plot area
 */
export function isWithinPlotArea(
  cx: number,
  cy: number,
  dimensions: PlotDimensions = DEFAULT_DIMENSIONS
): boolean {
  const { width, height, margins } = dimensions;

  return (
    cx >= margins.left &&
    cx <= width - margins.right &&
    cy >= margins.top &&
    cy <= height - margins.bottom
  );
}


