/**
 * Usage API Types
 *
 * Types for the Orchestra metrics API used to fetch billed_cost data.
 */

/**
 * Time granularity options for grouping usage data.
 * Maps to derived time columns in Unity LLM event logs.
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
 * Request parameters for the usage metrics API.
 */
export interface UsageMetricsRequest {
  /** Project name (always 'Assistants' for usage page) */
  projectName: string;
  /** Context path for the logs (e.g., '{UserName}/All/Events/LLM') */
  context: string;
  /** The metric key to aggregate (always 'billed_cost') */
  key: 'billed_cost';
  /** Time column to group by */
  groupBy: TimeGranularity;
  /** Filter expression for date range */
  filterExpr: string;
}

/**
 * Raw response format from Orchestra /v0/logs/metric/sum endpoint.
 * Keys are timestamp strings, values contain the aggregated sum.
 */
export interface UsageMetricsResponse {
  [timestamp: string]: { sum: number };
}

/**
 * Error response from the API
 */
export interface UsageApiError {
  detail: string;
}

/**
 * Union type for API responses
 */
export type UsageApiResult = UsageMetricsResponse | UsageApiError;

/**
 * Type guard to check if response is an error
 */
export function isUsageApiError(result: UsageApiResult): result is UsageApiError {
  return result !== null && typeof result === 'object' && 'detail' in result;
}
