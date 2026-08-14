'use client';

import { Wallet } from 'lucide-react';
import { Card, CardContent } from '../../UI/card';
import type { BillingOrgContext, CurrentPlanSummary } from '@/types/billing';
import { ANNUAL_MONTHS, formatCredits } from '@/lib/billing/currency';
import { formatCountdown } from '@/lib/billing/format';

// =============================================================================
// Props
// =============================================================================

export interface CreditsBillingSectionProps {
  orgContext?: BillingOrgContext | null;

  // Credits facts
  fullBalance: number;
  loadingBalance: boolean;
  isRefreshingBalance: boolean;
  isSubscribed: boolean;
  monthlyCreditAllowance: number | null;
  trialExpiresAt: string | null;
  plan: CurrentPlanSummary | null;
}

// =============================================================================
// Component
// =============================================================================

/**
 * CREDITS-mode credit balance + usage view.
 *
 * Subscribed accounts see how many credits remain this cycle against their
 * allowance (a clamped usage meter). Unsubscribed (free/trial) accounts see
 * their remaining balance and, when applicable, a countdown to trial expiry.
 *
 * Plan selection / switching, auto-increment, and payment actions live in
 * the sibling ``PlansBillingSection``. Shown only when
 * ``billingMode === 'CREDITS'`` (METERED renders ``MeteredBillingSection``).
 */
export const CreditsBillingSection = ({
  orgContext,
  fullBalance,
  loadingBalance,
  isRefreshingBalance,
  isSubscribed,
  monthlyCreditAllowance,
  trialExpiresAt,
  plan,
}: CreditsBillingSectionProps) => {
  const loading = loadingBalance || isRefreshingBalance;
  // Balances and allowances are framed as credit counts (display-only ×400).
  const isAnnual = plan?.commitPeriod === 'ANNUAL';
  const remaining = formatCredits(fullBalance);
  // `monthlyCreditAllowance` is the per-month tier rung; annual plans grant
  // the whole year up front (12×) as a single bucket, so show that total.
  const allowanceRaw =
    monthlyCreditAllowance != null
      ? isAnnual
        ? monthlyCreditAllowance * ANNUAL_MONTHS
        : monthlyCreditAllowance
      : null;
  const allowance = allowanceRaw != null ? formatCredits(allowanceRaw) : null;
  const allowanceLabel = isAnnual ? 'Annual allowance' : 'Monthly allowance';
  // Remaining-this-cycle progress (clamped: a just-granted balance can
  // briefly exceed the allowance, and rollover/top-ups push it over too).
  const remainingPct =
    allowanceRaw && allowanceRaw > 0
      ? Math.min(100, Math.max(0, (fullBalance / allowanceRaw) * 100))
      : null;

  return (
    <section className="space-y-4" data-testid="credits-balance-section">
      <div>
        <h2 className="text-h3 flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Credits
        </h2>
        <p className="text-body-muted mt-1">
          {orgContext
            ? `Credit balance for ${orgContext.orgName}`
            : 'Your available credits and usage this cycle'}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-6">
          {isSubscribed ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-body font-medium" data-testid="credits-remaining">
                  {loading ? '…' : remaining}
                </span>
                <span className="text-caption text-muted-foreground">
                  {allowanceLabel}:{' '}
                  <span data-testid="monthly-allowance">{loading ? '…' : (allowance ?? '—')}</span>
                </span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={remainingPct ?? undefined}
                aria-label="Credits remaining this cycle"
              >
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${remainingPct ?? 0}%` }}
                />
              </div>
              <p className="text-caption text-muted-foreground">remaining this cycle</p>
            </div>
          ) : (
            <div className="space-y-2">
              {trialExpiresAt ? (
                <p className="text-h3 text-semibold" data-testid="trial-credits">
                  {loading ? (
                    <span className="text-muted-foreground">Loading…</span>
                  ) : (
                    <>
                      {remaining}{' '}
                      <span
                        className="text-caption font-normal text-muted-foreground"
                        data-testid="trial-countdown"
                      >
                        {formatCountdown(trialExpiresAt) === 'expired'
                          ? '— expired'
                          : `expire in ${formatCountdown(trialExpiresAt)}`}
                      </span>
                    </>
                  )}
                </p>
              ) : (
                <p className="text-h3 text-semibold" data-testid="credits-balance-amount">
                  {loading ? <span className="text-muted-foreground">Loading…</span> : remaining}
                </p>
              )}
              {/*
                An account with nothing in it is where the rules have to be
                stated: signup credits land on the first collected invoice,
                not at signup, and free credits are console-only. Neither is
                inferable from a balance of zero, and both are what someone
                is looking at this page to find out.
              */}
              {!loading && !trialExpiresAt && fullBalance <= 0 && (
                <p className="text-caption text-muted-foreground" data-testid="credits-empty-help">
                  Your signup credits are added once your first invoice is collected — choose a plan
                  below to get started. Credits are spent here in the console; using them through
                  the API needs an account that has paid.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
};
