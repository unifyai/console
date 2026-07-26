/**
 * Shared handler for ``GET /oauth/<providerId>/callback`` routes.
 *
 * Every provider's callback follows the same shape:
 *
 *   1. Short-circuit on a provider-side ``error=`` query param.
 *   2. Verify the state JWT + nonce cookie set by
 *      ``/api/integrations/oauth/start``.
 *   3. Resolve the current user, api key, and active org.
 *   4. Confirm ``CLIENT_ID`` + ``CLIENT_SECRET`` exist in the assistant's
 *      ``Secrets`` context, then read their values inline.
 *   5. Hand control to the provider-specific ``exchange`` hook to swap
 *      the auth code for tokens.
 *   6. (optional) Hand control to a provider-specific ``postExchange``
 *      hook for any extra REST calls — best-effort identity probes
 *      or further-derived secret writes (Employment Hero's active-org
 *      auto-pin).
 *   7. Delete every existing OAuth-managed secret in
 *      ``provider.auth.oauth.managedSecretKeys``, then write the new
 *      values (trimmed; empty-after-trim short-circuits as ``write_empty``).
 *   8. Redirect to ``payload.redirectAfter`` with ``integration_success=<providerId>``
 *      and an optional ``integration_notice`` from ``postExchange``.
 *
 * Provider-specific differences are confined to two hooks:
 *
 *   - ``exchange`` — provider-specific token endpoint call.  Returns
 *     ``{ accessToken, secretWrites }`` where ``secretWrites`` maps
 *     managed secret keys to the values returned by the token endpoint
 *     (EH returns ``{ EMPLOYMENTHERO_REFRESH_TOKEN: ... }``).
 *   - ``postExchange`` (optional) — runs after a successful exchange
 *     with the full callback context.  May contribute additional
 *     ``extraWrites`` (e.g. EH's ``EMPLOYMENTHERO_ORGANISATION_ID``
 *     derived from a separate ``/organisations`` enumeration), set a
 *     human-readable ``notice`` for the success toast, or short-circuit
 *     with ``abortReason`` to fail the flow before any secrets are
 *     written.
 *
 * Writes are filtered to ``provider.auth.oauth.managedSecretKeys`` so a
 * provider hook that hands back an unrecognised key is silently ignored
 * — the registry stays the single source of truth for which keys the
 * OAuth flow owns.
 */

import { NextRequest } from 'next/server';
import { createSecret, deleteSecret, getSecrets, getSecretValue } from '@/lib/assistants/secret';
import { verifyOAuthState } from '@/lib/oauth/state';
import { getCurrentUser } from '@/lib/user/user';
import { getActiveOrganization } from '@/lib/user/workspace';
import {
  customerProvidedSecretKeysFor,
  getIntegrationProvider,
} from '@/constants/assistants/integrations';
import type { IntegrationProviderId } from '@/types/assistants/integration';
import type { Secret } from '@/types/assistants/secret';

export interface OAuthExchangeArgs {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}

export interface OAuthExchangeResult {
  /** Access token from the token endpoint — passed through to
   *  ``postExchange`` for identity probes or further enumeration.  Not
   *  persisted (the runtime uses the refresh token to mint fresh access
   *  tokens on demand). */
  accessToken: string;
  /** Map of managed secret keys to values returned by the token endpoint.
   *  Must include the provider's refresh token.  Any key not declared in
   *  ``provider.auth.oauth.managedSecretKeys`` is filtered out before
   *  writing. */
  secretWrites: Record<string, string>;
}

export interface OAuthCallbackContext {
  apiKey: string;
  ownerId: string;
  assistantId: string;
  orgId: number | null;
  orgName: string | null;
  /** Snapshot of the assistant's secrets list at callback time — handed
   *  to the hook so it can inspect customer-provided fields without
   *  re-fetching. */
  list: Secret[];
  accessToken: string;
}

export interface OAuthPostExchangeResult {
  /** Extra secret writes derived from post-exchange REST calls.  Filtered
   *  to ``managedSecretKeys`` before writing. */
  extraWrites?: Record<string, string>;
  /** Optional human-readable notice surfaced in the success toast via the
   *  ``integration_notice`` query param. */
  notice?: string;
  /** When set, the callback aborts before writing any secrets and
   *  redirects with ``integration_error=<abortReason>``. */
  abortReason?: string;
}

export interface OAuthCallbackHooks {
  exchange: (args: OAuthExchangeArgs) => Promise<OAuthExchangeResult>;
  postExchange?: (ctx: OAuthCallbackContext) => Promise<OAuthPostExchangeResult>;
}

