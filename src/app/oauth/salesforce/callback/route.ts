/**
 * GET /oauth/salesforce/callback
 *
 * Handles the redirect Salesforce sends after the user grants consent.
 * Verifies the state nonce against the cookie set by
 * ``/api/integrations/oauth/start``, then exchanges the code for tokens
 * server-side using the customer's CLIENT_SECRET (read from the
 * assistant's secrets — never crosses the wire to the browser), and
 * writes ``SALESFORCE_REFRESH_TOKEN`` + ``SALESFORCE_INSTANCE_URL`` back
 * to the assistant.
 *
 * Mirrors ``src/app/oauth/webex/callback/route.ts``.  The only
 * Salesforce-specific bits are:
 *   - the additional ``instance_url`` persisted alongside the refresh
 *     token (per-org API host returned by Salesforce in the token
 *     response — required because REST traffic post-auth uses it as the
 *     base, not ``login.salesforce.com``); and
 *   - whitespace-trim on every persisted value.  The unity-deploy
 *     ``_client.py`` resolver already ``.strip()``s defensively, but we
 *     trim on the way in too so the stored values stay clean and don't
 *     rely on the runtime safety net.
 *
 * Production-only: the OAuth host is ``login.salesforce.com``.  Sandbox
 * connections will fail at the authorize step before reaching this
 * callback.
 */

import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/user/user';
import { getActiveOrganization } from '@/lib/user/workspace';
import { createSecret, deleteSecret, getSecrets } from '@/lib/assistants/secret';
import { verifyOAuthState } from '@/lib/oauth/state';
import { exchangeSalesforceCode, fetchSalesforceAccountInfo } from '@/lib/integrations/salesforce';
import {
  getIntegrationProvider,
  customerProvidedSecretKeysFor,
} from '@/constants/assistants/integrations';

const PROVIDER_ID = 'salesforce' as const;

