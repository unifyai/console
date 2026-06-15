'use client';

import { useState } from 'react';
import { CreditCard, Layers, Loader2, Zap } from 'lucide-react';
import { Button } from '../../UI/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../UI/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../UI/dialog';
import { Switch } from '../../UI/switch';
import { SubscribePlanSection } from './SubscribePlanSection';
import type {
  AvailablePlanItem,
  BillingOrgContext,
  CurrentPlanSummary,
  SubscribeResponse,
  SwitchPlanResponse,
} from '@/types/billing';
import {
  ANNUAL_DISCOUNT_PERCENT,
  annualDiscountedUsd,
  annualListUsd,
  formatCredits,
  formatDisplayMoney,
  type DisplayCurrency,
} from '@/lib/billing/currency';
import { formatShortDate } from '@/lib/billing/format';

// =============================================================================
// Props
// =============================================================================

export interface PlansBillingSectionProps {
  orgContext?: BillingOrgContext | null;
  isSubscribed: boolean;
  plan: CurrentPlanSummary | null;
  nextRenewalAt: string | null;
  /** Whether the subscription is scheduled to cancel at period end. */
  cancelAtPeriodEnd: boolean;

  // Display currency (DISPLAY-ONLY)
  displayCurrency: DisplayCurrency;

  // Plan picker
  availablePlans: AvailablePlanItem[];
  loadingAvailablePlans: boolean;
  onSubscribe: (templateId: number) => Promise<SubscribeResponse | null>;
  onSwitchPlan: (templateId: number) => Promise<SwitchPlanResponse | null>;
  onCancelSubscription: (immediate?: boolean) => Promise<boolean>;
  /** Undo a scheduled end-of-period cancellation. */
  onResumeSubscription: () => Promise<boolean>;

  // Auto-increment (subscribed only)
  isAutoIncrementEnabled: boolean;
  isAtTopTier: boolean;
  handleToggleAutoIncrement: () => Promise<void>;

  /** Whether the billing profile has a full address (required to subscribe — tax). */
  hasBillingAddress: boolean;
  /** Whether a saved card is on file (required to subscribe — charged off-session). */
  hasPaymentMethod: boolean;
  /** Opens the billing-profile panel (prerequisites checklist action). */
  onEditBillingProfile?: () => void;
  /** Opens the payment-methods panel (prerequisites checklist action). */
  onManagePaymentMethods?: () => void;
}

// =============================================================================
// Component
// =============================================================================

/**
 * CREDITS-mode plan management.
 *
 * Subscribed accounts see their current tier + renewal date, the tier
 * switcher, the auto-increment toggle, and payment/cancel actions.
 * Unsubscribed (free/trial) accounts see a "Choose a plan" card with the
 * subscribe picker. The credit balance / usage meter lives in the sibling
 * ``CreditsBillingSection``.
 */
