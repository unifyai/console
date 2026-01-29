/**
 * Unit tests for useSpendingGate hook.
 *
 * Tests cover:
 * - Basic blocking logic
 * - Priority order of block reasons
 * - Loading state handling
 * - Near-limit warning helpers
 * - Edge cases
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useSpendingGate,
  isAnyLimitNear,
  getNearLimitWarning,
} from '@/hooks/Assistants/useSpendingGate';
import { SpendingDisplayProps } from '@/types/assistants/spending';
import { SpendingGateStatus } from '@/types/assistants/spendingGate';

// Test data factories
const createSpendingDisplay = (
  overrides: Partial<SpendingDisplayProps> = {}
): SpendingDisplayProps => ({
  currentSpend: 50,
  limit: 100,
  percentUsed: 50,
  isOverLimit: false,
  isNearLimit: false,
  isUnlimited: false,
  ...overrides,
});

const createOverLimitDisplay = (): SpendingDisplayProps =>
  createSpendingDisplay({
    currentSpend: 150,
    limit: 100,
    percentUsed: 150,
    isOverLimit: true,
  });

const createNearLimitDisplay = (): SpendingDisplayProps =>
  createSpendingDisplay({
    currentSpend: 85,
    limit: 100,
    percentUsed: 85,
    isNearLimit: true,
  });

const createUnlimitedDisplay = (): SpendingDisplayProps =>
  createSpendingDisplay({
    currentSpend: 50,
    limit: null,
    percentUsed: 0,
    isUnlimited: true,
  });

describe('useSpendingGate', () => {
  // ===========================================================================
  // Basic Blocking Logic
  // ===========================================================================

  describe('basic blocking logic', () => {
    it('returns not blocked when all limits are within bounds', () => {
      const { result } = renderHook(() =>
        useSpendingGate({
          assistantSpending: createSpendingDisplay(),
          userSpending: createSpendingDisplay(),
          orgSpending: createSpendingDisplay(),
          isLoading: false,
        })
      );

      expect(result.current.isBlocked).toBe(false);
      expect(result.current.blockReason).toBeNull();
      expect(result.current.blockedMessage).toBeNull();
    });

    it('returns blocked when assistant limit is exceeded', () => {
      const { result } = renderHook(() =>
        useSpendingGate({
          assistantSpending: createOverLimitDisplay(),
          userSpending: createSpendingDisplay(),
          orgSpending: createSpendingDisplay(),
          isLoading: false,
        })
      );

      expect(result.current.isBlocked).toBe(true);
      expect(result.current.blockReason).toBe('assistant_limit');
      expect(result.current.blockedMessage).toBe(
        "This assistant's monthly spending limit has been reached."
      );
    });

    it('returns blocked when user limit is exceeded', () => {
      const { result } = renderHook(() =>
        useSpendingGate({
          assistantSpending: createSpendingDisplay(),
          userSpending: createOverLimitDisplay(),
          orgSpending: createSpendingDisplay(),
          isLoading: false,
        })
      );

      expect(result.current.isBlocked).toBe(true);
      expect(result.current.blockReason).toBe('user_limit');
      expect(result.current.blockedMessage).toBe('Your monthly spending limit has been reached.');
    });

    it('returns blocked when org limit is exceeded', () => {
      const { result } = renderHook(() =>
        useSpendingGate({
          assistantSpending: createSpendingDisplay(),
          userSpending: createSpendingDisplay(),
          orgSpending: createOverLimitDisplay(),
          isLoading: false,
        })
      );

      expect(result.current.isBlocked).toBe(true);
      expect(result.current.blockReason).toBe('org_limit');
      expect(result.current.blockedMessage).toBe(
        "Your organization's monthly spending limit has been reached."
      );
    });

    it('does not block when limits are unlimited', () => {
      const { result } = renderHook(() =>
        useSpendingGate({
          assistantSpending: createUnlimitedDisplay(),
          userSpending: createUnlimitedDisplay(),
          orgSpending: createUnlimitedDisplay(),
          isLoading: false,
        })
      );

      expect(result.current.isBlocked).toBe(false);
      expect(result.current.blockReason).toBeNull();
    });
  });

  // ===========================================================================
  // Priority Order
  // ===========================================================================

  describe('priority order of block reasons', () => {
    it('prioritizes assistant limit over user and org limits', () => {
      const { result } = renderHook(() =>
        useSpendingGate({
          assistantSpending: createOverLimitDisplay(),
          userSpending: createOverLimitDisplay(),
          orgSpending: createOverLimitDisplay(),
          isLoading: false,
        })
      );

      expect(result.current.blockReason).toBe('assistant_limit');
    });

    it('prioritizes user limit over org limit when assistant is ok', () => {
      const { result } = renderHook(() =>
        useSpendingGate({
          assistantSpending: createSpendingDisplay(),
          userSpending: createOverLimitDisplay(),
          orgSpending: createOverLimitDisplay(),
          isLoading: false,
        })
      );

      expect(result.current.blockReason).toBe('user_limit');
    });

    it('uses org limit when assistant and user are ok', () => {
      const { result } = renderHook(() =>
        useSpendingGate({
          assistantSpending: createSpendingDisplay(),
          userSpending: createSpendingDisplay(),
          orgSpending: createOverLimitDisplay(),
          isLoading: false,
        })
      );

      expect(result.current.blockReason).toBe('org_limit');
    });
  });

  // ===========================================================================
  // Loading State
  // ===========================================================================

  describe('loading state handling', () => {
    it('propagates isLoading state', () => {
      const { result } = renderHook(() =>
        useSpendingGate({
          assistantSpending: null,
          userSpending: null,
          orgSpending: null,
          isLoading: true,
        })
      );

      expect(result.current.isLoading).toBe(true);
      // Should not block while loading (fail open)
      expect(result.current.isBlocked).toBe(false);
    });

    it('propagates isRefreshing state', () => {
      const { result } = renderHook(() =>
        useSpendingGate({
          assistantSpending: createSpendingDisplay(),
          userSpending: createSpendingDisplay(),
          orgSpending: null,
          isLoading: false,
          isRefreshing: true,
        })
      );

      expect(result.current.isRefreshing).toBe(true);
    });

    it('does not block when spending data is null (loading/unavailable)', () => {
      const { result } = renderHook(() =>
        useSpendingGate({
          assistantSpending: null,
          userSpending: null,
          orgSpending: null,
          isLoading: false,
        })
      );

      // Fail open - don't block when data isn't available
      expect(result.current.isBlocked).toBe(false);
    });
  });

  // ===========================================================================
  // Null Handling
  // ===========================================================================

  describe('null spending data handling', () => {
    it('handles null assistant spending (personal workspace scenario)', () => {
      const { result } = renderHook(() =>
        useSpendingGate({
          assistantSpending: null,
          userSpending: createOverLimitDisplay(),
          orgSpending: null,
          isLoading: false,
        })
      );

      expect(result.current.isBlocked).toBe(true);
      expect(result.current.blockReason).toBe('user_limit');
    });

    it('handles null org spending (personal workspace scenario)', () => {
      const { result } = renderHook(() =>
        useSpendingGate({
          assistantSpending: createSpendingDisplay(),
          userSpending: createSpendingDisplay(),
          orgSpending: null,
          isLoading: false,
        })
      );

      expect(result.current.isBlocked).toBe(false);
      expect(result.current.limits.org).toBeNull();
    });

    it('handles all null spending data gracefully', () => {
      const { result } = renderHook(() =>
        useSpendingGate({
          assistantSpending: null,
          userSpending: null,
          orgSpending: null,
          isLoading: false,
        })
      );

      expect(result.current.isBlocked).toBe(false);
      expect(result.current.limits.assistant).toBeNull();
      expect(result.current.limits.user).toBeNull();
      expect(result.current.limits.org).toBeNull();
    });
  });

  // ===========================================================================
  // Limits Object
  // ===========================================================================

  describe('limits object structure', () => {
    it('correctly converts spending display to limit status', () => {
      const assistantDisplay = createSpendingDisplay({
        currentSpend: 75,
        limit: 100,
        percentUsed: 75,
        isNearLimit: false,
        isOverLimit: false,
        isUnlimited: false,
      });

      const { result } = renderHook(() =>
        useSpendingGate({
          assistantSpending: assistantDisplay,
          userSpending: null,
          orgSpending: null,
          isLoading: false,
        })
      );

      expect(result.current.limits.assistant).toEqual({
        currentSpend: 75,
        limit: 100,
        isOverLimit: false,
        isNearLimit: false,
        isUnlimited: false,
      });
    });
  });
});

// ===========================================================================
// Helper Functions
// ===========================================================================

describe('isAnyLimitNear', () => {
  it('returns true when assistant limit is near', () => {
    const status: SpendingGateStatus = {
      isBlocked: false,
      blockReason: null,
      blockedMessage: null,
      isLoading: false,
      isRefreshing: false,
      limits: {
        assistant: {
          currentSpend: 85,
          limit: 100,
          isOverLimit: false,
          isNearLimit: true,
          isUnlimited: false,
        },
        user: null,
        org: null,
      },
    };

    expect(isAnyLimitNear(status)).toBe(true);
  });

  it('returns true when user limit is near', () => {
    const status: SpendingGateStatus = {
      isBlocked: false,
      blockReason: null,
      blockedMessage: null,
      isLoading: false,
      isRefreshing: false,
      limits: {
        assistant: null,
        user: {
          currentSpend: 180,
          limit: 200,
          isOverLimit: false,
          isNearLimit: true,
          isUnlimited: false,
        },
        org: null,
      },
    };

    expect(isAnyLimitNear(status)).toBe(true);
  });

  it('returns false when no limits are near', () => {
    const status: SpendingGateStatus = {
      isBlocked: false,
      blockReason: null,
      blockedMessage: null,
      isLoading: false,
      isRefreshing: false,
      limits: {
        assistant: {
          currentSpend: 50,
          limit: 100,
          isOverLimit: false,
          isNearLimit: false,
          isUnlimited: false,
        },
        user: {
          currentSpend: 100,
          limit: 200,
          isOverLimit: false,
          isNearLimit: false,
          isUnlimited: false,
        },
        org: null,
      },
    };

    expect(isAnyLimitNear(status)).toBe(false);
  });
});

describe('getNearLimitWarning', () => {
  it('returns null when blocked (no warning needed)', () => {
    const status: SpendingGateStatus = {
      isBlocked: true,
      blockReason: 'assistant_limit',
      blockedMessage: 'Blocked',
      isLoading: false,
      isRefreshing: false,
      limits: {
        assistant: {
          currentSpend: 150,
          limit: 100,
          isOverLimit: true,
          isNearLimit: false,
          isUnlimited: false,
        },
        user: null,
        org: null,
      },
    };

    expect(getNearLimitWarning(status)).toBeNull();
  });

  it('returns assistant warning when assistant is near limit', () => {
    const status: SpendingGateStatus = {
      isBlocked: false,
      blockReason: null,
      blockedMessage: null,
      isLoading: false,
      isRefreshing: false,
      limits: {
        assistant: {
          currentSpend: 85,
          limit: 100,
          isOverLimit: false,
          isNearLimit: true,
          isUnlimited: false,
        },
        user: null,
        org: null,
      },
    };

    expect(getNearLimitWarning(status)).toBe(
      'This assistant is approaching its monthly spending limit.'
    );
  });

  it('returns user warning when user is near limit', () => {
    const status: SpendingGateStatus = {
      isBlocked: false,
      blockReason: null,
      blockedMessage: null,
      isLoading: false,
      isRefreshing: false,
      limits: {
        assistant: null,
        user: {
          currentSpend: 180,
          limit: 200,
          isOverLimit: false,
          isNearLimit: true,
          isUnlimited: false,
        },
        org: null,
      },
    };

    expect(getNearLimitWarning(status)).toBe('You are approaching your monthly spending limit.');
  });

  it('returns org warning when org is near limit', () => {
    const status: SpendingGateStatus = {
      isBlocked: false,
      blockReason: null,
      blockedMessage: null,
      isLoading: false,
      isRefreshing: false,
      limits: {
        assistant: null,
        user: null,
        org: {
          currentSpend: 4500,
          limit: 5000,
          isOverLimit: false,
          isNearLimit: true,
          isUnlimited: false,
        },
      },
    };

    expect(getNearLimitWarning(status)).toBe(
      'Your organization is approaching its monthly spending limit.'
    );
  });

  it('returns null when no limits are near', () => {
    const status: SpendingGateStatus = {
      isBlocked: false,
      blockReason: null,
      blockedMessage: null,
      isLoading: false,
      isRefreshing: false,
      limits: {
        assistant: {
          currentSpend: 50,
          limit: 100,
          isOverLimit: false,
          isNearLimit: false,
          isUnlimited: false,
        },
        user: null,
        org: null,
      },
    };

    expect(getNearLimitWarning(status)).toBeNull();
  });

  it('prioritizes assistant warning over user and org', () => {
    const status: SpendingGateStatus = {
      isBlocked: false,
      blockReason: null,
      blockedMessage: null,
      isLoading: false,
      isRefreshing: false,
      limits: {
        assistant: {
          currentSpend: 85,
          limit: 100,
          isOverLimit: false,
          isNearLimit: true,
          isUnlimited: false,
        },
        user: {
          currentSpend: 180,
          limit: 200,
          isOverLimit: false,
          isNearLimit: true,
          isUnlimited: false,
        },
        org: {
          currentSpend: 4500,
          limit: 5000,
          isOverLimit: false,
          isNearLimit: true,
          isUnlimited: false,
        },
      },
    };

    expect(getNearLimitWarning(status)).toBe(
      'This assistant is approaching its monthly spending limit.'
    );
  });
});
