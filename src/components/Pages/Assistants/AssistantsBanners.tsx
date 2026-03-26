'use client';

import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { SpendingGateStatus } from '@/types/assistants/spendingGate';
import { formatSpendAmount } from '@/types/assistants/spending';

interface AssistantsBannersProps {
  /** Current credit balance */
  credits: number;
  /** Whether billing data is still loading */
  isBillingLoading: boolean;
  /** Spending gate status for limit-reached banners */
  spendingGateStatus: SpendingGateStatus;
  /** Whether the current workspace is an organization */
  isOrgWorkspace: boolean;
  /** Account status (ACTIVE, PAST_DUE, SUSPENDED, CLOSED) */
  accountStatus?: string;
}

/**
 * AssistantsBanners — renders contextual notification banners at the top of the
 * assistants page.
 *
 * Currently handles three mutually-exclusive cases (in priority order):
 * 1. **Account status** — account is PAST_DUE, SUSPENDED, or CLOSED.
 * 2. **Out of credits** — credit balance has gone negative (credits < 0).
 *    Brand-new users (credits === 0) are excluded because they haven't
 *    interacted with billing yet.
 * 3. **Spending limit reached** — a user, org, or assistant spending limit has
 *    been exceeded.
 */
export function AssistantsBanners({
  credits,
  isBillingLoading,
  spendingGateStatus,
  isOrgWorkspace,
  accountStatus,
}: AssistantsBannersProps) {
  // Account status banners — highest priority
  if (!isBillingLoading && accountStatus && accountStatus !== 'ACTIVE') {
    const statusConfig: Record<string, { label: string; description: string; variant: string }> = {
      PAST_DUE: {
        label: 'Payment past due',
        description: isOrgWorkspace
          ? 'Your organization has an outstanding payment. Please update your payment method to avoid service disruption.'
          : 'You have an outstanding payment. Please update your payment method to avoid service disruption.',
        variant: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200',
      },
      SUSPENDED: {
        label: 'Account suspended',
        description: isOrgWorkspace
          ? 'Your organization has been suspended due to non-payment. Please resolve the outstanding balance to restore access.'
          : 'Your account has been suspended due to non-payment. Please resolve the outstanding balance to restore access.',
        variant: 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200',
      },
      CLOSED: {
        label: 'Account closed',
        description: isOrgWorkspace
          ? 'Your organization account has been closed.'
          : 'Your account has been closed.',
        variant: 'border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200',
      },
    };

    const config = statusConfig[accountStatus];
    if (config) {
      return (
        <div
          className={`flex items-center justify-center gap-3 border-b px-4 py-2.5 ${config.variant}`}
          data-testid="account-status-banner"
        >
          <ShieldAlert className="h-4 w-4 flex-shrink-0" />
          <p className="text-sm">
            <span className="font-medium">{config.label}</span>
            {' — '}
            {config.description}{' '}
            <a href="/billing" className="font-medium underline underline-offset-2">
              Go to Billing
            </a>
          </p>
        </div>
      );
    }
  }

  // Out of credits — shown when balance has gone negative (excludes brand-new users at 0)
  if (credits < 0 && !isBillingLoading && !spendingGateStatus.isBlocked) {
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
