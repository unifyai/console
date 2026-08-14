import { NextRequest, NextResponse } from 'next/server';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { trustedClientIp } from '@/lib/server/clientIp';

/**
 * POST /api/auth/email/forgot-password
 *
 * Initiates the password reset flow with CAPTCHA verification.
 * Returns 200 on success to prevent email enumeration.
 * Returns 400 if CAPTCHA verification fails (doesn't leak email info).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, captchaToken } = body;
    const res = await OrchestraAdminClient.post('/auth/forgot-password', {
      email,
      captchaToken,
      clientIp: trustedClientIp(request),
    });
    return NextResponse.json(res.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status;
    const detail = error?.response?.data?.detail;

    // Surface CAPTCHA failures to the client so the widget can be reset
    if (status === 400 && detail?.error === 'captcha_failed') {
      return NextResponse.json(
        { error: 'captcha_failed', message: detail.message },
        { status: 400 }
      );
    }

    // All other errors — return 200 to prevent email enumeration
    return NextResponse.json(
      { message: 'If an account exists with that email, a reset code has been sent.' },
      { status: 200 }
    );
  }
}
