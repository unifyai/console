/**
 * Unit tests for organization spending types and utilities.
 *
 * Tests cover:
 * - Type guards for org spend and limit responses
 * - calculateOrgSpendingDisplay utility
 * - Re-exported utilities from assistant spending
 */

import { describe, it, expect } from 'vitest';
import {
  OrgSpend,
  OrgSpendingLimitResponse,
  isOrgSpendError,
  isOrgSpendData,
  isOrgSpendingLimitError,
  isOrgSpendingLimitData,
  calculateOrgSpendingDisplay,
  formatSpendAmount,
  getCurrentMonth,
} from '@/types/organization';
import { ResponseProps } from '@/types/common';

describe('Organization Spending Types', () => {
  // ===========================================================================
  // Type Guards
  // ===========================================================================

  describe('isOrgSpendError', () => {
    it('returns true for error response', () => {
      const error: ResponseProps = { detail: 'Not found' };
      expect(isOrgSpendError(error)).toBe(true);
    });

    it('returns false for valid spend data', () => {
      const spend: OrgSpend = {
        orgId: 1,
        month: '2026-01',
        cumulativeSpend: 500.0,
        limit: 1000.0,
        percentUsed: 50.0,
      };
      expect(isOrgSpendError(spend)).toBe(false);
    });
  });

  describe('isOrgSpendData', () => {
    it('returns true for valid spend data', () => {
      const spend: OrgSpend = {
        orgId: 1,
        month: '2026-01',
        cumulativeSpend: 500.0,
        limit: 1000.0,
        percentUsed: 50.0,
      };
      expect(isOrgSpendData(spend)).toBe(true);
    });

    it('returns false for error response', () => {
      const error: ResponseProps = { detail: 'Not found' };
      expect(isOrgSpendData(error)).toBe(false);
    });

    it('returns false for assistant spend (wrong type)', () => {
      // This has cumulativeSpend but no orgId
      const assistantSpend = {
        agentId: '123',
        month: '2026-01',
        cumulativeSpend: 100.0,
        limit: 200.0,
        percentUsed: 50.0,
      };
      expect(isOrgSpendData(assistantSpend as unknown as OrgSpend)).toBe(false);
    });
  });

  describe('isOrgSpendingLimitError', () => {
    it('returns true for error response', () => {
      const error: ResponseProps = { detail: 'Unauthorized' };
      expect(isOrgSpendingLimitError(error)).toBe(true);
    });

    it('returns false for valid limit response', () => {
      const limit: OrgSpendingLimitResponse = {
        orgId: 1,
        monthlySpendingCap: 1000.0,
      };
      expect(isOrgSpendingLimitError(limit)).toBe(false);
    });
  });

  describe('isOrgSpendingLimitData', () => {
    it('returns true for valid limit response', () => {
      const limit: OrgSpendingLimitResponse = {
        orgId: 1,
        monthlySpendingCap: 1000.0,
      };
      expect(isOrgSpendingLimitData(limit)).toBe(true);
    });

    it('returns true for unlimited response (null cap)', () => {
      const limit: OrgSpendingLimitResponse = {
        orgId: 1,
        monthlySpendingCap: null,
      };
      expect(isOrgSpendingLimitData(limit)).toBe(true);
    });

    it('returns false for error response', () => {
      const error: ResponseProps = { detail: 'Error' };
      expect(isOrgSpendingLimitData(error)).toBe(false);
    });
  });

  // ===========================================================================
  // calculateOrgSpendingDisplay
  // ===========================================================================

  describe('calculateOrgSpendingDisplay', () => {
    it('calculates normal spending state', () => {
      const spend: OrgSpend = {
        orgId: 1,
        month: '2026-01',
        cumulativeSpend: 300.0,
        limit: 1000.0,
        percentUsed: 30.0,
      };

      const display = calculateOrgSpendingDisplay(spend);

      expect(display.currentSpend).toBe(300.0);
      expect(display.limit).toBe(1000.0);
      expect(display.percentUsed).toBe(30.0);
      expect(display.isOverLimit).toBe(false);
      expect(display.isNearLimit).toBe(false);
      expect(display.isUnlimited).toBe(false);
    });

    it('calculates near limit state (>= 80%)', () => {
      const spend: OrgSpend = {
        orgId: 1,
        month: '2026-01',
        cumulativeSpend: 850.0,
        limit: 1000.0,
        percentUsed: 85.0,
      };

      const display = calculateOrgSpendingDisplay(spend);

      expect(display.isNearLimit).toBe(true);
      expect(display.isOverLimit).toBe(false);
      expect(display.isUnlimited).toBe(false);
    });

    it('calculates over limit state', () => {
      const spend: OrgSpend = {
        orgId: 1,
        month: '2026-01',
        cumulativeSpend: 1200.0,
        limit: 1000.0,
        percentUsed: 120.0,
      };

      const display = calculateOrgSpendingDisplay(spend);

      expect(display.isOverLimit).toBe(true);
      expect(display.isNearLimit).toBe(false);
      expect(display.isUnlimited).toBe(false);
    });

    it('calculates unlimited state', () => {
      const spend: OrgSpend = {
        orgId: 1,
        month: '2026-01',
        cumulativeSpend: 5000.0,
        limit: null,
        percentUsed: 0,
      };

      const display = calculateOrgSpendingDisplay(spend);

      expect(display.isUnlimited).toBe(true);
      expect(display.isOverLimit).toBe(false);
      expect(display.isNearLimit).toBe(false);
      expect(display.limit).toBeNull();
    });

    it('handles zero spend', () => {
      const spend: OrgSpend = {
        orgId: 1,
        month: '2026-01',
        cumulativeSpend: 0,
        limit: 1000.0,
        percentUsed: 0,
      };

      const display = calculateOrgSpendingDisplay(spend);

      expect(display.currentSpend).toBe(0);
      expect(display.percentUsed).toBe(0);
      expect(display.isOverLimit).toBe(false);
      expect(display.isNearLimit).toBe(false);
    });

    it('handles exactly at limit', () => {
      const spend: OrgSpend = {
        orgId: 1,
        month: '2026-01',
        cumulativeSpend: 1000.0,
        limit: 1000.0,
        percentUsed: 100.0,
      };

      const display = calculateOrgSpendingDisplay(spend);

      expect(display.isOverLimit).toBe(true);
      expect(display.isNearLimit).toBe(false);
    });

    it('handles exactly at 80% threshold', () => {
      const spend: OrgSpend = {
        orgId: 1,
        month: '2026-01',
        cumulativeSpend: 800.0,
        limit: 1000.0,
        percentUsed: 80.0,
      };

      const display = calculateOrgSpendingDisplay(spend);

      expect(display.isNearLimit).toBe(true);
      expect(display.isOverLimit).toBe(false);
    });
  });

  // ===========================================================================
  // Re-exported utilities
  // ===========================================================================

  describe('re-exported utilities', () => {
    describe('formatSpendAmount', () => {
      it('formats dollar amounts with two decimals', () => {
        expect(formatSpendAmount(1000)).toBe('$1000.00');
        expect(formatSpendAmount(99.5)).toBe('$99.50');
        expect(formatSpendAmount(0)).toBe('$0.00');
      });
    });

    describe('getCurrentMonth', () => {
      it('returns a valid YYYY-MM format', () => {
        const month = getCurrentMonth();
        expect(month).toMatch(/^\d{4}-\d{2}$/);
      });

      it('accepts a timezone parameter', () => {
        const month = getCurrentMonth('America/New_York');
        expect(month).toMatch(/^\d{4}-\d{2}$/);
      });
    });
  });
});
