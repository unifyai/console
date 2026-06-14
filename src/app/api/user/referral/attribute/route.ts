import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../_utils/auth';

const baseUrl = process.env.ORCHESTRA_URL || 'https://api.unify.ai';

/**
 * POST /api/user/referral/attribute  → attribute the caller to a referral code.
 *
 * Attribution only — the reward is granted later, when the caller makes
 * their first qualifying payment. Idempotent on the backend, so the client
 * can retry safely.
 */
export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  const body = await request.json().catch(() => ({}));
  const code = body?.code;
  if (!code) {
    return badRequest('Missing required field: code');
  }

  try {
    const res = await fetch(`${baseUrl}/v0/user/referral/attribute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.error(`Orchestra API Error (referral attribute - ${res.status}):`, data);
      return NextResponse.json(data ?? { detail: 'Unknown error' }, { status: res.status });
    }
    return NextResponse.json(data, { status: res.status });
  } catch (e: unknown) {
    console.error('Error proxying to Orchestra API (referral attribute):', e);
    return NextResponse.json(
      {
        detail: 'Failed to connect to backend API',
        errorDetails: e instanceof Error ? e.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
