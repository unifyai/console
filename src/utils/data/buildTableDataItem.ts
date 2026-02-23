import { TableDataItem, TileData } from '@/types/interfaces/grid';
import {
  GroupedLogProps,
  LogFieldsResponseProps,
  LogItemProps,
  LogProps,
  LogsResponseProps,
  GroupedLogPropsRaw,
} from '@/types/interfaces/logs';
import { buildFilterExpression } from '@/utils/interfaces/table/filters';
import { extractLogsData } from '@/utils/interfaces/common';
import { LogsActions } from '@/types/interfaces/grid';
import { processContext, sanitizeId } from '@/utils/interfaces/table/columnOperations';
import { isGroupedLogs, maybeFlattenGroupedLogs } from '../interfaces/table/grouping';
import { QueryClient } from '@tanstack/react-query';
import { isEqual } from 'lodash';
import { perfStart, perfEnd } from '@/lib/perf';

// Global semaphore to cap concurrent logs fetches
const MAX_LOGS_CONCURRENCY = 3;
let currentLogsConcurrency = 0;
const logsQueue: Array<() => void> = [];

async function withLogsSemaphore<T>(fn: () => Promise<T>): Promise<T> {
  if (currentLogsConcurrency >= MAX_LOGS_CONCURRENCY) {
    await new Promise<void>((resolve) => logsQueue.push(resolve));
  }
  currentLogsConcurrency++;
  try {
    return await fn();
  } finally {
    currentLogsConcurrency--;
    const next = logsQueue.shift();
    if (next) next();
  }
}

/**
 * Debug flag for performance logging
 * Set NEXT_PUBLIC_DEBUG_PERFORMANCE=true to enable detailed performance timing logs
 */
const DEBUG_PERFORMANCE = process.env.NEXT_PUBLIC_DEBUG_PERFORMANCE === 'true';

/**
 * Conditional debug logger for performance metrics
 */
const perfLog = (...args: any[]) => {
  if (DEBUG_PERFORMANCE) {
    console.log(...args);
  }
};

/**
 * Utility function to extract total count from logs response
 * Handles both ungrouped and grouped log responses
 */
export function getTotalCountFromLogsResponse(logsData: LogsResponseProps): number {
  const isGrouped = isGroupedLogs(logsData.logs);
  if (isGrouped) {
    // For grouped logs, check if it's GroupedLogPropsRaw format
    if (typeof logsData.logs === 'object' && !Array.isArray(logsData.logs)) {
      const groupedLogs = logsData.logs as GroupedLogPropsRaw;
      // Find the first group key and get its groupCount
      const firstGroupKey = Object.keys(groupedLogs).find(
        (key) => key !== 'groupCount' && key !== 'count' && typeof groupedLogs[key] === 'object'
      );

      if (firstGroupKey && typeof groupedLogs[firstGroupKey] === 'object') {
        const groupData = groupedLogs[firstGroupKey] as any;
        return groupData.groupCount || 0;
      }
    }
    // Fallback to regular count
    return logsData.count || 0;
  } else {
    // For ungrouped logs, use the regular count
    return logsData.count || 0;
  }
}

/**
 * Builds a TableDataItem from logs data and other inputs
 * Can be used directly in client components instead of passing through a server component
 * Now optimized to load main table data fast while triggering metrics/boundaries in background
 */
async function buildTableDataItem(
  tile: TileData,
  fields: LogFieldsResponseProps,
  logsData: LogsResponseProps,
  previousLogs?: LogProps[] | GroupedLogProps[]
): Promise<TableDataItem> {
  // Check if fields indicates context not found (from buildServerData.ts)
  const fieldsContextNotFound =
    '__contextNotFound' in fields && (fields as any).__contextNotFound === true;

  // Process column contexts
  const prefixes = Object.keys(fields)
    .filter((k) => k !== '__contextNotFound')
    .map((key) => (key.includes('/') ? key.split('/').slice(0, -1).join('/') : null))
    .filter((key) => key != null);

  const columnContexts = Array.from(
    new Set(
      prefixes
        .map((prefix) => {
          const parts = prefix!.split('/');
          let context = '';
          return parts.map((part) => {
            context += part + '/';
            return context;
          });
        })
        .flat()
        .sort()
    )
  );

  // Get logs details WITHOUT metrics and boundaries for faster loading
  const textractLogsData = performance.now();
  const { entriesProperties, logs } = extractLogsData(
    logsData,
    fields,
    tile.columnContext || null,
    tile.tableTile?.sorting || null,
    tile.tableTile?.hiddenColumns
  );
  const textractLogsDataExtract = performance.now();
  perfLog(`[perf] extractLogsData: ${(textractLogsDataExtract - textractLogsData).toFixed(2)} ms`);

  let newCells: string[] = [];
  if (previousLogs) {
    newCells = getNewCells(previousLogs, logs);
  }

  // Extract total count using utility function
  const totalCount = getTotalCountFromLogsResponse(logsData);
  const error = 'detail' in logsData ? logsData['detail'] : undefined;
  // Context not found if either fields or logs returned 404
  const logsContextNotFound =
    'contextNotFound' in logsData ? (logsData['contextNotFound'] as boolean) : false;
  const contextNotFound = fieldsContextNotFound || logsContextNotFound || undefined;

  // Construct table data item (without metrics and boundaries for now)
  const tableDataItem: TableDataItem = {
    columnContexts: columnContexts,
    fields,
    totalCount,
    entriesProperties,
    logs,
    isLoading: false,
    newCells: newCells,
    error: error,
    contextNotFound: contextNotFound,
  };

  return tableDataItem;
}

