import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '@/app/api/_utils/auth';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

/**
 * POST /api/auth/mfa/setup
 *
 * Initiates TOTP setup for the authenticated user.
 * Returns the provisioning URI (otpauth:// for QR code display).
 */
export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const client = await getOrchestraUserClient(apiKey);
    const res = await client.post('/auth/mfa/setup');
    return NextResponse.json(res.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ??
      rawData ?? { error: 'setup_failed', message: 'MFA setup failed' };
    return NextResponse.json(data, { status });
  }
}
