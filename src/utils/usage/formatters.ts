/**
 * Formatters for Usage Page
 *
 * Pure functions for formatting credit amounts.
 *
 * Internal accounting unit vs. displayed credits
 * ----------------------------------------------
 * The Orchestra ledger denominates wallet movements (recharge, spend,
 * promo, refund, dispute) in a canonical USD value (1 internal unit ≡
 * $1 on the Stripe side; see ``orchestra.web.api.webhooks.stripe``).
 * The *customer-facing* unit, however, is "credits", where 1 credit is a
 * fixed fraction of a dollar — the same display-only framing the billing
 * page uses (see ``@/lib/billing/currency`` ``DISPLAY_CREDITS_PER_USD``).
 *
 * These helpers therefore take the raw USD ledger value and render it as
 * a *credit count* (USD × ``DISPLAY_CREDITS_PER_USD``) so the usage page
 * matches the billing page. The multiplier is display-only and is never
 * sent to the API. Any surface that cares about the customer's plan
 * *currency* (invoices, metered overage estimate) instead uses
 * ``Intl.NumberFormat`` with the actual plan currency — see
 * ``InvoicesTable.tsx`` and ``MeteredBillingSection.tsx``.
 */

import { DISPLAY_CREDITS_PER_USD } from '@/lib/billing/currency';

const CREDIT_UNIT = 'credits';

/**
 * Format a number with thousand separators and the credit unit suffix.
 *
 * Examples:
 *   formatCurrency(1234.5)       => "1,234.50 credits"
 *   formatCurrency(0.0123, 4)    => "0.0123 credits"
 *   formatCurrency(-50)          => "-50.00 credits"
 *
 * @param amount - Amount to format
 * @param decimals - Number of decimal places (default: 2)
 * @param unit - Unit suffix to append (default: ``credits``). Override
 *   only when wrapping into a different domain unit; the call sites
 *   that need plan currency don't go through this helper at all.
 */
export function formatCurrency(
  amount: number,
  decimals: number = 2,
  unit: string = CREDIT_UNIT
): string {
  if (!Number.isFinite(amount)) {
    return `0.00 ${unit}`;
  }

  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const formatted = absAmount.toFixed(decimals);

  const parts = formatted.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `${sign}${parts.join('.')} ${unit}`;
}

/**
 * Format a number as compact credits (e.g., 1.2K credits, 3.4M credits).
 *
 * Used by ``formatCostForDisplay`` for amounts >= 10,000 to keep
 * summary cards readable. Dropping the unit (and using
 * ``formatCostAxis``) is preferable for chart tick labels where
 * horizontal space is tight.
 */
export function formatCompactCurrency(amount: number, unit: string = CREDIT_UNIT): string {
  if (!Number.isFinite(amount)) {
    return `0 ${unit}`;
  }

  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (absAmount >= 1_000_000_000) {
    return `${sign}${(absAmount / 1_000_000_000).toFixed(1)}B ${unit}`;
  }
  if (absAmount >= 1_000_000) {
    return `${sign}${(absAmount / 1_000_000).toFixed(1)}M ${unit}`;
  }
  if (absAmount >= 1_000) {
    return `${sign}${(absAmount / 1_000).toFixed(1)}K ${unit}`;
  }
  if (absAmount >= 1) {
    return `${sign}${absAmount.toFixed(2)} ${unit}`;
  }
  if (absAmount >= 0.01) {
    return `${sign}${absAmount.toFixed(2)} ${unit}`;
  }
  if (absAmount > 0) {
    // For very small amounts, show more precision
    return `${sign}${absAmount.toFixed(4)} ${unit}`;
  }
  return `0 ${unit}`;
}

/**
 * Format a USD ledger value for display in summary cards / tooltips /
 * ledger rows as a *credit count* (USD × ``DISPLAY_CREDITS_PER_USD``).
 * Picks compact vs full form based on magnitude, and always includes the
 * ``credits`` unit so the value is unambiguous out of context.
 */
export function formatCostForDisplay(amount: number): string {
  if (!Number.isFinite(amount)) {
    return `0.00 ${CREDIT_UNIT}`;
  }

  // Convert the canonical USD value to the displayed credit count. We
  // multiply (rather than round via ``toDisplayCredits``) to preserve
  // sub-credit precision for tiny per-transaction LLM ticks.
  const credits = amount * DISPLAY_CREDITS_PER_USD;
  const absAmount = Math.abs(credits);

  if (absAmount >= 10_000) {
    return formatCompactCurrency(credits);
  }

  // Use 4 decimal places for very small amounts (sub-credit LLM ticks)
  if (absAmount > 0 && absAmount < 0.01) {
    return formatCurrency(credits, 4);
  }

  return formatCurrency(credits, 2);
}

/**
 * Format a USD ledger value as a *credit count* for chart axis ticks.
 *
 * Converts USD × ``DISPLAY_CREDITS_PER_USD`` (matching the tooltip and
 * ledger), drops the ``credits`` unit, and shrinks to compact (K/M/B)
 * form so tick labels fit in the narrow Y-axis gutter. The chart's
 * tooltip (which uses ``formatCostForDisplay``) keeps the unit, and the
 * surrounding page copy makes the unit obvious in context.
 */
export function formatCostAxis(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '0';
  }

  const credits = amount * DISPLAY_CREDITS_PER_USD;
  const absAmount = Math.abs(credits);
  const sign = credits < 0 ? '-' : '';

  if (absAmount >= 1_000_000_000) {
    return `${sign}${(absAmount / 1_000_000_000).toFixed(1)}B`;
  }
  if (absAmount >= 1_000_000) {
    return `${sign}${(absAmount / 1_000_000).toFixed(1)}M`;
  }
  if (absAmount >= 1_000) {
    return `${sign}${(absAmount / 1_000).toFixed(1)}K`;
  }
  if (absAmount >= 1) {
    return `${sign}${absAmount.toFixed(0)}`;
  }
  if (absAmount > 0) {
    return `${sign}${absAmount.toFixed(2)}`;
  }
  return '0';
}

/**
 * Format a percentage value.
 * @param value Value to format as percentage
 * @param decimals Number of decimal places (default: 1)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a number with thousand separators.
 * @param value Number to format
 * @param decimals Number of decimal places (default: 0)
 * @returns Formatted number string
 */
export function formatNumber(value: number, decimals: number = 0): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  const formatted = value.toFixed(decimals);
  const parts = formatted.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return parts.join('.');
}