/**
 * Fetches logs data and then builds a TableDataItem
 * Useful for server components or client components that need to fetch fresh data
 */
export async function fetchAndBuildTableDataItem(
  tile: TileData,
  fields: LogFieldsResponseProps,
  projectId: string,
  logsActions: LogsActions,
  queryClient?: QueryClient,
  infiniteQueryKeys?: string[],
  previousLogs?: LogProps[] | GroupedLogProps[],
  signal?: AbortSignal
): Promise<TableDataItem> {
  // Remove all infinite logs queries for this tile before fetching fresh data
  if (queryClient && tile.id && tile.tabId && infiniteQueryKeys) {
    removeInfiniteLogsQueries(tile.id, tile.tabId, queryClient, infiniteQueryKeys);
  }

  // If the tableDataItem for this tile is already in the cache, first mark it as loading
  if (queryClient && tile.id) {
    // Check if the tableDataItem for this tile is already in the cache meaning this isn't the
    // initial render. If it is, mark it as loading.
    const existingTableDataItem = queryClient.getQueryData(['tableDataItem', tile.id]);
    if (existingTableDataItem) {
      queryClient.setQueryData(['tableDataItem', tile.id], {
        ...existingTableDataItem,
        isLoading: true,
      });
    }
  }

  // Build filter expression
  const filterExpression = buildFilterExpression(
    tile.filters,
    tile.commonFilter,
    tile.columnContext,
    tile.freeze,
    fields
  );

  // Handle sorting
  const sortingObject = tile.tableTile?.sorting ? getSortingObject(tile) : '';
  const sortingExpression = sortingObject ? JSON.stringify(sortingObject) : null;

  // Handle grouping
  const groupingExpression = tile.grouping || null;

  // Handle group sorting
  const groupSortingObject =
    tile.tableTile?.groupSorting && tile.grouping ? getGroupSortingObject(tile) : '';
  const groupSortingExpression = groupSortingObject ? JSON.stringify(groupSortingObject) : null;

  // Fetch logs data
  const limit = tile.tableTile?.limit ?? 20;
  const offset = tile.tableTile?.offset ?? 0;
  const groupLimit = tile.tableTile?.groupLimit ?? 20;
  const groupOffset = tile.tableTile?.groupOffset ?? 0;

  // Determine if we should use group pagination or regular pagination
  const useGroupPagination = !!groupingExpression;

  const tGetLogs = performance.now();
  let logsData: LogsResponseProps;
  try {
    // Call API route directly instead of server action to avoid POST /interfaces spam
    // Build query string with all parameters
    const params = new URLSearchParams();
    params.set('projectName', projectId);
    if (tile.context) params.set('context', tile.context);
    if (tile.columnContext) params.set('columnContext', tile.columnContext);
    if (filterExpression) params.set('filterExpr', filterExpression);
    if (sortingExpression) params.set('sorting', sortingExpression);
    if (groupSortingExpression) params.set('groupSorting', groupSortingExpression);

    // DISABLED: fromFields narrowing was causing missing column data (Bug #15 & #16)
    //
    // When from_fields is set, Orchestra filters log entries to only include
    // those fields. However, this was causing valid fields (like 'rowId') to
    // be missing from the response even though they exist in the schema.
    //
    // Root cause: Orchestra's from_fields parameter requires exact field name
    // matches. Any mismatch (case, prefix, format) causes fields to be filtered out.
    //
    // The infinite query path (fetchLogsCore) doesn't use from_fields and works
    // correctly. For consistency and reliability, we now fetch all fields on
    // initial load as well.
    //
    // Performance impact: Slightly larger payload on initial load, but this
    // ensures all column data is available and prevents empty columns.
    //
    // Symptoms this fixes:
    // - Column headers appear but values are empty on initial page load
    // - Hidden columns have no data when unhidden after page refresh
    // - Data appears correctly only after re-selecting the context

    // Handle grouping (can be multiple values)
    if (groupingExpression) {
      groupingExpression.split(',').forEach((expr) => {
        params.append('groupBy', expr.trim());
      });
    }

    // Pagination params
    if (!useGroupPagination && limit !== null) params.set('limit', limit.toString());
    if (!useGroupPagination && offset !== null) params.set('offset', offset.toString());
    if (useGroupPagination && groupLimit !== null) params.set('groupLimit', groupLimit.toString());
    if (useGroupPagination && groupOffset !== null)
      params.set('groupOffset', groupOffset.toString());
    if (useGroupPagination) params.set('groupDepth', '0');

    const pFetch = perfStart(`logs-fetch:${tile.name}:${projectId}`);
    const res = await withLogsSemaphore(() =>
      fetch(`/api/logs?${params.toString()}`, {
        method: 'GET',
        signal: signal as AbortSignal,
        cache: 'no-store',
      })
    );
    perfEnd(pFetch, { status: res.status });

    // Handle 404 (context not found) specially - don't throw, return contextNotFound flag
    if (res.status === 404) {
      const errorData = await res.json().catch(() => ({ detail: `Context not found` }));
      console.warn('[buildTableDataItem] Context not found for tile:', tile.name, errorData.detail);
      return {
        columnContexts: [],
        fields,
        totalCount: 0,
        entriesProperties: [],
        logs: [],
        isLoading: false,
        error: errorData.detail || `Context '${tile.context}' not found`,
        contextNotFound: true, // Key flag for overlay
        newCells: [],
      } as TableDataItem;
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: `Logs ${res.status}` }));
      throw new Error(errorData.detail || `Failed to fetch logs: ${res.status}`);
    }

    logsData = await res.json();
  } catch (err: any) {
    const errorMsg = err?.message || 'Failed to fetch logs';
    // Check if error message indicates context not found (from our 404 handler or API)
    const isContextNotFound = errorMsg.toLowerCase().includes('not found');
    console.error('[buildTableDataItem] Logs fetch failed for tile:', tile.name, errorMsg);

    // Gracefully surface a minimal item so the tile can display Retry or Context Not Found
    return {
      columnContexts: [],
      fields,
      totalCount: 0,
      entriesProperties: [],
      logs: [],
      isLoading: false,
      error: errorMsg,
      contextNotFound: isContextNotFound,
      newCells: [],
    } as TableDataItem;
  }
  const tGetLogsEnd = performance.now();
  perfLog(`[perf] getLogs: ${(tGetLogsEnd - tGetLogs).toFixed(2)} ms`);

  // Build table data item using the fetched logs data
  const tBuildTableDataItem = performance.now();
  const pBuild = perfStart(`table-build:${tile.name}:${projectId}`);
  const tableDataItem = await buildTableDataItem(tile, fields, logsData, previousLogs);
  const tBuildTableDataItemEnd = performance.now();
  perfLog(
    `[perf] buildTableDataItem: ${(tBuildTableDataItemEnd - tBuildTableDataItem).toFixed(2)} ms`
  );
  perfEnd(pBuild, { rows: Array.isArray(tableDataItem.logs) ? tableDataItem.logs.length : 0 });

  return tableDataItem;
}

