/**
 * useSpendingGate - Hook for aggregating spending limit status across multiple levels.
 *
 * This hook combines spending status from:
 * - Assistant level (specific to the current assistant)
 * - User level (current user's personal or member limit)
 * - Organization level (if in org context)
 *
 * It returns a unified status that indicates whether billable activity should be blocked.
 *
 * Usage:
 * ```tsx
 * const spendingGate = useSpendingGate({
 *   assistantSpending: assistantSpendingData.display,
 *   userSpending: userSpendingData.display,
 *   orgSpending: orgSpendingData?.display ?? null,
 *   isLoading: isLoadingAny,
 * });
 *
 * if (spendingGate.isBlocked) {
 *   // Show blocked UI
 * }
 * ```
 */

import * as React from 'react';
import { IS_SELF_HOST } from '@/lib/auth/self-host';
import type { BillingMode } from '@/types/billing';
import { SpendingDisplayProps } from '@/types/assistants/spending';
import {
  SpendingGateStatus,
  SpendingBlockReason,
  LimitStatus,
  getBlockedMessage,
  determineBlockReason,
} from '@/types/assistants/spendingGate';

/**
 * Configuration for the useSpendingGate hook.
 */
export interface UseSpendingGateConfig {
  /** Assistant spending display props (null if loading/unavailable) */
  assistantSpending: SpendingDisplayProps | null;

  /** User spending display props (null if loading/unavailable) */
  userSpending: SpendingDisplayProps | null;

  /** Org spending display props (null if not in org context or loading) */
  orgSpending: SpendingDisplayProps | null;

  /** Whether any of the spending data is currently loading */
  isLoading: boolean;

  /** Whether any of the spending data is refreshing in background */
  isRefreshing?: boolean;

  /** Current credit balance (zero or below = exhausted). Omit to skip credit gating. */
  credits?: number;

  /** Whether credit balance is still loading */
  isBillingLoading?: boolean;

  /** Whether the current balance came from a successful billing lookup */
  isBalanceKnown?: boolean;

  /**
   * Active billing model. METERED accounts settle usage at month-end
   * via the metered invoicer; their wallet is frozen and not a
   * reliable spending signal — credit-exhaustion gating is skipped
   * entirely for METERED. Defaults to `'CREDITS'` for back-compat.
   */
  billingMode?: BillingMode;

  /** Whether the active org is in free-trial mode (affects blocked messages) */
  isFreeTrial?: boolean;
}

/**
 * Convert SpendingDisplayProps to LimitStatus.
 */
function toLimitStatus(display: SpendingDisplayProps | null): LimitStatus | null {
  if (!display) return null;

  return {
    currentSpend: display.currentSpend,
    limit: display.limit,
    isOverLimit: display.isOverLimit,
    isNearLimit: display.isNearLimit,
    isUnlimited: display.isUnlimited,
  };
}

/**
 * Hook for aggregating spending limit status.
 *
 * @param config Configuration with spending data from each level
 * @returns Unified spending gate status
 */
export function useSpendingGate({
  assistantSpending,
  userSpending,
  orgSpending,
  isLoading,
  isRefreshing = false,
  credits,
  isBillingLoading = false,
  isBalanceKnown = true,
  billingMode = 'CREDITS',
  isFreeTrial = false,
}: UseSpendingGateConfig): SpendingGateStatus {
  return React.useMemo(() => {
    if (IS_SELF_HOST) {
      return {
        isBlocked: false,
        blockReason: null,
        blockedMessage: null,
        isLoading: false,
        isRefreshing: false,
        limits: {
          assistant: toLimitStatus(assistantSpending),
          user: toLimitStatus(userSpending),
          org: toLimitStatus(orgSpending),
        },
      };
    }

    // Convert to limit status objects
    const assistantLimit = toLimitStatus(assistantSpending);
    const userLimit = toLimitStatus(userSpending);
    const orgLimit = toLimitStatus(orgSpending);

    // Credit exhaustion takes priority over spending limits, but only
    // for CREDITS accounts. METERED wallets are frozen and may carry
    // any leftover balance from a prior CREDITS phase — gate behaviour
    // for METERED is webhook-driven (`accountStatus` flips on
    // `invoice.payment_failed`) rather than balance-driven.
    const creditsExhausted =
      billingMode === 'CREDITS' &&
      credits !== undefined &&
      isBalanceKnown &&
      !isBillingLoading &&
      credits <= 0;

    const blockReason: SpendingBlockReason = creditsExhausted
      ? 'no_credits'
      : determineBlockReason(assistantLimit, userLimit, orgLimit);
    const isBlocked = blockReason !== null;
    const blockedMessage = getBlockedMessage(blockReason, isFreeTrial);

    return {
      isBlocked,
      blockReason,
      blockedMessage,
      isLoading,
      isRefreshing,
      limits: {
        assistant: assistantLimit,
        user: userLimit,
        org: orgLimit,
      },
    };
  }, [
    assistantSpending,
    userSpending,
    orgSpending,
    isLoading,
    isRefreshing,
    credits,
    isBillingLoading,
    isBalanceKnown,
    billingMode,
    isFreeTrial,
  ]);
}

/**
 * Helper to check if any limit is near (for warning display).
 */
export function isAnyLimitNear(status: SpendingGateStatus): boolean {
  const { limits } = status;
  return Boolean(
    limits.assistant?.isNearLimit || limits.user?.isNearLimit || limits.org?.isNearLimit
  );
}

/**
 * Get a warning message if any limit is near but not exceeded.
 */
export function getNearLimitWarning(status: SpendingGateStatus): string | null {
  if (status.isBlocked) return null; // Already blocked, no warning needed

  const { limits } = status;

  if (limits.assistant?.isNearLimit) {
    return 'This assistant is approaching its monthly spending limit.';
  }
  if (limits.user?.isNearLimit) {
    return 'You are approaching your monthly spending limit.';
  }
  if (limits.org?.isNearLimit) {
    return 'Your organization is approaching its monthly spending limit.';
  }

  return null;
}
