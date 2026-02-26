import { NextRequest, NextResponse } from 'next/server';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';

/**
 * POST /api/auth/mfa/verify-recovery
 *
 * Verifies a recovery code during the login flow (admin-key endpoint).
 * Called from /login/mfa when the user clicks "Use recovery code".
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await OrchestraAdminClient.post('/auth/mfa/verify-recovery', body);
    return NextResponse.json(res.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ?? rawData ?? {
      error: 'recovery_failed',
      message: 'Recovery code verification failed',
    };
    return NextResponse.json(data, { status });
  }
}

