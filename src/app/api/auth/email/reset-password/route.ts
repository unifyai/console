import { NextRequest, NextResponse } from 'next/server';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { validatePassword } from '@/lib/auth/password';

/**
 * POST /api/auth/email/reset-password
 *
 * Validates the reset code + sets the new password.
 * Sets password_changed_at to invalidate existing sessions.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    const validation = validatePassword(password ?? '');
    if (!validation.isValid) {
      const missing = validation.rules.filter((r) => !r.passed).map((r) => r.label.toLowerCase());
      return NextResponse.json(
        { error: 'weak_password', message: `Password must have ${missing.join(', ')}.` },
        { status: 400 }
      );
    }

    const res = await OrchestraAdminClient.post('/auth/reset-password', {
      token,
      new_password: password,
    });
    return NextResponse.json(res.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ??
      rawData ?? { error: 'reset_failed', message: 'Password reset failed' };
    return NextResponse.json(data, { status });
  }
}
