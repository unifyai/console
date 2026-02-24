'use client';

import { AlertTriangle } from 'lucide-react';
import { SpendingGateStatus } from '@/types/assistants/spendingGate';
import { formatSpendAmount } from '@/types/assistants/spending';

interface AssistantsBannersProps {
  /** Whether the billing account has any credits */
  hasCredits: boolean;
  /** Whether the billing account has a Stripe customer ID (indicates prior billing activity) */
  hasCustomerId: boolean;
  /** Whether billing data is still loading */
  isBillingLoading: boolean;
  /** Spending gate status for limit-reached banners */
  spendingGateStatus: SpendingGateStatus;
  /** Whether the current workspace is an organization */
  isOrgWorkspace: boolean;
}

/**
 * AssistantsBanners — renders contextual notification banners at the top of the
 * assistants page.
 *
 * Currently handles two mutually-exclusive cases:
 * 1. **Out of credits** — credit balance is depleted for a user/org that has
 *    prior billing history (`hasCustomerId`). Brand-new users who have never
 *    interacted with billing are excluded.
 * 2. **Spending limit reached** — a user, org, or assistant spending limit has
 *    been exceeded.
 */
export function AssistantsBanners({
  hasCredits,
  hasCustomerId,
  isBillingLoading,
  spendingGateStatus,
  isOrgWorkspace,
}: AssistantsBannersProps) {
  // Out of credits — shown when balance is depleted for users who have billing history
  if (!hasCredits && !isBillingLoading && hasCustomerId && !spendingGateStatus.isBlocked) {
    return (
      <div
        className="flex items-center justify-center gap-3 border-b border-orange-200 bg-orange-50 px-4 py-2.5 dark:border-orange-800 dark:bg-orange-950"
        data-testid="out-of-credits-banner"
      >
        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-orange-600 dark:text-orange-400" />
        <p className="text-sm text-orange-800 dark:text-orange-200">
          <span className="font-medium">
            {isOrgWorkspace
              ? "Your organization's credit balance has been depleted"
              : 'Your credit balance has been depleted'}
          </span>
          {' — '}
          {isOrgWorkspace
            ? 'An organization owner or admin can add credits on the '
            : 'You can add credits on the '}
          <a href="/billing" className="font-medium underline underline-offset-2">
            Billing page
          </a>
          .
        </p>
      </div>
    );
  }

  // Spending limit reached
  if (spendingGateStatus.isBlocked && !spendingGateStatus.isLoading) {
    const limit =
      spendingGateStatus.blockReason === 'org_limit'
        ? spendingGateStatus.limits.org
        : spendingGateStatus.blockReason === 'user_limit'
          ? spendingGateStatus.limits.user
          : spendingGateStatus.limits.assistant;

    const usageText =
      limit?.limit != null
        ? `${formatSpendAmount(limit.currentSpend)} of ${formatSpendAmount(limit.limit)} used. `
        : '';

    return (
      <div
        className="flex items-center justify-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-800 dark:bg-amber-950"
        data-testid="spending-limit-banner"
      >
        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm text-amber-800 dark:text-amber-200">
          <span className="font-medium">
            {spendingGateStatus.blockReason === 'org_limit'
              ? 'Organization spending limit reached'
              : spendingGateStatus.blockReason === 'user_limit'
                ? 'Your spending limit reached'
                : 'Assistant spending limit reached'}
          </span>
          {' — '}
          {usageText}
          {spendingGateStatus.blockReason === 'org_limit'
            ? 'An organization owner or admin can increase the limit on the '
            : 'You can update your limit on the '}
          <a href="/usage" className="font-medium underline underline-offset-2">
            Usage page
          </a>
          .
        </p>
      </div>
    );
  }

  return null;
}
