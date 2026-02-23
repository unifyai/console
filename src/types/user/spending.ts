/**
 * User Spending Types
 *
 * TypeScript interfaces and utilities for user spending limits
 * and cumulative spend tracking in personal workspaces.
 */

import { ResponseProps } from '@/types/common';
import { SpendingDisplayProps } from '@/types/assistants/spending';

// Re-export shared utilities
export type { SpendingDisplayProps } from '@/types/assistants/spending';
export { formatSpendAmount, getCurrentMonth } from '@/types/assistants/spending';

/**
 * User's cumulative spend data for a given month.
 * Returned by GET /api/user/spending
 */
export interface UserSpend {
  /** User ID */
  userId: string;
  /** Month in YYYY-MM format */
  month: string;
  /** Total spend this month in dollars */
  cumulativeSpend: number;
  /** Monthly spending limit (null = unlimited) */
  limit: number | null;
  /** Percentage of limit used (0-100+), null if no limit */
  percentUsed: number;
}

/**
 * User's spending limit configuration.
 * Returned by GET/PUT /api/user/spending-limit
 */
export interface UserSpendingLimitResponse {
  /** User ID */
  userId: string;
  /** Monthly spending cap in dollars (null = unlimited) */
  monthlySpendingCap: number | null;
  /** Number of assistants that were capped (on update) */
  assistantsCapped?: number;
}

/**
 * Request payload for updating user spending limit.
 * Used by PUT /api/user/spending-limit
 */
export interface UserSpendingLimitRequest {
  /** Monthly spending cap in dollars (null = remove limit) */
  monthlySpendingCap: number | null;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a response is a UserSpend object (success case).
 */
export function isUserSpendData(response: UserSpend | ResponseProps): response is UserSpend {
  return (
    response !== null &&
    typeof response === 'object' &&
    'userId' in response &&
    'month' in response &&
    'cumulativeSpend' in response &&
    !('detail' in response && !('limit' in response))
  );
}

/**
 * Check if a response is an error (has detail property).
 */
export function isUserSpendError(response: UserSpend | ResponseProps): response is ResponseProps {
  return (
    response !== null &&
    typeof response === 'object' &&
    'detail' in response &&
    !('cumulativeSpend' in response)
  );
}

/**
 * Check if a response is a UserSpendingLimitResponse object (success case).
 */
export function isUserSpendingLimitData(
  response: UserSpendingLimitResponse | ResponseProps
): response is UserSpendingLimitResponse {
  return (
    response !== null &&
    typeof response === 'object' &&
    'userId' in response &&
    'monthlySpendingCap' in response
  );
}

/**
 * Check if a response is an error (has detail property).
 */
export function isUserSpendingLimitError(
  response: UserSpendingLimitResponse | ResponseProps
): response is ResponseProps {
  return (
    response !== null &&
    typeof response === 'object' &&
    'detail' in response &&
    !('monthlySpendingCap' in response)
  );
}

// ============================================================================
// Display Utilities
// ============================================================================

/**
 * Calculate display properties for user spending UI.
 *
 * @param spend - User spend data
 * @returns Display properties for UI components
 */
export function calculateUserSpendingDisplay(spend: UserSpend): SpendingDisplayProps {
  const isUnlimited = spend.limit === null;
  const isOverLimit = !isUnlimited && spend.cumulativeSpend >= spend.limit!;
  const isNearLimit = !isUnlimited && !isOverLimit && spend.percentUsed >= 80;

  return {
    currentSpend: spend.cumulativeSpend,
    limit: spend.limit,
    percentUsed: spend.percentUsed,
    isOverLimit,
    isNearLimit,
    isUnlimited,
  };
}
