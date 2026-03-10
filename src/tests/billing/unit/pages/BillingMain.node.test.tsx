/**
 * Tests for the Billing page Main component.
 *
 * Now uses mock BillingActions (server actions) instead of MSW HTTP
 * handlers, matching the new architecture where page.tsx passes
 * bound server actions to Main.
 *
 * Validates that:
 *   1. Kept sections: Account Balance, Billing Profile, Automatic Refill
 *   2. Checkout return status is displayed correctly
 *   3. Loading state on mount
 *   4. Org context displays correct heading
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import type { BillingActions } from '@/types/billing';

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

// ─── Default mock actions ────────────────────────────────────────────────────

function createMockActions(overrides?: Partial<BillingActions>): BillingActions {
  return {
    getBalance: vi.fn().mockResolvedValue({
      balance: '25.00',
      fullBalance: 25,
      lastRechargeAt: null,
    }),
    getAutoRecharge: vi.fn().mockResolvedValue({
      autoRechargeEnabled: false,
      autoRechargeThreshold: 10,
      autoRechargeQty: 25,
      minRechargeAmount: 25,
      totalSpending: 100,
      canEnableAutoRecharge: true,
      minimumSpendRequired: 50,
      remainingSpendNeeded: 0,
    }),
    updateAutoRecharge: vi.fn().mockResolvedValue(undefined),
    toggleAutoRecharge: vi.fn().mockResolvedValue(undefined),
    getProfile: vi.fn().mockResolvedValue({}),
    updateProfile: vi.fn().mockResolvedValue({}),
    createCheckoutSession: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }),
    createPortalSession: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/test' }),
    getCheckoutStatus: vi.fn().mockResolvedValue({ paymentStatus: 'unpaid' }),
    getSupportedTaxCountries: vi.fn().mockResolvedValue({
      supportedCountries: {},
      totalCountries: 0,
    }),
    validateTaxId: vi.fn().mockResolvedValue({ valid: true }),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Billing Main – simplified layout', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders Balance section', async () => {
    const actions = createMockActions();
    render(<Main actions={actions} />);

    await waitFor(() => {
      expect(screen.getByText('Balance')).toBeTruthy();
    });
  });

  it('renders Auto-Recharge section', async () => {
    const actions = createMockActions();
    render(<Main actions={actions} />);

    await waitFor(() => {
      expect(screen.getByText('Auto-Recharge')).toBeTruthy();
    });
  });

  it('renders Billing Profile section', async () => {
    const actions = createMockActions();
    render(<Main actions={actions} />);

    await waitFor(() => {
      expect(screen.getByTestId('billing-profile-section')).toBeTruthy();
    });
    expect(screen.getByText('Billing Profile')).toBeTruthy();
  });

  it('shows loading state before data loads', () => {
    // Create actions that never resolve the balance
    const actions = createMockActions({
      getBalance: vi.fn().mockReturnValue(new Promise(() => {})),
    });

    render(<Main actions={actions} />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows org name in billing profile description when in org context', async () => {
    const actions = createMockActions();
    render(
      <Main
        actions={actions}
        orgContext={{ orgId: 1, orgName: 'Acme Corp', canEdit: true }}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('billing-profile-section')).toBeTruthy();
    });
    expect(screen.getByText('Billing details for Acme Corp')).toBeTruthy();
  });

  it('shows personal billing profile description when not in org context', async () => {
    const actions = createMockActions();
    render(<Main actions={actions} />);

    await waitFor(() => {
      expect(screen.getByTestId('billing-profile-section')).toBeTruthy();
    });
    expect(screen.getByText('Your billing details and tax information')).toBeTruthy();
  });

  it('renders Edit button for billing profile', async () => {
    const actions = createMockActions();
    render(<Main actions={actions} />);

    await waitFor(() => {
      expect(screen.getByTestId('billing-profile-section')).toBeTruthy();
    });
    expect(screen.getByText('Edit')).toBeTruthy();
  });
});

describe('Billing Main – checkout return handling', () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('sessionId');
  });

  it('shows success alert when checkout session was paid', async () => {
    mockSearchParams.set('sessionId', 'cs_test_123');
    const actions = createMockActions({
      getCheckoutStatus: vi.fn().mockResolvedValue({ paymentStatus: 'paid' }),
    });

    render(<Main actions={actions} />);

    await waitFor(() => {
      expect(screen.getByText('Payment Successful')).toBeTruthy();
    });
    expect(
      screen.getByText('Payment successful! Your new balance will be reflected shortly.')
    ).toBeTruthy();
  });

  it('shows error alert when checkout session was not paid', async () => {
    mockSearchParams.set('sessionId', 'cs_test_fail');
    const actions = createMockActions({
      getCheckoutStatus: vi.fn().mockResolvedValue({ paymentStatus: 'unpaid' }),
    });

    render(<Main actions={actions} />);

    await waitFor(() => {
      expect(screen.getByText('Payment Issue')).toBeTruthy();
    });
  });

  it('does not show checkout alert when no sessionId in URL', async () => {
    mockSearchParams.delete('sessionId');
    const actions = createMockActions();

    render(<Main actions={actions} />);

    await waitFor(() => {
      expect(screen.getByText('Balance')).toBeTruthy();
    });
    expect(screen.queryByText('Payment Successful')).toBeNull();
    expect(screen.queryByText('Payment Issue')).toBeNull();
  });
});
