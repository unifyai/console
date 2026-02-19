import { ResponseProps } from '@/types/common';
import { LogProps, LogsResponseProps } from '@/types/interfaces/logs';
import { Secret, SecretPayload } from '@/types/assistants/secret';
import {
  buildUserIdFilter,
  buildAssistantIdFilter,
  combineFilters,
} from '@/utils/assistants/filterExpressions';

const PROJECT = 'Assistants';
const CONTEXT_SUFFIX = '/Secrets';

const mapLogToSecret = (log: LogProps): Secret | null => {
  const { id, entries } = log;
  const numericId = parseInt(id, 10);

  if (
    isNaN(numericId) ||
    !entries ||
    typeof entries.name !== 'string' ||
    typeof entries.value !== 'string'
  ) {
    console.warn('Skipping log due to missing, invalid, or non-numeric ID in secret data:', log);
    return null;
  }
  return {
    logId: numericId,
    name: entries.name,
    value: entries.value,
    description: typeof entries.description === 'string' ? entries.description : undefined,
  };
};

export const getSecrets = async (apiKey: string, userId: string) => {
  return async (assistantId: string): Promise<Secret[] | ResponseProps> => {
    'use server';
    try {
      const context = `All${CONTEXT_SUFFIX}`;
      // Add _user_id and _assistant_id filters for security (prevents data leaks if two users have same name)
      const securityFilter = combineFilters([
        buildUserIdFilter(userId),
        buildAssistantIdFilter(assistantId),
      ]);
      const url = `${process.env.NEXTAUTH_URL}/api/logs?projectName=${PROJECT}&context=${context}&filterExpr=${encodeURIComponent(securityFilter)}`;

      const response = await fetch(url, { method: 'GET', headers: { apiKey } });

      if (response.status === 404) return []; // No secrets found is not an error

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

export const createSecret = async (apiKey: string, userId: string) => {
  return async (
    assistantId: string,
    payload: SecretPayload
  ): Promise<ResponseProps> => {
    'use server';
    try {
      const context = `All${CONTEXT_SUFFIX}`;
      // Include all private fields that Unity's log_utils would inject
      // (Unity injects these automatically, but console creates logs directly via API)
      // See: unity/unity/common/log_utils.py _inject_private_fields
      // Note: These field names intentionally use Unity's underscore-prefixed naming convention
      /* eslint-disable @typescript-eslint/naming-convention */
      const entriesWithPrivateFields = {
        ...payload,
        _user_id: userId,
        _assistant_id: assistantId,
      };
      /* eslint-enable @typescript-eslint/naming-convention */
      const body = { projectName: PROJECT, context, entries: [entriesWithPrivateFields] };

      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/logs`, {
        method: 'POST',
        headers: { apiKey, 'Content-Type': 'application/json' },
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

export const deleteSecret = async (apiKey: string) => {
  return async (logId: number): Promise<ResponseProps> => {
    'use server';
    try {
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
          apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        return { info: 'Secret deleted successfully.' };
      }

      // Handle non-ok responses
      let detail = `Failed to delete secret: ${response.statusText}`;
      try {
        // Try to parse a JSON error body, but don't fail if it's empty
        const data = await response.json();
        detail = data.detail || detail;
      } catch (e) {
        // Ignore JSON parsing errors for empty bodies, use status text
      }
      return { detail };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error deleting secret.';
      return { detail: message };
    }
  };
};
