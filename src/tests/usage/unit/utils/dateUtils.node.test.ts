/**
 * Date Utilities Tests
 *
 * Tests for pure date functions used by the usage page.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getDefaultDateRange,
  getLastNDays,
  formatDateToISO,
  parseISODate,
  formatTimestampForDisplay,
  formatDateTime,
  getStartOfPeriod,
  isValidISODate,
  isValidDateRange,
} from '@/utils/usage/dateUtils';

describe('dateUtils', () => {
  describe('formatDateToISO', () => {
    it('formats a date to ISO format (YYYY-MM-DD)', () => {
      const date = new Date(2026, 0, 15); // Jan 15, 2026
      expect(formatDateToISO(date)).toBe('2026-01-15');
    });

    it('pads single digit months and days with zeros', () => {
      const date = new Date(2026, 2, 5); // Mar 5, 2026
      expect(formatDateToISO(date)).toBe('2026-03-05');
    });

    it('handles end of year dates', () => {
      const date = new Date(2026, 11, 31); // Dec 31, 2026
      expect(formatDateToISO(date)).toBe('2026-12-31');
    });
  });

  describe('parseISODate', () => {
    it('parses an ISO date string to a Date object', () => {
      const date = parseISODate('2026-01-15');
      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(0); // January
      expect(date.getDate()).toBe(15);
    });

    it('roundtrips with formatDateToISO', () => {
      const isoString = '2026-06-20';
      const date = parseISODate(isoString);
      expect(formatDateToISO(date)).toBe(isoString);
    });
  });

  describe('getDefaultDateRange', () => {
    beforeEach(() => {
      // Mock Date to return a fixed date
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 19)); // Jan 19, 2026
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns last 30 days date range', () => {
      const range = getDefaultDateRange();
      expect(range.endDate).toBe('2026-01-19');
      expect(range.startDate).toBe('2025-12-20');
    });

    it('returns dates in ISO format', () => {
      const range = getDefaultDateRange();
      expect(range.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(range.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('getLastNDays', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 19)); // Jan 19, 2026
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns correct range for 7 days', () => {
      const range = getLastNDays(7);
      expect(range.startDate).toBe('2026-01-12');
      expect(range.endDate).toBe('2026-01-19');
    });

    it('returns same day for 0 days', () => {
      const range = getLastNDays(0);
      expect(range.startDate).toBe('2026-01-19');
      expect(range.endDate).toBe('2026-01-19');
    });

    it('throws error for negative days', () => {
      expect(() => getLastNDays(-5)).toThrow('Days must be a non-negative number');
    });

    it('handles crossing year boundary', () => {
      const range = getLastNDays(30);
      expect(range.startDate).toBe('2025-12-20');
      expect(range.endDate).toBe('2026-01-19');
    });
  });

  describe('formatTimestampForDisplay', () => {
    it('formats minute granularity with date and time', () => {
      const result = formatTimestampForDisplay('2026-01-15T10:30:00+00:00', 'time_minute');
      expect(result).toBe('Jan 15, 10:30');
    });

    it('formats hour granularity with date and hour', () => {
      const result = formatTimestampForDisplay('2026-01-15T10:00:00+00:00', 'time_hour');
      expect(result).toBe('Jan 15, 10:00');
    });

    it('formats day granularity with month and day', () => {
      const result = formatTimestampForDisplay('2026-01-15', 'time_day');
      expect(result).toBe('Jan 15');
    });

    it('formats month granularity with month and year', () => {
      const result = formatTimestampForDisplay('2026-01-01', 'time_month');
      expect(result).toBe('Jan 2026');
    });

    it('formats year granularity with just year', () => {
      const result = formatTimestampForDisplay('2026-01-01', 'time_year');
      expect(result).toBe('2026');
    });

    it('returns original string for invalid date', () => {
      const result = formatTimestampForDisplay('invalid-date', 'time_day');
      expect(result).toBe('invalid-date');
    });
  });

  describe('formatDateTime', () => {
    const date = new Date(2026, 5, 7, 14, 30); // Jun 7, 2026 14:30

    it('formats YYYY correctly', () => {
      expect(formatDateTime(date, 'YYYY')).toBe('2026');
    });

    it('formats MMM correctly', () => {
      expect(formatDateTime(date, 'MMM')).toBe('Jun');
    });

    it('formats MM correctly', () => {
      expect(formatDateTime(date, 'MM')).toBe('06');
    });

    it('formats D correctly (no padding)', () => {
      expect(formatDateTime(date, 'D')).toBe('7');
    });

    it('formats DD correctly (with padding)', () => {
      expect(formatDateTime(date, 'DD')).toBe('07');
    });

    it('formats HH correctly', () => {
      expect(formatDateTime(date, 'HH')).toBe('14');
    });

    it('formats mm correctly', () => {
      expect(formatDateTime(date, 'mm')).toBe('30');
    });

    it('formats complex patterns', () => {
      expect(formatDateTime(date, 'MMM D, YYYY at HH:mm')).toBe('Jun 7, 2026 at 14:30');
    });
  });

  describe('getStartOfPeriod', () => {
    const date = new Date(2026, 5, 15, 14, 30, 45, 123); // Jun 15, 2026 14:30:45.123

    it('gets start of minute', () => {
      const result = getStartOfPeriod(date, 'time_minute');
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
      expect(result.getMinutes()).toBe(30);
    });

    it('gets start of hour', () => {
      const result = getStartOfPeriod(date, 'time_hour');
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getHours()).toBe(14);
    });

    it('gets start of day', () => {
      const result = getStartOfPeriod(date, 'time_day');
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getDate()).toBe(15);
    });

    it('gets start of month', () => {
      const result = getStartOfPeriod(date, 'time_month');
      expect(result.getDate()).toBe(1);
      expect(result.getHours()).toBe(0);
      expect(result.getMonth()).toBe(5); // June
    });

    it('gets start of year', () => {
      const result = getStartOfPeriod(date, 'time_year');
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(1);
      expect(result.getFullYear()).toBe(2026);
    });

    it('does not mutate original date', () => {
      const original = new Date(date);
      getStartOfPeriod(date, 'time_year');
      expect(date.getTime()).toBe(original.getTime());
    });
  });

  describe('isValidISODate', () => {
    it('returns true for valid ISO date', () => {
      expect(isValidISODate('2026-01-15')).toBe(true);
    });

    it('returns false for invalid format (wrong separators)', () => {
      expect(isValidISODate('2026/01/15')).toBe(false);
    });

    it('returns false for invalid format (no padding)', () => {
      expect(isValidISODate('2026-1-15')).toBe(false);
    });

    it('returns false for invalid month', () => {
      expect(isValidISODate('2026-13-15')).toBe(false);
    });

    it('returns false for invalid day', () => {
      expect(isValidISODate('2026-02-30')).toBe(false);
    });

    it('returns false for non-date strings', () => {
      expect(isValidISODate('not-a-date')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isValidISODate('')).toBe(false);
    });
  });

  describe('isValidDateRange', () => {
    it('returns true when start is before end', () => {
      expect(isValidDateRange('2026-01-01', '2026-01-31')).toBe(true);
    });

    it('returns true when start equals end', () => {
      expect(isValidDateRange('2026-01-15', '2026-01-15')).toBe(true);
    });

    it('returns false when start is after end', () => {
      expect(isValidDateRange('2026-01-31', '2026-01-01')).toBe(false);
    });

    it('returns false for invalid start date', () => {
      expect(isValidDateRange('invalid', '2026-01-31')).toBe(false);
    });

    it('returns false for invalid end date', () => {
      expect(isValidDateRange('2026-01-01', 'invalid')).toBe(false);
    });

    it('handles year boundaries correctly', () => {
      expect(isValidDateRange('2025-12-15', '2026-01-15')).toBe(true);
    });
  });
});
