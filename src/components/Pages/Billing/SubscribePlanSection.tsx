'use client';

/**
 * Self-serve subscription tier picker (CREDITS path).
 *
 * Replaces the card-based switcher for self-serve accounts with a single
 * grouped dropdown over the seeded credit tiers (1 credit = $1 / month),
 * matching the landing page's grouped-pricing pattern. Tier prices are
 * shown in the customer's display currency (USD, or £ for UK users) —
 * DISPLAY ONLY; the `templateId` sent to the API is currency-agnostic and
 * settlement stays USD.
 *
 * Two modes:
 *   * ``subscribe`` (unsubscribed/free/trial) → `POST /billing/subscribe`.
 *     Redirects to the Stripe-hosted invoice when one is returned.
 *   * ``change`` (already subscribed) → `POST /billing/plan`. Subscription
 *     tier changes are immediate (anniversary-anchored, Stripe-prorated);
 *     copy reflects immediate effect, not a next-month boundary.
 */

import { useMemo, useState } from 'react';
import { Check, Circle, Loader2 } from 'lucide-react';
import { Button } from '../../UI/button';
import { Checkbox } from '../../UI/checkbox';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../../UI/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../UI/dialog';
import type { AvailablePlanItem, SubscribeResponse, SwitchPlanResponse } from '@/types/billing';
import {
  ANNUAL_DISCOUNT_PERCENT,
  annualDiscountedUsd,
  annualListUsd,
  formatCredits,
  formatDisplayMoney,
  type DisplayCurrency,
} from '@/lib/billing/currency';

type BillingInterval = 'monthly' | 'annual';

const isAnnualPlan = (p: AvailablePlanItem): boolean => p.commitPeriod === 'ANNUAL';

// =============================================================================
// Props
// =============================================================================

export interface SubscribePlanSectionProps {
  /** Whether the account already holds a paid subscription. */
  isSubscribed: boolean;
  /** Seeded tiers from `getAvailablePlans` (ordered by position). */
  availablePlans: AvailablePlanItem[];
  loading: boolean;
  /** Display currency for tier prices (DISPLAY-ONLY). */
  displayCurrency: DisplayCurrency;
  /** Subscribe to a tier (unsubscribed accounts). */
  onSubscribe: (templateId: number) => Promise<SubscribeResponse | null>;
  /** Change to another tier (subscribed accounts). */
  onSwitchPlan: (templateId: number) => Promise<SwitchPlanResponse | null>;
  /**
   * Whether the account may start a new subscription. Gated on a billing
   * address (country) being present, which Stripe needs to compute tax on
   * the first invoice. Only relevant for the unsubscribed (subscribe) path;
   * tier *changes* reuse the address captured at first subscribe. Defaults
   * to true so the change path and tests are unaffected.
   */
  canSubscribe?: boolean;
  /**
   * Whether a saved card is on file. The new-subscription path charges the
   * card off-session at subscribe time, so it's gated on one being present.
   * Only relevant for the unsubscribed (subscribe) path; defaults to true so
   * the change path and tests are unaffected.
   */
  hasPaymentMethod?: boolean;
  /**
   * Opens the billing-profile panel — wired to the "Add billing address"
   * action in the prerequisites checklist (new-subscribe path only).
   */
  onEditBillingProfile?: () => void;
  /**
   * Opens the payment-methods panel — wired to the "Add payment method"
   * action in the prerequisites checklist (new-subscribe path only).
   */
  onManagePaymentMethods?: () => void;
}

// =============================================================================
// Grouping
// =============================================================================

interface TierGroup {
  label: string;
  items: AvailablePlanItem[];
}

/**
 * Bucket tiers by monthly size so the dropdown is scannable rather than a
 * flat list of 21 options. Buckets are derived from `commitAmount` (the
 * monthly USD grant); tiers with no commit fall into "Other".
 */
