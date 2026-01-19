/**
 * Data Transforms Tests
 *
 * Tests for transforming API responses to chart-ready format.
 */

import { describe, it, expect } from 'vitest';
import {
  transformMetricsResponse,
  calculateSummary,
  transformToBarData,
  fillMissingBuckets,
  generateEmptyBuckets,
  generateTimeBuckets,
  aggregateByGranularity,
} from '@/lib/usage/transforms';
import {
  SAMPLE_WEEK_RESPONSE,
  SAMPLE_HOURLY_RESPONSE,
  createMockMetricsResponse,
  createMockUsageData,
} from '@/tests/usage/mocks/data';
import { UsageDataPoint, EMPTY_SUMMARY } from '@/types/usage';

describe('transforms', () => {
  describe('transformMetricsResponse', () => {
    it('transforms a valid metrics response to data points', () => {
      const result = transformMetricsResponse(SAMPLE_WEEK_RESPONSE);

      expect(result).toHaveLength(7);
      expect(result[0]).toEqual({
        timestamp: '2026-01-13',
        billedCost: 1.25,
      });
    });

    it('sorts data points by timestamp ascending', () => {
      const unsortedResponse = {
        '2026-01-15': { sum: 2.0 },
        '2026-01-13': { sum: 1.0 },
        '2026-01-14': { sum: 1.5 },
      };

      const result = transformMetricsResponse(unsortedResponse);

      expect(result[0].timestamp).toBe('2026-01-13');
      expect(result[1].timestamp).toBe('2026-01-14');
      expect(result[2].timestamp).toBe('2026-01-15');
    });

    it('handles empty response', () => {
      const result = transformMetricsResponse({});
      expect(result).toEqual([]);
    });

    it('handles null/undefined response', () => {
      expect(transformMetricsResponse(null as any)).toEqual([]);
      expect(transformMetricsResponse(undefined as any)).toEqual([]);
    });

    it('filters out invalid entries', () => {
      const response = {
        '2026-01-13': { sum: 1.0 },
        '2026-01-14': { sum: null as any },
        '2026-01-15': { sum: 2.0 },
        '2026-01-16': null as any,
      };

      const result = transformMetricsResponse(response);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.timestamp)).toEqual(['2026-01-13', '2026-01-15']);
    });

    it('handles hourly timestamps', () => {
      const result = transformMetricsResponse(SAMPLE_HOURLY_RESPONSE);

      expect(result).toHaveLength(5);
      expect(result[0].timestamp).toContain('00:00:00');
    });
  });

  describe('calculateSummary', () => {
    it('calculates correct summary for sample data', () => {
      const data = transformMetricsResponse(SAMPLE_WEEK_RESPONSE);
      const summary = calculateSummary(data);

      expect(summary.total).toBeCloseTo(12.25, 2);
      expect(summary.average).toBeCloseTo(1.75, 2);
      expect(summary.peak).toBe(3.0);
      expect(summary.peakTimestamp).toBe('2026-01-16');
    });

    it('returns empty summary for empty data', () => {
      const summary = calculateSummary([]);
      expect(summary).toEqual(EMPTY_SUMMARY);
    });

    it('returns empty summary for null/undefined', () => {
      expect(calculateSummary(null as any)).toEqual(EMPTY_SUMMARY);
      expect(calculateSummary(undefined as any)).toEqual(EMPTY_SUMMARY);
    });

    it('handles single data point', () => {
      const data: UsageDataPoint[] = [{ timestamp: '2026-01-15', billedCost: 5.0 }];
      const summary = calculateSummary(data);

      expect(summary.total).toBe(5.0);
      expect(summary.average).toBe(5.0);
      expect(summary.peak).toBe(5.0);
      expect(summary.peakTimestamp).toBe('2026-01-15');
    });

    it('handles data with zero values', () => {
      const data: UsageDataPoint[] = [
        { timestamp: '2026-01-13', billedCost: 0 },
        { timestamp: '2026-01-14', billedCost: 2.0 },
        { timestamp: '2026-01-15', billedCost: 0 },
      ];
      const summary = calculateSummary(data);

      expect(summary.total).toBe(2.0);
      expect(summary.average).toBeCloseTo(0.667, 2);
      expect(summary.peak).toBe(2.0);
    });

    it('handles all zeros', () => {
      const data: UsageDataPoint[] = [
        { timestamp: '2026-01-13', billedCost: 0 },
        { timestamp: '2026-01-14', billedCost: 0 },
      ];
      const summary = calculateSummary(data);

      expect(summary.total).toBe(0);
      expect(summary.average).toBe(0);
      expect(summary.peak).toBe(0);
    });
  });

  describe('transformToBarData', () => {
    it('transforms data points to bar data format', () => {
      const data: UsageDataPoint[] = [
        { timestamp: '2026-01-13', billedCost: 1.5 },
        { timestamp: '2026-01-14', billedCost: 2.5 },
      ];

      const result = transformToBarData(data);

      // PlotCanvas expects [string, number] tuples
      expect(result).toEqual([
        ['2026-01-13', 1.5],
        ['2026-01-14', 2.5],
      ]);
    });

    it('handles empty data', () => {
      expect(transformToBarData([])).toEqual([]);
    });

    it('preserves order', () => {
      const data: UsageDataPoint[] = [
        { timestamp: 'a', billedCost: 1 },
        { timestamp: 'b', billedCost: 2 },
        { timestamp: 'c', billedCost: 3 },
      ];

      const result = transformToBarData(data);

      // First element of each tuple is the timestamp
      expect(result.map((r) => r[0])).toEqual(['a', 'b', 'c']);
    });
  });

  describe('generateTimeBuckets', () => {
    it('generates daily buckets', () => {
      const buckets = generateTimeBuckets('2026-01-15', '2026-01-17', 'time_day');

      expect(buckets).toEqual(['2026-01-15', '2026-01-16', '2026-01-17']);
    });

    it('generates monthly buckets', () => {
      const buckets = generateTimeBuckets('2026-01-01', '2026-03-01', 'time_month');

      expect(buckets).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
    });

    it('generates yearly buckets', () => {
      const buckets = generateTimeBuckets('2024-01-01', '2026-01-01', 'time_year');

      expect(buckets).toEqual(['2024-01-01', '2025-01-01', '2026-01-01']);
    });

    it('handles single day range', () => {
      const buckets = generateTimeBuckets('2026-01-15', '2026-01-15', 'time_day');

      expect(buckets).toEqual(['2026-01-15']);
    });

    it('generates hourly buckets for a day', () => {
      const buckets = generateTimeBuckets('2026-01-15', '2026-01-15', 'time_hour');

      // Should have 24 hours
      expect(buckets.length).toBe(24);
      expect(buckets[0]).toContain('T00:00:00');
      expect(buckets[23]).toContain('T23:00:00');
    });
  });

  describe('generateEmptyBuckets', () => {
    it('generates empty data points for date range', () => {
      const result = generateEmptyBuckets('2026-01-15', '2026-01-17', 'time_day');

      expect(result).toHaveLength(3);
      expect(result.every((p) => p.billedCost === 0)).toBe(true);
    });

    it('preserves timestamp format', () => {
      const result = generateEmptyBuckets('2026-01-15', '2026-01-15', 'time_day');

      expect(result[0].timestamp).toBe('2026-01-15');
    });
  });

  describe('fillMissingBuckets', () => {
    it('fills gaps with zero values', () => {
      const data: UsageDataPoint[] = [
        { timestamp: '2026-01-15', billedCost: 1.0 },
        { timestamp: '2026-01-17', billedCost: 2.0 },
      ];

      const result = fillMissingBuckets(data, '2026-01-15', '2026-01-17', 'time_day');

      expect(result).toHaveLength(3);
      expect(result[1].billedCost).toBe(0);
    });

    it('preserves existing values', () => {
      const data: UsageDataPoint[] = [
        { timestamp: '2026-01-15', billedCost: 1.5 },
        { timestamp: '2026-01-16', billedCost: 2.5 },
      ];

      const result = fillMissingBuckets(data, '2026-01-15', '2026-01-16', 'time_day');

      expect(result[0].billedCost).toBe(1.5);
      expect(result[1].billedCost).toBe(2.5);
    });

    it('returns empty buckets for empty data', () => {
      const result = fillMissingBuckets([], '2026-01-15', '2026-01-17', 'time_day');

      expect(result).toHaveLength(3);
      expect(result.every((p) => p.billedCost === 0)).toBe(true);
    });
  });

  describe('aggregateByGranularity', () => {
    it('aggregates hourly data to daily', () => {
      const hourlyData: UsageDataPoint[] = [
        { timestamp: '2026-01-15T10:00:00', billedCost: 1.0 },
        { timestamp: '2026-01-15T11:00:00', billedCost: 2.0 },
        { timestamp: '2026-01-15T12:00:00', billedCost: 3.0 },
        { timestamp: '2026-01-16T10:00:00', billedCost: 1.5 },
      ];

      const result = aggregateByGranularity(hourlyData, 'time_day');

      expect(result).toHaveLength(2);
      expect(result[0].billedCost).toBe(6.0); // Sum of Jan 15
      expect(result[1].billedCost).toBe(1.5); // Jan 16
    });

    it('aggregates daily data to monthly', () => {
      const dailyData: UsageDataPoint[] = [
        { timestamp: '2026-01-15', billedCost: 1.0 },
        { timestamp: '2026-01-20', billedCost: 2.0 },
        { timestamp: '2026-02-10', billedCost: 3.0 },
      ];

      const result = aggregateByGranularity(dailyData, 'time_month');

      expect(result).toHaveLength(2);
      expect(result[0].billedCost).toBe(3.0); // Sum of Jan
      expect(result[1].billedCost).toBe(3.0); // Feb
    });

    it('handles empty data', () => {
      const result = aggregateByGranularity([], 'time_day');
      expect(result).toEqual([]);
    });

    it('sorts results by timestamp', () => {
      const data: UsageDataPoint[] = [
        { timestamp: '2026-03-01', billedCost: 3.0 },
        { timestamp: '2026-01-01', billedCost: 1.0 },
        { timestamp: '2026-02-01', billedCost: 2.0 },
      ];

      const result = aggregateByGranularity(data, 'time_month');

      expect(result[0].timestamp).toContain('2026-01');
      expect(result[1].timestamp).toContain('2026-02');
      expect(result[2].timestamp).toContain('2026-03');
    });
  });

  describe('mock data generators', () => {
    it('createMockMetricsResponse generates correct count', () => {
      const response = createMockMetricsResponse({
        count: 10,
        startDate: '2026-01-01',
        granularity: 'time_day',
      });

      expect(Object.keys(response)).toHaveLength(10);
    });

    it('createMockUsageData generates correct count', () => {
      const data = createMockUsageData({
        count: 10,
        startDate: '2026-01-01',
        granularity: 'time_day',
      });

      expect(data).toHaveLength(10);
    });

    it('generates reproducible data with same seed', () => {
      const data1 = createMockUsageData({
        count: 5,
        startDate: '2026-01-01',
        granularity: 'time_day',
        seed: 123,
      });

      const data2 = createMockUsageData({
        count: 5,
        startDate: '2026-01-01',
        granularity: 'time_day',
        seed: 123,
      });

      expect(data1).toEqual(data2);
    });

    it('generates different data with different seeds', () => {
      const data1 = createMockUsageData({
        count: 5,
        startDate: '2026-01-01',
        granularity: 'time_day',
        seed: 123,
      });

      const data2 = createMockUsageData({
        count: 5,
        startDate: '2026-01-01',
        granularity: 'time_day',
        seed: 456,
      });

      expect(data1[0].billedCost).not.toBe(data2[0].billedCost);
    });

    it('respects min/max cost bounds', () => {
      const data = createMockUsageData({
        count: 100,
        startDate: '2026-01-01',
        granularity: 'time_day',
        minCost: 5.0,
        maxCost: 10.0,
        includeZeros: false,
      });

      for (const point of data) {
        expect(point.billedCost).toBeGreaterThanOrEqual(5.0);
        expect(point.billedCost).toBeLessThanOrEqual(10.0);
      }
    });
  });
});
