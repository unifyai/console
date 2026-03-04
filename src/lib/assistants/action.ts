/**
 * Server Actions for Assistant Actions Panel
 *
 * Factory functions that return server actions for fetching ManagerMethod
 * and ToolLoop events from the logging API.
 *
 * Uses paginated fetching (limit + offset) to safely retrieve all matching
 * logs without sending unbounded queries that could choke bandwidth.
 *
 * Set USE_MOCK_DATA to true in action-mock-data.ts to use simulated
 * progressive event data for UI testing.
 */

import { ResponseProps } from '@/types/common';
import {
  buildAssistantIdFilter,
  combineFilters,
  escapeFilterValue,
} from '@/utils/assistants/filterExpressions';
import { buildTimestampFilter } from '@/utils/assistants/assistant-actions';
import { snakeToCamelObject } from '@/utils/casing';
import type { ActionsLogsResponse } from '@/types/assistants/action';
import {
  USE_MOCK_DATA,
  getMockManagerMethodEvents,
  getMockToolLoopEvents,
} from '../../utils/assistants/action-mock-data';
import { buildExcludedManagerFilters } from './excluded-managers';

const __DEV__ = process.env.NODE_ENV === 'development';

// =============================================================================
// Pagination constants
// =============================================================================

const MM_PAGE_SIZE = 100;
const TL_PAGE_SIZE = 500;
const MAX_TOTAL_LOGS = 5000;

// =============================================================================
// Pagination helpers
// =============================================================================

/**
 * Fetches a single page of logs from Orchestra, parses the JSON response,
 * and validates the HTTP status.
 *
 * @returns The parsed response data, or a ResponseProps error.
 */
async function fetchPage(
  baseUrl: string,
  apiKey: string,
  limit: number,
  offset: number,
  label: string
): Promise<{ data: any } | ResponseProps> {
  const url = `${baseUrl}&limit=${limit}&offset=${offset}`;

  const response = await fetch(url, { method: 'GET', headers: { apiKey } });

  let data;
  try {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      console.error(
        `[action.ts ${label}] Received non-JSON response with status ${response.status}`
      );
      return { detail: 'Received an invalid response from the server.' };
    }
  } catch (parseError) {
    console.error(`[action.ts ${label}] Failed to parse JSON response ${parseError}`);
    return { detail: 'Received an invalid response from the server.' };
  }

  if (!response.ok) {
    const errorMessage = data.detail || `Failed to get events: ${response.statusText}`;
    return { detail: errorMessage };
  }

  return { data };
}

/**
 * Fetches ALL matching logs from Orchestra using pagination.
 *
 * Starts at offset 0 with PAGE_SIZE, reads the `count` field from the
 * first response to know the total, then pages through the remainder.
 * Stops when all logs are fetched or the safety cap is reached.
 *
 * Returns the accumulated logs with entries converted to camelCase and
 * sorted by id ascending (Orchestra returns newest-first by default).
 */
async function fetchAllPages(
  baseUrl: string,
  apiKey: string,
  label: string,
  pageSize: number = MM_PAGE_SIZE
): Promise<ActionsLogsResponse | ResponseProps> {
  const allLogs: any[] = [];
  let totalCount = 0;
  let offset = 0;

  while (true) {
    const result = await fetchPage(baseUrl, apiKey, pageSize, offset, label);
    if ('detail' in result) {
      if (__DEV__)
        console.log(
          `[DEBUG][action.ts] ${label} fetchPage returned error at offset=${offset}: ${JSON.stringify(result).slice(0, 200)}`
        );
      return result;
    }

    const pageLogs = result.data?.logs ?? [];
    allLogs.push(...pageLogs);

    if (offset === 0) {
      totalCount = result.data?.count ?? pageLogs.length;
    }

    if (__DEV__)
      console.log(
        `[DEBUG][action.ts] ${label} paginated fetch: offset=${offset}, page=${pageLogs.length}, accumulated=${allLogs.length}, total=${totalCount}`
      );

    offset += pageSize;

    const done =
      pageLogs.length < pageSize ||
      allLogs.length >= totalCount ||
      allLogs.length >= MAX_TOTAL_LOGS;

    if (done) {
      if (allLogs.length >= MAX_TOTAL_LOGS && allLogs.length < totalCount) {
        console.warn(
          `[action.ts ${label}] Stopped at safety cap (${MAX_TOTAL_LOGS}), total matching=${totalCount}`
        );
      }
      if (__DEV__ && allLogs.length < totalCount && pageLogs.length >= pageSize)
        console.log(
          `[DEBUG][action.ts] ${label} pagination stopped: accumulated=${allLogs.length} < total=${totalCount}`
        );
      break;
    }
  }

  if (__DEV__ && allLogs.length > pageSize) {
    console.log(
      `[DEBUG][action.ts] ${label} fetched ${allLogs.length} logs across ${Math.ceil(allLogs.length / pageSize)} pages`
    );
  }

  const processedLogs = allLogs
    .map((log: any) => ({
      ...log,
      entries: snakeToCamelObject<Record<string, unknown>>(log.entries),
    }))
    .sort((a: any, b: any) => a.id - b.id);

  return { logs: processedLogs, count: totalCount } as ActionsLogsResponse;
}

