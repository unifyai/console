/**
 * Server Actions for Assistant Actions Panel
 *
 * Factory functions that return server actions for fetching ManagerMethod
 * and ToolLoop events from the logging API.
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

// =============================================================================
// Server Actions
// =============================================================================

/**
 * Factory for getManagerMethodEvents server action.
 *
 * Fetches ManagerMethod events for an assistant from the All/Events/ManagerMethod context.
 *
 * @param apiKey - API key for authentication
 * @returns Async function to fetch ManagerMethod events
 */
export const getManagerMethodEvents = async (apiKey: string) => {
  return async (
    assistantId: string,
    startTime: string | null,
    limit: number | null
  ): Promise<ActionsLogsResponse | ResponseProps> => {
    'use server';

    // Use mock data for UI testing
    if (USE_MOCK_DATA) {
      return getMockManagerMethodEvents(assistantId, startTime, limit);
    }

    try {
      const context = 'All/Events/ManagerMethod';
      let url = `${process.env.NEXTAUTH_URL}/api/logs?projectName=Assistants&context=${context}`;

      // Build filter expression
      const filters: string[] = [buildAssistantIdFilter(assistantId)];
      if (startTime) {
        filters.push(buildTimestampFilter(startTime));
      }
      const filterExpr = combineFilters(filters);
      if (filterExpr) {
        url += `&filterExpr=${encodeURIComponent(filterExpr)}`;
      }

      // No server-side sorting — Orchestra doesn't reliably sort on ts/id/created_at.
      // Logs are returned newest-first by default; client sorts by id ascending.
      if (limit !== null) {
        url += `&limit=${limit}`;
      }

      // TODO: Remove debug logging
      console.log(`[DEBUG][action.ts] getManagerMethodEvents URL: ${url}`);

      const response = await fetch(url, { method: 'GET', headers: { apiKey: apiKey } });

      let data;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          console.error(
            `[action.ts getManagerMethodEvents] Received non-JSON response with status ${response.status}`
          );
          return { detail: 'Received an invalid response from the server.' };
        }
      } catch (parseError) {
        console.error(
          `[action.ts getManagerMethodEvents] Failed to parse JSON response ${parseError}`
        );
        return { detail: 'Received an invalid response from the server.' };
      }

      // TODO: Remove debug logging
      console.log(
        `[DEBUG][action.ts] getManagerMethodEvents status=${response.status}, logs count=${data?.logs?.length ?? 'N/A'}, count field=${data?.count ?? 'N/A'}`
      );
      if (data?.logs?.length > 0) {
        const firstLog = data.logs[0];
        const lastLog = data.logs[data.logs.length - 1];
        console.log(`[DEBUG][action.ts] First log ts=${firstLog.ts}, id=${firstLog.id}`);
        console.log(`[DEBUG][action.ts] Last log ts=${lastLog.ts}, id=${lastLog.id}`);
      }

      if (!response.ok) {
        const errorMessage = data.detail || `Failed to get events: ${response.statusText}`;
        return { detail: errorMessage };
      }

      // Orchestra returns entries in snake_case — convert to camelCase
      // so parseManagerMethodLog / the frontend types work correctly.
      // Also sort by id ascending (Orchestra returns newest-first by default).
      if (data?.logs) {
        data.logs = data.logs
          .map((log: any) => ({
            ...log,
            entries: snakeToCamelObject<Record<string, unknown>>(log.entries),
          }))
          .sort((a: any, b: any) => a.id - b.id);
      }

      return data as ActionsLogsResponse;
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
 * Filters by hierarchy_label prefix to get events for a specific node.
 *
 * @param apiKey - API key for authentication
 * @returns Async function to fetch ToolLoop events
 */
export const getToolLoopEvents = async (apiKey: string) => {
  return async (
    assistantId: string,
    hierarchyLabelPrefix: string,
    limit: number | null
  ): Promise<ActionsLogsResponse | ResponseProps> => {
    'use server';

    // Use mock data for UI testing
    if (USE_MOCK_DATA) {
      return getMockToolLoopEvents(assistantId, hierarchyLabelPrefix, limit);
    }

    try {
      const context = 'All/Events/ToolLoop';
      let url = `${process.env.NEXTAUTH_URL}/api/logs?projectName=Assistants&context=${context}`;

      // Build filter expression
      const filters: string[] = [
        buildAssistantIdFilter(assistantId),
        `hierarchy_label.startswith('${hierarchyLabelPrefix}')`,
      ];
      const filterExpr = combineFilters(filters);
      if (filterExpr) {
        url += `&filterExpr=${encodeURIComponent(filterExpr)}`;
      }

      // No server-side sorting — client sorts by id ascending.
      if (limit !== null) {
        url += `&limit=${limit}`;
      }

      const response = await fetch(url, { method: 'GET', headers: { apiKey: apiKey } });

      let data;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          console.error(
            `[action.ts getToolLoopEvents] Received non-JSON response with status ${response.status}`
          );
          return { detail: 'Received an invalid response from the server.' };
        }
      } catch (parseError) {
        console.error(`[action.ts getToolLoopEvents] Failed to parse JSON response ${parseError}`);
        return { detail: 'Received an invalid response from the server.' };
      }

      if (!response.ok) {
        const errorMessage =
          data.detail || `Failed to get tool loop events: ${response.statusText}`;
        return { detail: errorMessage };
      }

      // Orchestra returns entries in snake_case — convert to camelCase.
      // Sort by id ascending (Orchestra returns newest-first by default).
      if (data?.logs) {
        data.logs = data.logs
          .map((log: any) => ({
            ...log,
            entries: snakeToCamelObject<Record<string, unknown>>(log.entries),
          }))
          .sort((a: any, b: any) => a.id - b.id);
      }

      return data as ActionsLogsResponse;
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

      console.log(`[DEBUG][action.ts] backfillByCallingIds URL: ${url}`);

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
        const errorMessage =
          data.detail || `Failed to backfill events: ${response.statusText}`;
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
