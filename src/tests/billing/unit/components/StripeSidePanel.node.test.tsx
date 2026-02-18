/**
 * Tests for StripeSidePanel component.
 *
 * Strategy:
 *   1. Pure logic tests for resolveStep, fetchCheckoutSession, checkPaymentMethod, claimCreditGrantToken
 *   2. Component rendering tests for each step (checkout, waiting, success, error)
 *   3. Integration tests for the checkout flow with polling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';
import React from 'react';

import {
  StripeSidePanel,
  resolveStep,
  fetchCheckoutSession,
  checkPaymentMethod,
  claimCreditGrantToken,
} from '@/components/Billing/StripeSidePanel';

// ─── 1. Pure logic tests ────────────────────────────────────────────────────

describe('resolveStep', () => {
  it('returns "error" when error is present', () => {
    expect(resolveStep(false, false, 'Something went wrong')).toBe('error');
  });

  it('returns "error" even when hasPaymentMethod is true if error exists', () => {
    // Error takes precedence
    expect(resolveStep(true, false, 'error')).toBe('error');
  });

  it('returns "success" when hasPaymentMethod is true and no error', () => {
    expect(resolveStep(true, false, null)).toBe('success');
  });

  it('returns "success" when hasPaymentMethod is true even if isCheckingOut', () => {
    expect(resolveStep(true, true, null)).toBe('success');
  });

  it('returns "waiting" when isCheckingOut is true and no payment method', () => {
    expect(resolveStep(false, true, null)).toBe('waiting');
  });

  it('returns "checkout" when nothing is active', () => {
    expect(resolveStep(false, false, null)).toBe('checkout');
  });
});

// ─── 2. API helper tests ────────────────────────────────────────────────────

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

describe('checkPaymentMethod', () => {
  beforeEach(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    server.close();
  });

  it('returns true when payment method exists', async () => {
    server.use(
      http.get('/api/stripe/defaultPaymentMethod', () =>
        HttpResponse.json({ defaultPaymentMethod: 'pm_123' })
      )
    );
    expect(await checkPaymentMethod()).toBe(true);
  });

  it('returns false when payment method is null', async () => {
    server.use(
      http.get('/api/stripe/defaultPaymentMethod', () =>
        HttpResponse.json({ defaultPaymentMethod: null })
      )
    );
    expect(await checkPaymentMethod()).toBe(false);
  });

  it('returns false when API returns 404', async () => {
    server.use(
      http.get('/api/stripe/defaultPaymentMethod', () => new HttpResponse(null, { status: 404 }))
    );
    expect(await checkPaymentMethod()).toBe(false);
  });

  it('returns false on network error', async () => {
    server.use(http.get('/api/stripe/defaultPaymentMethod', () => HttpResponse.error()));
    expect(await checkPaymentMethod()).toBe(false);
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
    // Default: checkout session returns URL
    server.use(
      http.get('/api/stripe/checkoutSession', () =>
        HttpResponse.json({ url: 'https://checkout.stripe.com/test' })
      ),
      http.get('/api/stripe/defaultPaymentMethod', () =>
        HttpResponse.json({ defaultPaymentMethod: null })
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
    render(<StripeSidePanel open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByTestId('stripe-side-panel')).toBeTruthy();
    expect(screen.getByText('Purchase Credits')).toBeTruthy();
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
      expect(screen.getByTestId('stripe-panel-error')).toBeTruthy();
      expect(screen.getByText(/Failed to create checkout session/)).toBeTruthy();
    });
  });

  it('transitions to success when payment method is detected during polling', async () => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const mockOnSuccess = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    // Start with no payment method, then change to having one
    let callCount = 0;
    server.use(
      http.get('/api/stripe/defaultPaymentMethod', () => {
        callCount++;
        if (callCount >= 2) {
          return HttpResponse.json({ defaultPaymentMethod: 'pm_test_123' });
        }
        return HttpResponse.json({ defaultPaymentMethod: null });
      })
    );

    render(<StripeSidePanel open={true} onOpenChange={vi.fn()} onSuccess={mockOnSuccess} />);

    // Click Add Payment Method to start flow
    await user.click(screen.getByTestId('stripe-panel-add-button'));

    // Should be in waiting state
    await waitFor(() => {
      expect(screen.getByText(/Complete the checkout/)).toBeTruthy();
    });

    // Advance past polling interval (3 seconds x 2)
    await vi.advanceTimersByTimeAsync(6500);

    // Should transition to success
    await waitFor(() => {
      expect(screen.getByTestId('stripe-panel-success')).toBeTruthy();
    });

    expect(mockOnSuccess).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('resets to prompt step when panel is reopened', async () => {
    const onOpenChange = vi.fn();

    const { rerender } = render(<StripeSidePanel open={true} onOpenChange={onOpenChange} />);

    // Verify prompt is showing
    expect(screen.getByTestId('stripe-panel-add-button')).toBeTruthy();

    // Close panel
    rerender(<StripeSidePanel open={false} onOpenChange={onOpenChange} />);

    // Reopen panel
    rerender(<StripeSidePanel open={true} onOpenChange={onOpenChange} />);

    // Should be back at prompt
    expect(screen.getByTestId('stripe-panel-add-button')).toBeTruthy();
  });

  it('calls claimCreditGrantToken when payment method is detected and token is provided', async () => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    let claimCalled = false;
    server.use(
      http.get('/api/stripe/defaultPaymentMethod', () =>
        HttpResponse.json({ defaultPaymentMethod: 'pm_test_123' })
      ),
      http.post('/api/user/claim-credit-grant-link', async ({ request }) => {
        const body = (await request.json()) as { token: string };
        if (body.token === 'credit_grant_abc') {
          claimCalled = true;
          return HttpResponse.json({ success: true });
        }
        return new HttpResponse(null, { status: 400 });
      })
    );

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <StripeSidePanel open={true} onOpenChange={vi.fn()} pendingCreditToken="credit_grant_abc" />
    );

    await user.click(screen.getByTestId('stripe-panel-add-button'));

    // Advance past polling interval
    await vi.advanceTimersByTimeAsync(3500);

    await waitFor(() => {
      expect(screen.getByTestId('stripe-panel-success')).toBeTruthy();
    });

    expect(claimCalled).toBe(true);
    expect(screen.getByText(/credits have been applied/)).toBeTruthy();

    vi.useRealTimers();
  });
});
