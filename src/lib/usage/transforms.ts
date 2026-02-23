/**
 * Data Transform Utilities for Usage Page
 *
 * Pure functions for transforming API responses to chart-ready format.
 */

import {
  UsageMetricsResponse,
  UsageDataPoint,
  UsageSummary,
  EMPTY_SUMMARY,
  UsageBarData,
  TimeGranularity,
} from '@/types/usage';

/**
 * Transform the raw metrics API response to an array of data points.
 * Sorts the data by timestamp ascending.
 * Filters out entries with null, undefined, or empty timestamps.
 *
 * @param response Raw response from the metrics API
 * @returns Array of usage data points sorted by timestamp
 */
export function transformMetricsResponse(response: UsageMetricsResponse): UsageDataPoint[] {
  if (!response || typeof response !== 'object') {
    return [];
  }

  const dataPoints: UsageDataPoint[] = Object.entries(response)
    .filter(([timestamp, value]) => {
      // Filter out null, undefined, empty, or invalid timestamps
      if (!timestamp || timestamp === 'null' || timestamp === 'undefined') {
        return false;
      }
      // Ensure value has a valid sum
      if (!value || typeof value.sum !== 'number') {
        return false;
      }
      // Validate the timestamp can be parsed as a date
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return false;
      }
      return true;
    })
    .map(([timestamp, value]) => ({
      timestamp,
      billedCost: value.sum,
    }));

  // Sort by timestamp ascending
  return dataPoints.sort((a, b) => {
    const dateA = new Date(a.timestamp);
    const dateB = new Date(b.timestamp);
    return dateA.getTime() - dateB.getTime();
  });
}

/**
 * Calculate summary statistics from usage data.
 *
 * @param data Array of usage data points
 * @returns Summary with total, average, peak, and peak timestamp
 */
export function calculateSummary(data: UsageDataPoint[]): UsageSummary {
  if (!data || data.length === 0) {
    return EMPTY_SUMMARY;
  }

  let total = 0;
  let peak = -Infinity;
  let peakTimestamp: string | null = null;

  for (const point of data) {
    total += point.billedCost;
    if (point.billedCost > peak) {
      peak = point.billedCost;
      peakTimestamp = point.timestamp;
    }
  }

  // Handle edge case where all values might be negative or zero
  if (peak === -Infinity) {
    peak = 0;
    peakTimestamp = null;
  }

  const average = total / data.length;

  return {
    total,
    average,
    peak,
    peakTimestamp,
  };
}

/**
 * Transform usage data points to the format expected by PlotCanvas.
 * PlotCanvas expects DataLabel tuples: [string, number]
 *
 * @param data Array of usage data points
 * @returns Array of bar data for PlotCanvas
 */
export function transformToBarData(data: UsageDataPoint[]): UsageBarData[] {
  return data.map((point): UsageBarData => [point.timestamp, point.billedCost]);
}

/**
 * Fill in missing time buckets with zero values.
 * Useful for ensuring the chart shows all time periods even if no data.
 *
 * @param data Existing data points
 * @param startDate Start date of the range
 * @param endDate End date of the range
 * @param granularity Time granularity
 * @returns Data points with missing buckets filled in
 */
export function fillMissingBuckets(
  data: UsageDataPoint[],
  startDate: string,
  endDate: string,
  granularity: TimeGranularity
): UsageDataPoint[] {
  if (!data || data.length === 0) {
    return generateEmptyBuckets(startDate, endDate, granularity);
  }

  // Create a map of existing data
  const existingData = new Map<string, number>();
  for (const point of data) {
    existingData.set(normalizeTimestamp(point.timestamp, granularity), point.billedCost);
  }

  // Generate all buckets and fill in values
  const allBuckets = generateTimeBuckets(startDate, endDate, granularity);

  return allBuckets.map((timestamp) => ({
    timestamp,
    billedCost: existingData.get(timestamp) ?? 0,
  }));
}

/**
 * Generate empty data points for a date range.
 *
 * @param startDate Start date in ISO format
 * @param endDate End date in ISO format
 * @param granularity Time granularity
 * @returns Array of data points with zero values
 */
