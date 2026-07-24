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

import { NextRequest, NextResponse } from 'next/server';
import { verifySlackOAuthState } from '@/lib/slack/oauth-state';
import { exchangeSlackCode } from '@/lib/slack/exchange';
import { persistSlackInstall } from '@/lib/slack/install';
import { getCurrentUser } from '@/lib/user/user';
import type { SlackInstallOwner } from '@/types/slack/install';

function consoleUrl(): string {
  return (process.env.NEXT_PUBLIC_CONSOLE_URL ?? process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '');
}

/** The workspace cookie ``getCurrentUser`` reads to pick the active org. */
function ownerWorkspaceId(owner: SlackInstallOwner): string {
  return owner.kind === 'org' ? String(owner.orgId) : 'personal';
}

/**
 * Redirect back into the console. When ``workspaceId`` is supplied (i.e.
 * the OAuth state was verified and we know which owner the install
 * belongs to), the ``unify_workspace_id`` cookie is restored so the user
 * lands in the same workspace they started the install from. The
 * switcher writes this cookie ``SameSite=Strict``, so it is dropped on
 * the cross-site return leg from Slack and must be re-set here.
 */
function redirectWith(
  path: string,
  params: Record<string, string>,
  workspaceId?: string
): Response {
  const base = consoleUrl();
  const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const response = NextResponse.redirect(url.toString(), 302);
  if (workspaceId) {
    response.cookies.set('unify_workspace_id', workspaceId, {
      path: '/',
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });
  }
  return response;
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

  // Restore the workspace the install belongs to on every redirect past
  // state verification — the SameSite=Strict workspace cookie is dropped
  // on the cross-site return from Slack, so without this the user lands
  // back in their personal workspace even for an org install.
  const workspaceId = ownerWorkspaceId(payload.owner);

  const user = await getCurrentUser();
  if (!user) {
    return redirectWith('/login', { signout: 'true' });
  }
  if (String(user.id) !== payload.initiatorUserId) {
    return redirectWith(
      payload.redirectAfter,
      { slack_install_error: 'owner_mismatch' },
      workspaceId
    );
  }

  let installBody;
  try {
    installBody = await exchangeSlackCode({ code, owner: payload.owner });
    installBody.initiator_user_id = payload.initiatorUserId;
  } catch (e) {
    console.error('[slack/oauth/callback] token exchange failed:', e);
    return redirectWith(
      payload.redirectAfter,
      { slack_install_error: 'token_exchange_failed' },
      workspaceId
    );
  }

  const persistResult = await persistSlackInstall({ body: installBody });
  if ('detail' in persistResult) {
    console.error('[slack/oauth/callback] install persist failed:', persistResult);
    return redirectWith(
      payload.redirectAfter,
      { slack_install_error: 'persist_failed' },
      workspaceId
    );
  }

  return redirectWith(
    payload.redirectAfter,
    {
      slack_install: 'success',
      slack_team: installBody.slack_team_name ?? installBody.slack_team_id,
    },
    workspaceId
  );
}

/* eslint-enable @typescript-eslint/naming-convention */
