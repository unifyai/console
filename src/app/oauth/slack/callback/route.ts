/**
 * GET /oauth/slack/callback
 *
 * Slack redirects here after the user approves the app on
 * ``slack.com/oauth/v2/authorize``. Exchanges the ``code`` for a bot
 * token, persists the install row in Orchestra, and redirects the
 * user back to ``redirectAfter`` with a ``slack_install`` query flag
 * the hook can consume to show a toast.
 *
 * Errors at every step short-circuit with a single
 * ``slack_install_error=<reason>`` query param so the UI can surface
 * a generic failure (we never display Slack's raw error strings to
 * the user — see ``code-conventions.mdc``).
 */

import { NextRequest } from 'next/server';
import { verifySlackOAuthState } from '@/lib/slack/oauth-state';
import { exchangeSlackCode } from '@/lib/slack/exchange';
import { persistSlackInstall } from '@/lib/slack/install';
import { getCurrentUser } from '@/lib/user/user';

function consoleUrl(): string {
  return (process.env.NEXT_PUBLIC_CONSOLE_URL ?? process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '');
}

function redirectWith(path: string, params: Record<string, string>): Response {
  const base = consoleUrl();
  const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return Response.redirect(url.toString(), 302);
}

/* The callback emits snake_case query params (``slack_install``,
 * ``slack_install_error``, ``slack_team``) so the URL reads naturally
 * and matches the conventions used elsewhere for redirect flags
 * (e.g. ``integration_success``). The matching consumer is
 * ``useSlackCallbackFlash``. */
/* eslint-disable @typescript-eslint/naming-convention */

const FALLBACK_REDIRECT = '/assistants';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateToken = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  if (errorParam) {
    // User cancelled at the Slack consent screen or Slack rejected
    // the request. Without a verified state we don't know which org
    // to send them back to — land on the org index.
    return redirectWith(FALLBACK_REDIRECT, { slack_install_error: errorParam });
  }
  if (!code || !stateToken) {
    return redirectWith(FALLBACK_REDIRECT, { slack_install_error: 'missing_params' });
  }

  let payload;
  try {
    payload = await verifySlackOAuthState(stateToken);
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'state_invalid';
    return redirectWith(FALLBACK_REDIRECT, { slack_install_error: reason });
  }

  const user = await getCurrentUser();
  if (!user) {
    return redirectWith('/login', { signout: 'true' });
  }
  if (String(user.id) !== payload.initiatorUserId) {
    return redirectWith(payload.redirectAfter, { slack_install_error: 'owner_mismatch' });
  }

  let installBody;
  try {
    installBody = await exchangeSlackCode({ code, owner: payload.owner });
  } catch (e) {
    console.error('[slack/oauth/callback] token exchange failed:', e);
    return redirectWith(payload.redirectAfter, {
      slack_install_error: 'token_exchange_failed',
    });
  }

  const persistResult = await persistSlackInstall({ body: installBody });
  if ('detail' in persistResult) {
    console.error('[slack/oauth/callback] install persist failed:', persistResult);
    return redirectWith(payload.redirectAfter, { slack_install_error: 'persist_failed' });
  }

  return redirectWith(payload.redirectAfter, {
    slack_install: 'success',
    slack_team: installBody.slack_team_name ?? installBody.slack_team_id,
  });
}

/* eslint-enable @typescript-eslint/naming-convention */