export const PlansBillingSection = ({
  orgContext,
  isSubscribed,
  plan,
  nextRenewalAt,
  cancelAtPeriodEnd,
  displayCurrency,
  availablePlans,
  loadingAvailablePlans,
  onSubscribe,
  onSwitchPlan,
  onCancelSubscription,
  onResumeSubscription,
  isAutoIncrementEnabled,
  isAtTopTier,
  handleToggleAutoIncrement,
  hasBillingAddress,
  hasPaymentMethod,
  onEditBillingProfile,
  onManagePaymentMethods,
}: PlansBillingSectionProps) => {
  const renewalLabel = nextRenewalAt ? formatShortDate(nextRenewalAt) : null;

  // Annual tiers are *named* by their list price (e.g. "$600 / yr"), but the
  // amount actually billed is discounted (the Stripe coupon) — the same
  // figure the tier dropdown shows. Surface the billed price + discount so
  // the header doesn't look like it contradicts the picker.
  const isAnnualPlan = plan?.commitPeriod === 'ANNUAL';

  // Header label: credits-per-period (e.g. "360,000 credits / yr") so the
  // current tier reads in the same credit units as the balance/allowance,
  // rather than the price-led template name. `commitAmount` is the monthly
  // grant (1 credit = $1, ×400 display), so annual lists 12× it.
  const tierName =
    plan?.commitAmount != null
      ? isAnnualPlan
        ? `${formatCredits(annualListUsd(plan.commitAmount))} / yr`
        : `${formatCredits(plan.commitAmount)} / mo`
      : (plan?.templateDisplayName ?? plan?.templateName ?? null);
  const annualBilledLabel =
    isAnnualPlan && plan?.commitAmount != null
      ? `Billed ${formatDisplayMoney(annualDiscountedUsd(plan.commitAmount), displayCurrency, {
          maximumFractionDigits: 0,
        })}/yr · ${ANNUAL_DISCOUNT_PERCENT}% off list`
      : null;

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [resuming, setResuming] = useState(false);

  const handleConfirmCancel = async () => {
    setCanceling(true);
    try {
      const ok = await onCancelSubscription(false);
      if (ok) setCancelDialogOpen(false);
    } finally {
      setCanceling(false);
    }
  };

  const handleResume = async () => {
    setResuming(true);
    try {
      await onResumeSubscription();
    } finally {
      setResuming(false);
    }
  };

  return (
    <section className="space-y-4" data-testid="plans-section">
      <div>
        <h2 className="text-h3 flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Plans
        </h2>
        <p className="text-body-muted mt-1">
          {orgContext
            ? `Subscription plan for ${orgContext.orgName}`
            : isSubscribed
              ? 'Manage your subscription tier and auto-increment'
              : 'Subscribe to a credit tier to keep working'}
        </p>
      </div>

      {isSubscribed ? (
        <>
          {/* Current subscription: tier, renewal, switcher, auto-increment */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base" data-testid="current-tier-name">
                  {tierName ?? 'Current plan'}
                </CardTitle>
                {cancelAtPeriodEnd && (
                  <span
                    className="text-label rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    data-testid="cancellation-badge"
                  >
                    Canceling
                  </span>
                )}
              </div>
              {annualBilledLabel && (
                <CardDescription className="text-body-muted" data-testid="annual-billed-price">
                  {annualBilledLabel}
                </CardDescription>
              )}
              {nextRenewalAt &&
                (cancelAtPeriodEnd ? (
                  <CardDescription
                    className="text-amber-700 dark:text-amber-400"
                    data-testid="cancellation-scheduled"
                  >
                    Cancels on {renewalLabel} — you keep your credits and access until then, then
                    drop to the free tier.
                  </CardDescription>
                ) : (
                  <CardDescription className="text-body-muted" data-testid="renewal-date">
                    Renews on {renewalLabel}
                  </CardDescription>
                ))}
            </CardHeader>
            <CardContent>
              {/* Change tier */}
              <SubscribePlanSection
                isSubscribed
                availablePlans={availablePlans}
                loading={loadingAvailablePlans}
                displayCurrency={displayCurrency}
                onSubscribe={onSubscribe}
                onSwitchPlan={onSwitchPlan}
              />

              {/* Auto-increment */}
              <div
                className="mt-5 flex items-start justify-between gap-4 border-t border-border pt-5"
                data-testid="auto-increment-card"
              >
                <div className="flex items-start gap-2">
                  <Zap className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-body font-medium">Auto-increment</p>
                    <p className="text-body-muted">
                      {isAtTopTier ? (
                        <span data-testid="auto-increment-top-tier">
                          You&apos;re on the top tier — there&apos;s nothing higher to upgrade to.
                        </span>
                      ) : (
                        'When you run out of credits mid-cycle, automatically upgrade to the next tier instead of stopping.'
                      )}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isAutoIncrementEnabled}
                  onCheckedChange={handleToggleAutoIncrement}
                  disabled={isAtTopTier}
                  data-testid="auto-increment-toggle"
                />
              </div>
            </CardContent>
          </Card>

          {/* Account actions */}
          {cancelAtPeriodEnd ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-caption text-muted-foreground" data-testid="cancellation-note">
                Subscription ends {renewalLabel ?? 'at period end'}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResume}
                disabled={resuming}
                data-testid="resume-subscription"
              >
                {resuming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Resume subscription
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setCancelDialogOpen(true)}
                data-testid="cancel-subscription"
              >
                Cancel subscription
              </Button>
            </div>
          )}

          <Dialog
            open={cancelDialogOpen}
            onOpenChange={(open) => !open && setCancelDialogOpen(false)}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancel subscription?</DialogTitle>
                <DialogDescription>
                  You&apos;ll keep your credits and access until the end of the current billing
                  period{renewalLabel ? ` on ${renewalLabel}` : ''}, then drop to the free tier. You
                  can re-subscribe at any time.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCancelDialogOpen(false)}
                  disabled={canceling}
                >
                  Keep subscription
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmCancel}
                  disabled={canceling}
                  data-testid="cancel-subscription-confirm"
                >
                  {canceling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Cancel subscription
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        /* Choose a plan CTA + picker */
        <Card data-testid="choose-plan-card">
          <CardHeader>
            <CardTitle className="text-base">Choose a plan</CardTitle>
            <CardDescription className="text-body-muted">
              Credits reset at the start of each cycle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SubscribePlanSection
              isSubscribed={false}
              availablePlans={availablePlans}
              loading={loadingAvailablePlans}
              displayCurrency={displayCurrency}
              onSubscribe={onSubscribe}
              onSwitchPlan={onSwitchPlan}
              canSubscribe={hasBillingAddress}
              hasPaymentMethod={hasPaymentMethod}
              onEditBillingProfile={onEditBillingProfile}
              onManagePaymentMethods={onManagePaymentMethods}
            />
          </CardContent>
        </Card>
      )}
    </section>
  );
};
