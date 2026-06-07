'use client';

/**
 * Customer-facing self-serve plan switching.
 *
 * Renders the set of templates the account can switch between
 * (`BillingActions.getAvailablePlans`) as either:
 *
 *   * A vertical ladder when every member has a `position` set —
 *     up/down rungs with the current plan flagged. Mirrors the
 *     server's downgrade-detection rule (target.position < current
 *     => downgrade => deferred to next period under AT_BOUNDARY).
 *   * Side-by-side cards when positions are NULL (unordered offers).
 *
 * The section hides itself entirely when the available list is empty
 * — that's how accounts without a `plan_group_id` are handled
 * (no extra "Switch plan" header on the page). Scheduling a switch
 * always lands on the next-month boundary; the confirmation modal
 * spells out the effective date and the classification (upgrade /
 * downgrade / sidegrade) so the customer can't be surprised by
 * either direction.
 */

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../../UI/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../../UI/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../UI/dialog';
import type { AvailablePlanItem, SwitchPlanResponse } from '@/types/billing';

// =============================================================================
// Props
// =============================================================================

export interface SwitchPlanSectionProps {
  availablePlans: AvailablePlanItem[];
  loading: boolean;
  /** Display name for the section heading (group label). */
  groupDisplayName: string | null;
  /** ISO-8601 next-month boundary every switch lands on. */
  nextPeriodStart: string | null;
  /**
   * Schedule the switch via the bound server action. Returns null on
   * error so the modal can render an inline message without exposing
   * raw server detail strings.
   */
  onSwitchPlan: (templateId: number, changeReason?: string) => Promise<SwitchPlanResponse | null>;
}

// =============================================================================
// Helpers
// =============================================================================

const formatDate = (iso: string | null): string => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
};

const formatCommit = (item: AvailablePlanItem): string => {
  if (item.commitAmount === null) return 'Pay-as-you-go';
  const period = item.commitPeriod ? ` / ${item.commitPeriod.toLowerCase()}` : '';
  return `${item.currency} ${item.commitAmount.toLocaleString()} commit${period}`;
};

// Direction badges (upgrade/downgrade/sidegrade) used to live in the
// card header here — they were dropped to declutter the card; the
// classification-aware copy still surfaces in the confirmation modal
// (downgrade gets the refund caveat, upgrade gets the "still paying
// the current rate until then" reassurance), so customers don't lose
// the directional context where it actually matters.

// =============================================================================
// Component
// =============================================================================

export const SwitchPlanSection = ({
  availablePlans,
  loading,
  groupDisplayName,
  nextPeriodStart,
  onSwitchPlan,
}: SwitchPlanSectionProps) => {
  const [pending, setPending] = useState<AvailablePlanItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SwitchPlanResponse | null>(null);

  // The ladder rendering is only meaningful when EVERY member has a
  // position set. Otherwise we fall back to cards so unordered
  // offerings (e.g. parallel agency vs in-house plans) don't pretend
  // to be a ladder.
  const isLadder = useMemo(
    () => availablePlans.length > 0 && availablePlans.every((p) => typeof p.position === 'number'),
    [availablePlans]
  );

  // When loading is still in flight on the FIRST paint and we have
  // no data yet, render a skeleton row rather than an empty section
  // that would pop into view a moment later.
  if (loading && availablePlans.length === 0) {
    return (
      <section className="space-y-3" data-testid="switch-plan-section-loading">
        <div>
          <h2 className="text-h3">Switch plan</h2>
          <p className="text-body-muted mt-1">Loading available plans…</p>
        </div>
      </section>
    );
  }

  // Empty list = no plan_group on the account. Hide the section
  // entirely — there is no equivalent of "no plans" to show.
  if (availablePlans.length === 0) return null;

  const handleConfirm = async () => {
    if (!pending) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await onSwitchPlan(pending.templateId);
      if (!result) {
        setError(
          'We could not schedule the switch. Refresh the page and try again, ' +
            'or contact support if the problem persists.'
        );
        return;
      }
      setLastResult(result);
      setPending(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-4" data-testid="switch-plan-section">
      <div>
        <h2 className="text-h3">Switch plan</h2>
        <p className="text-body-muted mt-1">
          {groupDisplayName
            ? `Choose another tier in ${groupDisplayName}.`
            : 'Choose another plan available on your account.'}{' '}
          {nextPeriodStart && <>Changes take effect on {formatDate(nextPeriodStart)}.</>}
        </p>
      </div>

      {lastResult && lastResult.status === 'scheduled' && (
        <div
          className="text-body border-[color:var(--status-success)]/25 rounded-md border bg-[color:var(--status-success-bg)] px-4 py-3 text-[color:var(--status-success)]"
          data-testid="switch-plan-success"
        >
          Switch scheduled — your new plan starts on {formatDate(lastResult.effectiveAt)}.
        </div>
      )}

      <div
        className={
          isLadder ? 'flex flex-col gap-3' : 'grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3'
        }
        data-testid="switch-plan-options"
      >
        {availablePlans.map((p) => (
          <Card
            key={p.templateId}
            className={p.isCurrent ? 'border-primary' : undefined}
            data-testid={`switch-plan-card-${p.templateId}`}
          >
            {/* Title and CTA share a single flex row so the Switch
                button vertically centres on the plan name; the
                pricing line drops below the row as the
                CardDescription. ``items-center`` is critical — the
                CTA was previously stranded under the description. */}
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base" data-testid="switch-plan-name">
                  {p.templateDisplayName}
                </CardTitle>
                <Button
                  size="sm"
                  variant={p.classification === 'upgrade' ? 'default' : 'outline'}
                  disabled={p.isCurrent}
                  onClick={() => {
                    setError(null);
                    setLastResult(null);
                    setPending(p);
                  }}
                  data-testid="switch-plan-cta"
                >
                  {p.isCurrent ? 'Current' : 'Switch'}
                </Button>
              </div>
              <CardDescription>{formatCommit(p)}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending ? `Switch to ${pending.templateDisplayName}?` : 'Switch plan'}
            </DialogTitle>
            <DialogDescription>
              {pending && (
                <>
                  Your switch will take effect on {formatDate(pending.effectiveAt)} — the start of
                  the next billing period.
                  {pending.classification === 'downgrade' && (
                    <>
                      {' '}
                      This is a downgrade; usage between now and then will still be billed at your
                      current rate. Refunds for any unused commitment are not automatic — contact
                      support if you believe one applies.
                    </>
                  )}
                  {pending.classification === 'upgrade' && (
                    <> You will continue paying your current rate until the new plan starts.</>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="text-body border-[color:var(--status-danger)]/25 rounded-md border bg-[color:var(--status-danger-bg)] px-3 py-2 text-[color:var(--status-danger)]">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={submitting} data-testid="switch-plan-confirm">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
