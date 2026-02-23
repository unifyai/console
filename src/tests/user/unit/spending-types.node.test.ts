/**
 * Tests for User Spending Types
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import {
  UserSpend,
  UserSpendingLimitResponse,
  UserSpendingLimitRequest,
  isUserSpendData,
  isUserSpendError,
  isUserSpendingLimitData,
  isUserSpendingLimitError,
  calculateUserSpendingDisplay,
  formatSpendAmount,
  getCurrentMonth,
} from '@/types/user/spending';

describe('User Spending Types', () => {
  describe('UserSpend interface', () => {
    it('should accept valid UserSpend object', () => {
      const spend: UserSpend = {
        userId: 'user-123',
        month: '2026-01',
        cumulativeSpend: 50.0,
        limit: 100.0,
        percentUsed: 50.0,
      };
      expect(spend.userId).toBe('user-123');
      expect(spend.cumulativeSpend).toBe(50.0);
    });

    it('should accept UserSpend with null limit (unlimited)', () => {
      const spend: UserSpend = {
        userId: 'user-123',
        month: '2026-01',
        cumulativeSpend: 50.0,
        limit: null,
        percentUsed: 0,
      };
      expect(spend.limit).toBeNull();
    });
  });

  describe('UserSpendingLimitResponse interface', () => {
    it('should accept valid response with limit', () => {
      const response: UserSpendingLimitResponse = {
        userId: 'user-123',
        monthlySpendingCap: 100.0,
        assistantsCapped: 2,
      };
      expect(response.monthlySpendingCap).toBe(100.0);
    });

    it('should accept response with null limit (unlimited)', () => {
      const response: UserSpendingLimitResponse = {
        userId: 'user-123',
        monthlySpendingCap: null,
      };
      expect(response.monthlySpendingCap).toBeNull();
    });
  });

  describe('UserSpendingLimitRequest interface', () => {
    it('should accept request to set limit', () => {
      const request: UserSpendingLimitRequest = {
        monthlySpendingCap: 100.0,
      };
      expect(request.monthlySpendingCap).toBe(100.0);
    });

    it('should accept request to remove limit', () => {
      const request: UserSpendingLimitRequest = {
        monthlySpendingCap: null,
      };
      expect(request.monthlySpendingCap).toBeNull();
    });
  });
});

describe('Type Guards', () => {
  describe('isUserSpendData', () => {
    it('returns true for valid UserSpend object', () => {
      const spend: UserSpend = {
        userId: 'user-123',
        month: '2026-01',
        cumulativeSpend: 50.0,
        limit: 100.0,
        percentUsed: 50.0,
      };
      expect(isUserSpendData(spend)).toBe(true);
    });

    it('returns false for error response', () => {
      const error = { detail: 'Not found' };
      expect(isUserSpendData(error)).toBe(false);
    });

    it('returns false for empty object', () => {
      expect(isUserSpendData({} as UserSpend)).toBe(false);
    });
  });

  describe('isUserSpendError', () => {
    it('returns true for error response', () => {
      const error = { detail: 'Not found' };
      expect(isUserSpendError(error)).toBe(true);
    });

    it('returns false for valid UserSpend object', () => {
      const spend: UserSpend = {
        userId: 'user-123',
        month: '2026-01',
        cumulativeSpend: 50.0,
        limit: 100.0,
        percentUsed: 50.0,
      };
      expect(isUserSpendError(spend)).toBe(false);
    });
  });

  describe('isUserSpendingLimitData', () => {
    it('returns true for valid limit response', () => {
      const response: UserSpendingLimitResponse = {
        userId: 'user-123',
        monthlySpendingCap: 100.0,
      };
      expect(isUserSpendingLimitData(response)).toBe(true);
    });

    it('returns false for error response', () => {
      const error = { detail: 'Unauthorized' };
      expect(isUserSpendingLimitData(error)).toBe(false);
    });
  });

  describe('isUserSpendingLimitError', () => {
    it('returns true for error response', () => {
      const error = { detail: 'Unauthorized' };
      expect(isUserSpendingLimitError(error)).toBe(true);
    });

    it('returns false for valid limit response', () => {
      const response: UserSpendingLimitResponse = {
        userId: 'user-123',
        monthlySpendingCap: 100.0,
      };
      expect(isUserSpendingLimitError(response)).toBe(false);
    });
  });
});

describe('calculateUserSpendingDisplay', () => {
  it('calculates display for under-limit spending', () => {
    const spend: UserSpend = {
      userId: 'user-123',
      month: '2026-01',
      cumulativeSpend: 30.0,
      limit: 100.0,
      percentUsed: 30.0,
    };
    const display = calculateUserSpendingDisplay(spend);
    expect(display.currentSpend).toBe(30.0);
    expect(display.limit).toBe(100.0);
    expect(display.percentUsed).toBe(30.0);
    expect(display.isOverLimit).toBe(false);
    expect(display.isNearLimit).toBe(false);
    expect(display.isUnlimited).toBe(false);
  });

  it('calculates display for near-limit spending (>= 80%)', () => {
    const spend: UserSpend = {
      userId: 'user-123',
      month: '2026-01',
      cumulativeSpend: 85.0,
      limit: 100.0,
      percentUsed: 85.0,
    };
    const display = calculateUserSpendingDisplay(spend);
    expect(display.isNearLimit).toBe(true);
    expect(display.isOverLimit).toBe(false);
  });

  it('calculates display for over-limit spending', () => {
    const spend: UserSpend = {
      userId: 'user-123',
      month: '2026-01',
      cumulativeSpend: 120.0,
      limit: 100.0,
      percentUsed: 120.0,
    };
    const display = calculateUserSpendingDisplay(spend);
    expect(display.isOverLimit).toBe(true);
    expect(display.isNearLimit).toBe(false);
  });

  it('calculates display for unlimited spending', () => {
    const spend: UserSpend = {
      userId: 'user-123',
      month: '2026-01',
      cumulativeSpend: 500.0,
      limit: null,
      percentUsed: 0,
    };
    const display = calculateUserSpendingDisplay(spend);
    expect(display.isUnlimited).toBe(true);
    expect(display.isOverLimit).toBe(false);
    expect(display.isNearLimit).toBe(false);
  });
});

describe('Utility Functions', () => {
  describe('formatSpendAmount', () => {
    it('formats positive amounts', () => {
      expect(formatSpendAmount(100)).toBe('$100.00');
    });

    it('formats zero', () => {
      expect(formatSpendAmount(0)).toBe('$0.00');
    });

    it('formats decimal amounts', () => {
      expect(formatSpendAmount(50.5)).toBe('$50.50');
    });
  });

  describe('getCurrentMonth', () => {
    it('returns month in YYYY-MM format', () => {
      const month = getCurrentMonth();
      expect(month).toMatch(/^\d{4}-\d{2}$/);
    });
  });
});
