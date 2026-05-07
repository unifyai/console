/**
 * DELETE /api/assistant/[assistantId]/integrations/[providerId]
 *
 * Two-stage disconnect for OAuth providers, single-stage for API-key.
 *
 * OAuth:
 *   - Stage 1 (any managed secret present, e.g. refresh_token): deletes
 *     managed secrets only.  Customer-provided Client ID / Client Secret
 *     stay so the user can reconnect with one click.  Card transitions
 *     to ``needs_reconnect``.
 *   - Stage 2 (no managed secrets — already in needs_reconnect): deletes
 *     the customer-provided keys.  The card disappears entirely.
 *
 * API-key (``api_key`` and ``api_key_multi``): deletes every customer-
 * provided field in one shot.  ``api_key_multi`` providers store a token
 * pair (e.g. Matterport's Token ID + secret) so removal must drop both.
 *
 * Returns:
 *   - 200 with ``{ success, removedCount, stage, note }`` on success.
 *     ``stage`` is ``'tokens'`` | ``'credentials'`` | ``'api_key'``.
 *   - 400 if the provider is unknown or the integration is non-removable
 *   - 401 if the user is unauthenticated
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../_utils/auth';
import { getCurrentUser } from '@/lib/user/user';
import { getActiveOrganization } from '@/lib/user/workspace';
import { deleteSecret, getSecrets } from '@/lib/assistants/secret';
import {
  customerProvidedSecretKeysFor,
  getIntegrationProvider,
} from '@/constants/assistants/integrations';
import type { IntegrationProviderId } from '@/types/assistants/integration';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { assistantId: string; providerId: string } }
) {
  const apiKey = await getApiKeyFromRequest(request);
  if (!apiKey) return unauthorized();

  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const provider = getIntegrationProvider(params.providerId as IntegrationProviderId);
  if (!provider) {
    return badRequest(`Unknown provider: ${params.providerId}`);
  }

  // Custom isn't routable here — there's no ``providerId`` for custom
  // secrets; users delete them via the standard secrets row.
  if (provider.auth.kind === 'freeform') {
    return badRequest(
      'Custom secrets are removed via the standard delete row, not the integration disconnect endpoint.'
    );
  }

  const ownerId = String(user.id);
  const activeOrg = getActiveOrganization(user);
  const orgId = activeOrg?.id ?? null;

  const getSecretsFn = await getSecrets(apiKey, orgId);
  const list = await getSecretsFn(params.assistantId, ownerId);
  if (!Array.isArray(list)) {
    return NextResponse.json(
      { error: list.detail ?? 'Failed to read assistant secrets.' },
      { status: 502 }
    );
  }

  // Pick the stage and the keys it targets.
  //   - OAuth stage 1 (``tokens``): managed keys present → delete those.
  //   - OAuth stage 2 (``credentials``): no managed keys remain → delete
  //     the customer-provided keys to fully remove the integration.
  //   - API-key (``api_key``): one shot — delete the single field.
  let stage: 'tokens' | 'credentials' | 'api_key';
  let keysToDelete: string[];
  switch (provider.auth.kind) {
    case 'oauth_authorization_code': {
      const managed = provider.auth.oauth.managedSecretKeys;
      const presentNames = new Set(list.map((s) => s.name));
      const anyManagedPresent = managed.some((k) => presentNames.has(k));
      if (anyManagedPresent) {
        stage = 'tokens';
        keysToDelete = managed;
      } else {
        stage = 'credentials';
        keysToDelete = customerProvidedSecretKeysFor(provider);
      }
      break;
    }
    case 'api_key':
    case 'api_key_multi':
      stage = 'api_key';
      keysToDelete = customerProvidedSecretKeysFor(provider);
      break;
  }

  const matching = list.filter((s) => keysToDelete.includes(s.name));
  if (matching.length === 0) {
    return NextResponse.json(
      { success: true, removedCount: 0, stage, note: 'Nothing to remove.' },
      { status: 200 }
    );
  }

  const deleteSecretFn = await deleteSecret(apiKey, orgId);
  let removedCount = 0;
  for (const s of matching) {
    const result = await deleteSecretFn(s.logId, ownerId, params.assistantId);
    if (!('detail' in result) || !result.detail) removedCount += 1;
  }

  const note = (() => {
    switch (stage) {
      case 'tokens':
        return `Disconnected locally. To revoke this app's access in ${provider.label}, visit its Apps & Integrations settings — we cannot revoke server-side.`;
      case 'credentials':
        return `Removed ${provider.label} from this assistant.`;
      case 'api_key':
        return `Removed ${provider.label} credentials from this assistant.`;
    }
  })();

  return NextResponse.json({
    success: true,
    removedCount,
    stage,
    note,
  });
}
