'use client';

/**
 * useCreditGrantLink
 *
 * Manages the credit grant link flow:
 * 1. Reads `?token=xxx` from the URL on mount
 * 2. Stores the token in localStorage (persists across page refreshes)
 * 3. Once billing status is loaded, claims the token immediately
 * 4. After successful claim, invalidates billing status cache so
 *    BillableActionGuard and other consumers pick up the new credits
 *
 * The hook does NOT render any UI — it only provides state + actions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useBillingStatus, BILLING_STATUS_QUERY_KEY } from '@/hooks/Billing/useBillingStatus';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = 'pending_credit_grant_token';

// =============================================================================
// Types
// =============================================================================

export interface CreditGrantClaimResult {
  success: boolean;
  creditsGranted?: number;
  /** "personal" or the org name */
  creditedTo?: string;
  message?: string;
  error?: string;
}

export interface UseCreditGrantLinkReturn {
  /** The pending token (from URL or localStorage), null if none or already claimed */
  pendingToken: string | null;
  /** Whether the token is currently being claimed */
  isClaiming: boolean;
  /** Whether the token has been successfully claimed in this session */
  hasClaimed: boolean;
  /** Error message if claiming failed */
  error: string | null;
  /** Manually trigger claiming the pending token (e.g., after adding payment method) */
  claimPendingToken: () => Promise<CreditGrantClaimResult>;
  /** Clear the pending token without claiming */
  clearPendingToken: () => void;
}

// =============================================================================
// localStorage helpers (exported for testing)
// =============================================================================

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // localStorage may be unavailable in some contexts
  }
}

export function clearStoredToken(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// =============================================================================
// API call (exported for testing)
// =============================================================================

export async function claimCreditGrantToken(token: string): Promise<CreditGrantClaimResult> {
  try {
    const response = await fetch('/api/user/claim-credit-grant-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.detail || data.message || `Claim failed (${response.status})`,
      };
    }

    return {
      success: true,
      creditsGranted: data.credits_granted ?? data.creditsGranted ?? undefined,
      creditedTo: data.credited_to ?? data.creditedTo ?? undefined,
      message: data.message ?? 'Credits claimed successfully!',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error claiming credits',
    };
  }
}

// =============================================================================
// Hook
// =============================================================================

export function useCreditGrantLink(): UseCreditGrantLinkReturn {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { billing: billingEnabled } = useFeatures();
  const { isLoading: isBillingLoading } = useBillingStatus();

  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track whether we've already auto-claimed to prevent duplicate calls
  const hasAutoClaimedRef = useRef(false);

  // 1. On mount: read token from URL or localStorage
  useEffect(() => {
    // Credit grants only exist where billing is enabled; ignore tokens otherwise.
    if (!billingEnabled) return;

    const urlToken = searchParams?.get('token') ?? null;
    const storedToken = getStoredToken();

    if (urlToken) {
      // Store in localStorage for persistence
      setStoredToken(urlToken);
      setPendingToken(urlToken);

      // Clean the URL (remove ?token=xxx)
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('token');
        window.history.replaceState({}, document.title, url.toString());
      }
    } else if (storedToken) {
      setPendingToken(storedToken);
    }
  }, [searchParams, billingEnabled]);

  // Core claim function
  const claimPendingToken = useCallback(async (): Promise<CreditGrantClaimResult> => {
    if (!pendingToken) {
      return { success: false, error: 'No pending token to claim' };
    }

    setIsClaiming(true);
    setError(null);

    const result = await claimCreditGrantToken(pendingToken);

    if (result.success) {
      clearStoredToken();
      setPendingToken(null);
      setHasClaimed(true);
      // Invalidate billing status so BillableActionGuard picks up the new credits
      queryClient.invalidateQueries({ queryKey: BILLING_STATUS_QUERY_KEY });

      // Build a context-aware success message
      const defaultMsg =
        result.creditedTo && result.creditedTo !== 'personal'
          ? `Credits claimed for ${result.creditedTo}!`
          : 'Credits claimed successfully!';
      toast.success(result.message || defaultMsg);
    } else {
      setError(result.error || 'Failed to claim credits');
      // If token is invalid/expired, clear it
      if (
        result.error?.includes('expired') ||
        result.error?.includes('invalid') ||
        result.error?.includes('not found')
      ) {
        clearStoredToken();
        setPendingToken(null);
      }
      toast.error(result.error || 'Failed to claim credits');
    }

    setIsClaiming(false);
    return result;
  }, [pendingToken, queryClient]);

  // 2. Auto-claim as soon as we have a pending token
  useEffect(() => {
    if (
      pendingToken &&
      !isBillingLoading &&
      !isClaiming &&
      !hasClaimed &&
      !hasAutoClaimedRef.current
    ) {
      hasAutoClaimedRef.current = true;
      claimPendingToken();
    }
  }, [pendingToken, isBillingLoading, isClaiming, hasClaimed, claimPendingToken]);

  const clearPendingTokenAction = useCallback(() => {
    clearStoredToken();
    setPendingToken(null);
    setError(null);
  }, []);

  return {
    pendingToken,
    isClaiming,
    hasClaimed,
    error,
    claimPendingToken,
    clearPendingToken: clearPendingTokenAction,
  };
}
