import { NextRequest, NextResponse } from 'next/server';
import { decode, encode } from 'next-auth/jwt';
import { getApiKeyFromRequest, unauthorized } from '@/app/api/_utils/auth';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false;
const cookiePrefix = useSecureCookies ? '__Secure-' : '';
const cookieName = `${cookiePrefix}next-auth.session-token`;

/**
 * POST /api/auth/mfa/confirm
 *
 * Confirms TOTP setup by validating the user's first TOTP code.
 * On success, enables MFA, returns recovery codes, and clears
 * mfaPending from the JWT (for org-enforced setup flows).
 */
export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  try {
    const body = await request.json();
    const client = await getOrchestraUserClient(apiKey);
    const res = await client.post('/auth/mfa/confirm', body);

    // After successful MFA confirmation, clear mfaPending from the JWT.
    // This handles the org-enforced setup flow where the user was redirected
    // to /login/mfa with mfaPending=true because they didn't have MFA yet.
    const secret = process.env.JWT_SECRET;
    const rawJwt = request.cookies.get(cookieName)?.value;

    if (secret && rawJwt) {
      const jwtToken = await decode({ token: rawJwt, secret });
      if (jwtToken?.mfaPending) {
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
      rawData ?? { error: 'confirm_failed', message: 'MFA confirmation failed' };
    return NextResponse.json(data, { status });
  }
}
