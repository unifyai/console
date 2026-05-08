'use client';

/**
 * BillableActionGuard
 *
 * Wraps any billable action button/element and, when the active billing
 * account lacks sufficient credits, disables the element and shows a
 * tooltip explaining the requirement.
 *
 * The tooltip contains a clickable "purchase credits" link that opens
 * the Stripe side panel.
 *
 * By default the guard fetches billing status automatically via the
 * `useBillingStatus` hook (React Query deduplicates across all guards
 * on the same page), but callers can also pass explicit props to
 * override billing state.
 *
 * Usage:
 * ```tsx
 * // Automatic — fetches billing status internally (shared via React Query)
 * <BillableActionGuard onAddPaymentMethod={() => openStripeSidePanel()}>
 *   <Button onClick={hireAssistant}>Hire</Button>
 * </BillableActionGuard>
 *
 * // With credit threshold — requires at least $5 in credits
 * <BillableActionGuard creditsRequired={5}>
 *   <Button onClick={expensiveAction}>Run</Button>
 * </BillableActionGuard>
 *
 * // Explicit override — pass billing status from parent
 * <BillableActionGuard hasCredits={status.hasCredits}>
 *   <Button onClick={action}>Go</Button>
 * </BillableActionGuard>
 * ```
 *
 * When the user has sufficient credits, children render normally.
 * If `tooltipMessage` is provided, an informational tooltip wraps the
 * children in the non-gated state; otherwise there is no wrapper overhead.
 */

import * as React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { useBillingStatus } from '@/hooks/Billing/useBillingStatus';
import { useWorkspace } from '@/components/Pages/Providers/WorkspaceProvider';
import type { BillingMode } from '@/types/billing';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BillableActionGuardProps {
  children: React.ReactElement;
  /**
   * Whether the user has sufficient credits.
   * If omitted, computed from useBillingStatus using `creditsRequired`.
   */
  hasCredits?: boolean;
  /**
   * Minimum credit balance required for this action (default: any positive balance).
   * Only used when `hasCredits` is not explicitly provided.
   */
  creditsRequired?: number;
  /** Callback to open the Stripe payment panel */
  onAddPaymentMethod?: () => void;
  /** Whether the active org is in free-trial mode (affects tooltip copy) */
  isFreeTrial?: boolean;
  /** Tooltip shown on the child when the action is NOT gated. No tooltip if omitted. */
  tooltipMessage?: string;
  /** Tooltip placement (default: "top") */
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
}

// ─── Pure logic ─────────────────────────────────────────────────────────────

export interface GuardDecision {
  blocked: boolean;
  reason: 'no_credits' | null;
  message: string;
}

/**
 * Determines whether a billable action should be blocked and why.
 *
 * Managed-billing: METERED accounts pay by monthly invoice and
 * intentionally have a $0 credits wallet, so the credit-balance gate
 * must be bypassed entirely for them. Spending caps still apply (the
 * org/user/assistant limits live elsewhere — this guard is only the
 * "do you have credits?" check).
 *
 * Exported for unit testing without React.
 */
export function computeGuardDecision(
  hasCredits: boolean,
  billingMode: BillingMode = 'CREDITS'
): GuardDecision {
  if (billingMode === 'METERED') {
    return { blocked: false, reason: null, message: '' };
  }
  if (!hasCredits) {
    return {
      blocked: true,
      reason: 'no_credits',
      message: 'You need to purchase credits to use this feature.',
    };
  }
  return { blocked: false, reason: null, message: '' };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function BillableActionGuard({
  children,
  hasCredits: hasCreditsProp,
  creditsRequired = 0,
  onAddPaymentMethod,
  isFreeTrial,
  tooltipMessage,
  tooltipSide = 'top',
}: BillableActionGuardProps) {
  // All hooks called unconditionally (React rules of hooks)
  const billingStatus = useBillingStatus();
  const { activeOrganization } = useWorkspace();

  const resolvedIsFreeTrial = isFreeTrial ?? !!activeOrganization?.freeTrial;

  // Use explicit props when provided, otherwise derive from hook data
  const hasCredits =
    hasCreditsProp ??
    (creditsRequired > 0 ? billingStatus.credits >= creditsRequired : billingStatus.hasCredits);

  // METERED accounts always pass the credits gate (see computeGuardDecision).
  // We still consult ``billingStatus.billingMode`` even when the caller passed
  // an explicit ``hasCredits`` prop — a parent computing ``hasCredits`` from
  // raw balance might not know the account is METERED.
  const decision = computeGuardDecision(hasCredits, billingStatus.billingMode);

  // Still loading and no explicit props → render children as-is (not blocked)
  if (billingStatus.isLoading && hasCreditsProp === undefined) {
    return <>{children}</>;
  }

  // Not blocked → optionally wrap with a plain tooltip
  if (!decision.blocked) {
    if (tooltipMessage) {
      return (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent side={tooltipSide} className="max-w-xs p-2">
              <p className="text-caption leading-relaxed">{tooltipMessage}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Wrap in a clickable span so disabled children still trigger the tooltip,
             and clicking redirects to the payment flow */}
          <span
            data-testid="billable-action-guard"
            className="inline-flex cursor-pointer"
            onClick={onAddPaymentMethod}
          >
            {React.cloneElement(children, {
              disabled: true,
              'aria-disabled': true,
              onClick: (e: React.MouseEvent) => e.preventDefault(),
              className: `${children.props.className ?? ''} pointer-events-none opacity-50`.trim(),
            })}
          </span>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide} className="max-w-xs p-3">
          <p className="text-caption leading-relaxed">
            {resolvedIsFreeTrial ? (
              <>
                Your trial credits have been used.{' '}
                <a
                  href="https://cal.com/danlenton/chat"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-primary/80 inline font-medium text-primary underline underline-offset-2"
                  data-testid="talk-to-us-link"
                >
                  Talk to us
                </a>{' '}
                about deployment, or{' '}
                <button
                  type="button"
                  onClick={onAddPaymentMethod}
                  className="hover:text-primary/80 inline cursor-pointer font-medium text-primary underline underline-offset-2"
                  data-testid="buy-credits-link"
                >
                  add credits
                </button>{' '}
                to keep exploring.
              </>
            ) : (
              <>
                You need to{' '}
                <button
                  type="button"
                  onClick={onAddPaymentMethod}
                  className="hover:text-primary/80 inline cursor-pointer font-medium text-primary underline underline-offset-2"
                  data-testid="buy-credits-link"
                >
                  purchase credits
                </button>{' '}
                to use this feature.
              </>
            )}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default BillableActionGuard;
