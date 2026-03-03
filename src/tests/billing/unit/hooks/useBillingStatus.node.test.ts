/**
 * Tests for useBillingStatus hook.
 *
 * Strategy:
 *  1. Pure-function tests for fetchBillingStatus and its helpers —
 *     these exercise the core logic without React.
 *  2. React-hook tests via renderHook to verify React Query integration.
 *
 * All network calls are intercepted by MSW so we never hit real endpoints.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';

import {
  fetchHasCustomerId,
  fetchCreditBalance,
  fetchBillingStatus,
  useBillingStatus,
  type BillingStatusData,
} from '@/hooks/Billing/useBillingStatus';

// ─── Baseline handlers ─────────────────────────────────────────────────────
// Other feature handlers (assistants, etc.) may also register /api/billing/*
// endpoints. We install our own baseline at the start of every test to
// guarantee deterministic responses.

const BASELINE_BALANCE = 25;

function installBaselineHandlers() {
  server.use(
    http.get('/api/billing/hasCustomerId', () => {
      return HttpResponse.json({ hasCustomerId: true });
    }),
    http.get('/api/billing/balance', () => {
      return HttpResponse.json({ balance: '25.00', fullBalance: BASELINE_BALANCE });
    })
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

describe('fetchHasCustomerId', () => {
  it('returns true when API returns hasCustomerId: true', async () => {
    // default handler already returns true
    expect(await fetchHasCustomerId()).toBe(true);
  });

  it('returns false when API returns hasCustomerId: false', async () => {
    server.use(
      http.get('/api/billing/hasCustomerId', () => {
        return HttpResponse.json({ hasCustomerId: false });
      })
    );
    expect(await fetchHasCustomerId()).toBe(false);
  });

  it('returns false on network/server error', async () => {
    server.use(
      http.get('/api/billing/hasCustomerId', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );
    expect(await fetchHasCustomerId()).toBe(false);
  });
});

describe('fetchCreditBalance', () => {
  it('returns fullBalance as a number', async () => {
    expect(await fetchCreditBalance()).toBe(25);
  });

  it('falls back to parsing string balance', async () => {
    server.use(
      http.get('/api/billing/balance', () => {
        return HttpResponse.json({ balance: '42.50' });
      })
    );
    expect(await fetchCreditBalance()).toBe(42.5);
  });

  it('returns 0 on server error', async () => {
    server.use(
      http.get('/api/billing/balance', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );
    expect(await fetchCreditBalance()).toBe(0);
  });

  it('returns 0 for zero balance', async () => {
    server.use(
      http.get('/api/billing/balance', () => {
        return HttpResponse.json({ balance: '0.00', fullBalance: 0 });
      })
    );
    expect(await fetchCreditBalance()).toBe(0);
  });
});

describe('fetchBillingStatus', () => {
  it('returns ready status with default mocks', async () => {
    const status = await fetchBillingStatus();
    expect(status).toEqual<BillingStatusData>({
      hasCustomerId: true,
      credits: 25,
      hasCredits: true,
    });
  });

  it('hasCredits is false when zero credits', async () => {
    server.use(
      http.get('/api/billing/balance', () => {
        return HttpResponse.json({ balance: '0.00', fullBalance: 0 });
      })
    );
    const status = await fetchBillingStatus();
    expect(status.hasCredits).toBe(false);
  });

  it('hasCredits is false when both customer ID and balance missing', async () => {
    server.use(
      http.get('/api/billing/hasCustomerId', () => {
        return HttpResponse.json({ hasCustomerId: false });
      }),
      http.get('/api/billing/balance', () => {
        return HttpResponse.json({ balance: '0.00', fullBalance: 0 });
      })
    );
    const status = await fetchBillingStatus();
    expect(status.hasCustomerId).toBe(false);
    expect(status.hasCredits).toBe(false);
  });

  it('handles partial API failures gracefully', async () => {
    // Customer ID check fails, but balance succeeds
    server.use(
      http.get('/api/billing/hasCustomerId', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );
    const status = await fetchBillingStatus();
    expect(status.hasCustomerId).toBe(false);
    // Balance still works
    expect(status.credits).toBe(25);
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
    expect(result.current.error).toBeNull();
  });

  it('reports no credits when balance is zero', async () => {
    server.use(
      http.get('/api/billing/balance', () => {
        return HttpResponse.json({ balance: '0.00', fullBalance: 0 });
      })
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
        return HttpResponse.json({ balance: String(balance), fullBalance: balance });
      })
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
