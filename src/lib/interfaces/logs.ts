'use server';

import { requireUserApiKey } from '@/lib/server-action-session';
import { LogFieldsProps, LogItemProps, GetLogsParameters } from '@/types/interfaces/logs';
import { sanitizeKey } from '../../app/(home)/interfaces/utils';
import { ResponseProps } from '@/types/common';
import { SyncableLogEntry } from '@/types/assistants/contact-sync';
import { maybeSyncContactFields } from './contact-sync';

// create logs
export async function createLogs(
  project: string,
  context: string | null,
  entries: { [entry: string | number]: string }[]
) {
  const apiKey = await requireUserApiKey();
  const contextBody = context ? { context: { name: context } } : {};
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/logs`, {
    method: 'POST',
    headers: { apiKey: apiKey },
    body: JSON.stringify({ projectName: project, ...contextBody, entries }),
  });
  return await response.json();
}

// get logs
export async function getLogs(
  project: string,
  context: string | null,
  columnContext: string | null,
  filterExpression: string | null,
  sortingExpression: string | null,
  groupingExpression: string | null,
  groupSortingExpression: string | null,
  fromIds: string | null,
  fromFields: string | null,
  excludeFields: string | null,
  limit: number | null,
  offset: number | null,
  groupLimit: number | null,
  groupOffset: number | null,
  groupDepth: number | null,
  returnIdsOnly: string | null,
  randomize: string | null,
  _timestamp: string | null,
  signal?: AbortSignal
) {
  const apiKey = await requireUserApiKey();
  try {
    const response = await fetch(
      `${process.env.NEXTAUTH_URL}/api/logs?projectName=${project}` +
        (context ? `&context=${context}` : '') +
        (columnContext ? `&columnContext=${columnContext}` : '') +
        (filterExpression ? `&filterExpr=${encodeURIComponent(filterExpression)}` : '') +
        (sortingExpression ? `&sorting=${encodeURIComponent(sortingExpression)}` : '') +
        (groupingExpression
          ? groupingExpression
              .split(',') // Split into individual grouping expressions
              .map((expr) => `&groupBy=${encodeURIComponent(expr.trim())}`) // Encode separately
              .join('') // Concatenate each `groupBy` separately
          : '') +
        (groupSortingExpression
          ? `&groupSorting=${encodeURIComponent(groupSortingExpression)}`
          : '') +
        (fromIds ? `&fromIds=${encodeURIComponent(fromIds)}` : '') +
        (fromFields ? `&fromFields=${encodeURIComponent(fromFields)}` : '') +
        (excludeFields ? `&excludeFields=${encodeURIComponent(excludeFields)}` : '') +
        (limit ? `&limit=${limit}` : '') +
        (offset ? `&offset=${offset}` : '') +
        (groupLimit ? `&groupLimit=${groupLimit}` : '') +
        (groupOffset ? `&groupOffset=${groupOffset}` : '') +
        (groupDepth !== null && groupDepth !== undefined ? `&groupDepth=${groupDepth}` : '') +
        (returnIdsOnly ? `&returnIdsOnly=${returnIdsOnly}` : '') +
        (randomize ? `&randomize=${randomize}` : ''),
      {
        method: 'GET',
        headers: { apiKey: apiKey },
        next: { tags: [`logs_${_timestamp}`] },
        signal,
      }
    );

    // Handle 404 - context not found
    if (response.status === 404) {
      console.warn(`[getLogs] Context not found: ${context} in project ${project}`);
      return { logs: [], count: 0, groups: [], contextNotFound: true };
    }

    const json = await response.json();
    if (!response.ok) return { logs: [], count: 0, groups: [], detail: json.detail };
    return await json;
  } catch (e: any) {
    console.log(`Failed to get logs error: ${e?.message || e}`);
    return { logs: [], count: 0, groups: [] };
  }
}

// update log
export async function updateLogs(
  project: string,
  context: string | null,
  logs: number[],
  entries: LogItemProps,
  overwrite: boolean = true
): Promise<ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    // Validate inputs before sending to server to avoid 400s
    if (!project || typeof project !== 'string' || project.trim() === '') {
      return { detail: "Missing 'project' when updating logs." };
    }
    const isValidLogsArray =
      Array.isArray(logs) && logs.length > 0 && logs.every((id) => Number.isInteger(id));
    if (!isValidLogsArray) {
      return { detail: "Invalid 'logs' payload. Expected a non-empty array of integer IDs." };
    }
    const hasEntries = entries && Object.keys(entries).length > 0;
    if (!hasEntries) {
      return {
        detail: "No changes provided. 'entries' must include at least one field to update.",
      };
    }

    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/logs`, {
      method: 'PUT',
      headers: {
        apiKey: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ logs, projectName: project, context, entries, overwrite }),
    });

    let data;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        console.error(
          `[actions.ts updateLog] Received non-JSON response with status ${response.status}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }
    } catch (parseError) {
      console.error(`[actions.ts updateLog] Failed to parse JSON response ${parseError}`);
      return { detail: 'Received an invalid response from the server.' };
    }

    if (!response.ok) {
      const errorMessage = data.detail || `Failed to update logs ${logs}: ${response.statusText}`;
      return { detail: errorMessage };
    }

    const successMessage = data.info || `Tasks ${logs} successfully updated.`;
    return { info: successMessage };
  } catch (error) {
    console.error(`[actions.ts updateLog] Error updating log ${logs}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error occurred.';
    return { detail: errorMessage };
  }
}

