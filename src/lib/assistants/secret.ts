import { ResponseProps } from '@/types/common';
import { LogProps, LogsResponseProps } from '@/types/interfaces/logs';
import { Secret, SecretPayload, SecretUpdatePayload } from '@/types/assistants/secret';
import {
  buildUserIdFilter,
  buildAssistantIdFilter,
  combineFilters,
} from '@/utils/assistants/filterExpressions';
import { resolveOwnerApiKeyForAssistant } from '@/lib/assistants/owner';

const PROJECT = 'Assistants';
const CONTEXT_SUFFIX = '/Secrets';

async function mirrorToAllContexts(
  apiKey: string,
  logIds: number[],
  ownerId: string,
  suffix: string
): Promise<void> {
  const orchestraUrl = process.env.ORCHESTRA_URL || 'https://api.unify.ai';
  const allContexts = [`${ownerId}/All${suffix}`, `All${suffix}`];
  /* eslint-disable @typescript-eslint/naming-convention */
  const results = await Promise.all(
    allContexts.map((ctx) =>
      fetch(`${orchestraUrl}/v0/project/${PROJECT}/contexts/add_logs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ context_name: ctx, log_ids: logIds }),
      })
    )
  );
  /* eslint-enable @typescript-eslint/naming-convention */
  for (const res of results) {
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[mirrorToAllContexts] Failed to mirror logs: ${res.status} ${text}`);
    }
  }
}

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

export const getSecrets = async (
  apiKey: string,
  userId: string,
  isOrgContext: boolean,
  orgId: number | null = null
) => {
  return async (assistantId: string, ownerId: string): Promise<Secret[] | ResponseProps> => {
    'use server';
    try {
      const effectiveKey = isOrgContext
        ? await resolveOwnerApiKeyForAssistant(ownerId, orgId).catch(() => apiKey)
        : apiKey;
      const effectiveUserId = isOrgContext ? ownerId : userId;

      const context = `All${CONTEXT_SUFFIX}`;
      const securityFilters: string[] = [];
      if (!isOrgContext) {
        securityFilters.push(buildUserIdFilter(effectiveUserId));
      }
      securityFilters.push(buildAssistantIdFilter(assistantId));
      const securityFilter = combineFilters(securityFilters);
      const url = `${process.env.NEXTAUTH_URL}/api/logs?projectName=${PROJECT}&context=${context}&filterExpr=${encodeURIComponent(securityFilter)}&excludeFields=value`;

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
  _userId: string,
  _isOrgContext: boolean,
  orgId: number | null = null
) => {
  return async (
    assistantId: string,
    ownerId: string,
    payload: SecretPayload
  ): Promise<ResponseProps> => {
    'use server';
    try {
      const effectiveKey = await resolveOwnerApiKeyForAssistant(ownerId, orgId).catch(() => apiKey);

      const primaryContext = `${ownerId}/${assistantId}${CONTEXT_SUFFIX}`;
      /* eslint-disable @typescript-eslint/naming-convention */
      const entriesWithPrivateFields = {
        ...payload,
        _user_id: ownerId,
        _assistant_id: assistantId,
      };
      /* eslint-enable @typescript-eslint/naming-convention */
      const body = {
        projectName: PROJECT,
        context: primaryContext,
        entries: [entriesWithPrivateFields],
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

      const data = await response.json();
      const logIds: number[] | undefined = data?.logEventIds;
      if (logIds?.length) {
        await mirrorToAllContexts(effectiveKey, logIds, ownerId, CONTEXT_SUFFIX);
      }

      return { info: 'Secret created successfully.' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error creating secret.';
      return { detail: message };
    }
  };
};

export const updateSecret = async (
  apiKey: string,
  _isOrgContext: boolean = false,
  orgId: number | null = null
) => {
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

export const deleteSecret = async (
  apiKey: string,
  _isOrgContext: boolean = false,
  orgId: number | null = null
) => {
  return async (logId: number, ownerId: string): Promise<ResponseProps> => {
    'use server';
    try {
      const effectiveKey = await resolveOwnerApiKeyForAssistant(ownerId, orgId).catch(() => apiKey);

      const context = `All${CONTEXT_SUFFIX}`;
      const url = `${process.env.NEXTAUTH_URL}/api/logs`;
      const body = {
        projectName: PROJECT,
        context: context,
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
