/**
 * Credit grant link flow tests.
 *
 * Covers the "Claim a credit link" user journey:
 *   - Token detection from URL and localStorage
 *   - Auto-claim behavior after billing status loads
 *   - Manual claiming and error handling
 *   - Token cleanup
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  useCreditGrantLink,
} from '@/hooks/Billing/useCreditGrantLink';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

// Mock useBillingStatus — it's a dependency of the credit grants flow,
// not the thing being tested. Mocking lets us control isLoading precisely.
const mockBillingStatus = {
  isLoading: false,
  hasBillingHistory: true,
  hasCredits: false,
  credits: 0,
  error: null,
  refetch: vi.fn(),
};

vi.mock('@/hooks/Billing/useBillingStatus', () => ({
  useBillingStatus: () => mockBillingStatus,
  BILLING_STATUS_QUERY_KEY: ['billing', 'status'],
}));

// Mock toast notifications — they'd error in jsdom without a toast container
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from 'sonner';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createQueryWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  Wrapper.displayName = 'TestQueryWrapper';
  return Wrapper;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockSearchParams.delete('token');
  mockBillingStatus.isLoading = false;
  mockBillingStatus.hasCredits = false;
});

afterEach(() => {
  localStorage.clear();
});

// =============================================================================
// 1. Token detection
// =============================================================================

describe('Token detection', () => {
  it('picks up token from URL search params', () => {
    mockSearchParams.set('token', 'url_token_123');

    // Prevent auto-claim so we can inspect the token
    mockBillingStatus.isLoading = true;

    const { result } = renderHook(() => useCreditGrantLink(), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.pendingToken).toBe('url_token_123');
    expect(getStoredToken()).toBe('url_token_123');
  });

  it('picks up token from localStorage when URL has no token', () => {
    setStoredToken('stored_token_456');
    mockBillingStatus.isLoading = true;

    const { result } = renderHook(() => useCreditGrantLink(), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.pendingToken).toBe('stored_token_456');
  });

  it('prefers URL token over localStorage token', () => {
    setStoredToken('old_stored');
    mockSearchParams.set('token', 'new_from_url');
    mockBillingStatus.isLoading = true;

    const { result } = renderHook(() => useCreditGrantLink(), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.pendingToken).toBe('new_from_url');
    expect(getStoredToken()).toBe('new_from_url');
  });

  it('has no pending token when URL and storage are empty', () => {
    const { result } = renderHook(() => useCreditGrantLink(), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.pendingToken).toBeNull();
    expect(result.current.isClaiming).toBe(false);
    expect(result.current.hasClaimed).toBe(false);
  });
});

// =============================================================================
// 2. Auto-claiming
// =============================================================================

describe('Auto-claiming', () => {
  it('claims token automatically once billing status finishes loading', async () => {
    mockSearchParams.set('token', 'auto_claim_token');

    server.use(
      http.post('/api/user/claim-credit-grant-link', async ({ request }) => {
        const body = (await request.json()) as { token: string };
        if (body.token === 'auto_claim_token') {
          return HttpResponse.json({
            message: 'Claimed!',
            credits_granted: 15,
          });
        }
        return HttpResponse.json({ detail: 'Bad token' }, { status: 400 });
      }),
    );

    const { result } = renderHook(() => useCreditGrantLink(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.hasClaimed).toBe(true);
    });

    expect(result.current.pendingToken).toBeNull();
    expect(getStoredToken()).toBeNull();
    expect(toast.success).toHaveBeenCalledWith('Claimed!');
  });

  it('does NOT auto-claim while billing status is still loading', async () => {
    mockBillingStatus.isLoading = true;
    mockSearchParams.set('token', 'loading_token');

    const { result } = renderHook(() => useCreditGrantLink(), {
      wrapper: createQueryWrapper(),
    });

    // Give it time to potentially auto-claim
    await new Promise((r) => setTimeout(r, 100));

    expect(result.current.pendingToken).toBe('loading_token');
    expect(result.current.hasClaimed).toBe(false);
  });

  it('claims regardless of whether user has existing credits', async () => {
    mockBillingStatus.hasCredits = false;
    mockSearchParams.set('token', 'free_credit_token');

    server.use(
      http.post('/api/user/claim-credit-grant-link', () =>
        HttpResponse.json({
          message: 'Credits granted!',
          credits_granted: 10,
        }),
      ),
    );

    const { result } = renderHook(() => useCreditGrantLink(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.hasClaimed).toBe(true);
    });

    expect(toast.success).toHaveBeenCalledWith('Credits granted!');
  });

  it('shows org name in success toast when credits go to an organization', async () => {
    mockSearchParams.set('token', 'org_claim_token');

    server.use(
      http.post('/api/user/claim-credit-grant-link', () =>
        HttpResponse.json({
          message: '50.00 credits awarded to Acme Corp.',
          credits_granted: 50,
          credited_to: 'Acme Corp',
        }),
      ),
    );

    const { result } = renderHook(() => useCreditGrantLink(), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.hasClaimed).toBe(true);
    });

    expect(toast.success).toHaveBeenCalledWith(
      '50.00 credits awarded to Acme Corp.',
    );
  });
});

// =============================================================================
// 3. Manual claiming
// =============================================================================

describe('Manual claiming', () => {
  it('claims pending token and returns success result', async () => {
    setStoredToken('manual_claim_token');
    mockBillingStatus.isLoading = true; // prevent auto-claim

    server.use(
      http.post('/api/user/claim-credit-grant-link', () =>
        HttpResponse.json({
          message: 'Manual claim success!',
          credits_granted: 5,
        }),
      ),
    );

    const { result } = renderHook(() => useCreditGrantLink(), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.pendingToken).toBe('manual_claim_token');

    let claimResult: Awaited<ReturnType<typeof result.current.claimPendingToken>>;
    await act(async () => {
      claimResult = await result.current.claimPendingToken();
    });

    expect(claimResult!.success).toBe(true);
    expect(result.current.hasClaimed).toBe(true);
    expect(result.current.pendingToken).toBeNull();
    expect(getStoredToken()).toBeNull();
  });

  it('returns error when there is no pending token', async () => {
    const { result } = renderHook(() => useCreditGrantLink(), {
      wrapper: createQueryWrapper(),
    });

    let claimResult: Awaited<ReturnType<typeof result.current.claimPendingToken>>;
    await act(async () => {
      claimResult = await result.current.claimPendingToken();
    });

    expect(claimResult!.success).toBe(false);
    expect(claimResult!.error).toBe('No pending token to claim');
  });

  it('shows error toast on claim failure', async () => {
    setStoredToken('bad_token');
    mockBillingStatus.isLoading = true;

    server.use(
      http.post('/api/user/claim-credit-grant-link', () =>
        HttpResponse.json(
          { detail: 'Token has already been claimed' },
          { status: 400 },
        ),
      ),
    );

    const { result } = renderHook(() => useCreditGrantLink(), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      await result.current.claimPendingToken();
    });

    expect(result.current.hasClaimed).toBe(false);
    expect(result.current.error).toBe('Token has already been claimed');
    expect(toast.error).toHaveBeenCalledWith('Token has already been claimed');
  });

  it('clears token from storage when it is expired or invalid', async () => {
    setStoredToken('expired_token');
    mockBillingStatus.isLoading = true;

    server.use(
      http.post('/api/user/claim-credit-grant-link', () =>
        HttpResponse.json({ detail: 'Token expired' }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useCreditGrantLink(), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      await result.current.claimPendingToken();
    });

    expect(result.current.pendingToken).toBeNull();
    expect(getStoredToken()).toBeNull();
  });
});

// =============================================================================
// 4. Cleanup
// =============================================================================

describe('Token cleanup', () => {
  it('clears pending token without claiming', () => {
    setStoredToken('token_to_clear');
    mockBillingStatus.isLoading = true;

    const { result } = renderHook(() => useCreditGrantLink(), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.pendingToken).toBe('token_to_clear');

    act(() => {
      result.current.clearPendingToken();
    });

    expect(result.current.pendingToken).toBeNull();
    expect(getStoredToken()).toBeNull();
    expect(result.current.error).toBeNull();
  });
});

