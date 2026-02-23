/**
 * Formatters for Usage Page
 *
 * Pure functions for formatting currency/cost values.
 */

/**
 * Format a number as currency with specified decimal places.
 * @param amount Amount to format
 * @param decimals Number of decimal places (default: 2)
 * @param currencySymbol Currency symbol (default: '$')
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number,
  decimals: number = 2,
  currencySymbol: string = '$'
): string {
  if (!Number.isFinite(amount)) {
    return `${currencySymbol}0.00`;
  }

  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const formatted = absAmount.toFixed(decimals);

  // Add thousand separators
  const parts = formatted.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `${sign}${currencySymbol}${parts.join('.')}`;
}

/**
 * Format a number as compact currency (e.g., $1.2K, $3.4M).
 * @param amount Amount to format
 * @param currencySymbol Currency symbol (default: '$')
 * @returns Compact formatted currency string
 */
export function formatCompactCurrency(amount: number, currencySymbol: string = '$'): string {
  if (!Number.isFinite(amount)) {
    return `${currencySymbol}0`;
  }

  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (absAmount >= 1_000_000_000) {
    return `${sign}${currencySymbol}${(absAmount / 1_000_000_000).toFixed(1)}B`;
  }
  if (absAmount >= 1_000_000) {
    return `${sign}${currencySymbol}${(absAmount / 1_000_000).toFixed(1)}M`;
  }
  if (absAmount >= 1_000) {
    return `${sign}${currencySymbol}${(absAmount / 1_000).toFixed(1)}K`;
  }
  if (absAmount >= 1) {
    return `${sign}${currencySymbol}${absAmount.toFixed(2)}`;
  }
  if (absAmount >= 0.01) {
    return `${sign}${currencySymbol}${absAmount.toFixed(2)}`;
  }
  if (absAmount > 0) {
    // For very small amounts, show more precision
    return `${sign}${currencySymbol}${absAmount.toFixed(4)}`;
  }
  return `${currencySymbol}0`;
}

/**
 * Format a cost value for display in summary cards.
 * Automatically chooses appropriate formatting based on magnitude.
 * @param amount Amount to format
 * @returns Formatted string for display
 */
export function formatCostForDisplay(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '$0.00';
  }

  const absAmount = Math.abs(amount);

  // Use compact format for large numbers
  if (absAmount >= 10_000) {
    return formatCompactCurrency(amount);
  }

  // Use 4 decimal places for very small amounts
  if (absAmount > 0 && absAmount < 0.01) {
    return formatCurrency(amount, 4);
  }

  // Standard 2 decimal places for most values
  return formatCurrency(amount, 2);
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
