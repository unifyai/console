import { ResponseProps } from '@/types/common';
import { LogProps, LogsResponseProps } from '@/types/interfaces/logs';
import { Secret, SecretPayload, SecretUpdatePayload } from '@/types/assistants/secret';
import { resolveOwnerApiKeyForAssistant } from '@/lib/assistants/owner';

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

export const getSecrets = async (apiKey: string, orgId: number | null = null) => {
  return async (assistantId: string, ownerId: string): Promise<Secret[] | ResponseProps> => {
    'use server';
    try {
      const effectiveKey =
        orgId !== null
          ? await resolveOwnerApiKeyForAssistant(ownerId, orgId).catch(() => apiKey)
          : apiKey;

      const context = `${ownerId}/${assistantId}${CONTEXT_SUFFIX}`;
      const url = `${process.env.NEXTAUTH_URL}/api/logs?projectName=${PROJECT}&context=${context}&excludeFields=value`;

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
  };
};

export const createSecret = async (
  apiKey: string,
  orgId: number | null = null,
  orgName: string | null = null
) => {
  return async (
    assistantId: string,
    ownerId: string,
    payload: SecretPayload
  ): Promise<ResponseProps> => {
    'use server';
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

      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/logs`, {
        method: 'POST',
        headers: { apiKey: effectiveKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        return { detail: data.detail || `Failed to create secret: ${response.statusText}` };
      }

      return { info: 'Secret created successfully.' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error creating secret.';
      return { detail: message };
    }
  };
};

export const updateSecret = async (apiKey: string, orgId: number | null = null) => {
  return async (
    logId: number,
    ownerId: string,
    payload: SecretUpdatePayload
  ): Promise<ResponseProps> => {
    'use server';
    try {
      const effectiveKey = await resolveOwnerApiKeyForAssistant(ownerId, orgId).catch(() => apiKey);

      const body = {
        logs: [logId],
        entries: payload,
        overwrite: true,
      };

      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/logs`, {
        method: 'PUT',
        headers: { apiKey: effectiveKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        return { detail: data.detail || `Failed to update secret: ${response.statusText}` };
      }

      return { info: 'Secret updated successfully.' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error updating secret.';
      return { detail: message };
    }
  };
};

export const deleteSecret = async (apiKey: string, orgId: number | null = null) => {
  return async (logId: number, ownerId: string, assistantId: string): Promise<ResponseProps> => {
    'use server';
    try {
      const effectiveKey = await resolveOwnerApiKeyForAssistant(ownerId, orgId).catch(() => apiKey);

      const context = `${ownerId}/${assistantId}${CONTEXT_SUFFIX}`;
      const url = `${process.env.NEXTAUTH_URL}/api/logs`;
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
      } catch (e) {
        // Ignore JSON parsing errors for empty bodies
      }
      return { detail };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error deleting secret.';
      return { detail: message };
    }
  };
};
