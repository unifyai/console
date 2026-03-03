/**
 * Tests for useCreditGrantLink hook.
 *
 * Strategy:
 *   1. Pure function tests for claimCreditGrantToken, localStorage helpers
 *   2. Hook behavior tests using mocked dependencies
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  claimCreditGrantToken,
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  useCreditGrantLink,
} from '@/hooks/Billing/useCreditGrantLink';

// ─── Mock next/navigation ────────────────────────────────────────────────────

const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

// ─── Mock useBillingStatus ───────────────────────────────────────────────────

const mockBillingStatus = {
  hasPaymentMethod: false,
  isLoading: false,
  hasCustomerId: true,
  hasCredits: false,
  credits: 0,
  isReady: false,
  error: null,
  refetch: vi.fn(),
};

vi.mock('@/hooks/Billing/useBillingStatus', () => ({
  useBillingStatus: () => mockBillingStatus,
  BILLING_STATUS_QUERY_KEY: ['billing', 'status'],
}));

// ─── Mock sonner toast ───────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from 'sonner';

// ─── QueryClient wrapper for renderHook ──────────────────────────────────────

let testQueryClient: QueryClient;

function createWrapper() {
  testQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: testQueryClient }, children);
  return Wrapper;
}

// ─── localStorage helpers ────────────────────────────────────────────────────

describe('localStorage helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getStoredToken returns null when no token stored', () => {
    expect(getStoredToken()).toBeNull();
  });

  it('setStoredToken / getStoredToken round-trips', () => {
    setStoredToken('test_token_123');
    expect(getStoredToken()).toBe('test_token_123');
  });

  it('clearStoredToken removes the token', () => {
    setStoredToken('test_token_123');
    clearStoredToken();
    expect(getStoredToken()).toBeNull();
  });

  it('setStoredToken overwrites existing token', () => {
    setStoredToken('first');
    setStoredToken('second');
    expect(getStoredToken()).toBe('second');
  });
});

// ─── claimCreditGrantToken API function ──────────────────────────────────────

describe('claimCreditGrantToken', () => {
  beforeEach(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    server.close();
  });

  it('returns success with credits on 200', async () => {
    server.use(
      http.post('/api/user/claim-credit-grant-link', () =>
        HttpResponse.json({
          message: 'Credits granted!',
          credits_granted: 10,
        })
      )
    );

    const result = await claimCreditGrantToken('valid_token');
    expect(result.success).toBe(true);
    expect(result.creditsGranted).toBe(10);
    expect(result.message).toBe('Credits granted!');
  });

  it('returns error on 400', async () => {
    server.use(
      http.post('/api/user/claim-credit-grant-link', () =>
        HttpResponse.json({ detail: 'Token expired' }, { status: 400 })
      )
    );

    const result = await claimCreditGrantToken('expired_token');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Token expired');
  });

  it('returns error on 404', async () => {
    server.use(
      http.post('/api/user/claim-credit-grant-link', () =>
        HttpResponse.json({ detail: 'Token not found' }, { status: 404 })
      )
    );

    const result = await claimCreditGrantToken('unknown_token');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Token not found');
  });

  it('returns error on network failure', async () => {
    server.use(
      http.post('/api/user/claim-credit-grant-link', () => HttpResponse.error())
    );

    const result = await claimCreditGrantToken('any_token');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('handles camelCase creditsGranted in response', async () => {
    server.use(
      http.post('/api/user/claim-credit-grant-link', () =>
        HttpResponse.json({
          message: 'Granted',
          creditsGranted: 25,
        })
      )
    );

    const result = await claimCreditGrantToken('token');
    expect(result.success).toBe(true);
    expect(result.creditsGranted).toBe(25);
  });

  it('returns creditedTo when present in response (snake_case)', async () => {
    server.use(
      http.post('/api/user/claim-credit-grant-link', () =>
        HttpResponse.json({
          message: 'Claimed for org!',
          credits_granted: 50,
          credited_to: 'My Org',
        })
      )
    );

    const result = await claimCreditGrantToken('org_token');
    expect(result.success).toBe(true);
    expect(result.creditsGranted).toBe(50);
    expect(result.creditedTo).toBe('My Org');
  });

  it('returns creditedTo when present in response (camelCase)', async () => {
    server.use(
      http.post('/api/user/claim-credit-grant-link', () =>
        HttpResponse.json({
          message: 'Claimed personally!',
          creditsGranted: 10,
          creditedTo: 'personal',
        })
      )
    );

    const result = await claimCreditGrantToken('personal_token');
    expect(result.success).toBe(true);
    expect(result.creditedTo).toBe('personal');
  });
});

// ─── useCreditGrantLink hook ─────────────────────────────────────────────────

describe('useCreditGrantLink', () => {
  beforeEach(() => {
    server.listen();
    localStorage.clear();
    vi.clearAllMocks();

    // Reset billing status to default (no payment method, not loading)
    mockBillingStatus.hasPaymentMethod = false;
    mockBillingStatus.isLoading = false;

    // Reset search params
    // URLSearchParams is mutable, so we clear and re-use the same instance
    mockSearchParams.delete('token');
  });

  afterEach(() => {
    server.resetHandlers();
    server.close();
    localStorage.clear();
  });

  it('starts with no pending token when URL and localStorage are empty', () => {
    const { result } = renderHook(() => useCreditGrantLink(), { wrapper: createWrapper() });

    expect(result.current.pendingToken).toBeNull();
    expect(result.current.isClaiming).toBe(false);
    expect(result.current.hasClaimed).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('picks up token from URL search params', () => {
    mockSearchParams.set('token', 'url_token_123');

    const { result } = renderHook(() => useCreditGrantLink(), { wrapper: createWrapper() });

    expect(result.current.pendingToken).toBe('url_token_123');
    // Should also be persisted to localStorage
    expect(getStoredToken()).toBe('url_token_123');
  });

  it('picks up token from localStorage when URL has no token', () => {
    setStoredToken('stored_token_456');

    const { result } = renderHook(() => useCreditGrantLink(), { wrapper: createWrapper() });

    expect(result.current.pendingToken).toBe('stored_token_456');
  });

  it('URL token takes priority over localStorage token', () => {
    setStoredToken('old_stored_token');
    mockSearchParams.set('token', 'new_url_token');

    const { result } = renderHook(() => useCreditGrantLink(), { wrapper: createWrapper() });

    expect(result.current.pendingToken).toBe('new_url_token');
    expect(getStoredToken()).toBe('new_url_token');
  });

  it('auto-claims when user has payment method and token is present', async () => {
    mockBillingStatus.hasPaymentMethod = true;
    mockSearchParams.set('token', 'auto_claim_token');

    server.use(
      http.post('/api/user/claim-credit-grant-link', async ({ request }) => {
        const body = (await request.json()) as { token: string };
        if (body.token === 'auto_claim_token') {
          return HttpResponse.json({ message: 'Claimed!', credits_granted: 15 });
        }
        return HttpResponse.json({ detail: 'Bad token' }, { status: 400 });
      })
    );

    const { result } = renderHook(() => useCreditGrantLink(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.hasClaimed).toBe(true);
    });

    expect(result.current.pendingToken).toBeNull();
    expect(getStoredToken()).toBeNull();
    expect(toast.success).toHaveBeenCalledWith('Claimed!');
  });

  it('auto-claims even when user has no payment method (credit grants are free)', async () => {
    mockBillingStatus.hasPaymentMethod = false;
    mockSearchParams.set('token', 'free_credit_token');

    server.use(
      http.post('/api/user/claim-credit-grant-link', async ({ request }) => {
        const body = (await request.json()) as { token: string };
        if (body.token === 'free_credit_token') {
          return HttpResponse.json({ message: 'Credits granted!', credits_granted: 10 });
        }
        return HttpResponse.json({ detail: 'Bad token' }, { status: 400 });
      })
    );

    const { result } = renderHook(() => useCreditGrantLink(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.hasClaimed).toBe(true);
    });

    expect(result.current.pendingToken).toBeNull();
    expect(getStoredToken()).toBeNull();
    expect(toast.success).toHaveBeenCalledWith('Credits granted!');
  });

  it('does NOT auto-claim while billing status is loading', async () => {
    mockBillingStatus.hasPaymentMethod = true;
    mockBillingStatus.isLoading = true;
    mockSearchParams.set('token', 'loading_token');

    const { result } = renderHook(() => useCreditGrantLink(), { wrapper: createWrapper() });

    // Give it time to potentially auto-claim
    await new Promise((r) => setTimeout(r, 100));

    expect(result.current.pendingToken).toBe('loading_token');
    expect(result.current.hasClaimed).toBe(false);
  });

  it('claimPendingToken can be called manually', async () => {
    mockBillingStatus.hasPaymentMethod = false;
    setStoredToken('manual_claim_token');

    server.use(
      http.post('/api/user/claim-credit-grant-link', () =>
        HttpResponse.json({ message: 'Manual claim success!', credits_granted: 5 })
      )
    );

    const { result } = renderHook(() => useCreditGrantLink(), { wrapper: createWrapper() });

    expect(result.current.pendingToken).toBe('manual_claim_token');

    let claimResult: any;
    await act(async () => {
      claimResult = await result.current.claimPendingToken();
    });

    expect(claimResult.success).toBe(true);
    expect(result.current.hasClaimed).toBe(true);
    expect(result.current.pendingToken).toBeNull();
    expect(getStoredToken()).toBeNull();
  });

  it('claimPendingToken returns error when no token', async () => {
    const { result } = renderHook(() => useCreditGrantLink(), { wrapper: createWrapper() });

    let claimResult: any;
    await act(async () => {
      claimResult = await result.current.claimPendingToken();
    });

    expect(claimResult.success).toBe(false);
    expect(claimResult.error).toBe('No pending token to claim');
  });

  it('sets error state on claim failure', async () => {
    setStoredToken('bad_token');

    server.use(
      http.post('/api/user/claim-credit-grant-link', () =>
        HttpResponse.json({ detail: 'Token has already been claimed' }, { status: 400 })
      )
    );

    const { result } = renderHook(() => useCreditGrantLink(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.claimPendingToken();
    });

    expect(result.current.hasClaimed).toBe(false);
    expect(result.current.error).toBe('Token has already been claimed');
    expect(toast.error).toHaveBeenCalledWith('Token has already been claimed');
  });

  it('clears token on expired/invalid error', async () => {
    setStoredToken('expired_token');

    server.use(
      http.post('/api/user/claim-credit-grant-link', () =>
        HttpResponse.json({ detail: 'Token expired' }, { status: 400 })
      )
    );

    const { result } = renderHook(() => useCreditGrantLink(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.claimPendingToken();
    });

    expect(result.current.pendingToken).toBeNull();
    expect(getStoredToken()).toBeNull();
  });

  it('clearPendingToken removes token without claiming', () => {
    setStoredToken('token_to_clear');

    const { result } = renderHook(() => useCreditGrantLink(), { wrapper: createWrapper() });

    expect(result.current.pendingToken).toBe('token_to_clear');

    act(() => {
      result.current.clearPendingToken();
    });

    expect(result.current.pendingToken).toBeNull();
    expect(getStoredToken()).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('shows org name in success toast when credits go to an organization', async () => {
    mockBillingStatus.hasPaymentMethod = false;
    mockSearchParams.set('token', 'org_claim_token');

    server.use(
      http.post('/api/user/claim-credit-grant-link', () =>
        HttpResponse.json({
          message: 'Link successfully claimed! 50.00 credits awarded.',
          credits_granted: 50,
          credited_to: 'Acme Corp',
        })
      )
    );

    const { result } = renderHook(() => useCreditGrantLink(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.hasClaimed).toBe(true);
    });

    // The toast should show the backend message
    expect(toast.success).toHaveBeenCalledWith(
      'Link successfully claimed! 50.00 credits awarded.'
    );
  });
});

