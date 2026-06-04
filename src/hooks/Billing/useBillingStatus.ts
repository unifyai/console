/**
 * useBillingStatus - Hook for querying the billing readiness of the current workspace.
 *
 * Returns whether the active billing account has:
 *   - A positive credit balance
 *   - Prior billing history (at least one paid recharge)
 *
 * This is the foundational hook used by BillableActionGuard to decide
 * whether to gate billable actions behind a "purchase credits" prompt.
 *
 * Usage:
 * ```tsx
 * const { hasCredits, isLoading, startPolling } = useBillingStatus();
 *
 * if (!hasCredits) {
 *   // Show "purchase credits" prompt
 * }
 *
 * // After checkout, poll until credits land:
 * startPolling();
 * ```
 */

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BillingMode } from '@/types/billing';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BillingStatusData {
  /** Whether the current balance came from a successful billing lookup */
  isBalanceKnown: boolean;
  /** Whether the account has prior billing history (at least one paid recharge) */
  hasBillingHistory: boolean;
  /** Current credit balance */
  credits: number;
  /** Convenience: credits > 0 */
  hasCredits: boolean;
  /** Account status: ACTIVE, PAST_DUE, SUSPENDED, or CLOSED */
  accountStatus: string;
  /**
   * Active billing model (managed-billing). METERED accounts pay
   * by monthly invoice; their wallet balance is frozen (no automatic
   * writes from usage) and may carry any leftover balance from a
   * prior CREDITS phase. `BillableActionGuard` keys off this to
   * bypass the `hasCredits` gate regardless of the displayed
   * balance. Defaults to 'CREDITS' for back-compat with older
   * orchestra builds that don't surface the field.
   */
  billingMode: BillingMode;
}

export interface UseBillingStatusReturn extends BillingStatusData {
  isLoading: boolean;
  error: string | null;
  /** Manually refetch billing status */
  refetch: () => void;
  /**
   * Start aggressive polling (every 2 s) until credits appear or 30 s
   * elapse.  Useful after checkout to bridge the gap between Stripe
   * confirming payment and the webhook crediting the balance.
   */
  startPolling: () => void;
}

// ─── Fetch helper (single call) ─────────────────────────────────────────────

/**
 * Fetches billing status from a single endpoint.
 * Returns balance, billing history, and derived flags.
 * Exported for unit testing without React.
 */
export async function fetchBillingStatus(): Promise<BillingStatusData> {
  const res = await fetch('/api/billing/balance');
  if (!res.ok) {
    return {
      isBalanceKnown: false,
      hasBillingHistory: false,
      credits: 0,
      hasCredits: false,
      accountStatus: 'ACTIVE',
      billingMode: 'CREDITS',
    };
  }

  const data = await res.json();
  const credits =
    typeof data.fullBalance === 'number' ? data.fullBalance : parseFloat(data.balance) || 0;
  const billingMode: BillingMode = data.billingMode === 'METERED' ? 'METERED' : 'CREDITS';

  return {
    isBalanceKnown: true,
    hasBillingHistory: data.lastRechargeAt != null,
    credits,
    // METERED accounts settle usage at month-end via the metered
    // invoicer; the wallet is frozen and not a reliable spending
    // signal — they are *always* "has credits" from the guard's
    // perspective. The legacy CREDITS path keeps the strict
    // `credits > 0` rule.
    hasCredits: billingMode === 'METERED' ? true : credits > 0,
    accountStatus: data.accountStatus ?? 'ACTIVE',
    billingMode,
  };
}

// ─── React Query key ─────────────────────────────────────────────────────────

export const BILLING_STATUS_QUERY_KEY = ['billing', 'status'] as const;

// ─── Constants ────────────────────────────────────────────────────────────────

/** How often to poll while waiting for credits to land (ms) */
const POLL_INTERVAL_MS = 2_000;
/** Max time to keep polling before giving up (ms) */
const POLL_TIMEOUT_MS = 30_000;

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useBillingStatus(): UseBillingStatusReturn {
  const [pollInterval, setPollInterval] = React.useState<number | false>(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: BILLING_STATUS_QUERY_KEY,
    queryFn: fetchBillingStatus,
    staleTime: 60_000, // 1 minute
    refetchOnWindowFocus: true,
    refetchInterval: pollInterval || 60_000,
  });

  // Auto-stop polling once credits are reflected
  React.useEffect(() => {
    if (pollInterval && data?.hasCredits) {
      setPollInterval(false);
    }
  }, [pollInterval, data?.hasCredits]);

  // Safety net: stop polling after POLL_TIMEOUT_MS regardless
  React.useEffect(() => {
    if (!pollInterval) return;
    const timeout = setTimeout(() => setPollInterval(false), POLL_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [pollInterval]);

  const defaults: BillingStatusData = {
    isBalanceKnown: false,
    hasBillingHistory: false,
    credits: 0,
    hasCredits: false,
    accountStatus: 'ACTIVE',
    billingMode: 'CREDITS',
  };

  // Stable callback – safe to capture in closures / intervals
  const startPolling = React.useCallback(() => {
    setPollInterval(POLL_INTERVAL_MS);
  }, []);

  return {
    ...(data ?? defaults),
    isLoading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refetch: () => {
      refetch();
    },
    startPolling,
  };
}