/**
 * Wrapped update with contact sync support.
 * After a successful log update, checks if contact fields should be synced
 * to user/assistant profiles (fire-and-forget).
 *
 * @param apiKey - User's API key
 * @returns Server action for updating logs with optional contact sync
 */
export async function updateLogsWithSync(
  project: string,
  context: string | null,
  logs: number[],
  entries: LogItemProps,
  overwrite: boolean = true,
  affectedLogs?: SyncableLogEntry[]
): Promise<ResponseProps> {
  const result = await updateLogs(project, context, logs, entries, overwrite);

  if (!result.detail && affectedLogs && affectedLogs.length > 0) {
    maybeSyncContactFields(project, context, entries, affectedLogs).catch((err) =>
      console.warn('[ContactSync] Sync failed:', err)
    );
  }

  return result;
}

// get log fields
export async function getLogFields(project: string, context: string | null, signal?: AbortSignal) {
  const apiKey = await requireUserApiKey();
  try {
    const response = await fetch(
      `${process.env.NEXTAUTH_URL}/api/logs/fields?projectName=${project}` +
        (context ? `&context=${context}` : ''),
      { method: 'GET', headers: { apiKey: apiKey }, signal }
    );

    // Return empty object for 404 (context not found) or other errors
    if (response.status === 404) {
      console.warn(`[getLogFields] Context not found: ${context}`);
      return {};
    }
    if (!response.ok) {
      console.error(`[getLogFields] Error: ${response.status}`);
      return {};
    }

    return await response.json();
  } catch (e) {
    console.error(`[getLogFields] Network error:`, e);
    return {};
  }
}

