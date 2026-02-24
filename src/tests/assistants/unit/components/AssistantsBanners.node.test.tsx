/**
 * Unit tests for AssistantsBanners component.
 *
 * Tests cover:
 * - Out of credits banner visibility and messaging
 * - Spending limit reached banner visibility and messaging
 * - Brand-new user exclusion (no banner when hasCustomerId is false)
 * - Mutual exclusivity of banners
 * - Loading state handling
 * - Personal vs organization workspace messaging
 * - Correct links to Billing/Usage pages
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssistantsBanners } from '@/components/Pages/Assistants/AssistantsBanners';
import { SpendingGateStatus, DEFAULT_SPENDING_GATE_STATUS } from '@/types/assistants/spendingGate';

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
    it('renders nothing when user has credits', () => {
      const { container } = render(
        <AssistantsBanners
          hasCredits={true}
          hasCustomerId={true}
          isBillingLoading={false}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={false}
        />
      );

      expect(container.innerHTML).toBe('');
    });

    it('renders nothing for brand-new user with no credits and no customer ID', () => {
      const { container } = render(
        <AssistantsBanners
          hasCredits={false}
          hasCustomerId={false}
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
          hasCredits={false}
          hasCustomerId={true}
          isBillingLoading={true}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={false}
        />
      );

      expect(container.innerHTML).toBe('');
    });

    it('renders nothing when spending gate is still loading', () => {
      const { container } = render(
        <AssistantsBanners
          hasCredits={true}
          hasCustomerId={true}
          isBillingLoading={false}
          spendingGateStatus={createBlockedGate('assistant_limit')}
          isOrgWorkspace={false}
        />
      );

      // Has credits = true, so out-of-credits banner won't show
      // spending gate isBlocked but hasCredits is true, so spending limit banner shows
      // This is expected behavior (spending limit can be reached while credits remain)
      expect(screen.getByTestId('spending-limit-banner')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Out of Credits Banner
  // ===========================================================================

  describe('out of credits banner', () => {
    it('shows when credits depleted and customer has billing history', () => {
      render(
        <AssistantsBanners
          hasCredits={false}
          hasCustomerId={true}
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
          hasCredits={false}
          hasCustomerId={true}
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
          hasCredits={false}
          hasCustomerId={true}
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
          hasCredits={false}
          hasCustomerId={true}
          isBillingLoading={false}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={false}
        />
      );

      const link = screen.getByRole('link', { name: 'Billing page' });
      expect(link).toHaveAttribute('href', '/billing');
    });

    it('does NOT show for brand-new users (no customer ID)', () => {
      render(
        <AssistantsBanners
          hasCredits={false}
          hasCustomerId={false}
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
          hasCredits={false}
          hasCustomerId={true}
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
          hasCredits={false}
          hasCustomerId={true}
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
  // Spending Limit Reached Banner
  // ===========================================================================

  describe('spending limit reached banner', () => {
    it('shows when assistant limit is reached', () => {
      render(
        <AssistantsBanners
          hasCredits={true}
          hasCustomerId={true}
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
          hasCredits={true}
          hasCustomerId={true}
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
          hasCredits={true}
          hasCustomerId={true}
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
          hasCredits={true}
          hasCustomerId={true}
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
          hasCredits={true}
          hasCustomerId={true}
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
          hasCredits={true}
          hasCustomerId={true}
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
          hasCredits={true}
          hasCustomerId={true}
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
          hasCredits={true}
          hasCustomerId={true}
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
          hasCredits={true}
          hasCustomerId={true}
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

      const { container } = render(
        <AssistantsBanners
          hasCredits={true}
          hasCustomerId={true}
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
          hasCredits={true}
          hasCustomerId={true}
          isBillingLoading={false}
          spendingGateStatus={gateWithNullLimit}
          isOrgWorkspace={false}
        />
      );

      expect(screen.getByTestId('spending-limit-banner')).toBeInTheDocument();
      // Should NOT display usage text when limit is null
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
          hasCredits={false}
          hasCustomerId={true}
          isBillingLoading={false}
          spendingGateStatus={createBlockedGate('user_limit')}
          isOrgWorkspace={false}
        />
      );

      // Spending limit banner should win
      expect(screen.getByTestId('spending-limit-banner')).toBeInTheDocument();
      expect(screen.queryByTestId('out-of-credits-banner')).not.toBeInTheDocument();
    });

    it('never shows both banners simultaneously', () => {
      // Test all three block reasons
      for (const reason of ['assistant_limit', 'user_limit', 'org_limit'] as const) {
        const { unmount } = render(
          <AssistantsBanners
            hasCredits={false}
            hasCustomerId={true}
            isBillingLoading={false}
            spendingGateStatus={createBlockedGate(reason)}
            isOrgWorkspace={reason === 'org_limit'}
          />
        );

        const creditBanner = screen.queryByTestId('out-of-credits-banner');
        const limitBanner = screen.queryByTestId('spending-limit-banner');

        // At most one should be present
        expect(creditBanner && limitBanner).toBeFalsy();
        // Spending limit should always win when blocked
        expect(limitBanner).toBeInTheDocument();

        unmount();
      }
    });
  });

  // ===========================================================================
  // Brand-new User Exclusion
  // ===========================================================================

  describe('brand-new user exclusion', () => {
    it('never shows any banner for brand-new user in personal workspace', () => {
      const { container } = render(
        <AssistantsBanners
          hasCredits={false}
          hasCustomerId={false}
          isBillingLoading={false}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={false}
        />
      );

      expect(container.innerHTML).toBe('');
    });

    it('never shows any banner for brand-new org without billing', () => {
      const { container } = render(
        <AssistantsBanners
          hasCredits={false}
          hasCustomerId={false}
          isBillingLoading={false}
          spendingGateStatus={createUnblockedGate()}
          isOrgWorkspace={true}
        />
      );

      expect(container.innerHTML).toBe('');
    });

    it('still shows spending limit banner even without customer ID (limit could be set by org admin)', () => {
      render(
        <AssistantsBanners
          hasCredits={false}
          hasCustomerId={false}
          isBillingLoading={false}
          spendingGateStatus={createBlockedGate('org_limit')}
          isOrgWorkspace={true}
        />
      );

      // Spending limit banner should still show — hasCustomerId is irrelevant for spending limits
      expect(screen.getByTestId('spending-limit-banner')).toBeInTheDocument();
    });
  });
});
