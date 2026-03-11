/**
 * Checkout and payment flow tests.
 *
 * Covers the "Buy credits / manage payment methods" user journey:
 *   - Clicking Buy Credits → creating a Stripe checkout session
 *   - Clicking Manage Payment Methods → opening the Stripe portal
 *   - Returning from Stripe checkout with success/error
 *   - StripeSidePanel: new-tab checkout with polling for completion
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';

import Main from '@/components/Pages/Billing/Main';
import { StripeSidePanel } from '@/components/Billing/StripeSidePanel';

import { createMockActions, waitForMainLoaded } from './mocks/actions';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/billing',
}));

// Capture navigation calls
let locationAssignSpy: ReturnType<typeof vi.fn>;
let historyReplaceSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  locationAssignSpy = vi.fn();
  // Replace window.location.assign so navigation doesn't throw in jsdom
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { ...window.location, assign: locationAssignSpy },
  });
  historyReplaceSpy = vi
    .spyOn(window.history, 'replaceState')
    .mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  mockSearchParams.delete('sessionId');
});

// =============================================================================
// 1. Buying credits
// =============================================================================

describe('Buying credits', () => {
  it('creates checkout session and navigates to Stripe on success', async () => {
    const actions = createMockActions();
    const user = userEvent.setup();

    render(<Main actions={actions} />);
    await waitForMainLoaded();

    await user.click(screen.getByRole('button', { name: 'Buy Credits' }));

    await waitFor(() => {
      expect(actions.createCheckoutSession).toHaveBeenCalled();
    });
    expect(locationAssignSpy).toHaveBeenCalledWith(
      'https://checkout.stripe.com/test',
    );
  });

  it('stays on page and logs error when checkout creation fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const actions = createMockActions({
      createCheckoutSession: vi
        .fn()
        .mockResolvedValue({ detail: 'Stripe not configured' }),
    });
    const user = userEvent.setup();

    render(<Main actions={actions} />);
    await waitForMainLoaded();

    await user.click(screen.getByRole('button', { name: 'Buy Credits' }));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error creating checkout session:',
        'Stripe not configured',
      );
    });
    // Should NOT navigate
    expect(locationAssignSpy).not.toHaveBeenCalled();
  });
});

// =============================================================================
// 2. Managing payment methods
// =============================================================================

describe('Managing payment methods', () => {
  it('creates portal session and navigates to Stripe portal', async () => {
    const actions = createMockActions();
    const user = userEvent.setup();

    render(<Main actions={actions} />);
    await waitForMainLoaded();

    await user.click(
      screen.getByRole('button', { name: 'Manage Payment Methods' }),
    );

    await waitFor(() => {
      expect(actions.createPortalSession).toHaveBeenCalled();
    });
    expect(locationAssignSpy).toHaveBeenCalledWith(
      'https://billing.stripe.com/test',
    );
  });

  it('stays on page and logs error when portal creation fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const actions = createMockActions({
      createPortalSession: vi
        .fn()
        .mockResolvedValue({ detail: 'No Stripe customer found' }),
    });
    const user = userEvent.setup();

    render(<Main actions={actions} />);
    await waitForMainLoaded();

    await user.click(
      screen.getByRole('button', { name: 'Manage Payment Methods' }),
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to open billing portal:',
        'No Stripe customer found',
      );
    });
    expect(locationAssignSpy).not.toHaveBeenCalled();
  });
});

// =============================================================================
// 3. Checkout return handling
// =============================================================================

describe('Checkout return handling', () => {
  it('shows success alert when returning from a paid checkout', async () => {
    mockSearchParams.set('sessionId', 'cs_test_paid');
    const actions = createMockActions({
      getCheckoutStatus: vi
        .fn()
        .mockResolvedValue({ paymentStatus: 'paid' }),
    });

    render(<Main actions={actions} />);

    await waitFor(() => {
      expect(screen.getByText('Payment Successful')).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        'Payment successful! Your new balance will be reflected shortly.',
      ),
    ).toBeInTheDocument();
  });

  it('shows error alert when returning from an unpaid checkout', async () => {
    mockSearchParams.set('sessionId', 'cs_test_unpaid');
    const actions = createMockActions({
      getCheckoutStatus: vi
        .fn()
        .mockResolvedValue({ paymentStatus: 'unpaid' }),
    });

    render(<Main actions={actions} />);

    await waitFor(() => {
      expect(screen.getByText('Payment Issue')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Your payment was not successful. Please try again.'),
    ).toBeInTheDocument();
  });

  it('shows error alert when checkout status check itself fails', async () => {
    mockSearchParams.set('sessionId', 'cs_test_error');
    const actions = createMockActions({
      getCheckoutStatus: vi
        .fn()
        .mockResolvedValue({ detail: 'Session expired' }),
    });

    render(<Main actions={actions} />);

    await waitFor(() => {
      expect(screen.getByText('Payment Issue')).toBeInTheDocument();
    });
    expect(screen.getByText('Session expired')).toBeInTheDocument();
  });

  it('shows no alert when there is no sessionId in the URL', async () => {
    mockSearchParams.delete('sessionId');
    const actions = createMockActions();

    render(<Main actions={actions} />);
    await waitForMainLoaded();

    expect(screen.queryByText('Payment Successful')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment Issue')).not.toBeInTheDocument();
  });

  it('cleans the sessionId from the URL after processing', async () => {
    mockSearchParams.set('sessionId', 'cs_test_paid');
    const actions = createMockActions({
      getCheckoutStatus: vi
        .fn()
        .mockResolvedValue({ paymentStatus: 'paid' }),
    });

    render(<Main actions={actions} />);

    await waitFor(() => {
      expect(screen.getByText('Payment Successful')).toBeInTheDocument();
    });
    expect(historyReplaceSpy).toHaveBeenCalledWith(null, '', '/billing');
  });
});

// =============================================================================
// 4. StripeSidePanel component
// =============================================================================

describe('StripeSidePanel component', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/stripe/checkoutSession', () =>
        HttpResponse.json({
          url: 'https://checkout.stripe.com/test',
          sessionId: 'cs_test_default',
        }),
      ),
    );
  });

  it('is hidden when closed', () => {
    render(<StripeSidePanel open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByTestId('stripe-side-panel')).not.toBeInTheDocument();
  });

  it('opens checkout in a new tab and shows waiting state', async () => {
    const windowOpenSpy = vi
      .spyOn(window, 'open')
      .mockImplementation(() => null);

    render(<StripeSidePanel open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://checkout.stripe.com/test',
        '_blank',
      );
    });

    expect(
      screen.getByText(/Complete the checkout in the Stripe tab/),
    ).toBeInTheDocument();
  });

  it('shows error state when checkout session creation fails', async () => {
    server.use(
      http.get('/api/stripe/checkoutSession', () =>
        new HttpResponse(null, { status: 500 }),
      ),
    );

    render(<StripeSidePanel open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Something went wrong\. Please try again\./),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('restarts checkout flow when panel is closed and reopened', async () => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <StripeSidePanel open={true} onOpenChange={onOpenChange} />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Complete the checkout in the Stripe tab/),
      ).toBeInTheDocument();
    });

    // Close
    rerender(<StripeSidePanel open={false} onOpenChange={onOpenChange} />);
    // Reopen
    rerender(<StripeSidePanel open={true} onOpenChange={onOpenChange} />);

    // Should show waiting state again after re-fetching checkout
    await waitFor(() => {
      expect(
        screen.getByText(/Complete the checkout in the Stripe tab/),
      ).toBeInTheDocument();
    });
  });
});

