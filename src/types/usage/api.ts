/**
 * Usage API Types
 */

/**
 * Time granularity options for grouping usage data.
 */
export type TimeGranularity = 'time_minute' | 'time_hour' | 'time_day' | 'time_month' | 'time_year';

/**
 * Human-readable labels for granularity options
 */
export const GRANULARITY_LABELS: Record<TimeGranularity, string> = {
  time_minute: 'Minute',
  time_hour: 'Hour',
  time_day: 'Day',
  time_month: 'Month',
  time_year: 'Year',
};

/**
 * Timeseries response format from the credit ledger spending endpoint.
 * Keys are timestamp strings, values contain the aggregated sum.
 */
export interface UsageMetricsResponse {
  [timestamp: string]: { sum: number };
}
