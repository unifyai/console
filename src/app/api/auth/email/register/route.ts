import { NextRequest, NextResponse } from 'next/server';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { validatePassword } from '@/lib/auth/password';

/**
 * POST /api/auth/email/register
 *
 * Proxies email registration to Orchestra's admin auth endpoint.
 * Keeps the admin API key server-side — the browser never sees it.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, lastName, password, captchaToken } = body;

    const isStaging = process.env.ORCHESTRA_URL?.includes('staging') ?? false;
    if (isStaging && !email?.toLowerCase().endsWith('@unify.ai')) {
      return NextResponse.json(
        {
          error: 'staging_restricted',
          message: 'Registration on this environment is restricted to Unify AI members.',
        },
        { status: 403 }
      );
    }

    const validation = validatePassword(password ?? '');
    if (!validation.isValid) {
      const missing = validation.rules.filter((r) => !r.passed).map((r) => r.label.toLowerCase());
      return NextResponse.json(
        { error: 'weak_password', message: `Password must have ${missing.join(', ')}.` },
        { status: 400 }
      );
    }

    const res = await OrchestraAdminClient.post('/auth/register', {
      email,
      name,
      lastName,
      password,
      captchaToken,
    });
    return NextResponse.json(res.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ??
      rawData ?? { error: 'registration_failed', message: 'Registration failed' };
    return NextResponse.json(data, { status });
  }
}
