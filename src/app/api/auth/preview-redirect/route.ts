import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

import { validatePreviewOrigin } from '@/lib/auth/preview-host';
import {
  PREVIEW_TRANSFER_MAX_AGE_SECONDS,
  encodePreviewTransferToken,
} from '@/lib/auth/preview-tokens';

/**
 * Canonical-side post-OAuth bounce target.
 *
 * NextAuth's ``redirect`` callback only accepts same-origin redirects,
 * which is why the OAuth flow lands here rather than on the slug. This
 * route reads the just-set canonical session JWT, mints a 30-second JWE
 * pinned to the slug origin via ``aud``, and 302s the browser to
 * ``<slug>/api/auth/preview-claim?token=…``.
 *
 * If the user lands here without an authenticated session (cookie
 * missing or expired), they are bounced to the canonical login page so
 * they can retry — without leaking back to the slug as an unauthenticated
 * navigation.
 */

const SAFE_NEXT_PATH = /^\/[^\s]*$/;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;

  const returnToOrigin = validatePreviewOrigin(searchParams.get('return_to'));
  if (!returnToOrigin) {
    return new NextResponse('Invalid or missing return_to', { status: 400 });
  }

  const requestedNext = searchParams.get('next') ?? '/assistants';
  const next = SAFE_NEXT_PATH.test(requestedNext) ? requestedNext : '/assistants';

  const token = await getToken({ req: request, secret: process.env.JWT_SECRET });
  if (!token || !token.email || !token.sub) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'Signin');
    return NextResponse.redirect(loginUrl);
  }

  const transferToken = await encodePreviewTransferToken(
    {
      sub: token.sub,
      email: token.email,
      name: (token.name as string | null | undefined) ?? null,
      picture: (token.picture as string | null | undefined) ?? null,
      provider: (token as { provider?: string }).provider,
      mfaPending: (token as { mfaPending?: boolean }).mfaPending,
      onboardingStep: (token as { onboardingStep?: string }).onboardingStep,
    },
    returnToOrigin
  );

  const claimUrl = new URL('/api/auth/preview-claim', returnToOrigin);
  claimUrl.searchParams.set('token', transferToken);
  claimUrl.searchParams.set('next', next);

  const response = NextResponse.redirect(claimUrl);
  response.headers.set(
    'Cache-Control',
    `private, no-store, max-age=${PREVIEW_TRANSFER_MAX_AGE_SECONDS}`
  );
  return response;
}
