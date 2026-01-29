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
}: UseSpendingGateConfig): SpendingGateStatus {
  return React.useMemo(() => {
    // Convert to limit status objects
    const assistantLimit = toLimitStatus(assistantSpending);
    const userLimit = toLimitStatus(userSpending);
    const orgLimit = toLimitStatus(orgSpending);

    // Determine if blocked and why
    const blockReason = determineBlockReason(assistantLimit, userLimit, orgLimit);
    const isBlocked = blockReason !== null;
    const blockedMessage = getBlockedMessage(blockReason);

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
  }, [assistantSpending, userSpending, orgSpending, isLoading, isRefreshing]);
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