/*
 * Remove all of the infinite logs queries for the current table. This is called
 * from `fetchAndBuildTableDataItem` to ensure that the infinite logs queries
 * are removed before the new logs data is fetched.
 *
 * This is necessary because the infinite logs queries are not invalidated
 * when the logs data is fetched. This is a bug in the infinite logs queries
 * and will be fixed in the future.
 */
export function removeInfiniteLogsQueries(
  tileId: string,
  tabId: string,
  queryClient: QueryClient,
  queryKeys?: string[]
) {
  // Remove all infinite logs queries for the current table
  if (queryKeys && queryKeys.length > 0) {
    // Remove specific tracked query keys
    queryKeys.forEach((queryKey) => {
      try {
        const parsedKey = JSON.parse(queryKey);
        queryClient.removeQueries({ queryKey: parsedKey });
      } catch (error) {
        console.warn(`[removeInfiniteLogsQueries] Failed to parse query key: ${queryKey}`, error);
      }
    });
    return;
  }

  // Also remove queries by pattern as a fallback to match buildLogQueryKey structure
  queryClient.removeQueries({
    predicate: (query) => {
      const queryKey = query.queryKey;
      return (
        Array.isArray(queryKey) &&
        queryKey.length >= 4 &&
        queryKey[0] === 'logs' && // First element is always 'logs'
        (queryKey[1] === 'infinite' || queryKey[1] === 'group-specific') && // Second element is type
        queryKey[2] === tileId && // Third element is tileId
        queryKey[3] === tabId // Fourth element is tabId
      );
    },
  });
}

/**
 * Helper function to get sorting object from tile
 */
