import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import {
  PREVIEW_SESSION_MAX_AGE_SECONDS,
  decodePreviewTransferToken,
  encodePreviewSessionToken,
  previewSessionCookie,
} from '@/lib/auth/preview-tokens';

/**
 * Slug-side claim endpoint for the preview-environment OAuth bounce.
 *
 * Receives a 30-second JWE minted by the canonical ``preview-redirect``
 * route, validates its signature, expiry and ``aud`` (which must equal
 * this slug's origin), then re-mints a normal NextAuth session cookie
 * scoped to this host. From this point on the slug looks indistinguishable
 * from any other authenticated origin — middleware, ``getToken()`` and
 * ``getServerSession()`` all accept the cookie because both ends share the
 * same ``JWT_SECRET``.
 *
 * On any failure the user is sent to ``/login`` rather than silently logged
 * in, so a stale or tampered token never produces an authenticated session.
 */

const SAFE_NEXT_PATH = /^\/[^\s]*$/;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;

  const rawToken = searchParams.get('token');
  if (!rawToken) {
    return NextResponse.redirect(new URL('/login?error=Signin', request.url));
  }

  const expectedAudience = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  const payload = await decodePreviewTransferToken(rawToken, expectedAudience);
  if (!payload) {
    return NextResponse.redirect(new URL('/login?error=Signin', request.url));
  }

  const sessionToken = await encodePreviewSessionToken(payload);

  const requestedNext = searchParams.get('next') ?? '/assistants';
  const next = SAFE_NEXT_PATH.test(requestedNext) ? requestedNext : '/assistants';

  const { name, secure } = previewSessionCookie();
  const cookieStore = await cookies();
  cookieStore.set(name, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    maxAge: PREVIEW_SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.redirect(new URL(next, request.url));
}