// rename log field
export async function renameLogFields(
  project: string,
  context: string | null,
  oldFieldName: string,
  newFieldName: string
): Promise<ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/logs/fields`, {
      method: 'PATCH',
      headers: {
        apiKey: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectName: project,
        context,
        oldFieldName: oldFieldName,
        newFieldName: newFieldName,
      }),
    });
    return await response.json();
  } catch (error) {
    console.error(
      `[actions.ts renameLogField] Error renaming field ${oldFieldName} -> ${newFieldName}:`,
      error
    );
    return { detail: 'Failed to rename log field. Please try again.' };
  }
}

export async function getLogMetrics(
  project: string,
  context: string | null,
  filterExpression: string | null,
  groupingExpression: string | null,
  metricName: string,
  keyNames: string[]
) {
  const apiKey = await requireUserApiKey();
  // Sanitize the keyName before using it in the request
  const sanitizedKeyNames = keyNames.map(sanitizeKey);

  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/logs/${metricName}?projectName=${project}` +
      (context ? `&context=${context}` : '') +
      `&key=${JSON.stringify(sanitizedKeyNames)}` +
      (filterExpression ? `&filterExpr=${encodeURIComponent(filterExpression)}` : '') +
      (groupingExpression
        ? `&groupBy=${encodeURIComponent(JSON.stringify(groupingExpression.split(',')))}`
        : ''),
    { method: 'GET', headers: { apiKey: apiKey } }
  );
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    if (contentType.includes('application/json')) {
      try {
        const j = await response.json();
        if (j?.detail) detail = j.detail;
      } catch {
        /* ignore parse errors */
      }
    }
    throw new Error(`Upstream error: ${detail}`);
  }
  if (!contentType.includes('application/json')) {
    throw new Error(`Upstream error: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

// get latest timestamp
export async function getLatestTimestamp(
  project: string,
  context: string | null,
  columnContext: string | null,
  filterExpression: string | null,
  sortingExpression: string | null,
  groupingExpression: string | null,
  groupSortingExpression: string | null,
  fromIds: string | null,
  fromFields: string | null,
  excludeFields: string | null,
  limit: number | null,
  offset: number | null,
  groupDepth: number | null,
  returnIdsOnly: string | null,
  randomize: string | null,
  _timestamp: string | null,
  signal?: AbortSignal
) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/logs/latest_timestamp?projectName=${project}` +
      (context ? `&context=${context}` : '') +
      (columnContext ? `&columnContext=${columnContext}` : '') +
      (filterExpression ? `&filterExpr=${encodeURIComponent(filterExpression)}` : '') +
      (sortingExpression ? `&sorting=${encodeURIComponent(sortingExpression)}` : '') +
      (groupingExpression
        ? groupingExpression
            .split(',') // Split into individual grouping expressions
            .map((expr) => `&groupBy=${encodeURIComponent(expr.trim())}`) // Encode separately
            .join('') // Concatenate each `groupBy` separately
        : '') +
      (groupSortingExpression
        ? `&groupSorting=${encodeURIComponent(groupSortingExpression)}`
        : '') +
      (fromIds ? `&fromIds=${encodeURIComponent(fromIds)}` : '') +
      (fromFields ? `&fromFields=${encodeURIComponent(fromFields)}` : '') +
      (excludeFields ? `&excludeFields=${encodeURIComponent(excludeFields)}` : '') +
      (limit ? `&limit=${limit}` : '') +
      (offset ? `&offset=${offset}` : '') +
      (groupDepth !== null && groupDepth !== undefined ? `&groupDepth=${groupDepth}` : ''),
    { method: 'GET', headers: { apiKey: apiKey }, signal }
  );
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    if (contentType.includes('application/json')) {
      try {
        const j = await response.json();
        if (j?.detail) detail = j.detail;
      } catch {
        /* ignore */
      }
    }
    throw new Error(`Upstream error: ${detail}`);
  }
  if (!contentType.includes('application/json')) {
    throw new Error(`Upstream error: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

// delete logs
export async function deleteLogs(
  project: string,
  context: string | null,
  idsAndFields: LogFieldsProps
) {
  const apiKey = await requireUserApiKey();
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/logs`, {
    method: 'DELETE',
    headers: { apiKey: apiKey },
    body: JSON.stringify({
      projectName: project,
      context,
      idsAndFields,
      sourceType: 'all',
      deleteEmptyLogs: true,
      deleteEmptyFields: true,
    }),
  });
  return await response.json();
}

// create derived entry
export async function createDerivedEntry(
  project: string,
  context: string | undefined,
  key: string,
  equation: string,
  referencedLogs: { [table_name: string]: GetLogsParameters }
): Promise<ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const contextBody = context ? { context: context } : {};
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/logs/derived`, {
      method: 'POST',
      headers: { apiKey: apiKey },
      body: JSON.stringify({
        projectName: project,
        ...contextBody,
        key,
        equation,
        referencedLogs,
      }),
    });
    return await response.json();
  } catch (e) {
    console.log(`Failed to create derived entry with error: ${e}`);
    return { detail: 'Failed to create derived entry, please try again.' };
  }
}

// update derived entry
export async function updateDerivedEntry(
  project: string,
  context: string | undefined,
  key: string | null,
  equation: string | null,
  targetDerivedLogs: { [table_name: string]: GetLogsParameters }
): Promise<ResponseProps> {
  const apiKey = await requireUserApiKey();
  try {
    const contextBody = context ? { context: context } : {};
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/logs/derived`, {
      method: 'PUT',
      headers: { apiKey: apiKey },
      body: JSON.stringify({
        projectName: project,
        ...contextBody,
        key,
        equation,
        targetDerivedLogs,
      }),
    });
    return await response.json();
  } catch (e) {
    console.log(`Failed to update derived entry with error: ${e}`);
    return { detail: 'Failed to update derived entry, please try again.' };
  }
}
