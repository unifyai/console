'use client';

import { CreditCard, ExternalLink, Wallet } from 'lucide-react';
import { Button } from '../../UI/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../UI/card';
import type { BillingOrgContext, CurrentPeriodUsage, CurrentPlanSummary } from '@/types/billing';

// =============================================================================
// Props
// =============================================================================

export interface MeteredBillingSectionProps {
  plan: CurrentPlanSummary | null;
  /**
   * Mid-period invoice estimate from `GET /v0/billing/current-period-usage`.
   * `null` while loading or if the active plan is CREDITS (the backend
   * 404s in that case and the hook silently swallows it).
   */
  currentPeriodUsage: CurrentPeriodUsage | null;
  loadingCurrentPeriodUsage: boolean;
  orgContext?: BillingOrgContext | null;
  /**
   * Open the Stripe Customer Portal so the customer can manage their
   * card on file, view past invoices, and update billing details.
   *
   * The portal is useful on METERED whenever the invoice configuration
   * includes ``card`` as a payment option — true for ``AUTO_CARD`` and
   * for the default ``SEND_INVOICE_NET_30`` (``[card,
   * customer_balance]``). Stripe's hosted invoice page (linked from
   * the invoices table below) is the canonical source for
   * bank-transfer funding instructions; the portal does not surface
   * those, so wire-only customers won't see them here.
   *
   * Pass ``undefined`` to suppress the button entirely (e.g. for a
   * future wire-only configuration where there's no card to manage).
   */
  handleManagePaymentMethods?: () => void;
}

// =============================================================================
// Component
// =============================================================================

/**
 * METERED-mode plan summary card.
 *
 * Surfaces the active template (display name, commit, schedule,
 * collection method) plus a progress bar showing where the in-progress
 * month stands against the commit floor — the customer instantly sees
 * whether they're "below commit" (commit charges anyway) or "in
 * overage" (commit + the excess will invoice). PAYG plans have no
 * floor so the bar runs against the month's contract usage instead.
 */
export const MeteredBillingSection = ({
  plan,
  currentPeriodUsage,
  loadingCurrentPeriodUsage,
  orgContext,
  handleManagePaymentMethods,
}: MeteredBillingSectionProps) => (
  <section className="space-y-4" data-testid="metered-plan-section">
    <div>
      <h2 className="text-h3 flex items-center gap-2">
        <Wallet className="h-5 w-5" />
        Plan
      </h2>
      <p className="text-body-muted mt-1">
        {orgContext
          ? `Billing plan for ${orgContext.orgName}`
          : 'Your active billing plan and usage policy'}
      </p>
    </div>

    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base" data-testid="plan-name">
            {plan?.templateDisplayName ?? plan?.templateName ?? 'Custom plan'}
          </CardTitle>
        </div>
        <CardDescription className="text-body-muted">
          Usage is metered and invoiced at the end of each period. Talk to your account manager to
          update the contract.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/*
          Plan facts. We deliberately omit the derived "Plan type"
          field — the commit row already implies COMMITMENT vs PAYG
          ("$X / month" vs no row at all) without needing a label.
        */}
        <dl className="text-body grid grid-cols-2 gap-x-6 gap-y-3">
          {plan?.commitAmount != null && plan.commitAmount > 0 && (
            <div>
              <dt className="text-caption text-muted-foreground">Monthly commitment</dt>
              <dd className="font-medium" data-testid="plan-commit">
                {formatMoney(plan.commitAmount, plan.currency)}
                {plan.commitPeriod ? ` / ${plan.commitPeriod.toLowerCase()}` : ''}
              </dd>
            </div>
          )}
          {plan?.commitSchedule && (
            <div>
              <dt className="text-caption text-muted-foreground">Invoice schedule</dt>
              <dd className="font-medium" data-testid="plan-commit-schedule">
                {formatEnum(plan.commitSchedule)}
              </dd>
            </div>
          )}
          {plan?.collectionMethod && (
            <div>
              <dt className="text-caption text-muted-foreground">Collection</dt>
              <dd className="font-medium" data-testid="plan-collection-method">
                {formatCollectionMethod(plan.collectionMethod)}
              </dd>
            </div>
          )}
        </dl>

        {/*
          In-progress usage. Hidden entirely on PAYG accounts that
          have nothing to chart against (no commit floor, no quota)
          — instead we surface "this month" via the invoices table.
        */}
        {plan && (
          <UsageProgress
            plan={plan}
            usage={currentPeriodUsage}
            loading={loadingCurrentPeriodUsage}
          />
        )}

        {handleManagePaymentMethods && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleManagePaymentMethods}
              data-testid="manage-payment-methods"
            >
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              Manage payment methods
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  </section>
);

