import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '@/app/api/_utils/auth';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

/**
 * POST /api/auth/mfa/confirm
 *
 * Confirms TOTP setup by validating the user's first TOTP code.
 * On success, enables MFA and returns recovery codes.
 */
export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const client = await getOrchestraUserClient(apiKey);
    const res = await client.post('/auth/mfa/confirm', body);
    return NextResponse.json(res.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ?? rawData ?? { error: 'confirm_failed', message: 'MFA confirmation failed' };
    return NextResponse.json(data, { status });
  }
}

