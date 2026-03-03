import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized } from '@/app/api/_utils/auth';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';
import { validatePassword } from '@/lib/auth/password';

/**
 * POST /api/auth/email/change-password
 *
 * Changes the password for the currently authenticated user.
 * Requires a valid session (user API key).
 */
export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    const validation = validatePassword(newPassword ?? '');
    if (!validation.isValid) {
      const missing = validation.rules.filter((r) => !r.passed).map((r) => r.label.toLowerCase());
      return NextResponse.json(
        { error: 'weak_password', message: `Password must have ${missing.join(', ')}.` },
        { status: 400 }
      );
    }

    const client = await getOrchestraUserClient(apiKey);
    const res = await client.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return NextResponse.json(res.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ??
      rawData ?? { error: 'change_failed', message: 'Password change failed' };
    return NextResponse.json(data, { status });
  }
}
