/**
 * Bar Chart Sorting Unit Tests
 *
 * Tests for the sorting behavior of bar charts with pre-aggregated data.
 * This file specifically tests the fix for the sortBars undefined bug
 * where timestamps were being incorrectly sorted by y-value instead of
 * maintaining chronological order.
 *
 * Bug context:
 * - When sortBars is undefined (not explicitly set), the condition
 *   `sortBars !== 'unsorted'` was true, causing data to be sorted by
 *   y-value instead of maintaining x-axis (timestamp) order.
 * - Fix: Changed condition to `sortBars && sortBars !== 'unsorted'`
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as d3 from 'd3';
import type { DataLabel, GroupedDataLabel } from '@/types/interfaces/plot';

/**
 * Extracts and tests the sorting logic from drawBarChart.
 * This is a unit test that isolates the sorting behavior.
 */
function applySortingToPreAggregatedData(
  data: DataLabel[] | GroupedDataLabel[],
  groupBy: string | undefined,
  sortBars: string | undefined
): DataLabel[] | GroupedDataLabel[] {
  // Clone the data to avoid mutating the original
  const clonedData = [...data] as DataLabel[] | GroupedDataLabel[];

  // This is the FIXED logic from plot-bar.ts
  if (!groupBy && sortBars && sortBars !== 'unsorted') {
    (clonedData as DataLabel[]).sort((a, b) => {
      const yA = a[1];
      const yB = b[1];
      switch (sortBars) {
        case 'asc':
          return yA - yB;
        case 'desc':
          return yB - yA;
        default:
          return yA - yB;
      }
    });
  } else {
    // Sort by x-axis value (category)
    if (groupBy) {
      const isNumericX = (clonedData as GroupedDataLabel[]).every(
        (item) => !isNaN(Number(item[1][0]))
      );
      (clonedData as GroupedDataLabel[]).sort((a, b) => {
        const xCompare = isNumericX
          ? Number(a[1][0]) - Number(b[1][0])
          : a[1][0].localeCompare(b[1][0]);
        if (xCompare !== 0) return xCompare;
        return b[1][1] - a[1][1];
      });
    } else {
      (clonedData as DataLabel[]).every((item) => !isNaN(Number(item[0])))
        ? (clonedData as DataLabel[]).sort((a, b) => Number(a[0]) - Number(b[0]))
        : (clonedData as DataLabel[]).sort((a, b) => a[0].localeCompare(b[0]));
    }
  }

  return clonedData;
}

/**
 * The BUGGY logic that was causing the issue (for comparison testing).
 */
function applyBuggySortingToPreAggregatedData(
  data: DataLabel[] | GroupedDataLabel[],
  groupBy: string | undefined,
  sortBars: string | undefined
): DataLabel[] | GroupedDataLabel[] {
  const clonedData = [...data] as DataLabel[] | GroupedDataLabel[];

  // BUGGY: sortBars !== 'unsorted' is true when sortBars is undefined
  if (!groupBy && sortBars !== 'unsorted') {
    (clonedData as DataLabel[]).sort((a, b) => {
      const yA = a[1];
      const yB = b[1];
      switch (sortBars) {
        case 'asc':
          return yA - yB;
        case 'desc':
          return yB - yA;
        default:
          return yA - yB; // This gets triggered when sortBars is undefined!
      }
    });
  } else {
    if (groupBy) {
      const isNumericX = (clonedData as GroupedDataLabel[]).every(
        (item) => !isNaN(Number(item[1][0]))
      );
      (clonedData as GroupedDataLabel[]).sort((a, b) => {
        const xCompare = isNumericX
          ? Number(a[1][0]) - Number(b[1][0])
          : a[1][0].localeCompare(b[1][0]);
        if (xCompare !== 0) return xCompare;
        return b[1][1] - a[1][1];
      });
    } else {
      (clonedData as DataLabel[]).every((item) => !isNaN(Number(item[0])))
        ? (clonedData as DataLabel[]).sort((a, b) => Number(a[0]) - Number(b[0]))
        : (clonedData as DataLabel[]).sort((a, b) => a[0].localeCompare(b[0]));
    }
  }

  return clonedData;
}

