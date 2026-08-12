import crypto from 'crypto';
import { NextResponse } from 'next/server';
import type { NextFetchEvent } from 'next/server';
import { NextRequestWithAuth, withAuth } from 'next-auth/middleware';
import { getToken } from 'next-auth/jwt';
import authOptions from './app/api/auth/[...nextauth]/pages';
import { resolveAuthMode } from '@/lib/environment/environment';
import {
  MS_TEAMS_BOT_BIND_COOKIE,
  MS_TEAMS_BOT_BIND_COOKIE_MAX_AGE_SECONDS,
  MS_TEAMS_BOT_CONNECT_PATH,
} from '@/lib/ms-teams-bot/connectLink';
import { mockSimulationEnabled } from '@/lib/simulation/config';

const ENFORCE_ACCOUNT_ONBOARDING = true;
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

/**
 * Park a Microsoft Teams bind nonce so it survives the auth funnel.
 *
 * The bot's connect link is usually opened in a browser with no console session,
 * so the request is about to be bounced through sign-in — and possibly MFA and
 * account onboarding, whose redirects carry only the params they know about.
 * The nonce rides along out-of-band instead, and `/connect/ms-teams` clears the
 * cookie once it has claimed (or failed to claim) the install.
 */
function withPendingMsTeamsBind(
  response: NextResponse,
  request: NextRequestWithAuth,
  nonce: string | null
): NextResponse {
  if (!nonce) return response;

  response.cookies.set(MS_TEAMS_BOT_BIND_COOKIE, nonce, {
    httpOnly: true,
    maxAge: MS_TEAMS_BOT_BIND_COOKIE_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
  });
  return response;
}

/**
 * Whether this request should be diverted to the Teams connect handler to finish
 * a parked bind.
 *
 * Only plain page GETs qualify: diverting a server action POST, an RSC payload
 * fetch, or a prefetch would break the caller instead of completing the
 * handshake. Auth routes are excluded so the divert cannot land mid-sign-in.
 */
function shouldResumeMsTeamsBind(request: NextRequestWithAuth): boolean {
  if (request.method !== 'GET') return false;
  if (!request.cookies.get(MS_TEAMS_BOT_BIND_COOKIE)?.value) return false;
  if (request.headers.get('rsc') === '1') return false;
  if (request.headers.get('next-router-prefetch') === '1') return false;
  if (request.nextUrl.searchParams.has('_rsc')) return false;

  const { pathname } = request.nextUrl;
  if (pathname === MS_TEAMS_BOT_CONNECT_PATH) return false;
  return !['/login', '/auth', '/api', '/_next'].some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequestWithAuth, event: NextFetchEvent) {
  const { pathname, searchParams } = request.nextUrl;

  // Captured before any gate can redirect this request away from the connect
  // handler, and re-attached to whichever response we end up returning.
  const pendingMsTeamsBindNonce =
    pathname === MS_TEAMS_BOT_CONNECT_PATH ? searchParams.get('nonce') : null;

  // Allow public access to shareable/embed/auth helper pages (no auth required)
  if (
    pathname === '/auth/popup-start' ||
    pathname === '/auth/popup-complete' ||
    pathname.startsWith('/plot/view/') ||
    pathname.startsWith('/table/view/')
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
      return withPendingMsTeamsBind(
        NextResponse.redirect(mfaUrl),
        request,
        pendingMsTeamsBindNonce
      );
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
      return withPendingMsTeamsBind(
        NextResponse.redirect(onboardingUrl),
        request,
        pendingMsTeamsBindNonce
      );
    }
  }

  // Finish a parked Teams bind now that the session is past the MFA and
  // onboarding gates, returning the user to where they were headed. The handler
  // clears the cookie on every exit, so this diverts at most once per handshake.
  if (token && shouldResumeMsTeamsBind(request)) {
    // Clone `nextUrl` rather than resolving against `request.url`: it keeps the
    // origin the browser actually used, so the divert cannot bounce the user onto
    // the server's own bind address.
    const connectUrl = request.nextUrl.clone();
    connectUrl.search = '';
    connectUrl.searchParams.set('return', `${pathname}${request.nextUrl.search}`);
    connectUrl.pathname = MS_TEAMS_BOT_CONNECT_PATH;
    return NextResponse.redirect(connectUrl);
  }

  const response =
    ((await withAuth({ pages: authOptions.pages, secret: process.env.JWT_SECRET })(
      request,
      event
    )) as NextResponse | undefined) ?? NextResponse.next();
  return withPendingMsTeamsBind(
    withConsoleSessionMarker(response, request, Boolean(token)),
    request,
    pendingMsTeamsBindNonce
  );
}

export const config = {
  matcher:
    '/((?!api|_next/static|_next/image|.*\\.(?:png|jpe?g|svg|gif|webp|ico|mp3|wav|ogg|m4a|json)$).*)',
};
