import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '@/app/api/_utils/auth';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

/**
 * POST /api/auth/mfa/recovery-codes
 *
 * Regenerates recovery codes for the authenticated user.
 * Requires a valid TOTP code for confirmation.
 */
export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const { code } = body;
    if (!code) {
      return NextResponse.json(
        { error: 'code_required', message: 'A valid TOTP code is required.' },
        { status: 400 }
      );
    }
    const client = await getOrchestraUserClient(apiKey);
    const res = await client.post('/auth/mfa/recovery-codes', { code });
    return NextResponse.json(res.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ??
      rawData ?? {
        error: 'regenerate_failed',
        message: 'Recovery code regeneration failed',
      };
    return NextResponse.json(data, { status });
  }
}
