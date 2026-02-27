import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';

/**
 * POST /api/auth/mfa/verify
 *
 * Verifies a TOTP code during the login flow (admin-key endpoint).
 * Called from /login/mfa after the user enters their 6-digit code.
 *
 * The user ID is resolved server-side from the JWT token — the client
 * only sends `{ code }`.
 */
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.JWT_SECRET });
    if (!token?.sub) {
      return NextResponse.json({ error: 'unauthorized', message: 'No session found.' }, { status: 401 });
    }

    const body = await request.json();
    const res = await OrchestraAdminClient.post('/auth/mfa/verify', {
      userId: token.sub,
      code: body.code,
    });
    return NextResponse.json(res.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ?? rawData ?? { error: 'mfa_failed', message: 'MFA verification failed' };
    return NextResponse.json(data, { status });
  }
}
