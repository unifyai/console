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
