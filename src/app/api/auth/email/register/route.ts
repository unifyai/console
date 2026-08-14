import { NextRequest, NextResponse } from 'next/server';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { trustedClientIp } from '@/lib/server/clientIp';
import { signupProvenanceFrom } from '@/lib/server/signupProvenance';
import { validatePassword } from '@/lib/auth/password';
import { isSelfHost } from '@/lib/environment/environment';
import { IS_STAGING, isStagingAllowedEmail } from '@/lib/auth/staging-gate';

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

    if (!isSelfHost() && IS_STAGING && !isStagingAllowedEmail(email)) {
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
      // The browser's agent for the bot heuristic, and its address for
      // the rate limit. Orchestra sees this server, not the person.
      ...signupProvenanceFrom(request),
      clientIp: trustedClientIp(request),
    });
    const payload = res.data as Record<string, unknown>;
    const requiresVerification =
      payload.requiresVerification ?? payload.requires_verification ?? true;
    return NextResponse.json(
      {
        ...payload,
        requiresVerification,
        requires_verification: requiresVerification,
      },
      { status: 200 }
    );
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ??
      rawData ?? { error: 'registration_failed', message: 'Registration failed' };
    return NextResponse.json(data, { status });
  }
}