export function getSortingObject(tile: TileData) {
  if (!tile.tableTile?.sorting) return '';

  const { columnContext, tableTile } = tile;
  const sorting = tableTile?.sorting || '';

  return Object.fromEntries(
    sorting.split(',').map((value) => {
      const fieldName = value.split('@')[0];
      const processedField = columnContext
        ? processContext('merge', columnContext, fieldName)
        : fieldName;
      const direction = value
        .split('@')[1]
        .replace('true', 'descending')
        .replace('false', 'ascending');
      return [processedField, direction];
    })
  );
}

/**
 * Helper function to get group sorting object from tile
 */
export function getGroupSortingObject(tile: TileData) {
  if (!tile.tableTile?.groupSorting || !tile.grouping) return '';

  const { columnContext, tableTile, grouping, metric } = tile;
  const groupSorting = tableTile?.groupSorting || '';

  return Object.fromEntries(
    groupSorting.split(',').map((value) => {
      const group =
        columnContext && grouping
          ? processContext('merge', columnContext, grouping.split(',')[0])
          : grouping!.split(',')[0];

      const field =
        columnContext && value.split('@')[0]
          ? processContext('merge', columnContext, value.split('@')[0])
          : value.split('@')[0];

      const direction = value
        .split('@')[1]
        .replace('true', 'descending')
        .replace('false', 'ascending');
      return [group, { field, direction, metric: metric ?? 'mean' }];
    })
  );
}

/**
 * Helper function to identify new or updated cells in the table.
 * It compares previous logs with new logs to find:
 * 1. Cells in entirely new rows.
 * 2. Cells in existing rows where the value has changed.
 */
export function getNewCells(
  previousLogs: LogProps[] | GroupedLogProps[],
  logs: LogProps[] | GroupedLogProps[]
): string[] {
  const newOrUpdatedCellIds: string[] = [];

  const flattenedCurrentLogs = maybeFlattenGroupedLogs(logs);
  const flattenedPreviousLogs = maybeFlattenGroupedLogs(previousLogs);

  if (!flattenedCurrentLogs.length) {
    return [];
  }

  const previousLogsMap = new Map(flattenedPreviousLogs.map((log) => [log.id, log]));

  for (const currentLog of flattenedCurrentLogs) {
    const previousLog = previousLogsMap.get(currentLog.id);

    if (!previousLog) {
      const entryCells = Object.keys(currentLog.entries || {}).map(
        (key) => `${currentLog.id}_${key}`
      );
      newOrUpdatedCellIds.push(...entryCells);
      continue;
    }

    const checkAndUpdate = (
      currentData: LogItemProps,
      previousData: LogItemProps,
      logId: string
    ) => {
      for (const key in currentData) {
        const currentValue = currentData[key];
        const previousValue = previousData[key];
        const cellId = `${logId}_${key}`;

        const valuesAreEqual = isEqual(currentValue, previousValue);

        if (!Object.prototype.hasOwnProperty.call(previousData, key)) {
          newOrUpdatedCellIds.push(cellId);
        } else if (!valuesAreEqual) {
          newOrUpdatedCellIds.push(cellId);
        }
      }
    };

    checkAndUpdate(currentLog.entries || {}, previousLog.entries || {}, currentLog.id);
  }
  return newOrUpdatedCellIds;
}

/**
 * Filters out logs that already exist in the existing logs based on unique ID comparison.
 * Works for both LogProps[] and GroupedLogProps[] arrays.
 *
 * @param existingLogs - The current logs in the table
 * @param newLogs - The newly fetched logs that might contain duplicates
 * @returns Array of logs from newLogs that don't exist in existingLogs
 */
export function filterNewLogsById<T extends LogProps | GroupedLogProps>(
  existingLogs: T[],
  newLogs: T[]
): T[] {
  if (!existingLogs.length) {
    // No existing logs, all new logs are actually new
    return newLogs;
  }

  if (!newLogs.length) {
    // No new logs to filter
    return [];
  }

  // Create a Set of existing log IDs for fast lookup
  const existingIds = new Set(existingLogs.map((log) => log.id));

  // Filter new logs to only include those not already present
  return newLogs.filter((log) => !existingIds.has(log.id));
}

/**
 * Filters out logs that already exist in nested subRows based on unique ID comparison.
 * This is specifically for grouped logs where we need to check subRows within a specific group.
 *
 * @param existingSubRows - The current subRows in a specific group
 * @param newSubRows - The newly fetched subRows that might contain duplicates
 * @returns Array of subRows from newSubRows that don't exist in existingSubRows
 */
export function filterNewSubRowsById<T extends LogProps | GroupedLogProps>(
  existingSubRows: T[],
  newSubRows: T[]
): T[] {
  return filterNewLogsById(existingSubRows, newSubRows);
}
