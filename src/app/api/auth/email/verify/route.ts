import { NextRequest, NextResponse } from 'next/server';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';

/**
 * POST /api/auth/email/verify
 *
 * Proxies email verification (6-digit code) to Orchestra.
 * On success, the user + email account are created in a single transaction.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await OrchestraAdminClient.post('/auth/verify-email', body);
    return NextResponse.json(res.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ?? rawData ?? { error: 'verification_failed', message: 'Verification failed' };
    return NextResponse.json(data, { status });
  }
}

