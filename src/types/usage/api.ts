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
  time_minute: 'Minutely',
  time_hour: 'Hourly',
  time_day: 'Daily',
  time_month: 'Monthly',
  time_year: 'Yearly',
};

/**
 * Timeseries response format from the credit ledger spending endpoint.
 * Keys are timestamp strings, values contain the aggregated sum.
 */
export interface UsageMetricsResponse {
  [timestamp: string]: { sum: number };
}
