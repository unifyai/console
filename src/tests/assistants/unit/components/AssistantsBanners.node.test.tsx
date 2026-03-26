/**
 * Unit tests for AssistantsBanners component.
 *
 * Tests cover:
 * - Out of credits banner visibility and messaging (credits < 0)
 * - Brand-new user exclusion (credits === 0 → no banner)
 * - Users granted credits without payment (credits < 0 after depletion → banner shows)
 * - Spending limit reached banner visibility and messaging
 * - Account status banners (PAST_DUE, SUSPENDED, CLOSED)
 * - Mutual exclusivity of banners
 * - Loading state handling
 * - Personal vs organization workspace messaging
 * - Correct links to Billing/Usage pages
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssistantsBanners } from '@/components/Pages/Assistants/AssistantsBanners';
import { SpendingGateStatus } from '@/types/assistants/spendingGate';

// =============================================================================
// Test Helpers
// =============================================================================

const createUnblockedGate = (overrides?: Partial<SpendingGateStatus>): SpendingGateStatus => ({
  isBlocked: false,
  blockReason: null,
  blockedMessage: null,
  isLoading: false,
  isRefreshing: false,
  limits: {
    assistant: null,
    user: null,
    org: null,
  },
  ...overrides,
});

const createBlockedGate = (
  reason: 'assistant_limit' | 'user_limit' | 'org_limit' = 'assistant_limit'
): SpendingGateStatus => ({
  isBlocked: true,
  blockReason: reason,
  blockedMessage:
    reason === 'assistant_limit'
      ? "This assistant's monthly spending limit has been reached."
      : reason === 'user_limit'
        ? 'Your monthly spending limit has been reached.'
        : "Your organization's monthly spending limit has been reached.",
  isLoading: false,
  isRefreshing: false,
  limits: {
    assistant:
      reason === 'assistant_limit'
        ? {
            currentSpend: 150,
            limit: 100,
            isOverLimit: true,
            isNearLimit: false,
            isUnlimited: false,
          }
        : {
            currentSpend: 50,
            limit: 100,
            isOverLimit: false,
            isNearLimit: false,
            isUnlimited: false,
          },
    user:
      reason === 'user_limit'
        ? {
            currentSpend: 250,
            limit: 200,
            isOverLimit: true,
            isNearLimit: false,
            isUnlimited: false,
          }
        : null,
    org:
      reason === 'org_limit'
        ? {
            currentSpend: 5500,
            limit: 5000,
            isOverLimit: true,
            isNearLimit: false,
            isUnlimited: false,
          }
        : null,
  },
});

// =============================================================================
// Tests
// =============================================================================

describe('AssistantsBanners', () => {
  // ===========================================================================
  // No Banner (null rendering)
  // ===========================================================================

  describe('renders nothing when no banner should show', () => {
    it('renders nothing when user has positive credits', () => {
      const { container } = render(
        <AssistantsBanners
          credits={50}
          isBillingLoading={false}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={false}
        />
      );

      expect(container.innerHTML).toBe('');
    });

    it('renders nothing for brand-new user with zero credits', () => {
      const { container } = render(
        <AssistantsBanners
          credits={0}
          isBillingLoading={false}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={false}
        />
      );

      expect(container.innerHTML).toBe('');
    });

    it('renders nothing while billing data is loading', () => {
      const { container } = render(
        <AssistantsBanners
          credits={-5}
          isBillingLoading={true}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={false}
        />
      );

      expect(container.innerHTML).toBe('');
    });

    it('renders spending limit banner when credits are positive but limit is reached', () => {
      render(
        <AssistantsBanners
          credits={50}
          isBillingLoading={false}
          spendingGateStatus={createBlockedGate('assistant_limit')}
          isOrgWorkspace={false}
        />
      );

      expect(screen.getByTestId('spending-limit-banner')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Out of Credits Banner
  // ===========================================================================

  describe('out of credits banner', () => {
    it('shows when credits are negative', () => {
      render(
        <AssistantsBanners
          credits={-0.5}
          isBillingLoading={false}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={false}
        />
      );

      expect(screen.getByTestId('out-of-credits-banner')).toBeInTheDocument();
    });

    it('shows for user who received granted credits and depleted them (no paid recharge)', () => {
      render(
        <AssistantsBanners
          credits={-0.13}
          isBillingLoading={false}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={false}
        />
      );

      expect(screen.getByTestId('out-of-credits-banner')).toBeInTheDocument();
    });

    it('shows personal workspace message for individual users', () => {
      render(
        <AssistantsBanners
          credits={-1}
          isBillingLoading={false}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={false}
        />
      );

      expect(screen.getByText('Your credit balance has been depleted')).toBeInTheDocument();
      expect(screen.getByText(/You can add credits on the/)).toBeInTheDocument();
    });

    it('shows organization message for org workspaces', () => {
      render(
        <AssistantsBanners
          credits={-1}
          isBillingLoading={false}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={true}
        />
      );

      expect(
        screen.getByText("Your organization's credit balance has been depleted")
      ).toBeInTheDocument();
      expect(
        screen.getByText(/An organization owner or admin can add credits on the/)
      ).toBeInTheDocument();
    });

    it('links to the Billing page', () => {
      render(
        <AssistantsBanners
          credits={-1}
          isBillingLoading={false}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={false}
        />
      );

      const link = screen.getByRole('link', { name: 'Billing page' });
      expect(link).toHaveAttribute('href', '/billing');
    });

    it('does NOT show for brand-new users with zero credits', () => {
      render(
        <AssistantsBanners
          credits={0}
          isBillingLoading={false}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={false}
        />
      );

      expect(screen.queryByTestId('out-of-credits-banner')).not.toBeInTheDocument();
    });

    it('does NOT show while billing is loading', () => {
      render(
        <AssistantsBanners
          credits={-5}
          isBillingLoading={true}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={false}
        />
      );

      expect(screen.queryByTestId('out-of-credits-banner')).not.toBeInTheDocument();
    });

    it('does NOT show when spending limit is also blocked (prefers spending limit banner)', () => {
      render(
        <AssistantsBanners
          credits={-5}
          isBillingLoading={false}
          spendingGateStatus={createBlockedGate('user_limit')}
          isOrgWorkspace={false}
        />
      );

      expect(screen.queryByTestId('out-of-credits-banner')).not.toBeInTheDocument();
      expect(screen.getByTestId('spending-limit-banner')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Account Status Banners
  // ===========================================================================

  describe('account status banners', () => {
    it('shows PAST_DUE banner for personal workspace', () => {
      render(
        <AssistantsBanners
          credits={-1}
          isBillingLoading={false}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={false}
          accountStatus="PAST_DUE"
        />
      );

      expect(screen.getByTestId('account-status-banner')).toBeInTheDocument();
      expect(screen.getByText('Payment past due')).toBeInTheDocument();
      expect(screen.queryByTestId('out-of-credits-banner')).not.toBeInTheDocument();
    });

    it('shows SUSPENDED banner', () => {
      render(
        <AssistantsBanners
          credits={-1}
          isBillingLoading={false}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={false}
          accountStatus="SUSPENDED"
        />
      );

      expect(screen.getByTestId('account-status-banner')).toBeInTheDocument();
      expect(screen.getByText('Account suspended')).toBeInTheDocument();
    });

    it('shows CLOSED banner', () => {
      render(
        <AssistantsBanners
          credits={-1}
          isBillingLoading={false}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={false}
          accountStatus="CLOSED"
        />
      );

      expect(screen.getByTestId('account-status-banner')).toBeInTheDocument();
      expect(screen.getByText('Account closed')).toBeInTheDocument();
    });

    it('takes priority over out-of-credits banner', () => {
      render(
        <AssistantsBanners
          credits={-10}
          isBillingLoading={false}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={false}
          accountStatus="SUSPENDED"
        />
      );

      expect(screen.getByTestId('account-status-banner')).toBeInTheDocument();
      expect(screen.queryByTestId('out-of-credits-banner')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Spending Limit Reached Banner
  // ===========================================================================

  describe('spending limit reached banner', () => {
    it('shows when assistant limit is reached', () => {
      render(
        <AssistantsBanners
          credits={50}
          isBillingLoading={false}
          spendingGateStatus={createBlockedGate('assistant_limit')}
          isOrgWorkspace={false}
        />
      );

      expect(screen.getByTestId('spending-limit-banner')).toBeInTheDocument();
      expect(screen.getByText('Assistant spending limit reached')).toBeInTheDocument();
    });

    it('shows when user limit is reached', () => {
      render(
        <AssistantsBanners
          credits={50}
          isBillingLoading={false}
          spendingGateStatus={createBlockedGate('user_limit')}
          isOrgWorkspace={false}
        />
      );

      expect(screen.getByTestId('spending-limit-banner')).toBeInTheDocument();
      expect(screen.getByText('Your spending limit reached')).toBeInTheDocument();
    });

    it('shows when org limit is reached', () => {
      render(
        <AssistantsBanners
          credits={50}
          isBillingLoading={false}
          spendingGateStatus={createBlockedGate('org_limit')}
          isOrgWorkspace={true}
        />
      );

      expect(screen.getByTestId('spending-limit-banner')).toBeInTheDocument();
      expect(screen.getByText('Organization spending limit reached')).toBeInTheDocument();
    });

    it('displays usage amounts for assistant limit', () => {
      render(
        <AssistantsBanners
          credits={50}
          isBillingLoading={false}
          spendingGateStatus={createBlockedGate('assistant_limit')}
          isOrgWorkspace={false}
        />
      );

      expect(screen.getByText(/\$150\.00 of \$100\.00 used/)).toBeInTheDocument();
    });

    it('displays usage amounts for user limit', () => {
      render(
        <AssistantsBanners
          credits={50}
          isBillingLoading={false}
          spendingGateStatus={createBlockedGate('user_limit')}
          isOrgWorkspace={false}
        />
      );

      expect(screen.getByText(/\$250\.00 of \$200\.00 used/)).toBeInTheDocument();
    });

    it('displays usage amounts for org limit', () => {
      render(
        <AssistantsBanners
          credits={50}
          isBillingLoading={false}
          spendingGateStatus={createBlockedGate('org_limit')}
          isOrgWorkspace={true}
        />
      );

      expect(screen.getByText(/\$5500\.00 of \$5000\.00 used/)).toBeInTheDocument();
    });

    it('shows user-directed message for user/assistant limits', () => {
      render(
        <AssistantsBanners
          credits={50}
          isBillingLoading={false}
          spendingGateStatus={createBlockedGate('user_limit')}
          isOrgWorkspace={false}
        />
      );

      expect(screen.getByText(/You can update your limit on the/)).toBeInTheDocument();
    });

    it('shows admin-directed message for org limits', () => {
      render(
        <AssistantsBanners
          credits={50}
          isBillingLoading={false}
          spendingGateStatus={createBlockedGate('org_limit')}
          isOrgWorkspace={true}
        />
      );

      expect(
        screen.getByText(/An organization owner or admin can increase the limit on the/)
      ).toBeInTheDocument();
    });

    it('links to the Usage page', () => {
      render(
        <AssistantsBanners
          credits={50}
          isBillingLoading={false}
          spendingGateStatus={createBlockedGate('assistant_limit')}
          isOrgWorkspace={false}
        />
      );

      const link = screen.getByRole('link', { name: 'Usage page' });
      expect(link).toHaveAttribute('href', '/usage');
    });

    it('does NOT show when spending gate is loading', () => {
      const loadingGate: SpendingGateStatus = {
        ...createBlockedGate('assistant_limit'),
        isLoading: true,
      };

      render(
        <AssistantsBanners
          credits={50}
          isBillingLoading={false}
          spendingGateStatus={loadingGate}
          isOrgWorkspace={false}
        />
      );

      expect(screen.queryByTestId('spending-limit-banner')).not.toBeInTheDocument();
    });

    it('handles limit with null limit value (no usage text)', () => {
      const gateWithNullLimit: SpendingGateStatus = {
        isBlocked: true,
        blockReason: 'assistant_limit',
        blockedMessage: "This assistant's monthly spending limit has been reached.",
        isLoading: false,
        isRefreshing: false,
        limits: {
          assistant: {
            currentSpend: 100,
            limit: null,
            isOverLimit: true,
            isNearLimit: false,
            isUnlimited: false,
          },
          user: null,
          org: null,
        },
      };

      render(
        <AssistantsBanners
          credits={50}
          isBillingLoading={false}
          spendingGateStatus={gateWithNullLimit}
          isOrgWorkspace={false}
        />
      );

      expect(screen.getByTestId('spending-limit-banner')).toBeInTheDocument();
      expect(screen.queryByText(/used/)).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Mutual Exclusivity
  // ===========================================================================

  describe('mutual exclusivity', () => {
    it('shows spending limit banner instead of out-of-credits when both conditions are met', () => {
      render(
        <AssistantsBanners
          credits={-5}
          isBillingLoading={false}
          spendingGateStatus={createBlockedGate('user_limit')}
          isOrgWorkspace={false}
        />
      );

      expect(screen.getByTestId('spending-limit-banner')).toBeInTheDocument();
      expect(screen.queryByTestId('out-of-credits-banner')).not.toBeInTheDocument();
    });

    it('never shows both banners simultaneously', () => {
      for (const reason of ['assistant_limit', 'user_limit', 'org_limit'] as const) {
        const { unmount } = render(
          <AssistantsBanners
            credits={-5}
            isBillingLoading={false}
            spendingGateStatus={createBlockedGate(reason)}
            isOrgWorkspace={reason === 'org_limit'}
          />
        );

        const creditBanner = screen.queryByTestId('out-of-credits-banner');
        const limitBanner = screen.queryByTestId('spending-limit-banner');

        expect(creditBanner && limitBanner).toBeFalsy();
        expect(limitBanner).toBeInTheDocument();

        unmount();
      }
    });
  });

  // ===========================================================================
  // Brand-new User / Zero Credits Exclusion
  // ===========================================================================

  describe('brand-new user exclusion', () => {
    it('never shows out-of-credits banner for brand-new user with zero credits', () => {
      const { container } = render(
        <AssistantsBanners
          credits={0}
          isBillingLoading={false}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={false}
        />
      );

      expect(container.innerHTML).toBe('');
    });

    it('never shows out-of-credits banner for brand-new org with zero credits', () => {
      const { container } = render(
        <AssistantsBanners
          credits={0}
          isBillingLoading={false}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={true}
        />
      );

      expect(container.innerHTML).toBe('');
    });

    it('still shows spending limit banner even with zero credits', () => {
      render(
        <AssistantsBanners
          credits={0}
          isBillingLoading={false}
          spendingGateStatus={createBlockedGate('org_limit')}
          isOrgWorkspace={true}
        />
      );

      expect(screen.getByTestId('spending-limit-banner')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Credit Grant Edge Cases
  // ===========================================================================

  describe('credit grant scenarios', () => {
    it('shows banner for user who received granted credits and fully depleted them', () => {
      render(
        <AssistantsBanners
          credits={-0.54}
          isBillingLoading={false}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={false}
        />
      );

      expect(screen.getByTestId('out-of-credits-banner')).toBeInTheDocument();
    });

    it('does NOT show banner for user who still has granted credits', () => {
      const { container } = render(
        <AssistantsBanners
          credits={73.15}
          isBillingLoading={false}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={false}
        />
      );

      expect(container.innerHTML).toBe('');
    });
  });
});
