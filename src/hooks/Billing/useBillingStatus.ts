/**
 * useBillingStatus - Hook for querying the billing readiness of the current workspace.
 *
 * Returns whether the active billing account has:
 *   - A Stripe customer ID
 *   - A default payment method on file
 *   - A positive credit balance
 *
 * This is the foundational hook used by BillableActionGuard to decide
 * whether to gate billable actions behind an "add payment method" prompt.
 *
 * Usage:
 * ```tsx
 * const { hasPaymentMethod, hasCredits, isReady, isLoading } = useBillingStatus();
 *
 * if (!isReady) {
 *   // Show "add payment method" prompt
 * }
 * ```
 */

import { useQuery } from '@tanstack/react-query';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BillingStatusData {
  /** Whether the account has a Stripe customer ID */
  hasCustomerId: boolean;
  /** Whether Stripe has a default payment method for this customer */
  hasPaymentMethod: boolean;
  /** Current credit balance */
  credits: number;
  /** Convenience: credits > 0 */
  hasCredits: boolean;
  /**
   * "Ready" means the user can perform billable actions
   * (has a payment method AND positive balance).
   */
  isReady: boolean;
}

export interface UseBillingStatusReturn extends BillingStatusData {
  isLoading: boolean;
  error: string | null;
  /** Manually refetch billing status */
  refetch: () => void;
}

// ─── Fetch helpers (pure functions, easily testable) ────────────────────────

/**
 * Fetches whether the current user has a Stripe customer ID.
 * Returns `true` / `false`.
 */
export async function fetchHasCustomerId(): Promise<boolean> {
  const res = await fetch('/api/billing/hasCustomerId');
  if (!res.ok) return false;
  const data = await res.json();
  return !!data.hasCustomerId;
}

/**
 * Fetches the default payment method for the current user.
 * Returns the payment method ID string, or `null` if none.
 */
export async function fetchDefaultPaymentMethod(): Promise<string | null> {
  const res = await fetch('/api/stripe/defaultPaymentMethod');
  if (!res.ok) return null;
  const data = await res.json();
  return data.defaultPaymentMethod ?? null;
}

/**
 * Fetches the current credit balance.
 * Returns the numeric balance or `0` on failure.
 */
export async function fetchCreditBalance(): Promise<number> {
  const res = await fetch('/api/billing/balance');
  if (!res.ok) return 0;
  const data = await res.json();
  return typeof data.fullBalance === 'number' ? data.fullBalance : parseFloat(data.balance) || 0;
}

/**
 * Aggregates billing status from multiple endpoints into a single object.
 * Exported for unit testing without React.
 */
export async function fetchBillingStatus(): Promise<BillingStatusData> {
  const [hasCustomerId, paymentMethod, credits] = await Promise.all([
    fetchHasCustomerId(),
    fetchDefaultPaymentMethod(),
    fetchCreditBalance(),
  ]);

  const hasPaymentMethod = !!paymentMethod;
  const hasCredits = credits > 0;

  return {
    hasCustomerId,
    hasPaymentMethod,
    credits,
    hasCredits,
    isReady: hasPaymentMethod && hasCredits,
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
    hasCustomerId: false,
    hasPaymentMethod: false,
    credits: 0,
    hasCredits: false,
    isReady: false,
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



