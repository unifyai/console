import { NextRequest, NextResponse } from 'next/server';

const GEO_API_TIMEOUT_MS = 3000;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

function extractClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() ?? null;
  if (!ip || ip === '127.0.0.1' || ip === '::1') return null;
  return ip;
}

export async function GET(request: NextRequest) {
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
    if (COUNTRY_CODE_PATTERN.test(country)) {
      return NextResponse.json({ country });
    }
    return NextResponse.json({ country: null });
  } catch {
    return NextResponse.json({ country: null });
  }
}
