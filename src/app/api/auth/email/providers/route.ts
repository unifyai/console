import { NextRequest, NextResponse } from 'next/server';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';

/**
 * GET /api/auth/email/providers?email=user@example.com
 *
 * Returns the list of auth providers linked to an email address.
 * Used for provider-aware error messages (e.g., "Sign in with Google instead").
 * Rate-limited on the Orchestra side.
 */
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    const captchaToken = request.nextUrl.searchParams.get('captchaToken');
    if (!captchaToken) {
      return NextResponse.json({ error: 'captcha_required' }, { status: 403 });
    }
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: turnstileSecret,
        response: captchaToken,
      }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyData.success) {
      return NextResponse.json({ error: 'captcha_failed' }, { status: 403 });
    }
  }

  try {
    const res = await OrchestraAdminClient.get('/auth/providers-for-email', {
      params: { email },
    });
    return NextResponse.json(res.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ??
      rawData ?? { error: 'lookup_failed', message: 'Provider lookup failed' };
    return NextResponse.json(data, { status });
  }
}
