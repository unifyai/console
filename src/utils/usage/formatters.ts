/**
 * Formatters for Usage Page
 *
 * Pure functions for formatting credit amounts.
 *
 * Internal accounting unit
 * ------------------------
 * The Orchestra ledger denominates wallet movements (recharge, spend,
 * promo, refund, dispute) in "credits". 1 credit ≡ 1 USD on the Stripe
 * side today (see ``orchestra.web.api.webhooks.stripe`` and
 * ``orchestra.lib.billing.queue_auto_recharge`` — auto-recharge sets
 * ``Recharge.amount_usd = Decimal(credits)``), but the customer-facing
 * unit is "credits" everywhere outside the invoice surface itself.
 *
 * These helpers therefore render a credit amount, not a currency. Any
 * surface that *does* care about the customer's plan currency
 * (invoices, plan picker, billing-plan editor, metered overage estimate)
 * uses ``Intl.NumberFormat`` with the actual plan currency directly —
 * see ``InvoicesTable.tsx`` and ``MeteredBillingSection.tsx``.
 */

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
 * Format a credit amount for display in summary cards / tooltips /
 * ledger rows. Picks compact vs full form based on magnitude, and
 * always includes the ``credits`` unit so the value is unambiguous
 * out of context.
 */
export function formatCostForDisplay(amount: number): string {
  if (!Number.isFinite(amount)) {
    return `0.00 ${CREDIT_UNIT}`;
  }

  const absAmount = Math.abs(amount);

  if (absAmount >= 10_000) {
    return formatCompactCurrency(amount);
  }

  // Use 4 decimal places for very small amounts (sub-cent LLM ticks)
  if (absAmount > 0 && absAmount < 0.01) {
    return formatCurrency(amount, 4);
  }

  return formatCurrency(amount, 2);
}

/**
 * Format a credit amount for chart axis ticks.
 *
 * Drops the ``credits`` unit and shrinks to compact (K/M/B) form so
 * tick labels fit in the narrow Y-axis gutter. The chart's tooltip
 * (which uses ``formatCostForDisplay``) keeps the unit, and the
 * surrounding page copy makes the unit obvious in context.
 */
export function formatCostAxis(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '0';
  }

  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

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
