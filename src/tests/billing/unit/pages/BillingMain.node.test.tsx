/**
 * Tests for the simplified Billing page Main component.
 *
 * Validates that:
 *   1. Kept sections: Account Balance, Billing Profile, Automatic Refill
 *   2. Checkout return status is displayed correctly
 *   3. Billing setup check runs on mount
 *   4. Org context displays correct heading
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/server';
import React from 'react';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock next/navigation
const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/billing',
}));

// Mock BillingProfile component to isolate Main testing
vi.mock('@/components/Pages/Billing/BillingProfile', () => ({
  default: ({ isEditing }: { isEditing: boolean }) => (
    <div data-testid="billing-profile-section">
      BillingProfile {isEditing ? '(editing)' : '(view)'}
    </div>
  ),
}));

import Main from '@/components/Pages/Billing/Main';

// ─── Tests ──────────────────────────────────────────────────────────────────

// Default MSW handlers for Main.tsx data fetching
const defaultHandlers = [
  http.get('/api/billing/balance', () =>
    HttpResponse.json({ balance: '25.00', fullBalance: 25 })
  ),
  http.get('/api/billing/auto-recharge/settings', () =>
    HttpResponse.json({
      autoRechargeEnabled: false,
      autoRechargeThreshold: 10,
      autoRechargeQty: 25,
      minRechargeAmount: 25,
      totalSpending: 100,
      canEnableAutoRecharge: true,
      minimumSpendRequired: 50,
      remainingSpendNeeded: 0,
    })
  ),
];

describe('Billing Main – simplified layout', () => {
  beforeEach(() => {
    server.listen();
    server.use(...defaultHandlers);
  });

  afterEach(() => {
    server.resetHandlers();
    server.close();
    vi.clearAllMocks();
  });

  it('renders Balance section', async () => {
    render(<Main />);

    await waitFor(() => {
      expect(screen.getByText('Balance')).toBeTruthy();
    });
  });

  it('renders Auto-Recharge section', async () => {
    render(<Main />);

    await waitFor(() => {
      expect(screen.getByText('Auto-Recharge')).toBeTruthy();
    });
  });

  it('renders Billing Profile section', async () => {
    render(<Main />);

    await waitFor(() => {
      expect(screen.getByTestId('billing-profile-section')).toBeTruthy();
    });
    expect(screen.getByText('Billing Profile')).toBeTruthy();
  });

  it('shows loading state before data loads', () => {
    // Delay the balance fetch
    server.use(
      http.get('/api/billing/balance', async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return HttpResponse.json({ balance: '25.00', fullBalance: 25 });
      })
    );

    render(<Main />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows org name in billing profile description when in org context', async () => {
    render(<Main orgContext={{ orgId: 1, orgName: 'Acme Corp', canEdit: true }} />);

    await waitFor(() => {
      expect(screen.getByTestId('billing-profile-section')).toBeTruthy();
    });
    expect(screen.getByText('Billing details for Acme Corp')).toBeTruthy();
  });

  it('shows personal billing profile description when not in org context', async () => {
    render(<Main />);

    await waitFor(() => {
      expect(screen.getByTestId('billing-profile-section')).toBeTruthy();
    });
    expect(screen.getByText('Your billing details and tax information')).toBeTruthy();
  });

  it('renders Edit button for billing profile', async () => {
    render(<Main />);

    await waitFor(() => {
      expect(screen.getByTestId('billing-profile-section')).toBeTruthy();
    });
    expect(screen.getByText('Edit')).toBeTruthy();
  });
});

describe('Billing Main – checkout return handling', () => {
  beforeEach(() => {
    server.listen();
    server.use(...defaultHandlers);
  });

  afterEach(() => {
    server.resetHandlers();
    server.close();
    vi.clearAllMocks();
  });

  it('shows success alert when checkout session was paid', async () => {
    // Simulate returning from Stripe with sessionId
    mockSearchParams.set('sessionId', 'cs_test_123');
    server.use(
      http.get('/api/stripe/session-status', () =>
        HttpResponse.json({ paymentStatus: 'paid' })
      )
    );

    render(<Main />);

    await waitFor(() => {
      expect(screen.getByText('Payment Successful')).toBeTruthy();
    });
    expect(
      screen.getByText('Payment successful! Your new balance will be reflected shortly.')
    ).toBeTruthy();

    // Clean up
    mockSearchParams.delete('sessionId');
  });

  it('shows error alert when checkout session was not paid', async () => {
    mockSearchParams.set('sessionId', 'cs_test_fail');
    server.use(
      http.get('/api/stripe/session-status', () =>
        HttpResponse.json({ paymentStatus: 'unpaid' })
      )
    );

    render(<Main />);

    await waitFor(() => {
      expect(screen.getByText('Payment Issue')).toBeTruthy();
    });

    mockSearchParams.delete('sessionId');
  });

  it('does not show checkout alert when no sessionId in URL', async () => {
    mockSearchParams.delete('sessionId');

    render(<Main />);

    await waitFor(() => {
      expect(screen.getByText('Balance')).toBeTruthy();
    });
    expect(screen.queryByText('Payment Successful')).toBeNull();
    expect(screen.queryByText('Payment Issue')).toBeNull();
  });
});

