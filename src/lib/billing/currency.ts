/**
 * Display-only currency helpers for the self-serve billing UI.
 *
 * IMPORTANT: this module is purely cosmetic. Settlement always happens
 * in USD — every amount sent to the Orchestra API is the raw USD figure
 * (1 credit = $1). These helpers only change how prices and balances are
 * *displayed* to the customer:
 *
 *   * USD by default.
 *   * GBP (£) for UK users (billing profile country === "GB").
 *
 * The display FX rate is a single configurable constant. It is NOT a
 * settlement rate and is intentionally approximate; it exists so a UK
 * customer sees a roughly-right pound figure next to the canonical USD
 * price rather than a bare dollar amount.
 */

/** ISO-4217 codes the display layer understands. */
export type DisplayCurrency = 'USD' | 'GBP';

/**
 * Display-only credit framing.
 *
 * The backend wallet is denominated in USD value (1 internal unit = $1).
 * Customers, however, are shown *credits*, where 1 credit is a fixed
 * fraction of a dollar of value. This multiplier converts the canonical
 * USD value into the customer-facing credit count purely for display —
 * it is NEVER sent to the API and never used for settlement (a $50 plan
 * still settles as $50; it is merely shown as "20,000 credits").
 *
 * Credits are currency-independent: the count is the same whether the
 * customer is billed in USD or GBP (only the money figure changes).
 */
export const DISPLAY_CREDITS_PER_USD = 400;

/** Convert a canonical USD value to the customer-facing credit count. */
export function toDisplayCredits(usd: number): number {
  return Math.round(usd * DISPLAY_CREDITS_PER_USD);
}

/**
 * Inverse of {@link toDisplayCredits}: convert a customer-entered credit
 * count back to the canonical USD value the API expects. Use at the save
 * boundary of any input that is *displayed* in credits (e.g. spending
 * limits) so the stored figure stays in settlement USD.
 */
export function fromDisplayCredits(credits: number): number {
  return credits / DISPLAY_CREDITS_PER_USD;
}

/** Months billed in one annual cycle (annual list price = 12× the monthly). */
export const ANNUAL_MONTHS = 12;

/**
 * Display-only annual discount percentage.
 *
 * The *real* discount is enforced by a Stripe coupon on annual
 * subscriptions (orchestra `STRIPE_UNIFY_ANNUAL_COUPON_ID`); this constant
 * only drives the approximate "save N%" framing and the discounted price
 * shown in the picker. Keep it in sync with the coupon if the coupon
 * percentage changes. Never used for anything sent to the API.
 */
export const ANNUAL_DISCOUNT_PERCENT = 20;

/** Annual list price (USD) for a monthly tier rung, before the discount. */
export function annualListUsd(monthlyCommitUsd: number): number {
  return monthlyCommitUsd * ANNUAL_MONTHS;
}

/** Discounted annual price (USD) shown to the customer (display-only). */
export function annualDiscountedUsd(monthlyCommitUsd: number): number {
  return annualListUsd(monthlyCommitUsd) * (1 - ANNUAL_DISCOUNT_PERCENT / 100);
}

/**
 * Format a USD value as a credit count (e.g. `50 → "20,000 credits"`).
 *
 * @param usd  Canonical USD value (the backend wallet/grant amount).
 * @param opts `withSuffix` (default true) appends " credits"; set false to
 *             render just the number (e.g. inside a labelled field).
 */
export function formatCredits(usd: number, opts?: { withSuffix?: boolean }): string {
  const credits = toDisplayCredits(usd);
  const formatted = new Intl.NumberFormat('en-US').format(credits);
  return opts?.withSuffix === false ? formatted : `${formatted} credits`;
}

/**
 * Display-only USD→GBP rate. Centralised here so there is exactly one
 * place to update it (or later swap for a fetched rate). Settlement is
 * unaffected — see the module doc.
 */
export const GBP_PER_USD = 0.79;

/**
 * Resolve the display currency from a billing-profile country code.
 * Defaults to USD when the country is unknown or not the UK.
 */
export function resolveDisplayCurrency(country?: string | null): DisplayCurrency {
  return country?.toUpperCase() === 'GB' ? 'GBP' : 'USD';
}

/**
 * Convert a USD amount to the display currency. A no-op for USD; applies
 * {@link GBP_PER_USD} for GBP. Never use the result for anything sent to
 * the API.
 */
export function toDisplayAmount(usd: number, currency: DisplayCurrency): number {
  if (currency === 'GBP') return usd * GBP_PER_USD;
  return usd;
}

/**
 * Format a USD amount in the requested display currency.
 *
 * @param usd      Raw USD amount (settlement currency).
 * @param currency Display currency (USD/GBP).
 * @param opts     `maximumFractionDigits` (default 2); set to 0 for whole
 *                 tier prices.
 */
export function formatDisplayMoney(
  usd: number,
  currency: DisplayCurrency,
  opts?: { maximumFractionDigits?: number }
): string {
  const amount = toDisplayAmount(usd, currency);
  const maximumFractionDigits = opts?.maximumFractionDigits ?? 2;
  try {
    return new Intl.NumberFormat(currency === 'GBP' ? 'en-GB' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    const symbol = currency === 'GBP' ? '£' : '$';
    return `${symbol}${amount.toFixed(maximumFractionDigits)}`;
  }
}
