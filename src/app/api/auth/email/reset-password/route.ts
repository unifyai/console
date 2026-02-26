import { NextRequest, NextResponse } from 'next/server';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';

/**
 * POST /api/auth/email/reset-password
 *
 * Validates the reset code + sets the new password.
 * Sets password_changed_at to invalidate existing sessions.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await OrchestraAdminClient.post('/auth/reset-password', body);
    return NextResponse.json(res.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ?? rawData ?? { error: 'reset_failed', message: 'Password reset failed' };
    return NextResponse.json(data, { status });
  }
}

