/**
 * useUsageChartConfig Hook Tests
 *
 * Tests for the chart configuration building hook.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUsageChartConfig } from '@/hooks/Usage/useUsageChartConfig';
import { UsageDataPoint } from '@/types/usage';
import { createMockUsageData, SAMPLE_WEEK_RESPONSE } from '@/tests/usage/mocks/data';
import { transformMetricsResponse } from '@/lib/usage/transforms';

describe('useUsageChartConfig', () => {
  describe('barData transformation', () => {
    it('transforms data to bar chart format', () => {
      const data = transformMetricsResponse(SAMPLE_WEEK_RESPONSE);

      const { result } = renderHook(() => useUsageChartConfig({ data, granularity: 'time_day' }));

      expect(result.current.barData).toHaveLength(7);
      // barData is [string, number] tuples
      expect(Array.isArray(result.current.barData[0])).toBe(true);
      expect(result.current.barData[0]).toHaveLength(2);
    });

    it('preserves data values in transformation', () => {
      const data: UsageDataPoint[] = [
        { timestamp: '2026-01-15', billedCost: 1.5 },
        { timestamp: '2026-01-16', billedCost: 2.5 },
      ];

      const { result } = renderHook(() => useUsageChartConfig({ data, granularity: 'time_day' }));

      // barData is [string, number] tuples
      expect(result.current.barData[0][1]).toBe(1.5);
      expect(result.current.barData[1][1]).toBe(2.5);
    });

    it('returns empty array for empty data', () => {
      const { result } = renderHook(() =>
        useUsageChartConfig({ data: [], granularity: 'time_day' })
      );

      expect(result.current.barData).toEqual([]);
    });
  });

  describe('fields object', () => {
    it('provides required fields for PlotCanvas', () => {
      const data = transformMetricsResponse(SAMPLE_WEEK_RESPONSE);

      const { result } = renderHook(() => useUsageChartConfig({ data, granularity: 'time_day' }));

      expect(result.current.fields).toHaveProperty('timestamp');
      expect(result.current.fields).toHaveProperty('billed_cost');
    });

    it('has correct data types for fields', () => {
      const data: UsageDataPoint[] = [{ timestamp: '2026-01-15', billedCost: 1.0 }];

      const { result } = renderHook(() => useUsageChartConfig({ data, granularity: 'time_day' }));

      expect(result.current.fields.timestamp.dataType).toBe('datetime');
      expect(result.current.fields.billed_cost.dataType).toBe('float');
    });
  });

  describe('config object', () => {
    it('shows chart when data is present', () => {
      const data = transformMetricsResponse(SAMPLE_WEEK_RESPONSE);

      const { result } = renderHook(() => useUsageChartConfig({ data, granularity: 'time_day' }));

      expect(result.current.config.showChart).toBe(true);
      expect(result.current.config.emptyMessage).toBeUndefined();
    });

    it('hides chart when data is empty', () => {
      const { result } = renderHook(() =>
        useUsageChartConfig({ data: [], granularity: 'time_day' })
      );

      expect(result.current.config.showChart).toBe(false);
      expect(result.current.config.emptyMessage).toBeDefined();
    });

    it('sets correct axis labels for daily granularity', () => {
      const data: UsageDataPoint[] = [{ timestamp: '2026-01-15', billedCost: 1.0 }];

      const { result } = renderHook(() => useUsageChartConfig({ data, granularity: 'time_day' }));

      expect(result.current.config.xAxisLabel).toBe('Day');
      expect(result.current.config.yAxisLabel).toBe('Billed Cost ($)');
    });

    it('sets correct axis labels for hourly granularity', () => {
      const data: UsageDataPoint[] = [{ timestamp: '2026-01-15T10:00:00', billedCost: 1.0 }];

      const { result } = renderHook(() => useUsageChartConfig({ data, granularity: 'time_hour' }));

      expect(result.current.config.xAxisLabel).toBe('Hour');
    });

    it('sets correct axis labels for minute granularity', () => {
      const data: UsageDataPoint[] = [{ timestamp: '2026-01-15T10:30:00', billedCost: 1.0 }];

      const { result } = renderHook(() =>
        useUsageChartConfig({ data, granularity: 'time_minute' })
      );

      expect(result.current.config.xAxisLabel).toBe('Minute');
    });

    it('sets correct axis labels for monthly granularity', () => {
      const data: UsageDataPoint[] = [{ timestamp: '2026-01-01', billedCost: 1.0 }];

      const { result } = renderHook(() => useUsageChartConfig({ data, granularity: 'time_month' }));

      expect(result.current.config.xAxisLabel).toBe('Month');
    });

    it('sets correct axis labels for yearly granularity', () => {
      const data: UsageDataPoint[] = [{ timestamp: '2026-01-01', billedCost: 1.0 }];

      const { result } = renderHook(() => useUsageChartConfig({ data, granularity: 'time_year' }));

      expect(result.current.config.xAxisLabel).toBe('Year');
    });
  });

  describe('xTickFormatter', () => {
    it('formats daily timestamps correctly', () => {
      const data: UsageDataPoint[] = [{ timestamp: '2026-01-15', billedCost: 1.0 }];

      const { result } = renderHook(() => useUsageChartConfig({ data, granularity: 'time_day' }));

      const formatted = result.current.xTickFormatter('2026-01-15');
      expect(formatted).toBe('Jan 15');
    });

    it('formats hourly timestamps correctly', () => {
      const data: UsageDataPoint[] = [{ timestamp: '2026-01-15T10:00:00+00:00', billedCost: 1.0 }];

      const { result } = renderHook(() => useUsageChartConfig({ data, granularity: 'time_hour' }));

      const formatted = result.current.xTickFormatter('2026-01-15T10:00:00+00:00');
      expect(formatted).toBe('Jan 15, 10:00');
    });

    it('formats monthly timestamps correctly', () => {
      const data: UsageDataPoint[] = [{ timestamp: '2026-01-01', billedCost: 1.0 }];

      const { result } = renderHook(() => useUsageChartConfig({ data, granularity: 'time_month' }));

      const formatted = result.current.xTickFormatter('2026-01-01');
      expect(formatted).toBe('Jan 2026');
    });

    it('handles non-string values gracefully', () => {
      const data: UsageDataPoint[] = [{ timestamp: '2026-01-15', billedCost: 1.0 }];

      const { result } = renderHook(() => useUsageChartConfig({ data, granularity: 'time_day' }));

      const formatted = result.current.xTickFormatter(123);
      expect(formatted).toBe('123');
    });
  });

  describe('yTickFormatter', () => {
    it('formats regular cost values', () => {
      const data: UsageDataPoint[] = [{ timestamp: '2026-01-15', billedCost: 1.0 }];

      const { result } = renderHook(() => useUsageChartConfig({ data, granularity: 'time_day' }));

      const formatted = result.current.yTickFormatter(123.45);
      expect(formatted).toBe('$123.45');
    });

    it('formats small cost values', () => {
      const data: UsageDataPoint[] = [{ timestamp: '2026-01-15', billedCost: 0.001 }];

      const { result } = renderHook(() => useUsageChartConfig({ data, granularity: 'time_day' }));

      const formatted = result.current.yTickFormatter(0.001);
      expect(formatted).toBe('$0.0010');
    });

    it('formats large cost values with compact notation', () => {
      const data: UsageDataPoint[] = [{ timestamp: '2026-01-15', billedCost: 15000 }];

      const { result } = renderHook(() => useUsageChartConfig({ data, granularity: 'time_day' }));

      const formatted = result.current.yTickFormatter(15000);
      expect(formatted).toBe('$15.0K');
    });

    it('handles non-number values gracefully', () => {
      const data: UsageDataPoint[] = [{ timestamp: '2026-01-15', billedCost: 1.0 }];

      const { result } = renderHook(() => useUsageChartConfig({ data, granularity: 'time_day' }));

      const formatted = result.current.yTickFormatter('not a number');
      expect(formatted).toBe('not a number');
    });
  });

  describe('memoization', () => {
    it('returns same barData reference for same data', () => {
      const data: UsageDataPoint[] = [{ timestamp: '2026-01-15', billedCost: 1.0 }];

      const { result, rerender } = renderHook(() =>
        useUsageChartConfig({ data, granularity: 'time_day' })
      );

      const firstBarData = result.current.barData;
      rerender();
      const secondBarData = result.current.barData;

      expect(firstBarData).toBe(secondBarData);
    });

    it('recomputes when granularity changes', () => {
      const data: UsageDataPoint[] = [{ timestamp: '2026-01-15', billedCost: 1.0 }];

      const { result, rerender } = renderHook(
        (props: { granularity: 'time_day' | 'time_hour' }) =>
          useUsageChartConfig({ data, granularity: props.granularity }),
        { initialProps: { granularity: 'time_day' as 'time_day' | 'time_hour' } }
      );

      const firstLabel = result.current.config.xAxisLabel;
      rerender({ granularity: 'time_hour' });
      const secondLabel = result.current.config.xAxisLabel;

      expect(firstLabel).toBe('Day');
      expect(secondLabel).toBe('Hour');
    });
  });
});
