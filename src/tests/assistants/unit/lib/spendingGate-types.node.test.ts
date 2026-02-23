/**
 * Unit tests for spending gate types and utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
  SpendingBlockReason,
  LimitStatus,
  getBlockedMessage,
  determineBlockReason,
  DEFAULT_SPENDING_GATE_STATUS,
} from '@/types/assistants/spendingGate';

describe('spendingGate types', () => {
  // ===========================================================================
  // getBlockedMessage
  // ===========================================================================

  describe('getBlockedMessage', () => {
    it('returns correct message for assistant_limit', () => {
      expect(getBlockedMessage('assistant_limit')).toBe(
        "This assistant's monthly spending limit has been reached."
      );
    });

    it('returns correct message for user_limit', () => {
      expect(getBlockedMessage('user_limit')).toBe('Your monthly spending limit has been reached.');
    });

    it('returns correct message for org_limit', () => {
      expect(getBlockedMessage('org_limit')).toBe(
        "Your organization's monthly spending limit has been reached."
      );
    });

    it('returns null for null reason', () => {
      expect(getBlockedMessage(null)).toBeNull();
    });
  });

  // ===========================================================================
  // determineBlockReason
  // ===========================================================================

  describe('determineBlockReason', () => {
    const createLimitStatus = (overrides: Partial<LimitStatus> = {}): LimitStatus => ({
      currentSpend: 50,
      limit: 100,
      isOverLimit: false,
      isNearLimit: false,
      isUnlimited: false,
      ...overrides,
    });

    it('returns null when no limits are over', () => {
      const result = determineBlockReason(
        createLimitStatus(),
        createLimitStatus(),
        createLimitStatus()
      );
      expect(result).toBeNull();
    });

    it('returns assistant_limit when assistant is over', () => {
      const result = determineBlockReason(
        createLimitStatus({ isOverLimit: true }),
        createLimitStatus(),
        createLimitStatus()
      );
      expect(result).toBe('assistant_limit');
    });

    it('returns user_limit when user is over and assistant is ok', () => {
      const result = determineBlockReason(
        createLimitStatus(),
        createLimitStatus({ isOverLimit: true }),
        createLimitStatus()
      );
      expect(result).toBe('user_limit');
    });

    it('returns org_limit when org is over and others are ok', () => {
      const result = determineBlockReason(
        createLimitStatus(),
        createLimitStatus(),
        createLimitStatus({ isOverLimit: true })
      );
      expect(result).toBe('org_limit');
    });

    it('prioritizes assistant over user when both are over', () => {
      const result = determineBlockReason(
        createLimitStatus({ isOverLimit: true }),
        createLimitStatus({ isOverLimit: true }),
        createLimitStatus()
      );
      expect(result).toBe('assistant_limit');
    });

    it('prioritizes user over org when both are over', () => {
      const result = determineBlockReason(
        createLimitStatus(),
        createLimitStatus({ isOverLimit: true }),
        createLimitStatus({ isOverLimit: true })
      );
      expect(result).toBe('user_limit');
    });

    it('handles null limits gracefully', () => {
      const result = determineBlockReason(null, null, null);
      expect(result).toBeNull();
    });

    it('handles mixed null and valid limits', () => {
      const result = determineBlockReason(null, createLimitStatus({ isOverLimit: true }), null);
      expect(result).toBe('user_limit');
    });
  });

  // ===========================================================================
  // DEFAULT_SPENDING_GATE_STATUS
  // ===========================================================================

  describe('DEFAULT_SPENDING_GATE_STATUS', () => {
    it('has correct default values', () => {
      expect(DEFAULT_SPENDING_GATE_STATUS).toEqual({
        isBlocked: false,
        blockReason: null,
        blockedMessage: null,
        isLoading: true,
        isRefreshing: false,
        limits: {
          assistant: null,
          user: null,
          org: null,
        },
      });
    });

    it('defaults to not blocked (fail open)', () => {
      expect(DEFAULT_SPENDING_GATE_STATUS.isBlocked).toBe(false);
    });

    it('defaults to loading state', () => {
      expect(DEFAULT_SPENDING_GATE_STATUS.isLoading).toBe(true);
    });
  });
});
