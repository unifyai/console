import { NextRequest, NextResponse } from 'next/server';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { trustedClientIp } from '@/lib/server/clientIp';
import { signupProvenanceFrom } from '@/lib/server/signupProvenance';

/**
 * POST /api/auth/email/verify
 *
 * Two-step email verification for signup:
 *  1. POST /auth/verify-code — validates the 6-digit code, returns a JWT token
 *  2. POST /auth/create-user — uses the token to create User + EmailAccount
 *
 * The frontend still treats this as a single "verify" call.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = body;

    // Step 1: Verify the code → get a short-lived token
    const verifyRes = await OrchestraAdminClient.post('/auth/verify-code', {
      email,
      code,
      purpose: 'signup',
      clientIp: trustedClientIp(request),
    });
    const { token } = verifyRes.data;

    // Step 2: Create the user using the token. The signup origin rides
    // along because Orchestra sees this server, not the person.
    const createRes = await OrchestraAdminClient.post('/auth/create-user', {
      token,
      ...signupProvenanceFrom(request),
    });
    return NextResponse.json(createRes.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ??
      rawData ?? { error: 'verification_failed', message: 'Verification failed' };
    return NextResponse.json(data, { status });
  }
}
