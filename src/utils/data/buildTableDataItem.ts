import { TableDataItem, TileData } from "@/types/interfaces/grid";
import { GroupedLogProps, LogFieldsResponseProps, LogItemProps, LogProps, LogsResponseProps, GroupedLogPropsRaw } from "@/types/interfaces/logs";
import { buildFilterExpression } from "@/utils/interfaces/table/filters";
import { extractLogsData } from "@/utils/interfaces/common";
import { LogsActions } from "@/types/interfaces/grid";
import { processContext } from "@/utils/interfaces/table/columnOperations";
import { isGroupedLogs, maybeFlattenGroupedLogs } from "../interfaces/table/grouping";
import { QueryClient } from "@tanstack/react-query";

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
      // Find the first group key and get its group_count
      const firstGroupKey = Object.keys(groupedLogs).find(key => 
        key !== 'group_count' && key !== 'count' && 
        typeof groupedLogs[key] === 'object'
      );
      
      if (firstGroupKey && typeof groupedLogs[firstGroupKey] === 'object') {
        const groupData = groupedLogs[firstGroupKey] as any;
        return groupData.group_count || 0;
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

  // Process column contexts
  const prefixes = Object.keys(fields).map(
    key => key.includes("/") ? key.split("/").slice(0, -1).join("/") : null
  ).filter(key => key != null);

  const columnContexts = Array.from(
    new Set(prefixes.map(prefix => {
      const parts = prefix!.split("/");
      let context = "";
      return parts.map(part => {
        context += part + "/";
        return context;
      });    
    }).flat().sort())
  );

  // Get logs details WITHOUT metrics and boundaries for faster loading
  const textractLogsData = performance.now();
  const { entriesProperties, paramsProperties, logs, params } = extractLogsData(
    logsData,
    fields,
    tile.column_context || null,
    tile.table_tile?.sorting || null,
    tile.table_tile?.hidden_columns
  );
  const textractLogsDataExtract = performance.now();
  perfLog(`[perf] extractLogsData: ${(textractLogsDataExtract - textractLogsData).toFixed(2)} ms`);

  let newCells: string[] = [];
  if (previousLogs) {
    newCells = getNewCells(previousLogs, logs);
  }

  // Extract total count using utility function
  const totalCount = getTotalCountFromLogsResponse(logsData);
  const error = "detail" in logsData ? logsData["detail"] : undefined;

  // Construct table data item (without metrics and boundaries for now)
  const tableDataItem: TableDataItem = {
    columnContexts: columnContexts,
    fields,
    totalCount,
    entriesProperties,
    paramsProperties,
    logs,
    params,
    isLoading: false,
    newCells: newCells,
    error: error
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
  if (queryClient && tile.id && tile.tab_id && infiniteQueryKeys) {
    removeInfiniteLogsQueries(tile.id, tile.tab_id, queryClient, infiniteQueryKeys);
  }

  // If the tableDataItem for this tile is already in the cache, first mark it as loading
  if (queryClient && tile.id) {
    // Check if the tableDataItem for this tile is already in the cache meaning this isn't the 
    // initial render. If it is, mark it as loading.
    const existingTableDataItem = queryClient.getQueryData(["tableDataItem", tile.id]);
    if (existingTableDataItem) {
      queryClient.setQueryData(["tableDataItem", tile.id], {
        ...existingTableDataItem,
        isLoading: true
      });
    }
  }

  // Build filter expression
  const filterExpression = buildFilterExpression(
    tile.filters,
    tile.common_filter,
    tile.column_context,
    tile.freeze,
    fields
  );

  // Handle sorting
  const sortingObject = tile.table_tile?.sorting ? getSortingObject(tile) : "";
  const sortingExpression = sortingObject ? JSON.stringify(sortingObject) : null;

  // Handle grouping
  const groupingExpression = tile.grouping || null;

  // Handle group sorting
  const groupSortingObject = tile.table_tile?.group_sorting && tile.grouping ? 
    getGroupSortingObject(tile) : "";
  const groupSortingExpression = groupSortingObject ? JSON.stringify(groupSortingObject) : null;

  // Fetch logs data
  const limit = tile.table_tile?.limit ?? 20;
  const offset = tile.table_tile?.offset ?? 0;
  const group_limit = tile.table_tile?.group_limit ?? 20;
  const group_offset = tile.table_tile?.group_offset ?? 0;

  // Determine if we should use group pagination or regular pagination
  const useGroupPagination = !!groupingExpression;
  
  const tGetLogs = performance.now();
  const logsData: LogsResponseProps = await logsActions.get(
    projectId,
    tile.context || null,
    tile.column_context || null,
    filterExpression,
    sortingExpression,
    groupingExpression,
    groupSortingExpression,
    null,
    null,
    null,
    useGroupPagination ? null : limit, // Regular limit (not used for groups)
    useGroupPagination ? null : offset, // Regular offset (not used for groups)
    useGroupPagination ? group_limit : null, // Group limit (used for groups)
    useGroupPagination ? group_offset : null, // Group offset (used for groups)
    useGroupPagination ? 0 : null, // Group depth (used for groups)
    null,
    null,
    null, 
    signal
  );
  const tGetLogsEnd = performance.now();
  perfLog(`[perf] getLogs: ${(tGetLogsEnd - tGetLogs).toFixed(2)} ms`);

  // Build table data item using the fetched logs data
  const tBuildTableDataItem = performance.now();
  const tableDataItem = await buildTableDataItem(tile, fields, logsData, previousLogs);
  const tBuildTableDataItemEnd = performance.now();
  perfLog(`[perf] buildTableDataItem: ${(tBuildTableDataItemEnd - tBuildTableDataItem).toFixed(2)} ms`);

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
export function removeInfiniteLogsQueries(tileId: string, tabId: string, queryClient: QueryClient, queryKeys?: string[]) {
  // Remove all infinite logs queries for the current table
  if (queryKeys && queryKeys.length > 0) {
    // Remove specific tracked query keys
    queryKeys.forEach(queryKey => {
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
        queryKey[0] === 'logs' &&  // First element is always 'logs'
        (queryKey[1] === 'infinite' || queryKey[1] === 'group-specific') &&  // Second element is type
        queryKey[2] === tileId &&  // Third element is tileId
        queryKey[3] === tabId      // Fourth element is tabId
      );
    }
  });
}

/**
 * Helper function to get sorting object from tile
 */
export function getSortingObject(tile: TileData) {
  if (!tile.table_tile?.sorting) return "";
  
  const { column_context, table_tile } = tile;
  const sorting = table_tile?.sorting || "";
  
  return Object.fromEntries(
    sorting.split(",").map(value => {
      const fieldName = value.split("@")[0];
      const processedField = column_context
        ? processContext("merge", column_context, fieldName) 
        : fieldName;
      const direction = value.split("@")[1].replace("true", "descending").replace("false", "ascending");
      return [processedField, direction];
    })
  );
}

/**
 * Helper function to get group sorting object from tile
 */
export function getGroupSortingObject(tile: TileData) {
  if (!tile.table_tile?.group_sorting || !tile.grouping) return "";
  
  const { column_context, table_tile, grouping, metric } = tile;
  const groupSorting = table_tile?.group_sorting || "";
  
  return Object.fromEntries(
    groupSorting.split(",").map(value => {
      const group = column_context && grouping
        ? processContext("merge", column_context, grouping.split(",")[0]) 
        : grouping!.split(",")[0];
      
      const field = column_context && value.split("@")[0]
        ? processContext("merge", column_context, value.split("@")[0]) 
        : value.split("@")[0];
      
      const direction = value.split("@")[1].replace("true", "descending").replace("false", "ascending");
      return [group, {field, direction, metric: metric ?? "mean"}];
    })
  );
} 

/**
 * Helper function to identify new cells in the table
 */
export function getNewCells(previousLogs: LogProps[] | GroupedLogProps[], logs: LogProps[] | GroupedLogProps[]) {
  let newCells: string[] = [];
    const flattenedLogs = maybeFlattenGroupedLogs(logs);
    if (flattenedLogs.length) {
        const flattenedTableLogs = maybeFlattenGroupedLogs(previousLogs)
        const previousCells = flattenedTableLogs.flatMap(log => {
            const entryCells = Object.keys(log.entries as LogItemProps).map(key => `${log.id}_${key}`);
            const paramCells = Object.keys(log.params as LogItemProps).map(key => `${log.id}_${key}`);
            return entryCells.concat(paramCells);
        });
        newCells = flattenedLogs.flatMap(log => {
            const entryCells = Object.keys(log.entries as LogItemProps).map(key => `${log.id}_${key}`);
            const paramCells = Object.keys(log.params as LogItemProps).map(key => `${log.id}_${key}`);
            return entryCells.concat(paramCells);
        });
        newCells = newCells.filter(id => !previousCells.includes(id));
    }
    return newCells;
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
  const existingIds = new Set(existingLogs.map(log => log.id));
  
  // Filter new logs to only include those not already present
  return newLogs.filter(log => !existingIds.has(log.id));
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