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
 * When the user has sufficient credits, children render normally with
 * no wrapper overhead.
 */

import * as React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/UI/tooltip';
import { useBillingStatus } from '@/hooks/Billing/useBillingStatus';
import { useEnvironment } from '@/components/Pages/Providers/EnvironmentProvider';

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
  /** Override the default tooltip message */
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
 * Exported for unit testing without React.
 */
export function computeGuardDecision(
  hasCredits: boolean,
  customMessage?: string
): GuardDecision {
  if (!hasCredits) {
    return {
      blocked: true,
      reason: 'no_credits',
      message: customMessage ?? 'You need to purchase credits to use this feature.',
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
  tooltipMessage,
  tooltipSide = 'top',
}: BillableActionGuardProps) {
  // All hooks called unconditionally (React rules of hooks)
  const billingStatus = useBillingStatus();

  // Use explicit props when provided, otherwise derive from hook data
  const hasCredits =
    hasCreditsProp ?? (creditsRequired > 0
      ? billingStatus.credits >= creditsRequired
      : billingStatus.hasCredits);

  const decision = computeGuardDecision(hasCredits, tooltipMessage);

  // Still loading and no explicit props → render children as-is (not blocked)
  if (billingStatus.isLoading && hasCreditsProp === undefined) {
    return <>{children}</>;
  }

  // Not blocked → render children as-is
  if (!decision.blocked) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Wrap in a span so disabled children still trigger the tooltip */}
          <span
            data-testid="billable-action-guard"
            className="inline-flex"
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
            You need to{' '}
            <button
              type="button"
              onClick={onAddPaymentMethod}
              className="inline cursor-pointer font-medium text-primary underline underline-offset-2 hover:text-primary/80"
              data-testid="buy-credits-link"
            >
              purchase credits
            </button>{' '}
            to use this feature.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default BillableActionGuard;
