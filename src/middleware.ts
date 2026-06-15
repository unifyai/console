import crypto from 'crypto';
import { NextResponse } from 'next/server';
import type { NextFetchEvent } from 'next/server';
import { NextRequestWithAuth, withAuth } from 'next-auth/middleware';
import { getToken } from 'next-auth/jwt';
import authOptions from './app/api/auth/[...nextauth]/pages';
import { resolveAuthMode } from '@/lib/environment/environment';

const ENFORCE_ACCOUNT_ONBOARDING = false;

/**
 * Carry a credit-grant `?token=` param through internal redirects
 * (onboarding, MFA) so it survives until the Assistants page renders.
 */
function preserveCreditToken(source: URLSearchParams, target: URL): void {
  const creditToken = source.get('token');
  if (creditToken) {
    target.searchParams.set('token', creditToken);
  }
}

/**
 * Carry a `?ref=` referral code through internal redirects (onboarding, MFA)
 * so it survives until an authenticated page can attribute it.
 */
function preserveReferralCode(source: URLSearchParams, target: URL): void {
  const referralCode = source.get('ref');
  if (referralCode) {
    target.searchParams.set('ref', referralCode);
  }
}

export async function middleware(request: NextRequestWithAuth, event: NextFetchEvent) {
  const { pathname, searchParams } = request.nextUrl;

  // Allow public access to shareable/embed/auth helper pages (no auth required)
  if (
    pathname === '/auth/popup-start' ||
    pathname === '/auth/popup-complete' ||
    pathname.startsWith('/plot/view/') ||
    pathname.startsWith('/table/view/') ||
    pathname.startsWith('/tile/view/') ||
    pathname.startsWith('/dashboard/view/')
  ) {
    return NextResponse.next();
  }

  // Default to "Assistants" project when visiting /interfaces with no project specified
  // This runs BEFORE the server component, avoiding a double-render
  if (pathname === '/interfaces') {
    const hasProject = searchParams.has('project');
    const selectProject = searchParams.get('selectProject');
    const selectInterface = searchParams.get('selectInterface');

    // Only redirect if:
    // - No project is specified
    // - User isn't explicitly choosing a project (selectProject=true)
    // - User isn't on interface selection screen
    if (!hasProject && selectProject !== 'true' && selectInterface !== 'true') {
      const url = request.nextUrl.clone();
      url.searchParams.set('project', 'Assistants');
      return NextResponse.redirect(url);
    }
  }

  // External-auth deployments (legacy ON_PREM) inject identity upstream, so
  // NextAuth is bypassed here. Guard against this ever being enabled in cloud.
  if (resolveAuthMode() === 'external') {
    if (process.env.NEXT_PUBLIC_APP_URL?.includes('unify.ai')) {
      console.error('External auth mode (AUTH_MODE/ON_PREM) must not be set in cloud deployments');
      return new Response('Misconfiguration detected', { status: 500 });
    }
    return NextResponse.next();
  }

  if (request.url.includes('/user')) {
    const providedKey = request.headers.get('ADMIN_KEY');
    const expectedKey = process.env.ADMIN_KEY;
    if (!expectedKey || !providedKey) {
      return new Response('Unauthorized', { status: 403 });
    }
    const expectedBuf = Buffer.from(expectedKey);
    const providedBuf = Buffer.from(providedKey);
    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      return new Response('Unauthorized', { status: 403 });
    }
  }

  // MFA-pending check: redirect to /login/mfa when the JWT has mfaPending=true.
  // Allow /login/mfa itself, /login/invite (so users can accept invites
  // before verifying MFA), NextAuth API routes, and static assets.
  const token = await getToken({ req: request, secret: process.env.JWT_SECRET });

  // Restricted-environment kill-switch: if the auth callbacks have flagged
  // this token as no-longer-allowed (non-Unify email on a gated env), clear
  // the session cookie and bounce the user to /login. This forcibly signs
  // out anyone who held a valid session before the gate was enabled.
  if ((token as { restrictedSignOut?: boolean } | null)?.restrictedSignOut) {
    const useSecureCookies = request.nextUrl.protocol === 'https:';
    const cookieName = useSecureCookies
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token';

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'StagingRestricted');
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(cookieName, '', { path: '/', maxAge: 0 });
    return response;
  }

  if (token?.mfaPending) {
    // Allow the login page itself so users with stale sessions (e.g. DB reset)
    // can sign in again instead of being trapped in a redirect loop.
    const mfaAllowed = ['/login', '/api/auth', '/_next'];
    const isAllowed = mfaAllowed.some((prefix) => pathname.startsWith(prefix));
    if (!isAllowed) {
      const mfaUrl = new URL('/login/mfa', request.url);
      preserveCreditToken(searchParams, mfaUrl);
      preserveReferralCode(searchParams, mfaUrl);
      return NextResponse.redirect(mfaUrl);
    }
  }

  // Onboarding check: redirect new users to the onboarding flow.
  // This runs AFTER the MFA check (security-first) and only when the user
  // doesn't have mfaPending (which takes priority).
  if (
    ENFORCE_ACCOUNT_ONBOARDING &&
    token?.onboardingStep &&
    token.onboardingStep !== 'completed' &&
    !token?.mfaPending
  ) {
    const onboardingAllowed = ['/login', '/api/auth', '/_next'];
    const isAllowed = onboardingAllowed.some((prefix) => pathname.startsWith(prefix));
    if (!isAllowed) {
      const onboardingUrl = new URL('/login/onboarding', request.url);
      preserveCreditToken(searchParams, onboardingUrl);
      preserveReferralCode(searchParams, onboardingUrl);
      return NextResponse.redirect(onboardingUrl);
    }
  }

  return withAuth({ pages: authOptions.pages, secret: process.env.JWT_SECRET })(request, event);
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|.*\\.png$|.*\\.jpe?g$|.*\\.svg$).*)',
};