// =============================================================================
// Test Data
// =============================================================================

/**
 * Sample usage data with timestamps as x-axis (like the Usage page).
 * Note: Data is already sorted chronologically but with varying y-values.
 */
const USAGE_TIMESTAMP_DATA: DataLabel[] = [
  ['2026-01-19T14:20:00', 5.0], // First chronologically, medium cost
  ['2026-01-19T14:24:00', 2.0], // Second chronologically, low cost
  ['2026-01-20T13:00:00', 8.0], // Third chronologically, high cost
  ['2026-01-20T13:15:00', 3.0], // Fourth chronologically, low-medium cost
];

/**
 * Sample daily usage data with date strings.
 */
const DAILY_USAGE_DATA: DataLabel[] = [
  ['2026-01-13', 1.25],
  ['2026-01-14', 1.5],
  ['2026-01-15', 2.0],
  ['2026-01-16', 3.0],
  ['2026-01-17', 2.5],
  ['2026-01-18', 1.0],
  ['2026-01-19', 1.0],
];

/**
 * Numeric x-axis data (for testing numeric sorting).
 */
const NUMERIC_X_DATA: DataLabel[] = [
  ['10', 5.0],
  ['5', 2.0],
  ['20', 8.0],
  ['15', 3.0],
];

// =============================================================================
// Tests
// =============================================================================

