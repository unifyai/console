/**
 * Unit tests for spending types and utility functions.
 *
 * Tests cover:
 * - Type guards for response discrimination
 * - Display calculation logic
 * - Formatting functions
 * - Month calculation with timezone handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AssistantSpend,
  SpendingLimitResponse,
  isSpendingError,
  isSpendingData,
  isSpendingLimitError,
  isSpendingLimitData,
  calculateSpendingDisplay,
  formatSpendAmount,
  getCurrentMonth,
} from '@/types/assistants/spending';
import { ResponseProps } from '@/types/common';

describe('spending types', () => {
  // ==========================================================================
  // Type Guards
  // ==========================================================================

  describe('isSpendingError', () => {
    it('returns true for error responses', () => {
      const error: ResponseProps = { detail: 'Something went wrong' };
      expect(isSpendingError(error)).toBe(true);
    });

    it('returns false for valid spending data', () => {
      const spend: AssistantSpend = {
        agentId: '123',
        month: '2026-01',
        cumulativeSpend: 50.0,
        limit: 100.0,
        percentUsed: 50.0,
      };
      expect(isSpendingError(spend)).toBe(false);
    });
  });

  describe('isSpendingData', () => {
    it('returns true for valid spending data', () => {
      const spend: AssistantSpend = {
        agentId: '123',
        month: '2026-01',
        cumulativeSpend: 50.0,
        limit: 100.0,
        percentUsed: 50.0,
      };
      expect(isSpendingData(spend)).toBe(true);
    });

    it('returns false for error responses', () => {
      const error: ResponseProps = { detail: 'Not found' };
      expect(isSpendingData(error)).toBe(false);
    });

    it('returns true for spending data with null limit', () => {
      const spend: AssistantSpend = {
        agentId: '456',
        month: '2026-02',
        cumulativeSpend: 25.5,
        limit: null,
        percentUsed: 0,
      };
      expect(isSpendingData(spend)).toBe(true);
    });
  });

  describe('isSpendingLimitError', () => {
    it('returns true for error responses', () => {
      const error: ResponseProps = { detail: 'Unauthorized' };
      expect(isSpendingLimitError(error)).toBe(true);
    });

    it('returns false for valid limit data', () => {
      const limit: SpendingLimitResponse = {
        agentId: '123',
        monthlySpendingCap: 100.0,
        effectiveLimit: 100.0,
      };
      expect(isSpendingLimitError(limit)).toBe(false);
    });
  });

  describe('isSpendingLimitData', () => {
    it('returns true for valid limit data with cap', () => {
      const limit: SpendingLimitResponse = {
        agentId: '123',
        monthlySpendingCap: 100.0,
        effectiveLimit: 100.0,
      };
      expect(isSpendingLimitData(limit)).toBe(true);
    });

    it('returns true for limit data with null values', () => {
      const limit: SpendingLimitResponse = {
        agentId: '456',
        monthlySpendingCap: null,
        effectiveLimit: null,
      };
      expect(isSpendingLimitData(limit)).toBe(true);
    });

    it('returns false for error responses', () => {
      const error: ResponseProps = { detail: 'Server error' };
      expect(isSpendingLimitData(error)).toBe(false);
    });
  });

  // ==========================================================================
  // Display Calculation
  // ==========================================================================

  describe('calculateSpendingDisplay', () => {
    it('calculates display props for normal spending', () => {
      const spend: AssistantSpend = {
        agentId: '123',
        month: '2026-01',
        cumulativeSpend: 50.0,
        limit: 100.0,
        percentUsed: 50.0,
      };

      const display = calculateSpendingDisplay(spend);

      expect(display.currentSpend).toBe(50.0);
      expect(display.limit).toBe(100.0);
      expect(display.percentUsed).toBe(50.0);
      expect(display.isOverLimit).toBe(false);
      expect(display.isNearLimit).toBe(false);
      expect(display.isUnlimited).toBe(false);
    });

    it('detects when spending equals limit', () => {
      const spend: AssistantSpend = {
        agentId: '123',
        month: '2026-01',
        cumulativeSpend: 100.0,
        limit: 100.0,
        percentUsed: 100.0,
      };

      const display = calculateSpendingDisplay(spend);

      expect(display.isOverLimit).toBe(true);
      expect(display.isNearLimit).toBe(false); // Over limit, not near
    });

    it('detects when spending exceeds limit', () => {
      const spend: AssistantSpend = {
        agentId: '123',
        month: '2026-01',
        cumulativeSpend: 105.5,
        limit: 100.0,
        percentUsed: 105.5,
      };

      const display = calculateSpendingDisplay(spend);

      expect(display.isOverLimit).toBe(true);
      expect(display.percentUsed).toBe(105.5);
      expect(display.isNearLimit).toBe(false); // Over, not near
    });

    it('handles unlimited spending (null limit)', () => {
      const spend: AssistantSpend = {
        agentId: '123',
        month: '2026-01',
        cumulativeSpend: 500.0,
        limit: null,
        percentUsed: 0,
      };

      const display = calculateSpendingDisplay(spend);

      expect(display.limit).toBeNull();
      expect(display.isOverLimit).toBe(false);
      expect(display.isNearLimit).toBe(false);
      expect(display.isUnlimited).toBe(true);
    });

    it('handles zero spending', () => {
      const spend: AssistantSpend = {
        agentId: '123',
        month: '2026-01',
        cumulativeSpend: 0,
        limit: 100.0,
        percentUsed: 0,
      };

      const display = calculateSpendingDisplay(spend);

      expect(display.currentSpend).toBe(0);
      expect(display.percentUsed).toBe(0);
      expect(display.isOverLimit).toBe(false);
      expect(display.isNearLimit).toBe(false);
      expect(display.isUnlimited).toBe(false);
    });

    it('detects near limit threshold (80%)', () => {
      const spend: AssistantSpend = {
        agentId: '123',
        month: '2026-01',
        cumulativeSpend: 80.0,
        limit: 100.0,
        percentUsed: 80.0,
      };

      const display = calculateSpendingDisplay(spend);

      expect(display.isNearLimit).toBe(true);
      expect(display.isOverLimit).toBe(false);
    });

    it('detects just under near limit threshold (79%)', () => {
      const spend: AssistantSpend = {
        agentId: '123',
        month: '2026-01',
        cumulativeSpend: 79.0,
        limit: 100.0,
        percentUsed: 79.0,
      };

      const display = calculateSpendingDisplay(spend);

      expect(display.isNearLimit).toBe(false);
      expect(display.isOverLimit).toBe(false);
    });
  });

  // ==========================================================================
  // Formatting
  // ==========================================================================

  describe('formatSpendAmount', () => {
    it('formats whole dollar amounts', () => {
      expect(formatSpendAmount(100)).toBe('$100.00');
    });

    it('formats amounts with cents', () => {
      expect(formatSpendAmount(50.5)).toBe('$50.50');
    });

    it('formats small amounts', () => {
      expect(formatSpendAmount(0.01)).toBe('$0.01');
    });

    it('formats zero', () => {
      expect(formatSpendAmount(0)).toBe('$0.00');
    });

    it('formats large amounts', () => {
      expect(formatSpendAmount(1234.56)).toBe('$1234.56');
    });

    it('rounds to two decimal places', () => {
      expect(formatSpendAmount(10.999)).toBe('$11.00');
      expect(formatSpendAmount(10.994)).toBe('$10.99');
    });
  });

  // ==========================================================================
  // Month Calculation
  // ==========================================================================

  describe('getCurrentMonth', () => {
    beforeEach(() => {
      // Mock Date to 2026-01-15 12:00:00 UTC
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns current month in YYYY-MM format for UTC', () => {
      const month = getCurrentMonth('UTC');
      expect(month).toBe('2026-01');
    });

    it('returns current month for undefined timezone (defaults to UTC)', () => {
      const month = getCurrentMonth(undefined);
      expect(month).toBe('2026-01');
    });

    it('returns current month for null timezone (defaults to UTC)', () => {
      const month = getCurrentMonth(null);
      expect(month).toBe('2026-01');
    });

    it('handles timezone that would be in a different month', () => {
      // At 2026-01-15T12:00:00 UTC, it's still January everywhere
      // But let's test with a timezone far behind UTC
      // At 2026-01-01T01:00:00 UTC, Pacific time would be Dec 31
      vi.setSystemTime(new Date('2026-01-01T01:00:00Z'));
      const month = getCurrentMonth('America/Los_Angeles');
      expect(month).toBe('2025-12');
    });

    it('handles timezone far ahead of UTC', () => {
      // At 2026-01-31T23:00:00 UTC, Auckland would be Feb 1
      vi.setSystemTime(new Date('2026-01-31T23:00:00Z'));
      const month = getCurrentMonth('Pacific/Auckland');
      expect(month).toBe('2026-02');
    });

    it('falls back to UTC for invalid timezone', () => {
      const month = getCurrentMonth('Invalid/Timezone');
      expect(month).toBe('2026-01');
    });

    it('handles common timezone formats', () => {
      const timezones = ['America/New_York', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney'];

      for (const tz of timezones) {
        const month = getCurrentMonth(tz);
        expect(month).toMatch(/^\d{4}-\d{2}$/);
      }
    });
  });
});
