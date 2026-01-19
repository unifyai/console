/**
 * useUsageSummary Hook Tests
 *
 * Tests for the summary statistics computation hook.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUsageSummary } from '@/hooks/Usage/useUsageSummary';
import { UsageDataPoint, EMPTY_SUMMARY } from '@/types/usage';
import { createMockUsageData, SAMPLE_WEEK_RESPONSE } from '@/tests/usage/mocks/data';
import { transformMetricsResponse } from '@/lib/usage/transforms';

describe('useUsageSummary', () => {
  describe('with valid data', () => {
    it('computes correct summary for sample week data', () => {
      const data = transformMetricsResponse(SAMPLE_WEEK_RESPONSE);

      const { result } = renderHook(() => useUsageSummary({ data }));

      expect(result.current.hasData).toBe(true);
      expect(result.current.dataPointCount).toBe(7);
      expect(result.current.summary.total).toBeCloseTo(12.25, 2);
      expect(result.current.summary.average).toBeCloseTo(1.75, 2);
      expect(result.current.summary.peak).toBe(3.0);
      expect(result.current.summary.peakTimestamp).toBe('2026-01-16');
    });

    it('computes correct summary for generated data', () => {
      const data = createMockUsageData({
        count: 10,
        startDate: '2026-01-01',
        granularity: 'time_day',
        minCost: 1.0,
        maxCost: 5.0,
        seed: 42,
      });

      const { result } = renderHook(() => useUsageSummary({ data }));

      expect(result.current.hasData).toBe(true);
      expect(result.current.dataPointCount).toBe(10);
      expect(result.current.summary.total).toBeGreaterThan(0);
      expect(result.current.summary.average).toBeGreaterThan(0);
      expect(result.current.summary.peak).toBeGreaterThanOrEqual(result.current.summary.average);
    });

    it('handles single data point', () => {
      const data: UsageDataPoint[] = [{ timestamp: '2026-01-15', billedCost: 5.0 }];

      const { result } = renderHook(() => useUsageSummary({ data }));

      expect(result.current.hasData).toBe(true);
      expect(result.current.dataPointCount).toBe(1);
      expect(result.current.summary.total).toBe(5.0);
      expect(result.current.summary.average).toBe(5.0);
      expect(result.current.summary.peak).toBe(5.0);
      expect(result.current.summary.peakTimestamp).toBe('2026-01-15');
    });

    it('handles data with zero values', () => {
      const data: UsageDataPoint[] = [
        { timestamp: '2026-01-13', billedCost: 0 },
        { timestamp: '2026-01-14', billedCost: 2.0 },
        { timestamp: '2026-01-15', billedCost: 0 },
      ];

      const { result } = renderHook(() => useUsageSummary({ data }));

      expect(result.current.hasData).toBe(true);
      expect(result.current.summary.total).toBe(2.0);
      expect(result.current.summary.average).toBeCloseTo(0.667, 2);
      expect(result.current.summary.peak).toBe(2.0);
    });

    it('handles all zero values', () => {
      const data: UsageDataPoint[] = [
        { timestamp: '2026-01-13', billedCost: 0 },
        { timestamp: '2026-01-14', billedCost: 0 },
        { timestamp: '2026-01-15', billedCost: 0 },
      ];

      const { result } = renderHook(() => useUsageSummary({ data }));

      expect(result.current.hasData).toBe(true);
      expect(result.current.summary.total).toBe(0);
      expect(result.current.summary.average).toBe(0);
      expect(result.current.summary.peak).toBe(0);
    });

    it('identifies correct peak timestamp', () => {
      const data: UsageDataPoint[] = [
        { timestamp: '2026-01-13', billedCost: 1.0 },
        { timestamp: '2026-01-14', billedCost: 5.0 },
        { timestamp: '2026-01-15', billedCost: 3.0 },
        { timestamp: '2026-01-16', billedCost: 2.0 },
      ];

      const { result } = renderHook(() => useUsageSummary({ data }));

      expect(result.current.summary.peakTimestamp).toBe('2026-01-14');
      expect(result.current.summary.peak).toBe(5.0);
    });
  });

  describe('with empty or invalid data', () => {
    it('returns empty summary for empty array', () => {
      const { result } = renderHook(() => useUsageSummary({ data: [] }));

      expect(result.current.hasData).toBe(false);
      expect(result.current.dataPointCount).toBe(0);
      expect(result.current.summary).toEqual(EMPTY_SUMMARY);
    });

    it('returns consistent results for multiple empty array renders', () => {
      const { result, rerender } = renderHook(() => useUsageSummary({ data: [] }));

      expect(result.current.hasData).toBe(false);
      rerender();
      expect(result.current.hasData).toBe(false);
      expect(result.current.summary).toEqual(EMPTY_SUMMARY);
    });
  });

  describe('memoization', () => {
    it('returns same summary reference for same data', () => {
      const data: UsageDataPoint[] = [{ timestamp: '2026-01-15', billedCost: 5.0 }];

      const { result, rerender } = renderHook(() => useUsageSummary({ data }));

      const firstSummary = result.current.summary;
      rerender();
      const secondSummary = result.current.summary;

      expect(firstSummary).toBe(secondSummary);
    });

    it('recomputes when data changes', () => {
      let data: UsageDataPoint[] = [{ timestamp: '2026-01-15', billedCost: 5.0 }];

      const { result, rerender } = renderHook(({ data }) => useUsageSummary({ data }), {
        initialProps: { data },
      });

      expect(result.current.summary.total).toBe(5.0);

      data = [{ timestamp: '2026-01-15', billedCost: 10.0 }];
      rerender({ data });

      expect(result.current.summary.total).toBe(10.0);
    });
  });

  describe('edge cases', () => {
    it('handles very small values', () => {
      const data: UsageDataPoint[] = [
        { timestamp: '2026-01-13', billedCost: 0.0001 },
        { timestamp: '2026-01-14', billedCost: 0.0002 },
        { timestamp: '2026-01-15', billedCost: 0.0003 },
      ];

      const { result } = renderHook(() => useUsageSummary({ data }));

      expect(result.current.summary.total).toBeCloseTo(0.0006, 6);
      expect(result.current.summary.average).toBeCloseTo(0.0002, 6);
      expect(result.current.summary.peak).toBe(0.0003);
    });

    it('handles large values', () => {
      const data: UsageDataPoint[] = [
        { timestamp: '2026-01-13', billedCost: 1000000 },
        { timestamp: '2026-01-14', billedCost: 2000000 },
        { timestamp: '2026-01-15', billedCost: 3000000 },
      ];

      const { result } = renderHook(() => useUsageSummary({ data }));

      expect(result.current.summary.total).toBe(6000000);
      expect(result.current.summary.average).toBe(2000000);
      expect(result.current.summary.peak).toBe(3000000);
    });

    it('handles mixed positive values correctly', () => {
      const data: UsageDataPoint[] = [
        { timestamp: '2026-01-13', billedCost: 100 },
        { timestamp: '2026-01-14', billedCost: 0.01 },
        { timestamp: '2026-01-15', billedCost: 50.5 },
      ];

      const { result } = renderHook(() => useUsageSummary({ data }));

      expect(result.current.summary.total).toBeCloseTo(150.51, 2);
      expect(result.current.summary.average).toBeCloseTo(50.17, 2);
      expect(result.current.summary.peak).toBe(100);
    });
  });
});