// =============================================================================
// Server Actions
// =============================================================================

/**
 * Factory for getManagerMethodEvents server action.
 *
 * Fetches ManagerMethod events for an assistant from the All/Events/ManagerMethod context.
 * When limit is null, paginates internally to fetch all matching logs safely.
 * When limit is provided, fetches a single page (used by loadMore).
 *
 * @param apiKey - API key for authentication
 * @returns Async function to fetch ManagerMethod events
 */
export const getManagerMethodEvents = async (apiKey: string) => {
  return async (
    assistantId: string,
    startTime: string | null,
    limit: number | null,
    offset?: number,
    extraFilters?: string[]
  ): Promise<ActionsLogsResponse | ResponseProps> => {
    'use server';

    if (USE_MOCK_DATA) {
      return getMockManagerMethodEvents(assistantId, startTime, limit);
    }

    try {
      const context = 'All/Events/ManagerMethod';
      let baseUrl = `${process.env.NEXTAUTH_URL}/api/logs?projectName=Assistants&context=${context}`;

      const filters: string[] = [
        buildAssistantIdFilter(assistantId),
        ...buildExcludedManagerFilters(),
      ];
      if (startTime) {
        filters.push(buildTimestampFilter(startTime));
      }
      if (extraFilters) {
        filters.push(...extraFilters);
      }
      const filterExpr = combineFilters(filters);
      if (filterExpr) {
        baseUrl += `&filterExpr=${encodeURIComponent(filterExpr)}`;
      }

      if (limit === null && offset === undefined) {
        return await fetchAllPages(baseUrl, apiKey, 'getManagerMethodEvents', MM_PAGE_SIZE);
      }

      // Explicit limit/offset: single-page fetch (progressive load or loadMore)
      const pageLimit = limit ?? MM_PAGE_SIZE;
      const pageOffset = offset ?? 0;
      const result = await fetchPage(
        baseUrl,
        apiKey,
        pageLimit,
        pageOffset,
        'getManagerMethodEvents'
      );
      if ('detail' in result) return result;

      if (result.data?.logs) {
        result.data.logs = result.data.logs
          .map((log: any) => ({
            ...log,
            entries: snakeToCamelObject<Record<string, unknown>>(log.entries),
          }))
          .sort((a: any, b: any) => a.id - b.id);
      }

      return result.data as ActionsLogsResponse;
    } catch (error) {
      console.error(`[action.ts getManagerMethodEvents] Error fetching events:`, error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown server error occurred.';
      return { detail: errorMessage };
    }
  };
};

/**
 * Factory for getToolLoopEvents server action.
 *
 * Fetches ToolLoop events for an assistant from the All/Events/ToolLoop context.
 * Filters by hierarchy (array joined with "->") to get events for a specific
 * node and its un-noded descendants (e.g. StorageCheck inner hierarchy).
 * Client-side filtering is then applied to exclude events that belong to
 * child MM nodes.
 *
 * When limit is null, paginates internally to fetch all matching logs safely.
 *
 * @param apiKey - API key for authentication
 * @returns Async function to fetch ToolLoop events
 */
export const getToolLoopEvents = async (apiKey: string) => {
  return async (
    assistantId: string,
    hierarchy: string[],
    limit: number | null,
    startTime?: string,
    endTime?: string
  ): Promise<ActionsLogsResponse | ResponseProps> => {
    'use server';

    if (USE_MOCK_DATA) {
      return getMockToolLoopEvents(assistantId, hierarchy, limit);
    }

    try {
      const context = 'All/Events/ToolLoop';
      let baseUrl = `${process.env.NEXTAUTH_URL}/api/logs?projectName=Assistants&context=${context}`;

      const joinedHierarchy = hierarchy.join('->');
      const filters: string[] = [
        buildAssistantIdFilter(assistantId),
        `hierarchy_label.startswith('${escapeFilterValue(joinedHierarchy)}')`,
      ];
      if (startTime) {
        filters.push(`event_timestamp >= '${escapeFilterValue(startTime)}'`);
      }
      if (endTime) {
        filters.push(`event_timestamp <= '${escapeFilterValue(endTime)}'`);
      }
      const filterExpr = combineFilters(filters);
      if (filterExpr) {
        baseUrl += `&filterExpr=${encodeURIComponent(filterExpr)}`;
      }

      if (limit === null) {
        return await fetchAllPages(baseUrl, apiKey, 'getToolLoopEvents', TL_PAGE_SIZE);
      }

      // Explicit limit: single-page fetch
      const result = await fetchPage(baseUrl, apiKey, limit, 0, 'getToolLoopEvents');
      if ('detail' in result) return result;

      if (result.data?.logs) {
        result.data.logs = result.data.logs
          .map((log: any) => ({
            ...log,
            entries: snakeToCamelObject<Record<string, unknown>>(log.entries),
          }))
          .sort((a: any, b: any) => a.id - b.id);
      }

      return result.data as ActionsLogsResponse;
    } catch (error) {
      console.error(`[action.ts getToolLoopEvents] Error fetching events:`, error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown server error occurred.';
      return { detail: errorMessage };
    }
  };
};

/**
 * Factory for backfillByCallingIds server action.
 *
 * Fetches the incoming ManagerMethod events for specific calling_ids.
 * Used after the initial load when a root incoming event fell outside
 * the time window. The filter is fully targeted:
 *
 *   _assistant_id == 'X' and calling_id == 'Y' and phase == 'incoming'
 *
 * No time constraint — this reaches back as far as Orchestra stores data
 * to guarantee the root is found.
 */
export const backfillByCallingIds = async (apiKey: string) => {
  return async (
    assistantId: string,
    callingIds: string[]
  ): Promise<ActionsLogsResponse | ResponseProps> => {
    'use server';

    if (callingIds.length === 0) {
      return { logs: [], count: 0 };
    }

    try {
      const context = 'All/Events/ManagerMethod';
      let url = `${process.env.NEXTAUTH_URL}/api/logs?projectName=Assistants&context=${context}`;

      // Build filter: _assistant_id AND calling_id IN (...) AND phase == 'incoming'
      const callingIdConditions = callingIds
        .map((id) => `calling_id == '${escapeFilterValue(id)}'`)
        .join(' or ');
      const callingIdFilter =
        callingIds.length === 1 ? callingIdConditions : `(${callingIdConditions})`;

      const filters: string[] = [
        buildAssistantIdFilter(assistantId),
        callingIdFilter,
        `phase == 'incoming'`,
      ];

      const filterExpr = combineFilters(filters);
      if (filterExpr) {
        url += `&filterExpr=${encodeURIComponent(filterExpr)}`;
      }

      // One incoming event per calling_id
      url += `&limit=${callingIds.length}`;

      if (__DEV__) console.log(`[DEBUG][action.ts] backfillByCallingIds URL: ${url}`);

      const response = await fetch(url, { method: 'GET', headers: { apiKey: apiKey } });

      let data;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          console.error(
            `[action.ts backfillByCallingIds] Received non-JSON response with status ${response.status}`
          );
          return { detail: 'Received an invalid response from the server.' };
        }
      } catch (parseError) {
        console.error(
          `[action.ts backfillByCallingIds] Failed to parse JSON response ${parseError}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }

      if (!response.ok) {
        const errorMessage = data.detail || `Failed to backfill events: ${response.statusText}`;
        return { detail: errorMessage };
      }

      if (data?.logs) {
        data.logs = data.logs
          .map((log: any) => ({
            ...log,
            entries: snakeToCamelObject<Record<string, unknown>>(log.entries),
          }))
          .sort((a: any, b: any) => a.id - b.id);
      }

      if (__DEV__)
        console.log(
          `[DEBUG][action.ts] backfillByCallingIds: fetched ${data?.logs?.length ?? 0} incoming event(s) for ${callingIds.length} calling_id(s)`
        );

      return data as ActionsLogsResponse;
    } catch (error) {
      console.error(`[action.ts backfillByCallingIds] Error:`, error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown server error occurred.';
      return { detail: errorMessage };
    }
  };
};
