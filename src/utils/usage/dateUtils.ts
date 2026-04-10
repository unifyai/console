/**
 * Date Utilities for Usage Page
 *
 * Pure functions for date range calculations and formatting.
 */

import { TimeGranularity } from '@/types/usage';

/**
 * Get the default date range (last 30 days).
 * Returns dates in ISO format (YYYY-MM-DD).
 */
export function getDefaultDateRange(): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  return {
    startDate: formatDateToISO(startDate),
    endDate: formatDateToISO(endDate),
  };
}

/**
 * Get date range for last N days.
 * @param days Number of days to go back
 * @returns Object with startDate and endDate in ISO format
 */
export function getLastNDays(days: number): {
  startDate: string;
  endDate: string;
} {
  if (days < 0) {
    throw new Error('Days must be a non-negative number');
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return {
    startDate: formatDateToISO(startDate),
    endDate: formatDateToISO(endDate),
  };
}

/**
 * Format a Date object to ISO date string (YYYY-MM-DD).
 * @param date Date object to format
 * @returns ISO date string
 */
export function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse an ISO date string to a Date object.
 * @param isoString ISO date string (YYYY-MM-DD)
 * @returns Date object (at midnight UTC)
 */
export function parseISODate(isoString: string): Date {
  const [year, month, day] = isoString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format a timestamp for display based on granularity.
 * @param timestamp Timestamp string from API
 * @param granularity Time granularity
 * @returns Human-readable formatted string
 */
export function formatTimestampForDisplay(timestamp: string, granularity: TimeGranularity): string {
  const date = new Date(timestamp);

  if (isNaN(date.getTime())) {
    return timestamp; // Return as-is if parsing fails
  }

  switch (granularity) {
    case 'minute':
      return formatDateTime(date, 'MMM D, HH:mm');
    case 'hour':
      return formatDateTime(date, 'MMM D, HH:00');
    case 'day':
      return formatDateTime(date, 'MMM D');
    case 'month':
      return formatDateTime(date, 'MMM YYYY');
    case 'year':
      return formatDateTime(date, 'YYYY');
    default:
      return timestamp;
  }
}

/**
 * Format a date using a simple format pattern.
 * Supports: YYYY, MMM, MM, D, DD, HH, mm
 * @param date Date to format
 * @param pattern Format pattern
 * @returns Formatted string
 */
export function formatDateTime(date: Date, pattern: string): string {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const replacements: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    MMM: months[date.getMonth()],
    MM: String(date.getMonth() + 1).padStart(2, '0'),
    DD: String(date.getDate()).padStart(2, '0'),
    D: String(date.getDate()),
    HH: String(date.getHours()).padStart(2, '0'),
    mm: String(date.getMinutes()).padStart(2, '0'),
  };

  let result = pattern;
  // Replace in order of longest to shortest to avoid partial replacements
  const tokens = Object.keys(replacements).sort((a, b) => b.length - a.length);
  for (const token of tokens) {
    result = result.replace(new RegExp(token, 'g'), replacements[token]);
  }

  return result;
}

/**
 * Get the start of a time period for a given date and granularity.
 * @param date Date to get the start of the period for
 * @param granularity Time granularity
 * @returns Date at the start of the period
 */
export function getStartOfPeriod(date: Date, granularity: TimeGranularity): Date {
  const result = new Date(date);

  switch (granularity) {
    case 'minute':
      result.setSeconds(0, 0);
      break;
    case 'hour':
      result.setMinutes(0, 0, 0);
      break;
    case 'day':
      result.setHours(0, 0, 0, 0);
      break;
    case 'month':
      result.setDate(1);
      result.setHours(0, 0, 0, 0);
      break;
    case 'year':
      result.setMonth(0, 1);
      result.setHours(0, 0, 0, 0);
      break;
  }

  return result;
}

/**
 * Validate that a date string is in valid ISO format (YYYY-MM-DD).
 * @param dateString String to validate
 * @returns True if valid ISO date format
 */
export function isValidISODate(dateString: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false;
  }

  const date = parseISODate(dateString);
  return !isNaN(date.getTime()) && formatDateToISO(date) === dateString;
}

/**
 * Check if start date is before or equal to end date.
 * @param startDate Start date in ISO format
 * @param endDate End date in ISO format
 * @returns True if date range is valid
 */
export function isValidDateRange(startDate: string, endDate: string): boolean {
  if (!isValidISODate(startDate) || !isValidISODate(endDate)) {
    return false;
  }

  const start = parseISODate(startDate);
  const end = parseISODate(endDate);

  return start <= end;
}