function groupTiers(plans: AvailablePlanItem[]): TierGroup[] {
  const buckets: { label: string; max: number; items: AvailablePlanItem[] }[] = [
    { label: 'Starter', max: 499, items: [] },
    { label: 'Growth', max: 4999, items: [] },
    { label: 'Scale', max: 19999, items: [] },
    { label: 'Enterprise', max: Infinity, items: [] },
  ];
  const other: AvailablePlanItem[] = [];

  const sorted = [...plans].sort((a, b) => {
    if (a.position != null && b.position != null) return a.position - b.position;
    return (a.commitAmount ?? 0) - (b.commitAmount ?? 0);
  });

  for (const p of sorted) {
    if (p.commitAmount == null) {
      other.push(p);
      continue;
    }
    const bucket = buckets.find((b) => (p.commitAmount as number) <= b.max);
    (bucket ?? buckets[buckets.length - 1]).items.push(p);
  }

  const groups: TierGroup[] = buckets
    .filter((b) => b.items.length > 0)
    .map((b) => ({ label: b.label, items: b.items }));
  if (other.length > 0) groups.push({ label: 'Other', items: other });
  return groups;
}

// =============================================================================
// Component
// =============================================================================

export const SubscribePlanSection = ({
  isSubscribed,
  availablePlans,
  loading,
  displayCurrency,
  onSubscribe,
  onSwitchPlan,
  canSubscribe = true,
  hasPaymentMethod = true,
  onEditBillingProfile,
  onManagePaymentMethods,
}: SubscribePlanSectionProps) => {
  const [selectedId, setSelectedId] = useState<string>('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Only paid subscription tiers are pickable here. `getAvailablePlans`
  // also returns the free/default template (commitAmount == null, the
  // unsubscribed state) as a group member — exclude it so it never shows
  // up as a selectable "Default" option (you leave a paid plan via the
  // portal/cancel flow, not by "subscribing" to the free tier).
  const subscribableTiers = useMemo(
    () => availablePlans.filter((p) => p.commitAmount != null),
    [availablePlans]
  );

  // Split by billing interval. Unsubscribed accounts get both buckets (the
  // backend returns monthly + annual), so the annual checkbox chooses which
  // to show. Subscribed accounts only get same-interval tiers, so one bucket
  // is empty and the interval locks to the populated one (checkbox hidden).
  const monthlyTiers = useMemo(
    () => subscribableTiers.filter((p) => !isAnnualPlan(p)),
    [subscribableTiers]
  );
  const annualTiers = useMemo(
    () => subscribableTiers.filter((p) => isAnnualPlan(p)),
    [subscribableTiers]
  );
  const hasMonthly = monthlyTiers.length > 0;
  const hasAnnual = annualTiers.length > 0;

  // Default to monthly; `effectiveInterval` coerces to whatever interval is
  // actually available when only one bucket is populated (e.g. an account
  // already subscribed annually only gets annual tiers back).
  const [interval, setIntervalState] = useState<BillingInterval>('monthly');
  const effectiveInterval: BillingInterval =
    hasMonthly && hasAnnual ? interval : hasAnnual ? 'annual' : 'monthly';
  const intervalTiers = effectiveInterval === 'annual' ? annualTiers : monthlyTiers;

  const groups = useMemo(() => groupTiers(intervalTiers), [intervalTiers]);
  const selected = useMemo(
    () => intervalTiers.find((p) => String(p.templateId) === selectedId) ?? null,
    [intervalTiers, selectedId]
  );

  // Price label per tier. Monthly tiers price per month; annual tiers show
  // the discounted yearly price (display-only — the real discount is the
  // Stripe coupon). The credit grant is the period's whole bucket (12× for
  // annual), framed via the ×400 display multiplier.
  const tierPrice = (p: AvailablePlanItem): string => {
    if (p.commitAmount == null) return p.templateDisplayName;
    if (isAnnualPlan(p)) {
      const yearly = formatDisplayMoney(annualDiscountedUsd(p.commitAmount), displayCurrency, {
        maximumFractionDigits: 0,
      });
      return `${yearly}/yr · ${formatCredits(annualListUsd(p.commitAmount))}`;
    }
    return `${formatDisplayMoney(p.commitAmount, displayCurrency, {
      maximumFractionDigits: 0,
    })}/mo · ${formatCredits(p.commitAmount)}`;
  };

  // Selected-tier label for the trigger: credits-per-period (e.g.
  // "20,000 credits / mo") rather than the price-led option label, so the
  // chosen value reads in the same credit units as the rest of the page.
  const tierCreditsLabel = (p: AvailablePlanItem): string => {
    if (p.commitAmount == null) return p.templateDisplayName;
    return isAnnualPlan(p)
      ? `${formatCredits(annualListUsd(p.commitAmount))} / yr`
      : `${formatCredits(p.commitAmount)} / mo`;
  };

  const showIntervalToggle = hasMonthly && hasAnnual;

  // Block the *new subscription* path until the prerequisites are on file.
  // Both gates only apply to new subscriptions — tier changes (isSubscribed)
  // already have an address + card from first subscribe.
  //   1. Billing address — Stripe needs it to calculate tax on the invoice.
  //   2. A saved card — subscribe charges it off-session immediately.
  // Address is prompted first (the card is also tied to the customer the
  // address creates), then the card.
  const needsAddress = !isSubscribed && !canSubscribe;
  const needsCard = !isSubscribed && !needsAddress && !hasPaymentMethod;

  const handleIntervalChange = (next: BillingInterval) => {
    setIntervalState(next);
    // Keep the chosen rung across the monthly<->annual switch by mapping to
    // the same commit size in the target interval (monthly & annual tiers
    // share `commitAmount`). Clear only when there's no equivalent rung.
    const current = subscribableTiers.find((p) => String(p.templateId) === selectedId);
    if (current?.commitAmount == null) {
      setSelectedId('');
      return;
    }
    const targetTiers = next === 'annual' ? annualTiers : monthlyTiers;
    const equivalent = targetTiers.find((p) => p.commitAmount === current.commitAmount);
    setSelectedId(equivalent ? String(equivalent.templateId) : '');
  };

  if (loading && subscribableTiers.length === 0) {
    return (
      <div className="text-body-muted" data-testid="subscribe-plan-loading">
        Loading plans…
      </div>
    );
  }

  if (subscribableTiers.length === 0) return null;

  // Both subscribe and in-place tier change run through the confirm dialog —
  // each is immediate and moves money (subscribe charges the saved card now;
  // a switch prorates the difference now) with no further Stripe step, so an
  // explicit confirmation guards against accidents.
  const handleConfirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const result = isSubscribed
        ? await onSwitchPlan(selected.templateId)
        : await onSubscribe(selected.templateId);
      // Success + failure feedback are both surfaced as toasts by the hook;
      // on success we just close the confirm dialog.
      if (result) setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  };

  // For new subscriptions the CTA stays disabled until both prerequisites
  // (billing address + saved card) are met and a tier is picked; the
  // checklist below the picker explains/unblocks each one, so the button
  // itself no longer needs a tooltip.
  const cta = (
    <Button
      data-testid="subscribe-plan-cta"
      disabled={!selected || selected.isCurrent || submitting || needsAddress || needsCard}
      onClick={() => setConfirming(true)}
    >
      {isSubscribed ? 'Change plan' : 'Subscribe'}
    </Button>
  );

  // Prerequisites only gate brand-new subscriptions (tier changes reuse the
  // address + card captured at first subscribe). Show the checklist whenever
  // something is still outstanding so the user sees exactly what to do.
  const showPrerequisites = !isSubscribed && (needsAddress || needsCard);

  return (
    <div className="space-y-3" data-testid="subscribe-plan-section">
      {showPrerequisites && (
        <ul
          className="space-y-2 rounded-md border border-border p-3"
          data-testid="subscribe-prerequisites"
        >
          <PrerequisiteRow
            testId="prereq-billing-profile"
            complete={!needsAddress}
            label="Complete your billing profile"
            actionLabel="Add billing address"
            onAction={onEditBillingProfile}
          />
          <PrerequisiteRow
            testId="prereq-payment-method"
            complete={hasPaymentMethod}
            label="Add a payment method"
            actionLabel="Add payment method"
            onAction={onManagePaymentMethods}
          />
        </ul>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger id="tier-select" data-testid="tier-select-trigger">
              {selected ? (
                <span>{tierCreditsLabel(selected)}</span>
              ) : (
                <SelectValue placeholder="Choose a plan" />
              )}
            </SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.items.map((p) => (
                    <SelectItem
                      key={p.templateId}
                      value={String(p.templateId)}
                      data-testid={`tier-option-${p.templateId}`}
                    >
                      {tierPrice(p)}
                      {p.isCurrent ? ' (current)' : ''}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
        {cta}
      </div>

      {showIntervalToggle && (
        <label
          className="flex w-fit cursor-pointer items-center gap-2"
          data-testid="billing-interval-annual-toggle"
        >
          <Checkbox
            checked={effectiveInterval === 'annual'}
            onCheckedChange={(checked) =>
              handleIntervalChange(checked === true ? 'annual' : 'monthly')
            }
            data-testid="billing-interval-annual"
          />
          <span className="text-body">
            Save {ANNUAL_DISCOUNT_PERCENT}% with an annual subscription
          </span>
        </label>
      )}

      <Dialog open={confirming} onOpenChange={(open) => !open && setConfirming(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selected
                ? isSubscribed
                  ? `Change to ${selected.templateDisplayName}?`
                  : `Subscribe to ${selected.templateDisplayName}?`
                : 'Choose a plan'}
            </DialogTitle>
            <DialogDescription>
              {selected && (
                <>
                  {selected.commitAmount != null &&
                    (isAnnualPlan(selected) ? (
                      <>
                        This tier grants {formatCredits(annualListUsd(selected.commitAmount))} for
                        the year (
                        {formatDisplayMoney(
                          annualDiscountedUsd(selected.commitAmount),
                          displayCurrency,
                          {
                            maximumFractionDigits: 0,
                          }
                        )}
                        /yr, {ANNUAL_DISCOUNT_PERCENT}% off vs monthly).{' '}
                      </>
                    ) : (
                      <>
                        This tier grants {formatCredits(selected.commitAmount)} each month (
                        {formatDisplayMoney(selected.commitAmount, displayCurrency, {
                          maximumFractionDigits: 0,
                        })}
                        /mo).{' '}
                      </>
                    ))}
                  {isSubscribed ? (
                    <>
                      The change takes effect immediately — your credit allowance updates now and
                      the difference is prorated on your current cycle.
                    </>
                  ) : (
                    <>
                      Your default saved card is charged now for the first
                      {isAnnualPlan(selected) ? ' year' : ' month'}, then automatically each
                      renewal.
                    </>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={submitting}
              data-testid="subscribe-plan-confirm"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubscribed ? 'Confirm change' : 'Confirm & pay'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// =============================================================================
// Prerequisite checklist row
// =============================================================================

interface PrerequisiteRowProps {
  testId: string;
  /** Whether the prerequisite is satisfied (renders a check + muted label). */
  complete: boolean;
  label: string;
  /** Underlined action shown only while incomplete (opens the relevant panel). */
  actionLabel: string;
  onAction?: () => void;
}

const PrerequisiteRow = ({
  testId,
  complete,
  label,
  actionLabel,
  onAction,
}: PrerequisiteRowProps) => (
  <li
    className="flex items-center justify-between gap-3"
    data-testid={testId}
    data-complete={complete}
  >
    <span className="text-caption flex items-center gap-2">
      {complete ? (
        <Check className="h-4 w-4 text-emerald-600" />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={complete ? 'text-muted-foreground' : ''}>{label}</span>
    </span>
    {!complete && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="text-caption text-primary underline underline-offset-2 hover:no-underline"
        data-testid={`${testId}-action`}
      >
        {actionLabel}
      </button>
    )}
  </li>
);
