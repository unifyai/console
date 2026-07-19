/**
 * POST /api/integrations/oauth/start
 *
 * Begins an OAuth Authorization Code flow for the new generic
 * Integrations tab.  Distinct from the existing
 * ``/api/assistant/[id]/connect`` flow, which is the bespoke Google /
 * Microsoft email-linking path that ties into Gmail watches, BYOD email
 * contacts, etc.  This endpoint is the lightweight, registry-driven
 * variant for "app integrations" (Employment Hero, future Salesforce /
 * Slack, etc.).
 *
 * Body shape:
 *   {
 *     assistantId: string,
 *     providerId: 'employmenthero' | ...,
 *     redirectAfter?: string   // path within console to land on after callback
 *   }
 *
 * Returns ``{ authorizeUrl: string }``.  The caller (browser) does
 * ``window.location.href = authorizeUrl`` to begin the redirect dance.
 *
 * Side effects:
 *   - Reads the customer's CLIENT_ID for the provider from the
 *     assistant's secrets store.  Returns 400 with a hint if missing
 *     so the modal can display ``needs_credentials``.
 *   - Sets a short-lived signed cookie containing the state nonce.
 *     The matching per-provider callback verifies it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../_utils/auth';
import { getCurrentUser } from '@/lib/user/user';
import { getActiveOrganization } from '@/lib/user/workspace';
import { getSecrets, getSecretValue } from '@/lib/assistants/secret';
import { beginOAuthState } from '@/lib/oauth/state';
import {
  getIntegrationProvider,
  customerProvidedSecretKeysFor,
} from '@/constants/assistants/integrations';
import type { IntegrationProviderId } from '@/types/assistants/integration';

interface StartBody {
  assistantId: string;
  providerId: IntegrationProviderId;
  redirectAfter?: string;
}

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
  if (!body.assistantId || !body.providerId) {
    return badRequest('assistantId and providerId are required');
  }

  const provider = getIntegrationProvider(body.providerId);
  if (!provider) {
    return badRequest(`Unknown provider: ${body.providerId}`);
  }
  if (provider.auth.kind !== 'oauth_authorization_code') {
    return badRequest(
      `Provider ${body.providerId} does not support OAuth start (auth.kind=${provider.auth.kind}).`
    );
  }

  const consoleUrl = process.env.NEXT_PUBLIC_CONSOLE_URL ?? process.env.NEXTAUTH_URL ?? '';
  if (!consoleUrl) {
    return NextResponse.json(
      {
        error: 'Console URL is not configured',
        hint: 'Set NEXT_PUBLIC_CONSOLE_URL or NEXTAUTH_URL in the deployment env.',
      },
      { status: 500 }
    );
  }

  // Read the customer-provided OAuth client_id from the assistant's secrets.
  // We only need ``client_id`` here (it's a public identifier per the OAuth
  // spec).  ``client_secret`` is read server-side in the callback route, so
  // it never crosses the wire from this endpoint.
  const ownerId = String(user.id);
  const activeOrg = getActiveOrganization(user);
  const orgId = activeOrg?.id ?? null;

  const customerKeys = customerProvidedSecretKeysFor(provider);
  const clientIdKey = customerKeys[0];
  const list = await getSecrets(body.assistantId, ownerId);
  if (!Array.isArray(list)) {
    return NextResponse.json(
      { error: list.detail ?? 'Failed to read assistant secrets.' },
      { status: 502 }
    );
  }
  const clientIdSecret = list.find((s) => s.name === clientIdKey);
  if (!clientIdSecret) {
    return NextResponse.json(
      {
        error: 'missing_client_id',
        missing_secrets: customerKeys.filter((k) => !list.some((s) => s.name === k)),
        hint: `Add ${customerKeys.join(' and ')} to Settings → Secrets first, then click Connect.`,
      },
      { status: 400 }
    );
  }

  // Read the actual client_id value via the shared ``getSecretValue``
  // helper (filter lookup against the assistant's Secrets context).
  // client_id is a public OAuth identifier per the spec, so embedding it
  // in the authorize URL is expected — but we still keep this read
  // server-side to avoid round-tripping it through the browser
  // unnecessarily.
  const clientIdValue = await getSecretValue(body.assistantId, ownerId, clientIdKey);
  if (!clientIdValue) {
    return NextResponse.json(
      {
        error: 'client_id_value_unreadable',
        hint: 'The client_id secret exists but could not be read. Try removing and re-adding it.',
      },
      { status: 502 }
    );
  }

  // Sign state + set cookie.
  const stateToken = await beginOAuthState({
    assistantId: body.assistantId,
    ownerId,
    providerId: body.providerId,
    redirectAfter: body.redirectAfter ?? `/assistants/${body.assistantId}`,
  });

  const redirectUri = `${consoleUrl}/oauth/${body.providerId}/callback`;
  /* OAuth-spec wire format requires snake_case parameter names. */
  /* eslint-disable @typescript-eslint/naming-convention */
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientIdValue,
    redirect_uri: redirectUri,
    state: stateToken,
  });
  /* eslint-enable @typescript-eslint/naming-convention */
  // Append ``scope`` for providers that require it on the authorize URL.
  // EH binds scopes at app-registration time and doesn't need this; Webex
  // does.  See ``IntegrationAuthStrategy.oauth.scope`` for context.
  if (provider.auth.oauth.scope) {
    params.set('scope', provider.auth.oauth.scope);
  }

  return NextResponse.json({
    authorizeUrl: `${provider.auth.oauth.authorizeUrl}?${params.toString()}`,
  });
}