describe('Bar Chart Sorting', () => {
  describe('Pre-aggregated data with undefined sortBars (Usage page scenario)', () => {
    it('maintains chronological order when sortBars is undefined', () => {
      const result = applySortingToPreAggregatedData(
        USAGE_TIMESTAMP_DATA,
        undefined, // no groupBy
        undefined // sortBars is undefined (like Usage page)
      );

      // Should maintain chronological order via localeCompare on ISO timestamps
      const timestamps = (result as DataLabel[]).map((d) => d[0]);
      expect(timestamps).toEqual([
        '2026-01-19T14:20:00',
        '2026-01-19T14:24:00',
        '2026-01-20T13:00:00',
        '2026-01-20T13:15:00',
      ]);
    });

    it('demonstrates the bug when using old logic', () => {
      const result = applyBuggySortingToPreAggregatedData(
        USAGE_TIMESTAMP_DATA,
        undefined,
        undefined
      );

      // BUGGY: sorted by y-value ascending (2.0, 3.0, 5.0, 8.0)
      const yValues = (result as DataLabel[]).map((d) => d[1]);
      expect(yValues).toEqual([2.0, 3.0, 5.0, 8.0]);

      // The timestamps are now out of chronological order!
      const timestamps = (result as DataLabel[]).map((d) => d[0]);
      expect(timestamps).not.toEqual([
        '2026-01-19T14:20:00',
        '2026-01-19T14:24:00',
        '2026-01-20T13:00:00',
        '2026-01-20T13:15:00',
      ]);
    });

    it('maintains date order for daily granularity data', () => {
      const result = applySortingToPreAggregatedData(DAILY_USAGE_DATA, undefined, undefined);

      const dates = (result as DataLabel[]).map((d) => d[0]);
      expect(dates).toEqual([
        '2026-01-13',
        '2026-01-14',
        '2026-01-15',
        '2026-01-16',
        '2026-01-17',
        '2026-01-18',
        '2026-01-19',
      ]);
    });
  });

  describe('Explicit sortBars values', () => {
    it('sorts by y-value ascending when sortBars is "asc"', () => {
      const result = applySortingToPreAggregatedData(USAGE_TIMESTAMP_DATA, undefined, 'asc');

      const yValues = (result as DataLabel[]).map((d) => d[1]);
      expect(yValues).toEqual([2.0, 3.0, 5.0, 8.0]);
    });

    it('sorts by y-value descending when sortBars is "desc"', () => {
      const result = applySortingToPreAggregatedData(USAGE_TIMESTAMP_DATA, undefined, 'desc');

      const yValues = (result as DataLabel[]).map((d) => d[1]);
      expect(yValues).toEqual([8.0, 5.0, 3.0, 2.0]);
    });

    it('maintains x-axis order when sortBars is "unsorted"', () => {
      const result = applySortingToPreAggregatedData(USAGE_TIMESTAMP_DATA, undefined, 'unsorted');

      const timestamps = (result as DataLabel[]).map((d) => d[0]);
      expect(timestamps).toEqual([
        '2026-01-19T14:20:00',
        '2026-01-19T14:24:00',
        '2026-01-20T13:00:00',
        '2026-01-20T13:15:00',
      ]);
    });
  });

  describe('Numeric x-axis data', () => {
    it('sorts numerically when x values are numeric strings', () => {
      const result = applySortingToPreAggregatedData(NUMERIC_X_DATA, undefined, undefined);

      const xValues = (result as DataLabel[]).map((d) => d[0]);
      expect(xValues).toEqual(['5', '10', '15', '20']);
    });
  });

  describe('Grouped data', () => {
    it('sorts grouped data by x-axis then y-value descending', () => {
      const groupedData: GroupedDataLabel[] = [
        ['group-a', ['2026-01-20', 5.0]],
        ['group-b', ['2026-01-19', 3.0]],
        ['group-a', ['2026-01-19', 8.0]],
        ['group-b', ['2026-01-20', 2.0]],
      ];

      const result = applySortingToPreAggregatedData(groupedData, 'model', undefined);

      // Should be sorted by date first, then by y-value descending within same date
      const resultLabels = (result as GroupedDataLabel[]).map((d) => [d[0], d[1][0], d[1][1]]);

      // Jan 19 entries first (sorted by y-value desc: 8.0, 3.0), then Jan 20 (5.0, 2.0)
      expect(resultLabels).toEqual([
        ['group-a', '2026-01-19', 8.0],
        ['group-b', '2026-01-19', 3.0],
        ['group-a', '2026-01-20', 5.0],
        ['group-b', '2026-01-20', 2.0],
      ]);
    });

    it('grouped data ignores sortBars and always sorts by x-axis', () => {
      const groupedData: GroupedDataLabel[] = [
        ['group-a', ['2026-01-20', 5.0]],
        ['group-b', ['2026-01-19', 3.0]],
      ];

      // Even with sortBars='desc', grouped data should sort by x-axis
      const result = applySortingToPreAggregatedData(groupedData, 'model', 'desc');

      const xValues = (result as GroupedDataLabel[]).map((d) => d[1][0]);
      expect(xValues).toEqual(['2026-01-19', '2026-01-20']);
    });
  });

  describe('Edge cases', () => {
    it('handles empty data array', () => {
      const result = applySortingToPreAggregatedData([], undefined, undefined);
      expect(result).toEqual([]);
    });

    it('handles single data point', () => {
      const singlePoint: DataLabel[] = [['2026-01-19', 5.0]];
      const result = applySortingToPreAggregatedData(singlePoint, undefined, undefined);
      expect(result).toEqual([['2026-01-19', 5.0]]);
    });

    it('handles identical timestamps with different y-values', () => {
      const sameTimestamp: DataLabel[] = [
        ['2026-01-19T14:00:00', 5.0],
        ['2026-01-19T14:00:00', 2.0],
        ['2026-01-19T14:00:00', 8.0],
      ];

      const result = applySortingToPreAggregatedData(sameTimestamp, undefined, undefined);

      // localeCompare returns 0 for identical strings, so order depends on sort stability
      // All timestamps should still be the same
      const timestamps = (result as DataLabel[]).map((d) => d[0]);
      expect(timestamps.every((t) => t === '2026-01-19T14:00:00')).toBe(true);
    });
  });
});
