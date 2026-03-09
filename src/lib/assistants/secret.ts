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

/**
 * Mirrors log IDs to the All aggregation contexts so reads from All/
 * see data written to a primary user/assistant context.
 */
async function mirrorToAllContexts(
  apiKey: string,
  logIds: number[],
  userId: string,
  suffix: string
): Promise<void> {
  const orchestraUrl = process.env.ORCHESTRA_URL || 'https://api.unify.ai';
  const allContexts = [`${userId}/All${suffix}`, `All${suffix}`];
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

/**
 * Factory for getSecrets server action.
 *
 * @param isOrgContext - When true, skip _user_id filtering since org members should see all secrets.
 *                       The API key scopes data to the organization, preventing cross-org leaks.
 *                       In personal workspaces, _user_id filtering prevents same-name user leaks.
 */
export const getSecrets = async (apiKey: string, userId: string, isOrgContext: boolean) => {
  return async (assistantId: string): Promise<Secret[] | ResponseProps> => {
    'use server';
    try {
      const context = `All${CONTEXT_SUFFIX}`;
      // Build security filters based on workspace context
      // - Org workspace: API key scopes to org, all members see all secrets, no _user_id filter needed
      // - Personal workspace: Filter by _user_id to prevent same-name user data leaks
      const securityFilters: string[] = [];
      if (!isOrgContext) {
        securityFilters.push(buildUserIdFilter(userId));
      }
      securityFilters.push(buildAssistantIdFilter(assistantId));
      const securityFilter = combineFilters(securityFilters);
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

/**
 * Factory for createSecret server action.
 *
 * The `_user_id` field is always included in the log entry for audit purposes
 * (tracking who created the secret), regardless of workspace context.
 */
export const createSecret = async (apiKey: string, userId: string, _isOrgContext: boolean) => {
  return async (assistantId: string, payload: SecretPayload): Promise<ResponseProps> => {
    'use server';
    try {
      const primaryContext = `${userId}/${assistantId}${CONTEXT_SUFFIX}`;
      /* eslint-disable @typescript-eslint/naming-convention */
      const entriesWithPrivateFields = {
        ...payload,
        _user_id: userId,
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
        headers: { apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        return { detail: data.detail || `Failed to create secret: ${response.statusText}` };
      }

      const data = await response.json();
      const logIds: number[] | undefined = data?.logEventIds;
      if (logIds?.length) {
        await mirrorToAllContexts(apiKey, logIds, userId, CONTEXT_SUFFIX);
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
