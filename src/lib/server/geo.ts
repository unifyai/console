import { headers, type ReadonlyHeaders } from 'next/headers';

const GEO_API_TIMEOUT_MS = 3000;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

function isValidCountryCode(value: string | null | undefined): value is string {
  return !!value && COUNTRY_CODE_PATTERN.test(value);
}

function extractClientIp(headerStore: ReadonlyHeaders): string | null {
  const candidates = [
    headerStore.get('cf-connecting-ip'),
    headerStore.get('x-real-ip'),
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim(),
  ];
  for (const ip of candidates) {
    if (ip && ip !== '127.0.0.1' && ip !== '::1') return ip;
  }
  return null;
}

export async function resolveServerVisitorCountry(): Promise<string | null> {
  let headerStore: ReadonlyHeaders;
  try {
    headerStore = await headers();
  } catch {
    return null;
  }
  const cfCountry = headerStore.get('cf-ipcountry')?.toUpperCase();
  if (isValidCountryCode(cfCountry)) {
    return cfCountry;
  }

  const ip = extractClientIp(headerStore);
  if (!ip) {
    return null;
  }

  try {
    const res = await fetch(`https://ipapi.co/${ip}/country/`, {
      signal: AbortSignal.timeout(GEO_API_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const country = (await res.text()).trim().toUpperCase();
    return isValidCountryCode(country) ? country : null;
  } catch {
    return null;
  }
}
