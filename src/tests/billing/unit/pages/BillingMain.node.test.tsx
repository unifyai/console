/**
 * Tests for the simplified Billing page Main component.
 *
 * Validates that:
 *   1. Removed sections: spending limits, subscriptions/plan selection, eligibility alerts
 *   2. Kept sections: Account Balance, Billing Profile, Automatic Refill
 *   3. Checkout return status is displayed correctly
 *   4. Billing setup check runs on mount
 *   5. Org context displays correct heading
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

// Mock Balance component to isolate Main testing
vi.mock('@/components/Pages/Billing/Balance', () => ({
  default: () => <div data-testid="balance-section">Balance Component</div>,
}));

// Mock AutomaticRefill
vi.mock('@/components/Pages/Billing/Refill', () => ({
  default: () => <div data-testid="auto-refill-section">AutomaticRefill Component</div>,
}));

// Mock TaxClassification (now "Billing Profile" section)
vi.mock('@/components/Pages/Billing/TaxClassification', () => ({
  default: ({ isEditing }: { isEditing: boolean }) => (
    <div data-testid="billing-profile-section">
      TaxClassification {isEditing ? '(editing)' : '(view)'}
    </div>
  ),
}));

// Mock Subscriptions (should NOT be rendered)
vi.mock('@/components/Pages/Billing/Subscriptions', () => ({
  default: () => <div data-testid="subscriptions-section">Subscriptions</div>,
}));

// Mock OrgSpendingLimitSection (should NOT be rendered)
vi.mock('@/components/Pages/Billing/OrgSpendingLimitSection', () => ({
  OrgSpendingLimitSection: () => (
    <div data-testid="org-spending-limit-section">OrgSpendingLimit</div>
  ),
}));

// Mock UserSpendingLimitSection (should NOT be rendered)
vi.mock('@/components/Pages/Billing/UserSpendingLimitSection', () => ({
  UserSpendingLimitSection: () => (
    <div data-testid="user-spending-limit-section">UserSpendingLimit</div>
  ),
}));

import Main from '@/components/Pages/Billing/Main';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Billing Main – simplified layout', () => {
  beforeEach(() => {
    server.listen();
    // Default: customer already exists
    server.use(
      http.get('/api/billing/hasCustomerId', () =>
        HttpResponse.json({ hasCustomerId: true })
      )
    );
  });

  afterEach(() => {
    server.resetHandlers();
    server.close();
    vi.clearAllMocks();
  });

  it('renders Account Balance section', async () => {
    render(<Main />);

    await waitFor(() => {
      expect(screen.getByTestId('balance-section')).toBeTruthy();
    });
    expect(screen.getByText('Account Balance')).toBeTruthy();
  });

  it('renders Automatic Refill section', async () => {
    render(<Main />);

    await waitFor(() => {
      expect(screen.getByTestId('auto-refill-section')).toBeTruthy();
    });
  });

  it('renders Billing Profile section (not "Tax Classification")', async () => {
    render(<Main />);

    await waitFor(() => {
      expect(screen.getByTestId('billing-profile-section')).toBeTruthy();
    });
    expect(screen.getByText('Billing Profile')).toBeTruthy();
  });

  it('does NOT render Subscriptions / Plan Selection section', async () => {
    render(<Main />);

    await waitFor(() => {
      expect(screen.getByTestId('balance-section')).toBeTruthy();
    });
    expect(screen.queryByTestId('subscriptions-section')).toBeNull();
    expect(screen.queryByText('Plan Selection')).toBeNull();
  });

  it('does NOT render Organization Spending Limit section', async () => {
    render(<Main orgContext={{ orgId: 1, orgName: 'Acme', canEdit: true }} />);

    await waitFor(() => {
      expect(screen.getByTestId('balance-section')).toBeTruthy();
    });
    expect(screen.queryByTestId('org-spending-limit-section')).toBeNull();
  });

  it('does NOT render User Spending Limit section', async () => {
    render(<Main />);

    await waitFor(() => {
      expect(screen.getByTestId('balance-section')).toBeTruthy();
    });
    expect(screen.queryByTestId('user-spending-limit-section')).toBeNull();
  });

  it('does NOT render auto-recharge eligibility alert', async () => {
    render(<Main />);

    await waitFor(() => {
      expect(screen.getByTestId('balance-section')).toBeTruthy();
    });
    expect(screen.queryByText(/Spend \$.*to Access Automated Top-ups/)).toBeNull();
  });

  it('shows loading state before billing setup completes', () => {
    // Delay the billing check
    server.use(
      http.get('/api/billing/hasCustomerId', async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return HttpResponse.json({ hasCustomerId: true });
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
    server.use(
      http.get('/api/billing/hasCustomerId', () =>
        HttpResponse.json({ hasCustomerId: true })
      )
    );
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
      expect(screen.getByTestId('balance-section')).toBeTruthy();
    });
    expect(screen.queryByText('Payment Successful')).toBeNull();
    expect(screen.queryByText('Payment Issue')).toBeNull();
  });
});