export async function handleOAuthCallback(args: {
  providerId: IntegrationProviderId;
  request: NextRequest;
  hooks: OAuthCallbackHooks;
}): Promise<Response> {
  const { providerId, request, hooks } = args;
  const consoleUrl = process.env.NEXT_PUBLIC_CONSOLE_URL ?? process.env.NEXTAUTH_URL ?? '';

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateToken = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  // Provider-side error short-circuit: redirect with the error code.  We
  // don't know the assistantId without a verified state, so land on the
  // assistants index — the user will see the failure and re-open the
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
  if (payload.providerId !== providerId) {
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

  // 3. Resolve provider config + customer credential keys.
  const provider = getIntegrationProvider(providerId);
  if (!provider || provider.auth.kind !== 'oauth_authorization_code') {
    return Response.redirect(
      `${consoleUrl}${payload.redirectAfter}?integration_error=provider_misconfigured`,
      302
    );
  }
  const customerKeys = customerProvidedSecretKeysFor(provider);
  const [clientIdKey, clientSecretKey] = customerKeys;

  // 4. Read CLIENT_ID + CLIENT_SECRET from the assistant's secrets.
  const list = await getSecrets(payload.assistantId, payload.ownerId);
  if (!Array.isArray(list)) {
    return Response.redirect(
      `${consoleUrl}${payload.redirectAfter}?integration_error=secrets_unreadable`,
      302
    );
  }
  if (!list.some((s) => s.name === clientIdKey) || !list.some((s) => s.name === clientSecretKey)) {
    return Response.redirect(
      `${consoleUrl}${payload.redirectAfter}?integration_error=missing_credentials`,
      302
    );
  }

  const [clientId, clientSecret] = await Promise.all([
    getSecretValue(payload.assistantId, payload.ownerId, clientIdKey),
    getSecretValue(payload.assistantId, payload.ownerId, clientSecretKey),
  ]);
  if (!clientId || !clientSecret) {
    return Response.redirect(
      `${consoleUrl}${payload.redirectAfter}?integration_error=credentials_unreadable`,
      302
    );
  }

  // 5. Exchange code for tokens.
  const redirectUri = `${consoleUrl}/oauth/${providerId}/callback`;
  let exchangeResult: OAuthExchangeResult;
  try {
    exchangeResult = await hooks.exchange({ clientId, clientSecret, code, redirectUri });
  } catch (e) {
    const reason = e instanceof Error ? e.message.slice(0, 200) : 'token_exchange_failed';
    return Response.redirect(
      `${consoleUrl}${payload.redirectAfter}?integration_error=${encodeURIComponent(reason)}`,
      302
    );
  }

  // 6. Optional post-exchange hook (identity probes, org enumeration, ...).
  let notice: string | undefined;
  const writes: Record<string, string> = { ...exchangeResult.secretWrites };
  if (hooks.postExchange) {
    const postResult = await hooks.postExchange({
      apiKey,
      ownerId: payload.ownerId,
      assistantId: payload.assistantId,
      orgId,
      orgName,
      list,
      accessToken: exchangeResult.accessToken,
    });
    if (postResult.abortReason) {
      return Response.redirect(
        `${consoleUrl}${payload.redirectAfter}?integration_error=${encodeURIComponent(postResult.abortReason)}`,
        302
      );
    }
    notice = postResult.notice;
    if (postResult.extraWrites) {
      for (const [name, value] of Object.entries(postResult.extraWrites)) {
        writes[name] = value;
      }
    }
  }

  // 7. Delete every existing managed secret, then write the new values.
  //    Re-Connect after a previous Disconnect/expiry replaces cleanly,
  //    and dropping the full managed set (rather than just the keys
  //    we're about to write) means a previously-pinned value that's no
  //    longer applicable — e.g. EH's ORGANISATION_ID when the new token
  //    sees multiple named orgs and can't auto-pin — gets cleared.
  const managedKeySet = new Set(provider.auth.oauth.managedSecretKeys);
  const existingManagedSecrets = list.filter((s) => managedKeySet.has(s.name));
  for (const s of existingManagedSecrets) {
    await deleteSecret(s.logId, payload.ownerId, payload.assistantId).catch(() => undefined);
  }

  // Filter writes to managed keys + trim values.  Trim defensively
  // against trailing whitespace from upstream — the runtime's
  // ``_client.py`` already ``.strip()``s, but stored values stay clean
  // too, and the empty-after-trim check below catches degenerate cases.
  for (const [name, rawValue] of Object.entries(writes)) {
    if (!managedKeySet.has(name)) continue;
    const value = rawValue.trim();
    if (!value) {
      return Response.redirect(
        `${consoleUrl}${payload.redirectAfter}?integration_error=write_empty:${encodeURIComponent(name)}`,
        302
      );
    }
    const result = await createSecret(payload.assistantId, payload.ownerId, { name, value });
    if ('detail' in result && result.detail) {
      return Response.redirect(
        `${consoleUrl}${payload.redirectAfter}?integration_error=write_failed:${encodeURIComponent(name)}`,
        302
      );
    }
  }

  // 8. Done — redirect with success flag (+ optional notice).
  const successUrl = new URL(`${consoleUrl}${payload.redirectAfter}`);
  successUrl.searchParams.set('integration_success', providerId);
  if (notice) {
    successUrl.searchParams.set('integration_notice', notice);
  }
  return Response.redirect(successUrl.toString(), 302);
}
