'use client';

import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { IS_SELF_HOST } from '@/lib/auth/self-host';
import { SpendingGateStatus } from '@/types/assistants/spendingGate';
import { formatSpendAmount } from '@/types/assistants/spending';
import type { BillingMode } from '@/types/billing';

interface AssistantsBannersProps {
  /** Current credit balance */
  credits: number;
  /** Whether billing data is still loading */
  isBillingLoading: boolean;
  /** Whether the current balance came from a successful billing lookup */
  isBalanceKnown: boolean;
  /** Spending gate status for limit-reached banners */
  spendingGateStatus: SpendingGateStatus;
  /** Whether the current workspace is an organization */
  isOrgWorkspace: boolean;
  /** Whether the active org is in free-trial mode */
  isFreeTrial: boolean;
  /** Account status (ACTIVE, PAST_DUE, SUSPENDED, CLOSED) */
  accountStatus?: string;
  /**
   * Billing mode of the workspace's account. METERED accounts settle
   * usage at month-end via the metered invoicer; their wallet is
   * frozen and may carry any leftover balance from a prior CREDITS
   * phase, so the out-of-credits banner must not fire for them.
   * Defaults to 'CREDITS' for back-compat when callers don't pass it.
   */
  billingMode?: BillingMode;
}

/**
 * AssistantsBanners — renders contextual notification banners at the top of the
 * assistants page.
 *
 * Currently handles three mutually-exclusive cases (in priority order):
 * 1. **Account status** — account is PAST_DUE, SUSPENDED, or CLOSED.
 * 2. **Out of credits** — credit balance is zero or below (credits <= 0).
 * 3. **Spending limit reached** — a user, org, or assistant spending limit has
 *    been exceeded.
 */
export function AssistantsBanners({
  credits,
  isBillingLoading,
  isBalanceKnown,
  spendingGateStatus,
  isOrgWorkspace,
  isFreeTrial,
  accountStatus,
  billingMode = 'CREDITS',
}: AssistantsBannersProps) {
  if (IS_SELF_HOST) {
    return null;
  }

  // Account status banners — highest priority
  if (!isBillingLoading && accountStatus && accountStatus !== 'ACTIVE') {
    const statusConfig: Record<string, { label: string; description: string; variant: string }> = {
      PAST_DUE: {
        label: 'Payment past due',
        description: isOrgWorkspace
          ? 'Your organization has an outstanding payment. Please update your payment method to avoid service disruption.'
          : 'You have an outstanding payment. Please update your payment method to avoid service disruption.',
        variant:
          'border-[color:var(--status-warning)]/25 bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning)]',
      },
      SUSPENDED: {
        label: 'Account suspended',
        description: isOrgWorkspace
          ? 'Your organization has been suspended due to non-payment. Please resolve the outstanding balance to restore access.'
          : 'Your account has been suspended due to non-payment. Please resolve the outstanding balance to restore access.',
        variant:
          'border-[color:var(--status-danger)]/25 bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger)]',
      },
      CLOSED: {
        label: 'Account closed',
        description: isOrgWorkspace
          ? 'Your organization account has been closed.'
          : 'Your account has been closed.',
        variant: 'border-border bg-[color:var(--status-neutral-bg)] text-muted-foreground',
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

  // Out of credits — CREDITS-mode accounts cannot spend at zero or below.
  // The spending gate also detects credit exhaustion ('no_credits'), but the OOC banner
  // is the correct UI for this case, so we only suppress when a *spending limit* blocks.
  // Also suppressed for METERED accounts: usage is settled at month-end via the metered
  // invoicer and the wallet is frozen, so neither a positive nor a leftover negative
  // balance is actionable for the user. Suspension on non-payment is webhook-driven
  // (`accountStatus` flips to PAST_DUE / SUSPENDED, handled by the banner above).
  const blockedBySpendingLimit =
    spendingGateStatus.isBlocked && spendingGateStatus.blockReason !== 'no_credits';
  if (
    billingMode !== 'METERED' &&
    isBalanceKnown &&
    credits <= 0 &&
    !isBillingLoading &&
    !blockedBySpendingLimit
  ) {
    return (
      <div
        className="border-[color:var(--status-warning)]/25 flex items-center justify-center gap-3 border-b bg-[color:var(--status-warning-bg)] px-4 py-2.5"
        data-testid="out-of-credits-banner"
      >
        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-[color:var(--status-warning)]" />
        <p className="text-body text-[color:var(--status-warning)]">
          <span className="font-medium">
            {isFreeTrial
              ? isOrgWorkspace
                ? "Your organization's trial credits have been used"
                : 'Your trial credits have been used'
              : isOrgWorkspace
                ? "Your organization's credit balance has been depleted"
                : 'Your credit balance has been depleted'}
          </span>
          {' — '}
          {isFreeTrial ? (
            <>
              <a
                href="https://cal.com/danlenton/chat"
                target="_blank"
                rel="noreferrer"
                className="font-medium underline underline-offset-2"
              >
                Talk to us about deploying across your portfolio
              </a>
              {' or '}
              <a href="/billing" className="font-medium underline underline-offset-2">
                choose a plan
              </a>
              {' to keep exploring.'}
            </>
          ) : (
            <>
              {isOrgWorkspace
                ? 'An organization owner or admin can upgrade your plan on the '
                : 'You can upgrade your plan on the '}
              <a href="/billing" className="font-medium underline underline-offset-2">
                Billing page
              </a>
              .
            </>
          )}
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
        className="border-[color:var(--status-warning)]/25 flex items-center justify-center gap-3 border-b bg-[color:var(--status-warning-bg)] px-4 py-2.5"
        data-testid="spending-limit-banner"
      >
        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-[color:var(--status-warning)]" />
        <p className="text-body text-[color:var(--status-warning)]">
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
