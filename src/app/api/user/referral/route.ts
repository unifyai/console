import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '../../_utils/auth';

const baseUrl = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

/**
 * GET  /api/user/referral  → the caller's referral link, codes, and stats.
 * POST /api/user/referral  → create an additional referral code.
 *
 * Thin proxy to Orchestra ``/v0/user/referral`` (paths not yet in the
 * generated OpenAPI types, so we use raw fetch — same approach as the
 * credit-grant-link proxy).
 */
export async function GET(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const res = await fetch(`${baseUrl}/v0/user/referral`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.error(`Orchestra API Error (referral - ${res.status}):`, data);
      return NextResponse.json(data ?? { detail: 'Unknown error' }, { status: res.status });
    }
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    console.error('Error proxying to Orchestra API (referral):', e);
    return NextResponse.json(
      {
        detail: 'Failed to connect to backend API',
        errorDetails: e instanceof Error ? e.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const body = await request.json().catch(() => ({}));

  try {
    const res = await fetch(`${baseUrl}/v0/user/referral/codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ label: body?.label ?? null }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.error(`Orchestra API Error (referral create - ${res.status}):`, data);
      return NextResponse.json(data ?? { detail: 'Unknown error' }, { status: res.status });
    }
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    console.error('Error proxying to Orchestra API (referral create):', e);
    return NextResponse.json(
      {
        detail: 'Failed to connect to backend API',
        errorDetails: e instanceof Error ? e.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