export async function GET(request: NextRequest) {
  const consoleUrl = process.env.NEXT_PUBLIC_CONSOLE_URL ?? process.env.NEXTAUTH_URL ?? '';

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateToken = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  // Salesforce-side error short-circuit: redirect with the error code.
  // We don't know the assistantId without a verified state, so land on
  // the assistants index — the user will see the failure and re-open the
  // modal.
  if (errorParam) {
    return Response.redirect(
      `${consoleUrl}/assistants?integration_error=${encodeURIComponent(errorParam)}`,
      302
    );
  }
  if (!code || !stateToken) {
    return Response.redirect(`${consoleUrl}/assistants?integration_error=missing_params`, 302);
  }

  // 1. Verify state.
  let payload;
  try {
    payload = await verifyOAuthState(stateToken);
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'state_invalid';
    return Response.redirect(
      `${consoleUrl}/assistants?integration_error=${encodeURIComponent(reason)}`,
      302
    );
  }
  if (payload.providerId !== PROVIDER_ID) {
    return Response.redirect(
      `${consoleUrl}${payload.redirectAfter}?integration_error=provider_mismatch`,
      302
    );
  }

  // 2. Resolve user / api key / org for the secrets read+write.
  const user = await getCurrentUser();
  if (!user) {
    return Response.redirect(`${consoleUrl}/login?signout=true`, 302);
  }
  if (String(user.id) !== payload.ownerId) {
    return Response.redirect(
      `${consoleUrl}${payload.redirectAfter}?integration_error=owner_mismatch`,
      302
    );
  }
  const apiKey = user.apiKey;
  const activeOrg = getActiveOrganization(user);
  const orgId = activeOrg?.id ?? null;
  const orgName = activeOrg?.name ?? null;

  // 3. Read CLIENT_ID + CLIENT_SECRET from the assistant's secrets.
  const provider = getIntegrationProvider(PROVIDER_ID);
  if (!provider || provider.auth.kind !== 'oauth_authorization_code') {
    return Response.redirect(
      `${consoleUrl}${payload.redirectAfter}?integration_error=provider_misconfigured`,
      302
    );
  }
  const customerKeys = customerProvidedSecretKeysFor(provider);
  const [clientIdKey, clientSecretKey] = customerKeys;

  const getSecretsFn = await getSecrets(apiKey, orgId);
  const list = await getSecretsFn(payload.assistantId, payload.ownerId);
  if (!Array.isArray(list)) {
    return Response.redirect(
      `${consoleUrl}${payload.redirectAfter}?integration_error=secrets_unreadable`,
      302
    );
  }
  const clientIdSecret = list.find((s) => s.name === clientIdKey);
  const clientSecretSecret = list.find((s) => s.name === clientSecretKey);
  if (!clientIdSecret || !clientSecretSecret) {
    return Response.redirect(
      `${consoleUrl}${payload.redirectAfter}?integration_error=missing_credentials`,
      302
    );
  }

  const [clientId, clientSecret] = await Promise.all([
    readSecretValue({
      apiKey,
      ownerId: payload.ownerId,
      assistantId: payload.assistantId,
      secretName: clientIdKey,
    }),
    readSecretValue({
      apiKey,
      ownerId: payload.ownerId,
      assistantId: payload.assistantId,
      secretName: clientSecretKey,
    }),
  ]);
  if (!clientId || !clientSecret) {
    return Response.redirect(
      `${consoleUrl}${payload.redirectAfter}?integration_error=credentials_unreadable`,
      302
    );
  }

  // 4. Exchange code for tokens.
  const redirectUri = `${consoleUrl}/oauth/${PROVIDER_ID}/callback`;
  let tokens;
  try {
    tokens = await exchangeSalesforceCode({
      clientId,
      clientSecret,
      code,
      redirectUri,
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message.slice(0, 200) : 'token_exchange_failed';
    return Response.redirect(
      `${consoleUrl}${payload.redirectAfter}?integration_error=${encodeURIComponent(reason)}`,
      302
    );
  }

  // 5. Best-effort identity probe.  Failures here are non-fatal — we
  //    still write the refresh token because the runtime will surface
  //    any real auth issue on first use.  Salesforce's userinfo
  //    endpoint is reachable with the basic ``id`` / ``api`` scope, so
  //    this rarely fails when the token exchange itself succeeded.
  try {
    await fetchSalesforceAccountInfo({ accessToken: tokens.access_token });
  } catch {
    // Swallow: connected app may have an unusual scope policy.
  }

  // 6. Write OAuth-managed secrets.  Delete any existing managed values
  //    first so re-Connect after a previous Disconnect/expiry replaces
  //    cleanly.
  //
  //    Trim every value before persisting.  Salesforce's response is
  //    unlikely to contain whitespace, but values can pick up trailing
  //    ``\n`` / spaces during the Console -> /Secrets context -> .env
  //    round-trip; the runtime ``.strip()``s defensively but we keep the
  //    stored values clean too.
  const managedKeys = provider.auth.oauth.managedSecretKeys;
  const existingManagedSecrets = list.filter((s) => managedKeys.includes(s.name));

  const deleteSecretFn = await deleteSecret(apiKey, orgId);
  for (const s of existingManagedSecrets) {
    await deleteSecretFn(s.logId, payload.ownerId, payload.assistantId).catch(() => undefined);
  }

  const createSecretFn = await createSecret(apiKey, orgId, orgName);
  const writes: Array<{ name: string; value: string }> = [
    { name: 'SALESFORCE_REFRESH_TOKEN', value: tokens.refresh_token.trim() },
    { name: 'SALESFORCE_INSTANCE_URL', value: tokens.instance_url.trim() },
  ];

  for (const { name, value } of writes) {
    if (!value) {
      return Response.redirect(
        `${consoleUrl}${payload.redirectAfter}?integration_error=write_empty:${encodeURIComponent(name)}`,
        302
      );
    }
    const result = await createSecretFn(payload.assistantId, payload.ownerId, {
      name,
      value,
    });
    if ('detail' in result && result.detail) {
      return Response.redirect(
        `${consoleUrl}${payload.redirectAfter}?integration_error=write_failed:${encodeURIComponent(name)}`,
        302
      );
    }
  }

  // 7. Done — redirect with success flag.
  const successUrl = new URL(`${consoleUrl}${payload.redirectAfter}`);
  successUrl.searchParams.set('integration_success', PROVIDER_ID);
  return Response.redirect(successUrl.toString(), 302);
}

/**
 * See ``src/app/api/integrations/oauth/start/route.ts`` for the
 * background on why this uses ``filterExpr=name == "..."`` instead of
 * a logId lookup.
 */
async function readSecretValue(args: {
  apiKey: string;
  ownerId: string;
  assistantId: string;
  secretName: string;
}): Promise<string | null> {
  const escapedName = args.secretName.replace(/"/g, '\\"');
  const params = new URLSearchParams({
    projectName: 'Assistants',
    context: `${args.ownerId}/${args.assistantId}/Secrets`,
    filterExpr: `name == "${escapedName}"`,
    limit: '1',
  });
  const url = `${process.env.NEXTAUTH_URL}/api/logs?${params.toString()}`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { apiKey: args.apiKey },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      logs?: Array<{ entries?: { name?: string; value?: string } }>;
    };
    const log = data.logs?.find((l) => l.entries?.name === args.secretName);
    return log?.entries?.value ?? null;
  } catch {
    return null;
  }
}
