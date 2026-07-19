import crypto from 'crypto';
import { NextResponse } from 'next/server';
import type { NextFetchEvent } from 'next/server';
import { NextRequestWithAuth, withAuth } from 'next-auth/middleware';
import { getToken } from 'next-auth/jwt';
import authOptions from './app/api/auth/[...nextauth]/pages';
import { resolveAuthMode } from '@/lib/environment/environment';
import { mockSimulationEnabled } from '@/lib/simulation/config';

const ENFORCE_ACCOUNT_ONBOARDING = false;
const CONSOLE_SESSION_MARKER_COOKIE = 'unify_console_session';
const CONSOLE_SESSION_MARKER_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function requestPublicHostname(request: NextRequestWithAuth): string {
  const forwarded = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const fromHeaders = forwarded.split(',')[0]?.trim().toLowerCase().replace(/:\d+$/, '');
  if (fromHeaders) return fromHeaders;

  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim();
  if (nextAuthUrl) {
    try {
      return new URL(nextAuthUrl).hostname.toLowerCase();
    } catch {
      // Fall through to nextUrl.
    }
  }

  return request.nextUrl.hostname.toLowerCase();
}

function consoleSessionMarkerDomain(request: NextRequestWithAuth): string | undefined {
  const configured = process.env.LANDING_AUTH_COOKIE_DOMAIN?.trim();
  if (configured) return configured;

  const hostname = requestPublicHostname(request);
  // Shared with apex marketing hosts (unify.ai / staging.unify.ai). Prefer
  // Host / X-Forwarded-Host over nextUrl.hostname — behind Cloud Run the latter
  // is often the *.run.app service host, which would leave the marker host-only
  // on console and invisible to the landing page.
  if (hostname === 'console.unify.ai' || hostname.endsWith('.unify.ai')) {
    return '.unify.ai';
  }
  return undefined;
}

function withConsoleSessionMarker(
  response: NextResponse,
  request: NextRequestWithAuth,
  authenticated: boolean
) {
  const domain = consoleSessionMarkerDomain(request);
  response.cookies.set(CONSOLE_SESSION_MARKER_COOKIE, authenticated ? '1' : '', {
    ...(domain ? { domain } : {}),
    maxAge: authenticated ? CONSOLE_SESSION_MARKER_MAX_AGE_SECONDS : 0,
    path: '/',
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
  });
  return response;
}

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

  // Mock simulation mode: the mock identity is injected at the data boundary, so
  // NextAuth/JWT gating is bypassed entirely and every route renders the real
  // shell against fixtures. Reachable only when the build-time flag is on.
  if (mockSimulationEnabled()) {
    return NextResponse.next();
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
    return withConsoleSessionMarker(response, request, false);
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

  const response =
    ((await withAuth({ pages: authOptions.pages, secret: process.env.JWT_SECRET })(
      request,
      event
    )) as NextResponse | undefined) ?? NextResponse.next();
  return withConsoleSessionMarker(response, request, Boolean(token));
}

export const config = {
  matcher:
    '/((?!api|_next/static|_next/image|.*\\.(?:png|jpe?g|svg|gif|webp|ico|mp3|wav|ogg|m4a|json)$).*)',
};
