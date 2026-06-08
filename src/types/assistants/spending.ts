/**
 * Types for assistant spending limits and cumulative spend tracking.
 *
 * These types mirror the Orchestra API responses for spending data.
 */

import { ResponseProps } from '../common';
import { toDisplayCredits } from '@/lib/billing/currency';

/**
 * Cumulative spend data for an assistant in a given month.
 * Returned by GET /assistant/{id}/spend
 *
 * Amounts are in credits (the canonical wallet unit; 1 credit ≡ 1 USD
 * in the Stripe ledger today, but customer-facing surfaces denominate
 * in credits regardless of plan currency).
 */
export interface AssistantSpend {
  /** Assistant ID */
  agentId: string;
  /** Month in YYYY-MM format */
  month: string;
  /** Total spend for the month in credits */
  cumulativeSpend: number;
  /** Monthly spending limit in credits (null = unlimited) */
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
  /** Configured monthly spending cap in credits (null = no limit) */
  monthlySpendingCap: number | null;
  /** Effective limit after hierarchy constraints (may be lower than cap) */
  effectiveLimit: number | null;
}

/**
 * Request payload for setting a spending limit.
 */
export interface SpendingLimitRequest {
  /** Monthly spending cap in credits (null to remove limit) */
  monthlySpendingCap: number | null;
}

/**
 * Props for spending-related components.
 */
export interface SpendingDisplayProps {
  /** Current cumulative spend in credits */
  currentSpend: number;
  /** Spending limit in credits (null = unlimited) */
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
 * Format a USD spend/limit value as a customer-facing *credit count*.
 *
 * The wallet ledger denominates in a canonical USD value (1 internal
 * unit ≡ $1 in the Stripe ledger); customer-facing surfaces show
 * "credits" = USD × ``DISPLAY_CREDITS_PER_USD`` (display-only framing,
 * shared with the billing and usage pages). The multiplier is never
 * sent to the API; inputs displayed in credits convert back via
 * ``fromDisplayCredits`` at their save boundary. Plan-currency rendering
 * belongs on invoice surfaces only — see ``InvoicesTable.tsx`` and
 * ``MeteredBillingSection.tsx``.
 */
export function formatSpendAmount(amount: number): string {
  return `${toDisplayCredits(amount).toLocaleString('en-US')} credits`;
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
