/**
 * Types for assistant spending limits and cumulative spend tracking.
 *
 * These types mirror the Orchestra API responses for spending data.
 */

import { ResponseProps } from '../common';

/**
 * Cumulative spend data for an assistant in a given month.
 * Returned by GET /assistant/{id}/spend
 */
export interface AssistantSpend {
  /** Assistant ID */
  agentId: string;
  /** Month in YYYY-MM format */
  month: string;
  /** Total spend for the month in dollars */
  cumulativeSpend: number;
  /** Monthly spending limit in dollars (null = unlimited) */
  limit: number | null;
  /** Percentage of limit used (0-100+, can exceed 100 for soft limits) */
  percentUsed: number;
}

/**
 * Spending limit configuration for an assistant.
 * Returned by GET/PUT /assistant/{id}/spending-limit
 */
export interface SpendingLimitResponse {
  /** Assistant ID */
  agentId: string;
  /** Configured monthly spending cap in dollars (null = no limit) */
  monthlySpendingCap: number | null;
  /** Effective limit after hierarchy constraints (may be lower than cap) */
  effectiveLimit: number | null;
}

/**
 * Request payload for setting a spending limit.
 */
export interface SpendingLimitRequest {
  /** Monthly spending cap in dollars (null to remove limit) */
  monthlySpendingCap: number | null;
}

/**
 * Props for spending-related components.
 */
export interface SpendingDisplayProps {
  /** Current cumulative spend in dollars */
  currentSpend: number;
  /** Spending limit in dollars (null = unlimited) */
  limit: number | null;
  /** Percentage of limit used (0-100+) */
  percentUsed: number;
  /** Whether the limit has been exceeded */
  isOverLimit: boolean;
  /** Whether approaching the limit (>= 80%) */
  isNearLimit: boolean;
  /** Whether there is no limit set */
  isUnlimited: boolean;
}

/**
 * Type guard to check if a response is an error.
 */
export function isSpendingError(
  response: AssistantSpend | ResponseProps
): response is ResponseProps {
  return 'detail' in response;
}

/**
 * Type guard to check if a response is spending data.
 */
export function isSpendingData(
  response: AssistantSpend | ResponseProps
): response is AssistantSpend {
  return 'cumulativeSpend' in response;
}

/**
 * Type guard for spending limit response.
 */
export function isSpendingLimitError(
  response: SpendingLimitResponse | ResponseProps
): response is ResponseProps {
  return 'detail' in response;
}

/**
 * Type guard for spending limit data.
 */
export function isSpendingLimitData(
  response: SpendingLimitResponse | ResponseProps
): response is SpendingLimitResponse {
  return 'monthlySpendingCap' in response || 'effectiveLimit' in response;
}

/**
 * Calculate display props from spending data.
 */
export function calculateSpendingDisplay(spend: AssistantSpend): SpendingDisplayProps {
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

/**
 * Format a dollar amount for display.
 */
export function formatSpendAmount(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Get the current month in YYYY-MM format for a given timezone.
 */
export function getCurrentMonth(timezone?: string | null): string {
  const tz = timezone || 'UTC';
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    return `${year}-${month}`;
  } catch {
    // Fallback to UTC
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }
}
