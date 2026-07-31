/**
 * Contract for the Microsoft Teams bot one-click connect link.
 *
 * The bot's welcome DM sends the installer to
 * ``<console>/connect/ms-teams?nonce=<bind nonce>``, and a server route handler
 * claims the pending install before any page renders. The nonce is *not* read by
 * the assistants surface: that click usually arrives in a browser with no
 * console session, so the request funnels through ``/login`` and possibly
 * ``/login/mfa`` / ``/login/onboarding`` first, and those hops rewrite the URL.
 *
 * The middleware therefore parks the nonce in a short-lived cookie on the way in
 * and diverts the first usable page GET back to the handler, so the handshake
 * does not depend on a query param surviving the whole auth funnel. The handler
 * reports the outcome to the UI with the flash params below.
 */

export const MS_TEAMS_BOT_CONNECT_PATH = '/connect/ms-teams';

export const MS_TEAMS_BOT_BIND_COOKIE = 'unify_ms_teams_bind';

/**
 * Long enough to cover a cold signup (sign-in, MFA enrolment, and account
 * onboarding) and short enough that an abandoned handshake expires rather than
 * firing against a later, unrelated session.
 */
export const MS_TEAMS_BOT_BIND_COOKIE_MAX_AGE_SECONDS = 30 * 60;

/** Flash params the handler appends to the page it returns the user to. */
export const MS_TEAMS_BOT_CONNECTED_PARAM = 'ms_teams_connected';
export const MS_TEAMS_BOT_CONNECT_ERROR_PARAM = 'ms_teams_connect_error';

export type MsTeamsBotConnectErrorCode = 'expired_code' | 'not_permitted' | 'bind_failed';

const DEFAULT_RETURN_PATH = '/assistants';

/**
 * The same-origin ``pathname + search`` the handler should return the user to.
 *
 * Falls back to the assistants surface for anything absolute, protocol-relative,
 * unparseable, or pointing back at the handler itself (which would loop). Stale
 * flash params are dropped so an outcome is never reported twice.
 */
export function safeConnectReturnPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return DEFAULT_RETURN_PATH;

  let parsed: URL;
  try {
    parsed = new URL(raw, 'http://console.invalid');
  } catch {
    return DEFAULT_RETURN_PATH;
  }

  if (parsed.pathname === MS_TEAMS_BOT_CONNECT_PATH) return DEFAULT_RETURN_PATH;

  parsed.searchParams.delete(MS_TEAMS_BOT_CONNECTED_PARAM);
  parsed.searchParams.delete(MS_TEAMS_BOT_CONNECT_ERROR_PARAM);
  const search = parsed.searchParams.toString();
  return search ? `${parsed.pathname}?${search}` : parsed.pathname;
}

/** Map a failed bind's HTTP status onto the flash code the UI explains. */
export function msTeamsBotConnectErrorCode(status: number | undefined): MsTeamsBotConnectErrorCode {
  if (status === 404) return 'expired_code';
  if (status === 401 || status === 403) return 'not_permitted';
  return 'bind_failed';
}

/** User-facing explanation for a connect-link failure. */
export function msTeamsBotConnectErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case 'expired_code':
      return 'That Microsoft Teams connect link is no longer valid. Re-add the app in Teams to get a fresh one.';
    case 'not_permitted':
      return 'You must be an organization owner or admin to connect Microsoft Teams for this workspace.';
    default:
      return 'Could not connect Microsoft Teams. Please try again.';
  }
}