// =============================================================================
// Progress bar
// =============================================================================

interface UsageProgressProps {
  plan: CurrentPlanSummary;
  usage: CurrentPeriodUsage | null;
  loading: boolean;
}

const UsageProgress = ({ plan, usage, loading }: UsageProgressProps) => {
  const isCommitment = plan.commitAmount != null && plan.commitAmount > 0;

  // Render the bar / counter unconditionally — even when usage hasn't
  // loaded yet (or failed to load) we still want the structure visible
  // so the customer immediately understands "this is where you'll see
  // your monthly burn". Missing values are rendered as "—" rather than
  // making the whole block disappear.
  const periodLabel = usage
    ? formatPeriodLabel(usage.periodStart)
    : formatPeriodLabel(currentMonthStartIso());
  const currency = usage?.currency || plan.currency;
  const hasData = usage !== null && !loading;

  // PAYG: no floor — show raw contract usage as an open-ended counter.
  if (!isCommitment) {
    return (
      <div className="rounded-md border border-border px-4 py-3" data-testid="usage-progress-payg">
        <div className="flex items-baseline justify-between">
          <p className="text-caption text-muted-foreground">Usage so far ({periodLabel})</p>
          <p className="text-h4 font-semibold tabular-nums">
            {hasData ? formatMoney(usage.contractUsageLocal, currency) : '—'}
          </p>
        </div>
        <p className="text-caption mt-1 text-muted-foreground">
          Pay-as-you-go: invoiced at the end of the period.
        </p>
      </div>
    );
  }

  // COMMITMENT: show progress against the commit. Two cases:
  //   * below floor → bar fills up to (usage / commit)
  //   * in overage   → bar is full + a separate orange overage segment
  //                    sized proportionally
  const commit = plan.commitAmount as number;
  const used = hasData ? usage.contractUsageLocal : 0;
  const overage = hasData ? usage.overageLocal : 0;
  const inOverage = overage > 0;
  const estimatedInvoice = hasData ? usage.invoicedEstimateLocal : commit;

  // When in overage, scale both segments against (commit + overage)
  // so the overage tail is honest about how far past the floor we are.
  const denominator = inOverage ? commit + overage : commit;
  const commitPct =
    denominator > 0 ? Math.min(100, (Math.min(used, commit) / denominator) * 100) : 0;
  const overagePct = denominator > 0 && inOverage ? (overage / denominator) * 100 : 0;

  return (
    <div className="rounded-md border border-border px-4 py-3" data-testid="usage-progress-commit">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-caption text-muted-foreground">Commitment usage ({periodLabel})</p>
        <p className="text-caption tabular-nums text-muted-foreground">
          {hasData ? formatMoney(used, currency) : '—'} of {formatMoney(commit, currency)}
        </p>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(commitPct + overagePct)}
      >
        <div className="flex h-full">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${commitPct}%` }}
            data-testid="usage-progress-commit-bar"
          />
          {inOverage && (
            <div
              className="h-full bg-[color:var(--status-warning)] transition-all"
              style={{ width: `${overagePct}%` }}
              data-testid="usage-progress-overage-bar"
            />
          )}
        </div>
      </div>
      <div className="text-caption mt-2 flex items-center justify-between">
        {inOverage ? (
          <>
            <span className="text-[color:var(--status-warning)]">
              In overage by {formatMoney(overage, currency)}
            </span>
            <span className="tabular-nums text-muted-foreground">
              Estimated invoice: {formatMoney(estimatedInvoice, currency)}
            </span>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">
              {hasData
                ? `${Math.round(commitPct)}% of monthly commitment`
                : 'Awaiting current period data'}
            </span>
            <span className="tabular-nums text-muted-foreground">
              Estimated invoice: {formatMoney(estimatedInvoice, currency)}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// Helpers
// =============================================================================

function formatCollectionMethod(method: string): string {
  switch (method) {
    case 'AUTO_CARD':
      return 'Auto-charge card on file';
    case 'SEND_INVOICE_NET_30':
      return 'Send invoice (Net 30)';
    case 'SEND_INVOICE':
      return 'Send invoice';
    default:
      return formatEnum(method);
  }
}

function formatEnum(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function formatPeriodLabel(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  } catch {
    return isoDate;
  }
}

/** First-of-current-month in UTC, ISO date — fallback for the period
 *  label while the server-side estimate is still loading. */
function currentMonthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}