export function generateEmptyBuckets(
  startDate: string,
  endDate: string,
  granularity: TimeGranularity
): UsageDataPoint[] {
  const buckets = generateTimeBuckets(startDate, endDate, granularity);
  return buckets.map((timestamp) => ({
    timestamp,
    billedCost: 0,
  }));
}

/**
 * Generate time bucket timestamps for a date range.
 *
 * @param startDate Start date in ISO format
 * @param endDate End date in ISO format
 * @param granularity Time granularity
 * @returns Array of timestamp strings
 */
export function generateTimeBuckets(
  startDate: string,
  endDate: string,
  granularity: TimeGranularity
): string[] {
  const buckets: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Set end to end of day for inclusive range
  end.setHours(23, 59, 59, 999);

  let current = new Date(start);

  // Limit iterations to prevent infinite loops
  const maxIterations = 10000;
  let iterations = 0;

  while (current <= end && iterations < maxIterations) {
    buckets.push(formatBucketTimestamp(current, granularity));
    current = incrementBucket(current, granularity);
    iterations++;
  }

  return buckets;
}

/**
 * Normalize a timestamp to its bucket representation.
 *
 * @param timestamp Timestamp string
 * @param granularity Time granularity
 * @returns Normalized timestamp string
 */
function normalizeTimestamp(timestamp: string, granularity: TimeGranularity): string {
  const date = new Date(timestamp);
  return formatBucketTimestamp(date, granularity);
}

/**
 * Format a date as a bucket timestamp.
 *
 * @param date Date to format
 * @param granularity Time granularity
 * @returns Formatted timestamp string
 */
function formatBucketTimestamp(date: Date, granularity: TimeGranularity): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  switch (granularity) {
    case 'time_minute':
      return `${year}-${month}-${day}T${hours}:${minutes}:00`;
    case 'time_hour':
      return `${year}-${month}-${day}T${hours}:00:00`;
    case 'time_day':
      return `${year}-${month}-${day}`;
    case 'time_month':
      return `${year}-${month}-01`;
    case 'time_year':
      return `${year}-01-01`;
    default:
      return `${year}-${month}-${day}`;
  }
}

/**
 * Increment a date by one time bucket.
 *
 * @param date Date to increment
 * @param granularity Time granularity
 * @returns New date incremented by one bucket
 */
function incrementBucket(date: Date, granularity: TimeGranularity): Date {
  const result = new Date(date);

  switch (granularity) {
    case 'time_minute':
      result.setMinutes(result.getMinutes() + 1);
      break;
    case 'time_hour':
      result.setHours(result.getHours() + 1);
      break;
    case 'time_day':
      result.setDate(result.getDate() + 1);
      break;
    case 'time_month':
      result.setMonth(result.getMonth() + 1);
      break;
    case 'time_year':
      result.setFullYear(result.getFullYear() + 1);
      break;
  }

  return result;
}

/**
 * Aggregate data points by a different granularity.
 * Useful for rolling up minute data to hour, etc.
 *
 * @param data Array of data points
 * @param targetGranularity Target granularity to aggregate to
 * @returns Aggregated data points
 */
export function aggregateByGranularity(
  data: UsageDataPoint[],
  targetGranularity: TimeGranularity
): UsageDataPoint[] {
  if (!data || data.length === 0) {
    return [];
  }

  const aggregated = new Map<string, number>();

  for (const point of data) {
    const bucket = normalizeTimestamp(point.timestamp, targetGranularity);
    const existing = aggregated.get(bucket) ?? 0;
    aggregated.set(bucket, existing + point.billedCost);
  }

  const result: UsageDataPoint[] = Array.from(aggregated.entries()).map(
    ([timestamp, billedCost]) => ({ timestamp, billedCost })
  );

  // Sort by timestamp
  return result.sort((a, b) => {
    const dateA = new Date(a.timestamp);
    const dateB = new Date(b.timestamp);
    return dateA.getTime() - dateB.getTime();
  });
}
