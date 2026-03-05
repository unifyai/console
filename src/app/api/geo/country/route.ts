import { NextRequest, NextResponse } from 'next/server';

const GEO_API_TIMEOUT_MS = 3000;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

function isValidCountryCode(value: string | null | undefined): value is string {
  return !!value && COUNTRY_CODE_PATTERN.test(value);
}

function extractClientIp(request: NextRequest): string | null {
  const candidates = [
    request.headers.get('cf-connecting-ip'),
    request.headers.get('x-real-ip'),
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  ];
  for (const ip of candidates) {
    if (ip && ip !== '127.0.0.1' && ip !== '::1') return ip;
  }
  return null;
}

export async function GET(request: NextRequest) {
  // Cloudflare provides the country code directly — no external call needed
  const cfCountry = request.headers.get('cf-ipcountry')?.toUpperCase();
  if (isValidCountryCode(cfCountry)) {
    return NextResponse.json({ country: cfCountry });
  }

  const ip = extractClientIp(request);
  if (!ip) {
    return NextResponse.json({ country: null });
  }

  try {
    const res = await fetch(`https://ipapi.co/${ip}/country/`, {
      signal: AbortSignal.timeout(GEO_API_TIMEOUT_MS),
    });
    if (!res.ok) return NextResponse.json({ country: null });

    const country = (await res.text()).trim();
    if (isValidCountryCode(country)) {
      return NextResponse.json({ country });
    }
    return NextResponse.json({ country: null });
  } catch {
    return NextResponse.json({ country: null });
  }
}
