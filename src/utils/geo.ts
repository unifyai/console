export const FALLBACK_NATIONALITY = 'United Kingdom';

/**
 * Fetches the visitor's country code (ISO 3166-1 alpha-2) based on their IP address.
 * Returns null if detection fails for any reason.
 */
export async function fetchVisitorCountry(): Promise<string | null> {
  try {
    const res = await fetch('/api/geo/country');
    if (!res.ok) return null;
    const data = await res.json();
    return data.country ?? null;
  } catch {
    return null;
  }
}

/**
 * Converts an ISO 3166-1 alpha-2 country code to a display name
 * using the browser's Intl API (e.g. "GB" → "United Kingdom").
 */
export function countryCodeToNationality(code: string): string {
  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return displayNames.of(code.toUpperCase()) ?? FALLBACK_NATIONALITY;
  } catch {
    return FALLBACK_NATIONALITY;
  }
}

/**
 * Resolves the visitor's nationality name from their IP address.
 * Falls back to "United Kingdom" if IP resolution or code mapping fails.
 */
export async function fetchVisitorNationality(): Promise<string> {
  const code = await fetchVisitorCountry();
  if (!code) return FALLBACK_NATIONALITY;
  return countryCodeToNationality(code);
}
