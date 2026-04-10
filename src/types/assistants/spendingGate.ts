/**
 * Spending Gate Types
 *
 * Types for the spending gate system that blocks billable activity
 * when any applicable spending limit is reached.
 *
 * The spending gate checks three levels of limits:
 * 1. Assistant limit - specific to the current assistant
 * 2. User limit - the current user's personal limit (or member limit in org context)
 * 3. Org limit - the organization's overall limit (if in org context)
 *
 * If ANY of these limits are reached, billable activity is blocked.
 */

/**
 * The reason why spending is blocked.
 * Used for UI messaging and logging.
 */
export type SpendingBlockReason =
  | 'no_credits'
  | 'assistant_limit'
  | 'user_limit'
  | 'org_limit'
  | null;

/**
 * Status of the spending gate for a given context.
 * This is the primary interface for components to check if they should block activity.
 */
export interface SpendingGateStatus {
  /** Whether billable activity should be blocked */
  isBlocked: boolean;

  /** The reason for blocking (null if not blocked) */
  blockReason: SpendingBlockReason;

  /** User-friendly message explaining why activity is blocked */
  blockedMessage: string | null;

  /** Whether data is still loading (show loading state, don't block yet) */
  isLoading: boolean;

  /** Whether spending data is being refreshed in background */
  isRefreshing: boolean;

  /** Breakdown of each limit's status for debugging/display */
  limits: {
    assistant: LimitStatus | null;
    user: LimitStatus | null;
    org: LimitStatus | null;
  };
}

/**
 * Status of a single spending limit.
 */
export interface LimitStatus {
  /** Current spend amount in dollars */
  currentSpend: number;
  /** Limit amount in dollars (null = unlimited) */
  limit: number | null;
  /** Whether this limit is exceeded */
  isOverLimit: boolean;
  /** Whether approaching the limit (>= 80%) */
  isNearLimit: boolean;
  /** Whether there is no limit set */
  isUnlimited: boolean;
}

/**
 * Props for components that need spending gate status.
 * These are passed down from parent components.
 */
export interface SpendingGateProps {
  /** Current spending gate status */
  spendingGate: SpendingGateStatus;
}

/**
 * Default spending gate status when no data is available.
 * Does NOT block (fail open) but shows loading state.
 */
export const DEFAULT_SPENDING_GATE_STATUS: SpendingGateStatus = {
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
};

/**
 * Get user-friendly message for a block reason.
 */
export function getBlockedMessage(reason: SpendingBlockReason): string | null {
  switch (reason) {
    case 'no_credits':
      return 'You have run out of credits.';
    case 'assistant_limit':
      return "This assistant's monthly spending limit has been reached.";
    case 'user_limit':
      return 'Your monthly spending limit has been reached.';
    case 'org_limit':
      return "Your organization's monthly spending limit has been reached.";
    default:
      return null;
  }
}

/**
 * Determine the block reason from limit statuses.
 * Returns the first limit that is over (in priority order: assistant, user, org).
 */
export function determineBlockReason(
  assistantLimit: LimitStatus | null,
  userLimit: LimitStatus | null,
  orgLimit: LimitStatus | null
): SpendingBlockReason {
  // Check in priority order
  if (assistantLimit?.isOverLimit) return 'assistant_limit';
  if (userLimit?.isOverLimit) return 'user_limit';
  if (orgLimit?.isOverLimit) return 'org_limit';
  return null;
}
