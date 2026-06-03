/**
 * POST /api/slack/oauth/start
 *
 * Kick off the Slack workspace OAuth install flow for the caller's
 * active workspace (an organization they own, or their personal
 * account).
 *
 * Body shape::
 *
 *   {
 *     owner: { kind: "org", orgId } | { kind: "user", userId },
 *     redirectAfter?: string,   // path within console to land on
 *                                 // after the callback completes
 *   }
 *
 * Returns ``{ authorizeUrl: string }``. The browser does
 * ``window.location.assign(authorizeUrl)`` to begin the redirect
 * dance.
 *
 * Side effects:
 *   - Verifies the session user owns the target org.
 *   - Signs a short-lived state JWT carrying ``{ orgId, ownerId,
 *     redirectAfter, nonce }`` and sets the matching HTTP-only
 *     ``slack_oauth_state`` cookie; the callback route enforces both.
 *
 * Unlike the assistant-Integrations OAuth flow, Slack uses a single
 * platform app (Unify-owned), so no customer-provided ``CLIENT_ID``
 * is consulted — the client id is an env var on Console.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../_utils/auth';
import { getCurrentUser } from '@/lib/user/user';
import { beginSlackOAuthState } from '@/lib/slack/oauth-state';
import { buildSlackAuthorizeUrl } from '@/lib/slack/exchange';
import { canManageOrgSlackInstall } from '@/lib/slack/install';
import type { SlackInstallOwner } from '@/types/slack/install';

interface StartBody {
  owner: SlackInstallOwner;
  redirectAfter?: string;
}

const DEFAULT_REDIRECT = '/assistants';

export async function POST(request: NextRequest) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  const user = await getCurrentUser();
  if (!user) return unauthorized();

  let body: StartBody;
  try {
    body = (await request.json()) as StartBody;
  } catch {
    return badRequest('Invalid JSON body');
  }
  const owner = body.owner;
  if (!owner || (owner.kind !== 'org' && owner.kind !== 'user')) {
    return badRequest('owner ({ kind: "org", orgId } | { kind: "user", userId }) is required');
  }

  // Owner gate. Org installs require an org owner or admin; personal
  // installs require the user to be themselves. Re-enforced server-side
  // by the install/revoke server actions; checking here too means a
  // non-manager gets a clean 403 instead of being sent into the Slack
  // consent screen only to fail on persist.
  if (owner.kind === 'org') {
    const org = user.organizations?.find((o) => o.id === owner.orgId);
    if (!org) {
      return NextResponse.json({ detail: 'Organization not found.' }, { status: 404 });
    }
    if (!canManageOrgSlackInstall(org)) {
      return NextResponse.json(
        {
          detail:
            'You must be an organization owner or admin to install a Slack workspace for this organization.',
        },
        { status: 403 }
      );
    }
  } else if (String(user.id) !== owner.userId) {
    return NextResponse.json(
      { detail: 'You can only install a Slack workspace for your own account.' },
      { status: 403 }
    );
  }

  let stateToken: string;
  try {
    stateToken = await beginSlackOAuthState({
      owner,
      initiatorUserId: String(user.id),
      redirectAfter: body.redirectAfter ?? DEFAULT_REDIRECT,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Failed to sign Slack OAuth state.';
    return NextResponse.json({ detail }, { status: 500 });
  }

  let authorizeUrl: string;
  try {
    authorizeUrl = buildSlackAuthorizeUrl(stateToken);
  } catch (e) {
    const detail =
      e instanceof Error ? e.message : 'Slack OAuth is not configured on this deployment.';
    return NextResponse.json({ detail }, { status: 500 });
  }

  return NextResponse.json({ authorizeUrl });
}
