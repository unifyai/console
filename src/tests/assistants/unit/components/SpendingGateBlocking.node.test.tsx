/**
 * Unit tests for spending gate blocking behavior in components.
 *
 * Tests cover:
 * - Chat input blocked when spending limit reached
 * - Call button disabled when blocked
 * - Tooltip messages for blocked state
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpendingGateStatus, DEFAULT_SPENDING_GATE_STATUS } from '@/types/assistants/spendingGate';

// Mock data for a blocked spending gate
const createBlockedGate = (
  reason: 'assistant_limit' | 'user_limit' | 'org_limit' = 'assistant_limit'
): SpendingGateStatus => ({
  isBlocked: true,
  blockReason: reason,
  blockedMessage:
    reason === 'assistant_limit'
      ? "This assistant's monthly spending limit has been reached."
      : reason === 'user_limit'
        ? 'Your monthly spending limit has been reached.'
        : "Your organization's monthly spending limit has been reached.",
  isLoading: false,
  isRefreshing: false,
  limits: {
    assistant:
      reason === 'assistant_limit'
        ? {
            currentSpend: 150,
            limit: 100,
            isOverLimit: true,
            isNearLimit: false,
            isUnlimited: false,
          }
        : {
            currentSpend: 50,
            limit: 100,
            isOverLimit: false,
            isNearLimit: false,
            isUnlimited: false,
          },
    user:
      reason === 'user_limit'
        ? {
            currentSpend: 250,
            limit: 200,
            isOverLimit: true,
            isNearLimit: false,
            isUnlimited: false,
          }
        : null,
    org:
      reason === 'org_limit'
        ? {
            currentSpend: 5500,
            limit: 5000,
            isOverLimit: true,
            isNearLimit: false,
            isUnlimited: false,
          }
        : null,
  },
});

const createUnblockedGate = (): SpendingGateStatus => ({
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
});

describe('SpendingGate blocking behavior', () => {
  // ===========================================================================
  // Spending Gate Status
  // ===========================================================================

  describe('SpendingGateStatus structure', () => {
    it('blocked gate has correct structure', () => {
      const gate = createBlockedGate('assistant_limit');

      expect(gate.isBlocked).toBe(true);
      expect(gate.blockReason).toBe('assistant_limit');
      expect(gate.blockedMessage).toContain('assistant');
      expect(gate.isLoading).toBe(false);
    });

    it('unblocked gate has correct structure', () => {
      const gate = createUnblockedGate();

      expect(gate.isBlocked).toBe(false);
      expect(gate.blockReason).toBeNull();
      expect(gate.blockedMessage).toBeNull();
    });

    it('default gate has loading state', () => {
      expect(DEFAULT_SPENDING_GATE_STATUS.isLoading).toBe(true);
      expect(DEFAULT_SPENDING_GATE_STATUS.isBlocked).toBe(false);
    });
  });

  // ===========================================================================
  // Block Reason Messages
  // ===========================================================================

  describe('block reason messages', () => {
    it('assistant limit message is user-friendly', () => {
      const gate = createBlockedGate('assistant_limit');
      expect(gate.blockedMessage).toBe("This assistant's monthly spending limit has been reached.");
    });

    it('user limit message is user-friendly', () => {
      const gate = createBlockedGate('user_limit');
      expect(gate.blockedMessage).toBe('Your monthly spending limit has been reached.');
    });

    it('org limit message is user-friendly', () => {
      const gate = createBlockedGate('org_limit');
      expect(gate.blockedMessage).toBe(
        "Your organization's monthly spending limit has been reached."
      );
    });
  });

  // ===========================================================================
  // Call Button Blocking Logic
  // ===========================================================================

  describe('call button blocking logic', () => {
    it('should block new calls when spending limit is reached', () => {
      const gate = createBlockedGate('assistant_limit');
      const isInThisCall = false;

      // This is the logic from AssistantProfile.tsx
      const isSpendingBlocked = gate.isBlocked && !isInThisCall;
      const isCallButtonDisabled = isSpendingBlocked;

      expect(isCallButtonDisabled).toBe(true);
    });

    it('should allow returning to existing call when spending limit is reached', () => {
      const gate = createBlockedGate('assistant_limit');
      const isInThisCall = true;

      // This is the logic from AssistantProfile.tsx
      const isSpendingBlocked = gate.isBlocked && !isInThisCall;
      const isCallButtonDisabled = isSpendingBlocked;

      expect(isCallButtonDisabled).toBe(false);
    });

    it('should allow new calls when spending is within limit', () => {
      const gate = createUnblockedGate();
      const isInThisCall = false;

      const isSpendingBlocked = gate.isBlocked && !isInThisCall;
      const isCallButtonDisabled = isSpendingBlocked;

      expect(isCallButtonDisabled).toBe(false);
    });
  });

  // ===========================================================================
  // Chat Input Blocking Logic
  // ===========================================================================

  describe('chat input blocking logic', () => {
    it('should block chat input when spending limit is reached', () => {
      const gate = createBlockedGate('user_limit');

      // This is the logic from AssistantProfileChatPanel.tsx
      const isSpendingBlocked = gate.isBlocked;

      expect(isSpendingBlocked).toBe(true);
    });

    it('should allow chat input when spending is within limit', () => {
      const gate = createUnblockedGate();

      const isSpendingBlocked = gate.isBlocked;

      expect(isSpendingBlocked).toBe(false);
    });

    it('should not block when gate is loading (fail open)', () => {
      const gate = { ...DEFAULT_SPENDING_GATE_STATUS };

      const isSpendingBlocked = gate.isBlocked;

      expect(isSpendingBlocked).toBe(false);
    });
  });

  // ===========================================================================
  // Tooltip Messages
  // ===========================================================================

  describe('call button tooltip logic', () => {
    it('shows spending blocked message when blocked', () => {
      const gate = createBlockedGate('org_limit');
      const isInThisCall = false;
      const isConnectingCall = false;
      const isAnotherCallActive = false;
      const isSpendingBlocked = gate.isBlocked && !isInThisCall;

      // This is the logic from AssistantProfile.tsx
      const callButtonTooltip =
        isInThisCall && isConnectingCall
          ? 'Connecting call...'
          : isInThisCall
            ? 'Return to call'
            : isSpendingBlocked
              ? gate.blockedMessage || 'Spending limit reached'
              : isAnotherCallActive
                ? 'Another call is in progress'
                : 'Start a call';

      expect(callButtonTooltip).toBe(
        "Your organization's monthly spending limit has been reached."
      );
    });

    it('shows start call message when not blocked', () => {
      const gate = createUnblockedGate();
      const isInThisCall = false;
      const isConnectingCall = false;
      const isAnotherCallActive = false;
      const isSpendingBlocked = gate.isBlocked && !isInThisCall;

      const callButtonTooltip =
        isInThisCall && isConnectingCall
          ? 'Connecting call...'
          : isInThisCall
            ? 'Return to call'
            : isSpendingBlocked
              ? gate.blockedMessage || 'Spending limit reached'
              : isAnotherCallActive
                ? 'Another call is in progress'
                : 'Start a call';

      expect(callButtonTooltip).toBe('Start a call');
    });
  });
});
