import { NextRequest, NextResponse } from 'next/server';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { trustedClientIp } from '@/lib/server/clientIp';

/**
 * POST /api/auth/email/resend-verification
 *
 * Resends a verification code for signup or password reset.
 * Rate-limited on the Orchestra side (3 per email per hour).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, purpose } = body;
    const res = await OrchestraAdminClient.post('/auth/resend-verification', {
      email,
      purpose,
      clientIp: trustedClientIp(request),
    });
    return NextResponse.json(res.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ??
      rawData ?? { error: 'resend_failed', message: 'Failed to resend code' };
    return NextResponse.json(data, { status });
  }
}
