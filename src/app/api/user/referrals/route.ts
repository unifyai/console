import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';

const baseUrl = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

/**
 * GET /api/user/referrals  → list the caller's referrals (as referrer)
 * and the reward status of each. Proxies Orchestra ``/v0/user/referrals``.
 */
export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const res = await fetch(`${baseUrl}/v0/user/referrals`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.error(`Orchestra API Error (referrals - ${res.status}):`, data);
      return NextResponse.json(data ?? { detail: 'Unknown error' }, { status: res.status });
    }
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    console.error('Error proxying to Orchestra API (referrals):', e);
    return NextResponse.json(
      {
        detail: 'Failed to connect to backend API',
        errorDetails: e instanceof Error ? e.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
