/**
 * DELETE /api/assistant/[assistantId]/integrations/[providerId]
 *
 * Disconnects an integration for an assistant by deleting its
 * OAuth-managed secrets.  Customer-provided credentials
 * (CLIENT_ID/CLIENT_SECRET for OAuth, or the API-key value) are LEFT in
 * place so the user can reconnect with one click without re-pasting.
 *
 * For full removal (including customer-provided credentials), the user
 * deletes them individually from the Integrations tab — same as any
 * custom secret.
 *
 * Returns:
 *   - 200 with ``{ success, removedCount, note }`` on success
 *   - 400 if the provider is unknown or the integration is non-removable
 *   - 401 if the user is unauthenticated
 *   - 404 if the assistant has no managed secrets to remove
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromRequest, unauthorized, badRequest } from '../../../../_utils/auth';
import { getCurrentUser } from '@/lib/user/user';
import { getActiveOrganization } from '@/lib/user/workspace';
import { deleteSecret, getSecrets } from '@/lib/assistants/secret';
import { getIntegrationProvider } from '@/constants/assistants/integrations';
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

  // Determine which keys to delete.  For OAuth providers, only the
  // managed keys (refresh_token, organisation_id, etc. — whatever the
  // provider's registry entry lists).  For API-key providers, the
  // single field (caller chose to disconnect, so remove the token).
  // Custom isn't routable here — there's no ``providerId`` for custom
  // secrets; users delete them via the standard secrets row.
  let keysToDelete: string[] = [];
  switch (provider.auth.kind) {
    case 'oauth_authorization_code':
      keysToDelete = provider.auth.oauth.managedSecretKeys;
      break;
    case 'api_key':
      keysToDelete = [provider.auth.field.secretKey];
      break;
    case 'freeform':
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
  const matching = list.filter((s) => keysToDelete.includes(s.name));
  if (matching.length === 0) {
    return NextResponse.json(
      { success: true, removedCount: 0, note: 'Nothing to remove.' },
      { status: 200 }
    );
  }

  const deleteSecretFn = await deleteSecret(apiKey, orgId);
  let removedCount = 0;
  for (const s of matching) {
    const result = await deleteSecretFn(s.logId, ownerId, params.assistantId);
    if (!('detail' in result) || !result.detail) removedCount += 1;
  }

  const note =
    provider.auth.kind === 'oauth_authorization_code'
      ? `Disconnected locally. To revoke this app's access in ${provider.label}, visit its Apps & Integrations settings — we cannot revoke server-side.`
      : `Removed ${provider.label} credentials from this assistant.`;

  return NextResponse.json({
    success: true,
    removedCount,
    note,
  });
}
