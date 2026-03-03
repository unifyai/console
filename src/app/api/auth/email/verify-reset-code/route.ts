import { NextRequest, NextResponse } from 'next/server';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';

/**
 * POST /api/auth/email/verify-reset-code
 *
 * Validates a password-reset code via the unified verify-code endpoint.
 * Returns the verification token that must be passed to reset-password.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = body;
    const res = await OrchestraAdminClient.post('/auth/verify-code', {
      email,
      code,
      purpose: 'password_reset',
    });
    return NextResponse.json(res.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ??
      rawData ?? { error: 'verification_failed', message: 'Code verification failed' };
    return NextResponse.json(data, { status });
  }
}
