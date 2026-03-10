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
 * const { hasCredits, isLoading } = useBillingStatus();
 *
 * if (!hasCredits) {
 *   // Show "purchase credits" prompt
 * }
 * ```
 */

import { useQuery } from '@tanstack/react-query';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BillingStatusData {
  /** Whether the account has prior billing history (at least one paid recharge) */
  hasBillingHistory: boolean;
  /** Current credit balance */
  credits: number;
  /** Convenience: credits > 0 */
  hasCredits: boolean;
  /** Account status: ACTIVE, PAST_DUE, SUSPENDED, or CLOSED */
  accountStatus: string;
}

export interface UseBillingStatusReturn extends BillingStatusData {
  isLoading: boolean;
  error: string | null;
  /** Manually refetch billing status */
  refetch: () => void;
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
    return { hasBillingHistory: false, credits: 0, hasCredits: false, accountStatus: 'ACTIVE' };
  }

  const data = await res.json();
  const credits =
    typeof data.fullBalance === 'number'
      ? data.fullBalance
      : parseFloat(data.balance) || 0;

  return {
    hasBillingHistory: data.lastRechargeAt != null,
    credits,
    hasCredits: credits > 0,
    accountStatus: data.accountStatus ?? 'ACTIVE',
  };
}

// ─── React Query key ─────────────────────────────────────────────────────────

export const BILLING_STATUS_QUERY_KEY = ['billing', 'status'] as const;

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useBillingStatus(): UseBillingStatusReturn {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: BILLING_STATUS_QUERY_KEY,
    queryFn: fetchBillingStatus,
    staleTime: 60_000, // 1 minute
    refetchOnWindowFocus: true,
  });

  const defaults: BillingStatusData = {
    hasBillingHistory: false,
    credits: 0,
    hasCredits: false,
    accountStatus: 'ACTIVE',
  };

  return {
    ...(data ?? defaults),
    isLoading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refetch: () => {
      refetch();
    },
  };
}
