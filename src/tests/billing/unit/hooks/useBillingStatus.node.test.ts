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
  fetchDefaultPaymentMethod,
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
    http.get('/api/stripe/defaultPaymentMethod', () => {
      return HttpResponse.json({ defaultPaymentMethod: 'pm_test_card_visa' });
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

describe('fetchDefaultPaymentMethod', () => {
  it('returns payment method ID when one exists', async () => {
    expect(await fetchDefaultPaymentMethod()).toBe('pm_test_card_visa');
  });

  it('returns null when no payment method', async () => {
    server.use(
      http.get('/api/stripe/defaultPaymentMethod', () => {
        return HttpResponse.json({ defaultPaymentMethod: null });
      })
    );
    expect(await fetchDefaultPaymentMethod()).toBeNull();
  });

  it('returns null on 404 (no customer)', async () => {
    server.use(
      http.get('/api/stripe/defaultPaymentMethod', () => {
        return new HttpResponse(null, { status: 404 });
      })
    );
    expect(await fetchDefaultPaymentMethod()).toBeNull();
  });

  it('returns null on server error', async () => {
    server.use(
      http.get('/api/stripe/defaultPaymentMethod', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );
    expect(await fetchDefaultPaymentMethod()).toBeNull();
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
  it('returns fully ready status with default mocks', async () => {
    const status = await fetchBillingStatus();
    expect(status).toEqual<BillingStatusData>({
      hasCustomerId: true,
      hasPaymentMethod: true,
      credits: 25,
      hasCredits: true,
      isReady: true,
    });
  });

  it('isReady is false when no payment method', async () => {
    server.use(
      http.get('/api/stripe/defaultPaymentMethod', () => {
        return HttpResponse.json({ defaultPaymentMethod: null });
      })
    );
    const status = await fetchBillingStatus();
    expect(status.hasPaymentMethod).toBe(false);
    expect(status.isReady).toBe(false);
  });

  it('isReady is false when zero credits despite having payment method', async () => {
    server.use(
      http.get('/api/billing/balance', () => {
        return HttpResponse.json({ balance: '0.00', fullBalance: 0 });
      })
    );
    const status = await fetchBillingStatus();
    expect(status.hasPaymentMethod).toBe(true);
    expect(status.hasCredits).toBe(false);
    expect(status.isReady).toBe(false);
  });

  it('isReady is false when both missing', async () => {
    server.use(
      http.get('/api/stripe/defaultPaymentMethod', () => {
        return new HttpResponse(null, { status: 404 });
      }),
      http.get('/api/billing/balance', () => {
        return HttpResponse.json({ balance: '0.00', fullBalance: 0 });
      })
    );
    const status = await fetchBillingStatus();
    expect(status.isReady).toBe(false);
    expect(status.hasPaymentMethod).toBe(false);
    expect(status.hasCredits).toBe(false);
  });

  it('handles partial API failures gracefully', async () => {
    // Customer ID check fails, but others succeed
    server.use(
      http.get('/api/billing/hasCustomerId', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );
    const status = await fetchBillingStatus();
    expect(status.hasCustomerId).toBe(false);
    // Payment method and balance still work
    expect(status.hasPaymentMethod).toBe(true);
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
    expect(result.current.isReady).toBe(false);

    // Wait for resolution
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPaymentMethod).toBe(true);
    expect(result.current.hasCredits).toBe(true);
    expect(result.current.isReady).toBe(true);
    expect(result.current.credits).toBe(25);
    expect(result.current.error).toBeNull();
  });

  it('reports not ready when payment method is missing', async () => {
    server.use(
      http.get('/api/stripe/defaultPaymentMethod', () => {
        return HttpResponse.json({ defaultPaymentMethod: null });
      })
    );

    const { result } = renderHook(() => useBillingStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasPaymentMethod).toBe(false);
    expect(result.current.isReady).toBe(false);
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
    expect(result.current.isReady).toBe(false);

    // Trigger refetch
    result.current.refetch();

    await waitFor(() => {
      expect(result.current.credits).toBe(50);
    });

    expect(result.current.isReady).toBe(true);
  });
});

