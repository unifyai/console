/**
 * Data Transform Utilities for Usage Page
 *
 * Pure functions for transforming API responses to chart-ready format.
 */

import { UsageMetricsResponse, UsageDataPoint } from '@/types/usage';

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
