'use server';

import { resolveSecretSession } from '@/lib/server-action-session';
import { ResponseProps } from '@/types/common';
import { LogProps, LogsResponseProps } from '@/types/interfaces/logs';
import { Secret, SecretPayload, SecretUpdatePayload } from '@/types/assistants/secret';
import { resolveOwnerApiKeyForAssistant } from '@/lib/assistants/owner';
import { getInternalApiBaseUrl } from '@/utils/assistants/api-utils';
import { formatValidationDetail } from '@/utils/orchestra-error';

const PROJECT = 'Assistants';
const CONTEXT_SUFFIX = '/Secrets';

const mapLogToSecret = (log: LogProps): Secret | null => {
  const { id, entries } = log;
  const numericId = parseInt(id, 10);

  if (isNaN(numericId) || !entries || typeof entries.name !== 'string') {
    console.warn('Skipping log due to missing, invalid, or non-numeric ID in secret data:', log);
    return null;
  }
  return {
    logId: numericId,
    name: entries.name,
    description: typeof entries.description === 'string' ? entries.description : undefined,
  };
};

export async function getSecrets(
  assistantId: string,
  ownerId: string,
  sorting?: string,
  filter?: string
): Promise<Secret[] | ResponseProps> {
  const { apiKey, orgId } = await resolveSecretSession();
  try {
    const effectiveKey =
      orgId !== null
        ? await resolveOwnerApiKeyForAssistant(ownerId, orgId).catch(() => apiKey)
        : apiKey;

    const context = `${ownerId}/${assistantId}${CONTEXT_SUFFIX}`;
    const params = new URLSearchParams({
      projectName: PROJECT,
      context,
      excludeFields: 'value',
    });
    if (sorting) params.set('sorting', sorting);
    if (filter) params.set('filter', filter);
    const url = `${getInternalApiBaseUrl()}/api/logs?${params.toString()}`;

    const response = await fetch(url, { method: 'GET', headers: { apiKey: effectiveKey } });

    if (response.status === 404) return [];

    const data = await response.json();
    if (!response.ok)
      return { detail: data.detail || `Failed to get secrets: ${response.statusText}` };

    const logsResponse = data as LogsResponseProps;
    const secrets = (logsResponse.logs as LogProps[])
      .map(mapLogToSecret)
      .filter((secret): secret is Secret => secret !== null);

    return secrets;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error getting secrets.';
    return { detail: message };
  }
}

export async function getSecretValue(
  assistantId: string,
  ownerId: string,
  secretName: string
): Promise<string | null> {
  const { apiKey, orgId } = await resolveSecretSession();
  try {
    const effectiveKey =
      orgId !== null
        ? await resolveOwnerApiKeyForAssistant(ownerId, orgId).catch(() => apiKey)
        : apiKey;

    const escapedName = secretName.replace(/"/g, '\\"');
    const params = new URLSearchParams({
      projectName: PROJECT,
      context: `${ownerId}/${assistantId}${CONTEXT_SUFFIX}`,
      filter: `name == "${escapedName}"`,
      limit: '1',
    });
    const url = `${process.env.NEXTAUTH_URL}/api/logs?${params.toString()}`;

    const response = await fetch(url, { method: 'GET', headers: { apiKey: effectiveKey } });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      logs?: Array<{ entries?: { name?: string; value?: string } }>;
    };
    const log = data.logs?.find((l) => l.entries?.name === secretName);
    return log?.entries?.value ?? null;
  } catch {
    return null;
  }
}

export async function createSecret(
  assistantId: string,
  ownerId: string,
  payload: SecretPayload
): Promise<ResponseProps> {
  const { apiKey, orgId, orgName } = await resolveSecretSession();
  try {
    const effectiveKey = await resolveOwnerApiKeyForAssistant(ownerId, orgId).catch(() => apiKey);

    const context = `${ownerId}/${assistantId}${CONTEXT_SUFFIX}`;
    const privateFields: Record<string, string | number> = {
      ['_user']: ownerId,
      ['_user_id']: ownerId,
      ['_assistant']: assistantId,
      ['_assistant_id']: assistantId,
    };
    if (orgId !== null) privateFields['_org_id'] = orgId;
    if (orgName) privateFields['_org'] = orgName;

    const body = {
      projectName: PROJECT,
      context,
      entries: [{ ...payload, ...privateFields }],
    };

    const response = await fetch(`${getInternalApiBaseUrl()}/api/logs`, {
      method: 'POST',
      headers: { apiKey: effectiveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const data = await response.json();
      return {
        detail:
          formatValidationDetail(data.detail) || `Failed to create secret: ${response.statusText}`,
      };
    }

    return { info: 'Secret created successfully.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error creating secret.';
    return { detail: message };
  }
}

export async function updateSecret(
  logId: number,
  ownerId: string,
  payload: SecretUpdatePayload
): Promise<ResponseProps> {
  const { apiKey, orgId } = await resolveSecretSession();
  try {
    const effectiveKey = await resolveOwnerApiKeyForAssistant(ownerId, orgId).catch(() => apiKey);

    const body = {
      logs: [logId],
      entries: payload,
      overwrite: true,
    };

    const response = await fetch(`${getInternalApiBaseUrl()}/api/logs`, {
      method: 'PUT',
      headers: { apiKey: effectiveKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const data = await response.json();
      return {
        detail:
          formatValidationDetail(data.detail) || `Failed to update secret: ${response.statusText}`,
      };
    }

    return { info: 'Secret updated successfully.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error updating secret.';
    return { detail: message };
  }
}

export async function deleteSecret(
  logId: number,
  ownerId: string,
  assistantId: string
): Promise<ResponseProps> {
  const { apiKey, orgId } = await resolveSecretSession();
  try {
    const effectiveKey = await resolveOwnerApiKeyForAssistant(ownerId, orgId).catch(() => apiKey);

    const context = `${ownerId}/${assistantId}${CONTEXT_SUFFIX}`;
    const url = `${getInternalApiBaseUrl()}/api/logs`;
    const body = {
      projectName: PROJECT,
      context,
      idsAndFields: [[logId, null]],
    };

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        apiKey: effectiveKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      return { info: 'Secret deleted successfully.' };
    }

    let detail = `Failed to delete secret: ${response.statusText}`;
    try {
      const data = await response.json();
      detail = data.detail || detail;
    } catch {
      // Ignore JSON parsing errors for empty bodies
    }
    return { detail };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error deleting secret.';
    return { detail: message };
  }
}
