/**
 * Microsoft Teams bot connect-link handler.
 *
 * Claims the pending tenant install carried by the bot's welcome DM and returns
 * the user to the page they were headed for. Binding server-side — before any
 * page renders — is what makes the handshake reliable: the click routinely
 * arrives unauthenticated, so it funnels through sign-in (and possibly MFA and
 * account onboarding) first, and a client-side consumer only ever sees whatever
 * of the URL survived those hops.
 *
 * The nonce comes from the query on a direct hit, or from the cookie the
 * middleware parked when the request was bounced into the auth funnel. The
 * cookie is cleared on every exit so one failed handshake cannot divert
 * subsequent page loads.
 */

import { NextResponse, type NextRequest } from 'next/server';

import {
  MS_TEAMS_BOT_BIND_COOKIE,
  MS_TEAMS_BOT_CONNECTED_PARAM,
  MS_TEAMS_BOT_CONNECT_ERROR_PARAM,
  MS_TEAMS_BOT_CONNECT_PATH,
  msTeamsBotConnectErrorCode,
  safeConnectReturnPath,
  type MsTeamsBotConnectErrorCode,
} from '@/lib/ms-teams-bot/connectLink';
import { bindInstallAction, resolveMsTeamsBotInstallOwner } from '@/lib/ms-teams-bot/install';
import { getCurrentUser } from '@/lib/user/user';
import { isMsTeamsBotInstall } from '@/types/ms-teams-bot/install';

export const dynamic = 'force-dynamic';

type Outcome = 'connected' | MsTeamsBotConnectErrorCode | null;

/** Base for parsing a same-origin path; never reaches the response. */
const PATH_PARSE_BASE = 'http://console.invalid';

/**
 * Redirect to a same-origin path.
 *
 * The ``Location`` stays *relative* on purpose. A route handler's ``request.url``
 * carries the origin the server is bound to rather than the one the browser
 * used — ``0.0.0.0`` under ``next dev -H 0.0.0.0``, and the internal service
 * origin behind Cloud Run's proxy — so resolving an absolute target against it
 * sends the user to a host they cannot reach. Browsers resolve a relative
 * ``Location`` against the request URL, which is always the right origin.
 */
function redirectToPath(path: string): NextResponse {
  return new NextResponse(null, { status: 307, headers: { location: path } });
}

/** Return to ``returnPath`` with the outcome, dropping the parked nonce. */
function settle(request: NextRequest, returnPath: string, outcome: Outcome): NextResponse {
  const target = new URL(returnPath, PATH_PARSE_BASE);
  if (outcome === 'connected') {
    target.searchParams.set(MS_TEAMS_BOT_CONNECTED_PARAM, '1');
  } else if (outcome) {
    target.searchParams.set(MS_TEAMS_BOT_CONNECT_ERROR_PARAM, outcome);
  }

  const response = redirectToPath(`${target.pathname}${target.search}`);
  response.cookies.set(MS_TEAMS_BOT_BIND_COOKIE, '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
  });
  return response;
}

export async function GET(request: NextRequest) {
  const returnPath = safeConnectReturnPath(request.nextUrl.searchParams.get('return'));
  const nonce =
    request.nextUrl.searchParams.get('nonce')?.trim() ||
    request.cookies.get(MS_TEAMS_BOT_BIND_COOKIE)?.value?.trim() ||
    '';

  if (!nonce) {
    return settle(request, returnPath, null);
  }

  const user = await getCurrentUser();
  if (!user) {
    // The middleware normally bounces unauthenticated callers to sign-in first;
    // this covers the identity failing to resolve on this request. Keep the
    // parked nonce so the retry after sign-in still has it.
    const loginUrl = new URL('/login', PATH_PARSE_BASE);
    loginUrl.searchParams.set(
      'callbackUrl',
      `${MS_TEAMS_BOT_CONNECT_PATH}?nonce=${encodeURIComponent(nonce)}`
    );
    return redirectToPath(`${loginUrl.pathname}${loginUrl.search}`);
  }

  const result = await bindInstallAction(resolveMsTeamsBotInstallOwner(user), nonce);
  if (isMsTeamsBotInstall(result)) {
    return settle(request, returnPath, 'connected');
  }

  console.error('[ms-teams-bot] connect-link bind failed:', result);
  return settle(request, returnPath, msTeamsBotConnectErrorCode(result.status));
}
