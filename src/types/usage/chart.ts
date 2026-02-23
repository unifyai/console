/**
 * Usage Chart Types
 *
 * Types for the usage chart data and summary statistics.
 */

/**
 * A single data point for the usage chart.
 */
export interface UsageDataPoint {
  /** Timestamp string (format depends on granularity) */
  timestamp: string;
  /** Billed cost in credits/dollars */
  billedCost: number;
}

/**
 * Summary statistics computed from usage data.
 */
export interface UsageSummary {
  /** Total billed cost across all time buckets */
  total: number;
  /** Average cost per time bucket */
  average: number;
  /** Maximum cost in any single time bucket */
  peak: number;
  /** Timestamp of the peak usage (null if no data) */
  peakTimestamp: string | null;
}

/**
 * Empty summary for when there's no data
 */
export const EMPTY_SUMMARY: UsageSummary = {
  total: 0,
  average: 0,
  peak: 0,
  peakTimestamp: null,
};

/**
 * Chart configuration options
 */
export interface UsageChartConfig {
  /** Label for X axis */
  xAxisLabel: string;
  /** Label for Y axis */
  yAxisLabel: string;
  /** Whether to show the chart (false if no data) */
  showChart: boolean;
  /** Message to display when no data */
  emptyMessage?: string;
}

/**
 * Pre-aggregated bar data format for PlotCanvas
 * Matches the DataLabel type expected by PlotCanvas: [string, number]
 */
export type UsageBarData = [string, number];
