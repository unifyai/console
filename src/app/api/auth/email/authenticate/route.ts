import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { trustedClientIp } from '@/lib/server/clientIp';

/**
 * POST /api/auth/email/authenticate
 *
 * Pre-validates email + password credentials via Orchestra.
 *
 * On success, signs a short-lived `preAuthToken` JWT containing the
 * authenticated user data.  The frontend passes this token to
 * `signIn("credentials", { preAuthToken })`, allowing the `authorize`
 * callback to return the user without a second Orchestra call.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;
    const res = await OrchestraAdminClient.post('/auth/authenticate', {
      email,
      password,
      clientIp: trustedClientIp(request),
    });

    // Sign a short-lived JWT so `authorize` can skip the second Orchestra call.
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const preAuthToken = await new SignJWT({
      sub: res.data.id,
      email: res.data.email,
      name: res.data.name,
      lastName: res.data.lastName ?? null,
      image: res.data.image ?? null,
      mfaRequired: res.data.mfaRequired ?? false,
      onboardingStep: res.data.onboardingStep ?? 'completed',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('60s') // 60-second window to complete signIn
      .sign(secret);

    return NextResponse.json({ preAuthToken }, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ??
      rawData ?? { error: 'auth_failed', message: 'Authentication failed' };
    return NextResponse.json(data, { status });
  }
}
