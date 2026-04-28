import { NextRequest, NextResponse } from 'next/server';

import { validatePreviewOrigin } from '@/lib/auth/preview-host';

/**
 * Canonical-side entrypoint for the preview-environment OAuth bounce.
 *
 * The preview-tagged console redirects its "Sign in with Google" button
 * here instead of running NextAuth locally, because Google's OAuth client
 * has only canonical staging registered as a valid redirect URI. This
 * route normalizes the slug-side ``return_to`` claim and hands control to
 * the canonical login page, which carries the encoded "where to bounce
 * back to" through Google OAuth as a relative ``callbackUrl``.
 *
 * Query parameters:
 *  - ``return_to``  Required. The slug-tagged origin that initiated the flow.
 *                   Must match the canonical Cloud Run preview pattern; any
 *                   other value is rejected outright (open-redirect guard).
 *  - ``provider``   Optional. ``google`` (default) or ``azure-ad``.
 *  - ``next``       Optional. Path on the slug to land on after the bounce
 *                   completes; passed through unchanged to ``preview-claim``.
 */

const ALLOWED_PROVIDERS = new Set(['google', 'azure-ad']);

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;

  const returnToOrigin = validatePreviewOrigin(searchParams.get('return_to'));
  if (!returnToOrigin) {
    return new NextResponse('Invalid or missing return_to', { status: 400 });
  }

  const provider = searchParams.get('provider') ?? 'google';
  if (!ALLOWED_PROVIDERS.has(provider)) {
    return new NextResponse('Unsupported provider', { status: 400 });
  }

  const next = searchParams.get('next') ?? '/assistants';

  // After OAuth completes on canonical, NextAuth's ``redirect`` callback
  // accepts only same-origin URLs, so the post-auth landing is a relative
  // path here. ``preview-redirect`` then mints the transfer token and
  // bounces the browser to ``return_to``.
  const callbackUrl = new URL('/api/auth/preview-redirect', request.url);
  callbackUrl.searchParams.set('return_to', returnToOrigin);
  callbackUrl.searchParams.set('next', next);

  // Drive the canonical login page, which already calls ``signIn(provider)``
  // with the right CSRF + cookie plumbing. ``previewSignIn`` tells the
  // page to skip the form and trigger the provider immediately.
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('previewSignIn', provider);
  loginUrl.searchParams.set('callbackUrl', callbackUrl.pathname + callbackUrl.search);

  return NextResponse.redirect(loginUrl);
}
