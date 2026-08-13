import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { decode, encode } from 'next-auth/jwt';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';
import { trustedClientIp } from '@/lib/server/clientIp';

const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false;
const cookiePrefix = useSecureCookies ? '__Secure-' : '';
const cookieName = `${cookiePrefix}next-auth.session-token`;

/**
 * POST /api/auth/mfa/verify-recovery
 *
 * Verifies a recovery code during the login flow (admin-key endpoint).
 * Called from /login/mfa when the user clicks "Use recovery code".
 *
 * On success, patches the JWT cookie server-side to clear mfaPending,
 * so the client never controls MFA state transitions.
 */
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.JWT_SECRET });
    if (!token?.sub) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'No session found.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const res = await OrchestraAdminClient.post('/auth/mfa/verify-recovery', {
      userId: token.sub,
      code: body.code,
      clientIp: trustedClientIp(request),
    });

    // Recovery code verified — patch the JWT cookie server-side to clear mfaPending
    const secret = process.env.JWT_SECRET;
    const rawJwt = request.cookies.get(cookieName)?.value;

    if (secret && rawJwt) {
      const jwtToken = await decode({ token: rawJwt, secret });
      if (jwtToken) {
        delete jwtToken.mfaPending;
        const maxAge = 7 * 24 * 60 * 60;
        const newJwt = await encode({ token: jwtToken, secret, maxAge });

        const response = NextResponse.json(res.data, { status: 200 });
        response.cookies.set(cookieName, newJwt, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: useSecureCookies,
        });
        return response;
      }
    }

    return NextResponse.json(res.data, { status: 200 });
  } catch (error: any) {
    const status = error?.response?.status ?? 500;
    const rawData = error?.response?.data;
    const data = rawData?.detail ??
      rawData ?? {
        error: 'recovery_failed',
        message: 'Recovery code verification failed',
      };
    return NextResponse.json(data, { status });
  }
}
