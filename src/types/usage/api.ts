/**
 * Usage API Types
 */

/**
 * Time granularity options for grouping usage data.
 */
export type TimeGranularity = 'minute' | 'hour' | 'day' | 'month' | 'year';

/**
 * Human-readable labels for granularity options
 */
export const GRANULARITY_LABELS: Record<TimeGranularity, string> = {
  minute: 'Minutely',
  hour: 'Hourly',
  day: 'Daily',
  month: 'Monthly',
  year: 'Yearly',
};

/**
 * Timeseries response format from the credit ledger spending endpoint.
 * Keys are timestamp strings, values contain the aggregated sum.
 */
export interface UsageMetricsResponse {
  [timestamp: string]: { sum: number };
}
