/**
 * Small pure formatting helpers for the billing UI. Kept dependency-free
 * so they can be unit-tested without pulling in the React component tree.
 */

/**
 * Human countdown from `now` to an ISO instant, e.g. "3 days", "5 hours",
 * "1 minute", or "expired" when the instant is in the past. Returns an
 * empty string for null/invalid input.
 */
export function formatCountdown(iso: string | null, now: number = Date.now()): string {
  if (!iso) return '';
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return '';
  const ms = target - now;
  if (ms <= 0) return 'expired';
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'}`;
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/** Locale-formatted short date (e.g. "Jun 4, 2026"); empty string on null. */
export function formatShortDate(iso: string | null): string {
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
}
