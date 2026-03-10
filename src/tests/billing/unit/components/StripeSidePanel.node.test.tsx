/**
 * Tests for StripeSidePanel component.
 *
 * Strategy:
 *   1. Pure logic tests for fetchCheckoutSession, claimCreditGrantToken
 *   2. Component rendering tests for each step (loading, waiting, error)
 *   3. Integration tests for the checkout flow with polling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';
import React from 'react';

import {
  StripeSidePanel,
  fetchCheckoutSession,
  claimCreditGrantToken,
} from '@/components/Billing/StripeSidePanel';

// ─── 1. API helper tests ────────────────────────────────────────────────────

describe('fetchCheckoutSession', () => {
  beforeEach(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    server.close();
  });

  it('returns url and sessionId on success', async () => {
    server.use(
      http.get('/api/stripe/checkoutSession', () =>
        HttpResponse.json({
          url: 'https://checkout.stripe.com/test_session',
          sessionId: 'cs_test_123',
        })
      )
    );
    const result = await fetchCheckoutSession();
    expect(result).toEqual({
      url: 'https://checkout.stripe.com/test_session',
      sessionId: 'cs_test_123',
    });
  });

  it('returns null when response is not ok', async () => {
    server.use(
      http.get('/api/stripe/checkoutSession', () => new HttpResponse(null, { status: 500 }))
    );
    const result = await fetchCheckoutSession();
    expect(result).toBeNull();
  });

  it('returns null when url or sessionId is missing from response', async () => {
    server.use(
      http.get('/api/stripe/checkoutSession', () =>
        HttpResponse.json({ url: 'https://checkout.stripe.com/test_session' })
      )
    );
    const result = await fetchCheckoutSession();
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    server.use(http.get('/api/stripe/checkoutSession', () => HttpResponse.error()));
    const result = await fetchCheckoutSession();
    expect(result).toBeNull();
  });
});

describe('claimCreditGrantToken', () => {
  beforeEach(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    server.close();
  });

  it('returns true on successful claim', async () => {
    server.use(
      http.post('/api/user/claim-credit-grant-link', () => HttpResponse.json({ success: true }))
    );
    expect(await claimCreditGrantToken('token_abc')).toBe(true);
  });

  it('returns false on failed claim', async () => {
    server.use(
      http.post('/api/user/claim-credit-grant-link', () => new HttpResponse(null, { status: 400 }))
    );
    expect(await claimCreditGrantToken('bad_token')).toBe(false);
  });

  it('returns false on network error', async () => {
    server.use(http.post('/api/user/claim-credit-grant-link', () => HttpResponse.error()));
    expect(await claimCreditGrantToken('token_abc')).toBe(false);
  });
});

// ─── 3. Component tests ─────────────────────────────────────────────────────

describe('StripeSidePanel', () => {
  beforeEach(() => {
    server.listen();
    // Default: checkout session returns URL and sessionId
    server.use(
      http.get('/api/stripe/checkoutSession', () =>
        HttpResponse.json({ url: 'https://checkout.stripe.com/test', sessionId: 'cs_test_default' })
      )
    );
  });

  afterEach(() => {
    server.resetHandlers();
    server.close();
    vi.restoreAllMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<StripeSidePanel open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByTestId('stripe-side-panel')).toBeNull();
  });

  it('starts checkout immediately when opened', async () => {
    vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<StripeSidePanel open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByTestId('stripe-side-panel')).toBeTruthy();

    // The panel auto-starts checkout and transitions to the waiting step
    await waitFor(() => {
      expect(screen.getByText(/Complete the checkout in the Stripe tab/)).toBeTruthy();
    });
  });

  it('opens checkout URL in new tab via fallback redirect mode', async () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<StripeSidePanel open={true} onOpenChange={vi.fn()} />);

    // Auto-starts checkout, falls back to redirect mode (no embedded checkout in test env)
    await waitFor(() => {
      expect(windowOpenSpy).toHaveBeenCalledWith('https://checkout.stripe.com/test', '_blank');
    });
  });

  it('transitions to waiting step after auto-starting checkout', async () => {
    vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<StripeSidePanel open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Complete the checkout in the Stripe tab/)).toBeTruthy();
    });
  });

  it('shows error step when checkout session creation fails', async () => {
    server.use(
      http.get('/api/stripe/checkoutSession', () => new HttpResponse(null, { status: 500 }))
    );

    render(<StripeSidePanel open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Something went wrong\. Please try again\./)).toBeTruthy();
      expect(screen.getByText('Retry')).toBeTruthy();
    });
  });

  it('restarts checkout when panel is reopened', async () => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
    const onOpenChange = vi.fn();

    const { rerender } = render(<StripeSidePanel open={true} onOpenChange={onOpenChange} />);

    // Panel auto-starts checkout and transitions to waiting
    await waitFor(() => {
      expect(screen.getByText(/Complete the checkout in the Stripe tab/)).toBeTruthy();
    });

    // Close panel
    rerender(<StripeSidePanel open={false} onOpenChange={onOpenChange} />);

    // Reopen panel — should restart the checkout flow
    rerender(<StripeSidePanel open={true} onOpenChange={onOpenChange} />);

    // Should transition back to waiting after re-fetching checkout
    await waitFor(() => {
      expect(screen.getByText(/Complete the checkout in the Stripe tab/)).toBeTruthy();
    });
  });

});
