/**
 * Unit tests for organization member spending types
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  MemberSpend,
  MemberSpendingLimitResponse,
  MemberSpendingLimitRequest,
  isMemberSpendData,
  isMemberSpendError,
  isMemberSpendingLimitData,
  isMemberSpendingLimitError,
  calculateMemberSpendingDisplay,
} from '@/types/organization';
import { ResponseProps } from '@/types/common';

describe('Member Spending Types', () => {
  describe('MemberSpend interface', () => {
    it('should correctly structure member spend data', () => {
      const spend: MemberSpend = {
        orgId: 1,
        userId: 'user-123',
        month: '2026-01',
        cumulativeSpend: 45.5,
        limit: 100,
        percentUsed: 45.5,
      };

      expect(spend.orgId).toBe(1);
      expect(spend.userId).toBe('user-123');
      expect(spend.month).toBe('2026-01');
      expect(spend.cumulativeSpend).toBe(45.5);
      expect(spend.limit).toBe(100);
      expect(spend.percentUsed).toBe(45.5);
    });

    it('should allow null limit for unlimited spending', () => {
      const spend: MemberSpend = {
        orgId: 1,
        userId: 'user-123',
        month: '2026-01',
        cumulativeSpend: 200,
        limit: null,
        percentUsed: 0,
      };

      expect(spend.limit).toBeNull();
    });
  });

  describe('MemberSpendingLimitResponse interface', () => {
    it('should correctly structure spending limit response', () => {
      const response: MemberSpendingLimitResponse = {
        orgId: 1,
        userId: 'user-123',
        monthlySpendingCap: 100,
      };

      expect(response.orgId).toBe(1);
      expect(response.userId).toBe('user-123');
      expect(response.monthlySpendingCap).toBe(100);
    });

    it('should include cascaded updates when present', () => {
      const response: MemberSpendingLimitResponse = {
        orgId: 1,
        userId: 'user-123',
        monthlySpendingCap: 50,
        cascadedUpdates: { assistantsCapped: 3 },
      };

      expect(response.cascadedUpdates?.assistantsCapped).toBe(3);
    });
  });

  describe('MemberSpendingLimitRequest interface', () => {
    it('should correctly structure spending limit request', () => {
      const request: MemberSpendingLimitRequest = {
        monthlySpendingCap: 150,
      };

      expect(request.monthlySpendingCap).toBe(150);
    });

    it('should allow null to remove limit', () => {
      const request: MemberSpendingLimitRequest = {
        monthlySpendingCap: null,
      };

      expect(request.monthlySpendingCap).toBeNull();
    });
  });
});

describe('Member Spending Type Guards', () => {
  describe('isMemberSpendData', () => {
    it('should return true for valid member spend data', () => {
      const spend: MemberSpend = {
        orgId: 1,
        userId: 'user-123',
        month: '2026-01',
        cumulativeSpend: 45.5,
        limit: 100,
        percentUsed: 45.5,
      };

      expect(isMemberSpendData(spend)).toBe(true);
    });

    it('should return false for error response', () => {
      const error: ResponseProps = {
        detail: 'Member not found',
      };

      expect(isMemberSpendData(error)).toBe(false);
    });
  });

  describe('isMemberSpendError', () => {
    it('should return true for error response', () => {
      const error: ResponseProps = {
        detail: 'Member not found',
      };

      expect(isMemberSpendError(error)).toBe(true);
    });

    it('should return false for valid member spend data', () => {
      const spend: MemberSpend = {
        orgId: 1,
        userId: 'user-123',
        month: '2026-01',
        cumulativeSpend: 45.5,
        limit: 100,
        percentUsed: 45.5,
      };

      expect(isMemberSpendError(spend)).toBe(false);
    });
  });

  describe('isMemberSpendingLimitData', () => {
    it('should return true for valid spending limit data', () => {
      const limit: MemberSpendingLimitResponse = {
        orgId: 1,
        userId: 'user-123',
        monthlySpendingCap: 100,
      };

      expect(isMemberSpendingLimitData(limit)).toBe(true);
    });

    it('should return false for error response', () => {
      const error: ResponseProps = {
        detail: 'Unauthorized',
      };

      expect(isMemberSpendingLimitData(error)).toBe(false);
    });
  });

  describe('isMemberSpendingLimitError', () => {
    it('should return true for error response', () => {
      const error: ResponseProps = {
        detail: 'Unauthorized',
      };

      expect(isMemberSpendingLimitError(error)).toBe(true);
    });

    it('should return false for valid spending limit data', () => {
      const limit: MemberSpendingLimitResponse = {
        orgId: 1,
        userId: 'user-123',
        monthlySpendingCap: 100,
      };

      expect(isMemberSpendingLimitError(limit)).toBe(false);
    });
  });
});

describe('calculateMemberSpendingDisplay', () => {
  it('should calculate display props for normal spend', () => {
    const spend: MemberSpend = {
      orgId: 1,
      userId: 'user-123',
      month: '2026-01',
      cumulativeSpend: 45.5,
      limit: 100,
      percentUsed: 45.5,
    };

    const display = calculateMemberSpendingDisplay(spend);

    expect(display.currentSpend).toBe(45.5);
    expect(display.limit).toBe(100);
    expect(display.percentUsed).toBe(45.5);
    expect(display.isOverLimit).toBe(false);
    expect(display.isNearLimit).toBe(false);
    expect(display.isUnlimited).toBe(false);
  });

  it('should indicate near limit when 80% or more used', () => {
    const spend: MemberSpend = {
      orgId: 1,
      userId: 'user-123',
      month: '2026-01',
      cumulativeSpend: 85,
      limit: 100,
      percentUsed: 85,
    };

    const display = calculateMemberSpendingDisplay(spend);

    expect(display.isNearLimit).toBe(true);
    expect(display.isOverLimit).toBe(false);
  });

  it('should indicate over limit when spend exceeds limit', () => {
    const spend: MemberSpend = {
      orgId: 1,
      userId: 'user-123',
      month: '2026-01',
      cumulativeSpend: 110,
      limit: 100,
      percentUsed: 110,
    };

    const display = calculateMemberSpendingDisplay(spend);

    expect(display.isOverLimit).toBe(true);
    expect(display.isNearLimit).toBe(false);
  });

  it('should indicate unlimited when no limit set', () => {
    const spend: MemberSpend = {
      orgId: 1,
      userId: 'user-123',
      month: '2026-01',
      cumulativeSpend: 200,
      limit: null,
      percentUsed: 0,
    };

    const display = calculateMemberSpendingDisplay(spend);

    expect(display.isUnlimited).toBe(true);
    expect(display.isOverLimit).toBe(false);
    expect(display.isNearLimit).toBe(false);
  });

  it('should handle zero spend', () => {
    const spend: MemberSpend = {
      orgId: 1,
      userId: 'user-123',
      month: '2026-01',
      cumulativeSpend: 0,
      limit: 100,
      percentUsed: 0,
    };

    const display = calculateMemberSpendingDisplay(spend);

    expect(display.currentSpend).toBe(0);
    expect(display.percentUsed).toBe(0);
    expect(display.isOverLimit).toBe(false);
    expect(display.isNearLimit).toBe(false);
  });
});
