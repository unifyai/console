/**
 * Tests for useBillingStatus hook.
 *
 * Strategy:
 *  1. Pure-function tests for fetchBillingStatus —
 *     these exercise the core logic without React.
 *  2. React-hook tests via renderHook to verify React Query integration.
 *
 * All network calls are intercepted by MSW so we never hit real endpoints.
 *
 * The hook now makes a single call to `/api/billing/balance` which returns
 * balance, fullBalance, and lastRechargeAt.  `hasBillingHistory` is derived
 * from `lastRechargeAt != null`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';

import {
  fetchBillingStatus,
  useBillingStatus,
  type BillingStatusData,
} from '@/hooks/Billing/useBillingStatus';

// ─── Baseline handlers ─────────────────────────────────────────────────────

const BASELINE_BALANCE = 25;
const BASELINE_LAST_RECHARGE = '2025-01-15T10:30:00+00:00';

function installBaselineHandlers() {
  server.use(
    http.get('/api/billing/balance', () => {
      return HttpResponse.json({
        balance: '25.00',
        fullBalance: BASELINE_BALANCE,
        lastRechargeAt: BASELINE_LAST_RECHARGE,
      });
    }),
  );
}

beforeEach(() => {
  installBaselineHandlers();
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Creates a fresh QueryClient wrapper for each test. */
function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  Wrapper.displayName = 'TestQueryWrapper';
  return Wrapper;
}

// ─── 1. Pure function tests ─────────────────────────────────────────────────

describe('fetchBillingStatus', () => {
  it('returns ready status with default mocks', async () => {
    const status = await fetchBillingStatus();
    expect(status).toEqual<BillingStatusData>({
      hasBillingHistory: true,
      credits: 25,
      hasCredits: true,
    });
  });

  it('hasCredits is false when zero credits', async () => {
    server.use(
      http.get('/api/billing/balance', () => {
        return HttpResponse.json({
          balance: '0.00',
          fullBalance: 0,
          lastRechargeAt: BASELINE_LAST_RECHARGE,
        });
      }),
    );
    const status = await fetchBillingStatus();
    expect(status.hasCredits).toBe(false);
    expect(status.hasBillingHistory).toBe(true);
  });

  it('hasBillingHistory is false when lastRechargeAt is null', async () => {
    server.use(
      http.get('/api/billing/balance', () => {
        return HttpResponse.json({
          balance: '10.00',
          fullBalance: 10,
          lastRechargeAt: null,
        });
      }),
    );
    const status = await fetchBillingStatus();
    expect(status.hasBillingHistory).toBe(false);
    expect(status.hasCredits).toBe(true);
  });

  it('returns defaults when both billing history and balance are empty', async () => {
    server.use(
      http.get('/api/billing/balance', () => {
        return HttpResponse.json({
          balance: '0.00',
          fullBalance: 0,
          lastRechargeAt: null,
        });
      }),
    );
    const status = await fetchBillingStatus();
    expect(status.hasBillingHistory).toBe(false);
    expect(status.hasCredits).toBe(false);
  });

  it('handles server error gracefully', async () => {
    server.use(
      http.get('/api/billing/balance', () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );
    const status = await fetchBillingStatus();
    expect(status.hasBillingHistory).toBe(false);
    expect(status.credits).toBe(0);
    expect(status.hasCredits).toBe(false);
  });

  it('falls back to parsing string balance when fullBalance is missing', async () => {
    server.use(
      http.get('/api/billing/balance', () => {
        return HttpResponse.json({
          balance: '42.50',
          lastRechargeAt: BASELINE_LAST_RECHARGE,
        });
      }),
    );
    const status = await fetchBillingStatus();
    expect(status.credits).toBe(42.5);
    expect(status.hasCredits).toBe(true);
  });
});

// ─── 2. React hook tests ────────────────────────────────────────────────────

describe('useBillingStatus', () => {
  it('starts in loading state then resolves', async () => {
    const { result } = renderHook(() => useBillingStatus(), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for resolution
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasCredits).toBe(true);
    expect(result.current.credits).toBe(25);
    expect(result.current.hasBillingHistory).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('reports no credits when balance is zero', async () => {
    server.use(
      http.get('/api/billing/balance', () => {
        return HttpResponse.json({
          balance: '0.00',
          fullBalance: 0,
          lastRechargeAt: BASELINE_LAST_RECHARGE,
        });
      }),
    );

    const { result } = renderHook(() => useBillingStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasCredits).toBe(false);
  });

  it('provides a working refetch callback', async () => {
    let callCount = 0;
    server.use(
      http.get('/api/billing/balance', () => {
        callCount++;
        const balance = callCount === 1 ? 0 : 50;
        return HttpResponse.json({
          balance: String(balance),
          fullBalance: balance,
          lastRechargeAt: BASELINE_LAST_RECHARGE,
        });
      }),
    );

    const { result } = renderHook(() => useBillingStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // First call: 0 credits
    expect(result.current.credits).toBe(0);
    expect(result.current.hasCredits).toBe(false);

    // Trigger refetch
    result.current.refetch();

    await waitFor(() => {
      expect(result.current.credits).toBe(50);
    });

    expect(result.current.hasCredits).toBe(true);
  });
});
